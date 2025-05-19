const express = require("express");
const bodyParser = require("body-parser");
const { ingestFeedback } = require("../ingestion/mcpServer");
const { extractPainPoints } = require("../ai/extractor");
const { createInsightsCard } = require("./adaptiveCard");
const {
  BotFrameworkAdapter,
  ActivityHandler,
  CardFactory,
  MessageFactory,
} = require("botbuilder");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(bodyParser.json());

const adapter = new BotFrameworkAdapter({
  appId: process.env.MICROSOFT_APP_ID || "",
  appPassword: process.env.MICROSOFT_APP_PASSWORD || "",
});

async function extractValidInsight(
  feedback,
  timeoutMs = 5 * 60 * 1000,
  delayMs = 1000
) {
  const start = Date.now();
  let attempt = 0;

  const normalizeInsight = (str) => {
    try {
      const obj = typeof str === "string" ? JSON.parse(str) : str;
      return {
        painPoint: obj.pain_point_summary,
        sentiment: obj.sentiment,
        featureArea: obj.feature_area,
        source: obj.source
      };
    } catch (err) {
      return null;
    }
  };

  while (Date.now() - start < timeoutMs) {
    attempt++;
    const rawResult = await extractPainPoints(feedback);

    const candidates = Array.isArray(rawResult) ? rawResult : [rawResult];
    for (const candidate of candidates) {
      const insight = normalizeInsight(candidate);

      const isValid =
        insight &&
        insight.painPoint &&
        ["Positive", "Negative", "Neutral"].includes(insight.sentiment) &&
        insight.featureArea;

      if (isValid) {
        console.log(`✅ Valid insight found on attempt ${attempt}`);
        return { insight, attempts: attempt };
      }
    }

    console.warn(
      `⏳ Attempt ${attempt}: Invalid result -`,
      JSON.stringify(rawResult, null, 2)
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.error("⛔ Timed out after 5 minutes without a valid insight.");
  return null;
}

class LocalBot extends ActivityHandler {
  constructor() {
    super();
    this.insights = [];

    this.onMessage(async (context, next) => {
      const userText = context.activity.text?.toLowerCase().trim();

      if (userText.includes("pain points")) {
        await context.sendActivities([
          { type: "typing" },
          { type: "delay", value: 1000 },
          {
            type: "message",
            text: "🔍 Gathering recent feedback for analysis...",
          },
        ]);

        try {
          const feedbacks = await ingestFeedback();
          const insights = [];

          for (let i = 0; i < 5; i++) {
            await context.sendActivities([
              { type: "typing" },
              { type: "delay", value: 800 },
              {
                type: "message",
                text: `🧠 Analyzing feedback ${i + 1} of ${
                  feedbacks.length
                }...`,
              },
              {
                type: "message",
                text: `⏳ Progress: ${Math.round(
                  ((i + 1) / feedbacks.length) * 100
                )}%`,
              },
            ]);

            const result = await extractValidInsight(feedbacks[i]);
            if (result?.insight) {
              insights.push({
                ...result.insight,
                attempts: result.attempts,
                original: feedbacks[i],
              });
            }
          }

          if (insights.length === 0) {
            await context.sendActivity(
              "😞 Sorry, I couldn't extract any insights this time."
            );
          }

          this.insights = insights;

          const cards = feedbacks.map((feedback, index) => {
            const matchingInsight = insights.find(
              (ins) => ins.original === feedback
            );
            console.log("Matching Insight:", matchingInsight);
            const card = createInsightsCard(
              `Feedback ${index + 1}`,
              matchingInsight ?? {
                painPoint: "❌ No insight extracted",
                sentiment: "N/A",
                featureArea: "N/A",
              }
            );
            if (matchingInsight) {
              card.body.push({
                type: "TextBlock",
                text: `🌀 Extracted after ${matchingInsight.attempts} attempt(s)`,
                isSubtle: true,
                size: "Small",
              });
            }
            return CardFactory.adaptiveCard(card);
          });

          await context.sendActivity({ type: "message", attachments: cards });

          await context.sendActivity(
            "✅ Done! You can now ask me questions like:\n- 'What percentage is neutral?'\n- 'How many positive pain points?'\n- 'Show me negative feedback'."
          );
        } catch (err) {
          console.error(err);
          await context.sendActivity(
            "❌ Something went wrong while processing."
          );
        }
      }

      // Handle user queries about extracted insights
      else if (this.insights.length > 0) {
        const total = this.insights.length;
        const sentimentMatch = /(positive|neutral|negative)/.exec(userText);
        if (sentimentMatch) {
          const sentiment = sentimentMatch[1];
          const count = this.insights.filter(
            (i) => i.sentiment.toLowerCase() === sentiment
          ).length;
          const percentage = ((count / total) * 100).toFixed(1);
          await context.sendActivity(
            `📊 ${
              sentiment.charAt(0).toUpperCase() + sentiment.slice(1)
            } feedback: ${count}/${total} (${percentage}%)`
          );
        } else if (userText.includes("show") || userText.includes("list")) {
          const filtered = this.insights.filter(
            (i) => i.sentiment.toLowerCase() === "negative"
          );
          if (filtered.length > 0) {
            await context.sendActivity(
              `📌 Here are some negative pain points:`
            );
            for (const i of filtered.slice(0, 5)) {
              await context.sendActivity(
                `• ${i.painPoint} (Feature: ${i.featureArea})`
              );
            }
          } else {
            await context.sendActivity("🤷 No matching pain points found.");
          }
        } else {
          await context.sendActivity(
            "❓ You can ask things like:\n- 'What percent is neutral?'\n- 'Show me positive feedback'."
          );
        }
      } else {
        await context.sendActivity(
          "👋 Hi! You can type **'pain points'** to begin, and ask me questions after that."
        );
      }

      await next();
    });
  }
}

const bot = new LocalBot();

app.post("/api/messages", (req, res) => {
  adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Bot is running at http://localhost:${PORT}/api/messages`)
);
