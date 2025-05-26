// localBot.js
const { ActivityHandler, TurnContext, CardFactory } = require("botbuilder");
const { ingestFeedback } = require("../ingestion/mcpServer");
const { extractPainPoints } = require("../ai/extractor");
const { createInsightsCard } = require("./adaptiveCard");
const { getEmbedding, cosineSimilarity, insightEmbeddings, setInsightEmbeddings } = require("./embeddings");

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
  constructor(options) {
    super();
    this.adapter = options.adapter;
    this.ingestFeedback = options.ingestFeedback;
    this.extractPainPoints = options.extractPainPoints;
    this.createInsightsCard = options.createInsightsCard;
    this.getEmbedding = options.getEmbedding;
    this.cosineSimilarity = options.cosineSimilarity;
    this.insightEmbeddings = options.insightEmbeddings;
    this.setInsightEmbeddings = options.setInsightEmbeddings;
    this.insights = [];
    this.lastFeedbacks = [];
    this.lastFeedbackIndex = 0;

    this.onMessage(async (context, next) => {
      try {
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
            const feedbacks = await this.ingestFeedback();
            this.lastFeedbacks = feedbacks;
            this.lastFeedbackIndex = 0;
            const insights = [];

            await context.sendActivity(
              `🧠 Analyzing ${feedbacks.length} feedback entries...`
            );

            for (let i = 0; i < feedbacks.length; i++) {
              progressActivityId = await sendProgressBar(
                this.adapter,
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

            // Generate and store embeddings for all insights
            if (insights.length > 0) {
              let embeddingsArr = [];
              for (const insight of insights) {
                const text = `${insight.painPoint} ${insight.sentiment} ${insight.featureArea}`;
                try {
                  const embedding = await this.getEmbedding(text);
                  embeddingsArr.push({ embedding, insight });
                } catch (e) {
                  console.error("Embedding error:", e);
                }
              }
              this.setInsightEmbeddings(embeddingsArr);
              // Create a single concatenated embedding for all insights
              const allText = insights.map(i => `${i.painPoint} ${i.sentiment} ${i.featureArea}`).join(". ");
              try {
                this.allInsightsEmbedding = await this.getEmbedding(allText);
              } catch (e) {
                this.allInsightsEmbedding = null;
                console.error("All insights embedding error:", e);
              }
            }

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
          await next();
          return;
        }
        // Embedding-based Q&A
        if (
          this.insights.length > 0 &&
          this.insightEmbeddings.length > 0 &&
          userText.startsWith("ask ")
        ) {
          const query = context.activity.text.slice(4).trim();
          const queryEmbedding = await this.getEmbedding(query);
          // Find most similar insight
          let best = null,
            bestScore = -1;
          for (const item of this.insightEmbeddings) {
            const score = this.cosineSimilarity(queryEmbedding, item.embedding);
            if (score > bestScore) {
              bestScore = score;
              best = item.insight;
            }
          }
          if (best && bestScore > 0.7) {
            await context.sendActivity(
              `🤖 Closest insight: ${best.painPoint}\nSentiment: ${best.sentiment}\nFeature Area: ${best.featureArea}`
            );
          } else {
            await context.sendActivity(
              "Sorry, I couldn't find a relevant insight for your question."
            );
          }
          await next();
          return;
        }
        // Impromptu queries handling (moved up)
        if (
          this.insights.length > 0 &&
          this.insightEmbeddings.length > 0 &&
          userText &&
          !userText.startsWith("start analysis") &&
          !userText.startsWith("next analysis") &&
          !userText.startsWith("analyze next") &&
          !userText.startsWith("show") &&
          !userText.startsWith("list") &&
          !userText.startsWith("ask ") &&
          !userText.includes("how many") &&
          !userText.includes("what percent") &&
          !userText.includes("average attempts") &&
          !userText.includes("show stats") &&
          !userText.includes("statistics")
        ) {
          console.log('[EMBEDDINGS] Semantic search block triggered for:', context.activity.text);
          // Try to answer any impromptu query using embeddings
          const queryEmbedding = await this.getEmbedding(context.activity.text);
          let best = null, bestScore = -1;
          for (const item of this.insightEmbeddings) {
            const score = this.cosineSimilarity(queryEmbedding, item.embedding);
            if (score > bestScore) {
              bestScore = score;
              best = item.insight;
            }
          }
          console.log('[EMBEDDINGS] Best score:', bestScore, 'Best insight:', best);
          // If the query is very general, optionally use the allInsightsEmbedding for a summary
          if (this.allInsightsEmbedding) {
            const allScore = this.cosineSimilarity(queryEmbedding, this.allInsightsEmbedding);
            if (allScore > bestScore && allScore > 0.5) {
              await context.sendActivity("🤖 Your question is broad. Here is a summary of all extracted insights:");
              // Optionally, send a summary or the top 3 insights
              const top3 = this.insightEmbeddings
                .map(item => ({
                  score: this.cosineSimilarity(queryEmbedding, item.embedding),
                  insight: item.insight
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
              for (const t of top3) {
                await context.sendActivity(`• ${t.insight.painPoint} (Sentiment: ${t.insight.sentiment}, Feature: ${t.insight.featureArea})`);
              }
              await next();
              return;
            }
          }
          if (best && bestScore > 0.5) {
            await context.sendActivity(
              `🤖 Closest insight: ${best.painPoint}\nSentiment: ${best.sentiment}\nFeature Area: ${best.featureArea}`
            );
          } else {
            await context.sendActivity(
              `Sorry, I couldn't find a relevant insight for your question. (Best score: ${bestScore})`
            );
          }
          await next();
          return;
        }
        // Statistical queries
        if (
          this.insights.length > 0 &&
          (userText.includes("how many") ||
            userText.includes("what percent") ||
            userText.includes("average attempts") ||
            userText.includes("show stats") ||
            userText.includes("statistics"))
        ) {
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
          await next();
          return;
        }
        // Insights cards and filtering
        if (this.insights.length > 0) {
          // Helper function for cards (define if missing)
          function generateCardsFromInsights(insightsSubset) {
            return insightsSubset.map((insight, index) => {
              const card = createInsightsCard(`Insight ${index + 1}`, insight);
              card.body.push({
                type: "TextBlock",
                text: `🌀 Extracted after ${insight.attempts} attempt(s)`,
                isSubtle: true,
                size: "Small"
              });
              return CardFactory.adaptiveCard(card);
            });
          }

          // Only handle explicit show/list/filters here
          if (
            userText.includes('show all') ||
            userText.includes('list all') ||
            /(positive|neutral|negative)/.test(userText) ||
            /in ([\w\s]+)/i.test(userText)
          ) {
            let filteredInsights = this.insights;
            let showAll = false;
            if (userText.includes('show all') || userText.includes('list all')) {
              showAll = true;
            }
            const sentimentMatch = /(positive|neutral|negative)/.exec(userText);
            if (sentimentMatch && !showAll) {
              const sentiment = sentimentMatch[1];
              filteredInsights = filteredInsights.filter(
                (i) => i.sentiment && i.sentiment.toLowerCase() === sentiment
              );
            }
            const areaFilter = userText.match(/in ([\w\s]+)/i);
            if (areaFilter && !showAll) {
              const area = areaFilter[1].trim();
              filteredInsights = filteredInsights.filter(
                (i) => i.featureArea && i.featureArea.toLowerCase() === area.toLowerCase()
              );
            }
            if (showAll) {
              filteredInsights = this.insights;
            }
            if (filteredInsights.length === 0) {
              await context.sendActivity("🔍 No insights found matching your criteria.");
            } else {
              const batchSize = 5;
              for (let i = 0; i < filteredInsights.length; i += batchSize) {
                const batch = filteredInsights.slice(i, i + batchSize);
                const cards = generateCardsFromInsights(batch);
                await context.sendActivity({ attachments: cards });
              }
            }
            await next();
            return;
          }
        }
        // Default fallback
        await context.sendActivity(
          "👋 Hi! You can type **'Start Analysis'** to begin, and ask me questions after that."
        );
        await next();
        return;
      } catch (err) {
        console.error(err);
        await context.sendActivity("❌ Error processing your request.");
      }
      await next();
    });
  }
}

module.exports.LocalBot = LocalBot;
