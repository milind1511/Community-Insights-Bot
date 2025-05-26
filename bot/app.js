let progressActivityId = null;
let progressConversationReference = null;

async function sendProgressBar(
  adapter,
  conversationReference,
  progressId,
  current,
  total
) {
  const progress = Math.floor((current / total) * 10);
  const bar = "▓".repeat(progress) + "░".repeat(10 - progress);
  const percent = Math.floor((current / total) * 100);

  const progressCard = {
    type: "message",
    attachments: [
      CardFactory.adaptiveCard({
        type: "AdaptiveCard",
        version: "1.3",
        body: [
          {
            type: "TextBlock",
            text: `🧩 Progress: [${bar}] ${percent}%`,
            wrap: true,
            weight: "Bolder",
          },
        ],
      }),
    ],
  };

  return await adapter.continueConversation(
    conversationReference,
    async (progrContext) => {
      if (progressId) {
        await progrContext.updateActivity({
          ...progressCard,
          id: progressId,
          conversation: conversationReference.conversation,
        });
        return progressId;
      } else {
        const sent = await progrContext.sendActivity(progressCard);
        return sent.id;
      }
    }
  );
}

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
  TurnContext,
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
  timeoutMs = 0.5 * 60 * 1000,
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
        source: obj.source,
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

  console.error("⛔ Timed out after 30 seconds without a valid insight.");
  return null;
}

class LocalBot extends ActivityHandler {
  constructor() {
    super();
    this.insights = [];
    this.lastFeedbacks = [];
    this.lastFeedbackIndex = 0;

    this.onMessage(async (context, next) => {
      const userText = context.activity.text?.toLowerCase().trim();

      // Start or restart analysis
      if (
        userText.includes("start analysis") ||
        userText.includes("next analysis") ||
        userText.includes("analyze next")
      ) {
        progressActivityId = null;
        progressConversationReference = TurnContext.getConversationReference(
          context.activity
        );

        await context.sendActivities([
          { type: "typing" },
          { type: "delay", value: 1000 },
          {
            type: "message",
            text: userText.includes("next")
              ? "🔄 Analyzing next set of feedback..."
              : "🔍 Gathering recent feedback for analysis...",
          },
        ]);

        try {
          // Optionally, you could page through feedbacks if your ingestFeedback supports it
          // For now, just re-ingest and analyze a new set
          const feedbacks = await ingestFeedback();
          this.lastFeedbacks = feedbacks;
          this.lastFeedbackIndex = 0;
          const insights = [];

          await context.sendActivity(
            `🧠 Analyzing ${feedbacks.length} feedback entries...`
          );

          for (let i = 0; i < feedbacks.length; i++) {
            progressActivityId = await sendProgressBar(
              adapter,
              progressConversationReference,
              progressActivityId,
              i + 1,
              feedbacks.length
            );

            const result = await extractValidInsight(feedbacks[i]);
            if (result?.insight) {
              insights.push({
                ...result.insight,
                attempts: result.attempts,
                original: feedbacks[i],
              });
            }
          }

          console.log("Extracted insights:", insights);

          if (insights.length === 0) {
            await context.sendActivity(
              "😞 Sorry, I couldn't extract any insights this time."
            );
          } else {
            this.insights = insights;
            await context.sendActivity(
              `✅ Analysis complete! Extracted ${insights.length} insights from ${feedbacks.length} feedback entries.`
            );
          }
        } catch (err) {
          console.error(err);
          await context.sendActivity(
            "❌ Something went wrong while processing."
          );
        }
      }
      // Statistical queries
      else if (this.insights.length > 0 && (
        userText.includes("how many") ||
        userText.includes("what percent") ||
        userText.includes("average attempts") ||
        userText.includes("show stats") ||
        userText.includes("statistics")
      )) {
        const total = this.insights.length;
        const sentiments = ["positive", "neutral", "negative"];
        let reply = "";

        // Sentiment counts and percentages
        sentiments.forEach((sentiment) => {
          const count = this.insights.filter(
            (i) => i.sentiment.toLowerCase() === sentiment
          ).length;
          const percent = ((count / total) * 100).toFixed(1);
          reply += `\n${sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}: ${count} (${percent}%)`;
        });

        // Average attempts per sentiment
        sentiments.forEach((sentiment) => {
          const filtered = this.insights.filter(
            (i) => i.sentiment.toLowerCase() === sentiment
          );
          if (filtered.length > 0) {
            const avgAttempts = (
              filtered.reduce((sum, i) => sum + (i.attempts || 1), 0) /
              filtered.length
            ).toFixed(2);
            reply += `\nAvg attempts for ${sentiment}: ${avgAttempts}`;
          }
        });

        // Feature area stats
        const featureAreas = {};
        this.insights.forEach((i) => {
          if (i.featureArea) {
            featureAreas[i.featureArea] = (featureAreas[i.featureArea] || 0) + 1;
          }
        });
        if (Object.keys(featureAreas).length > 0) {
          reply += "\n\nFeature Area Distribution:";
          Object.entries(featureAreas).forEach(([area, count]) => {
            reply += `\n- ${area}: ${count} (${((count / total) * 100).toFixed(1)}%)`;
          });
        }

        await context.sendActivity("📊 Analysis statistics:" + reply);
      } else if (this.insights.length > 0) {
        const total = this.insights.length;
        const sentimentMatch = /(positive|neutral|negative)/.exec(userText);

        const generateCardsFromInsights = (insightsSubset) => {
          return insightsSubset.map((insight, index) => {
            const card = createInsightsCard(`Insight ${index + 1}`, insight);
            card.body.push({
              type: "TextBlock",
              text: `🌀 Extracted after ${insight.attempts} attempt(s)`,
              isSubtle: true,
              size: "Small",
            });
            return CardFactory.adaptiveCard(card);
          });
        };

        if (userText.includes("show all") || userText.includes("list all")) {
          const cards = generateCardsFromInsights(this.insights);
          await context.sendActivity("📋 Showing all extracted feedback:");
          for (const card of cards.slice(0, this.insights.length)) {
            await context.sendActivity({ attachments: [card] });
          }
        } else if (
          sentimentMatch &&
          (userText.includes("show") || userText.includes("list"))
        ) {
          const sentiment = sentimentMatch[1];
          const filtered = this.insights.filter(
            (i) => i.sentiment.toLowerCase() === sentiment
          );
          if (filtered.length > 0) {
            const cards = generateCardsFromInsights(filtered);
            await context.sendActivity(`📋 Showing ${sentiment} feedback:`);
            for (const card of cards.slice(0, this.insights.length)) {
              await context.sendActivity({ attachments: [card] });
            }
          } else {
            await context.sendActivity(`🤷 No ${sentiment} feedback found.`);
          }
        } else if (sentimentMatch) {
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
        } else {
          await context.sendActivity(
            "❓ You can ask things like:\n- 'What percent is neutral?'\n- 'Show me positive feedback'\n- 'List all feedback'\n- 'Show stats'"
          );
        }
      } else {
        await context.sendActivity(
          "👋 Hi! You can type **'Start Analysis'** to begin, and ask me questions after that."
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
