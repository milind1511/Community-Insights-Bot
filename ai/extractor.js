import { AzureOpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new AzureOpenAI({
  endpoint: "https://community-insights-resource.cognitiveservices.azure.com/",
  apiKey: process.env.API_KEY,
  apiVersion: "2024-04-01-preview",
  deployment: "gpt-4.1-mini"
});
const modelName = "gpt-4.1-mini";

async function extractPainPoints(feedback) {
  const prompt = `
You are an AI assistant helping the Microsoft Teams product team identify key developer pain points from online community feedback.  
Given a piece of feedback from Stack Overflow or GitHub Issues, perform the following tasks:

1. Identify and summarize the **primary pain point** described.
2. Classify the **sentiment** as one of: Positive, Negative, or Neutral.
3. Determine the **feature or area** being discussed (e.g., Teams SDK, Bots, Adaptive Cards, Authentication, TeamsFX).
4. Only provide the relevant & valid data.

{
  "source": "<StackOverflow | GitHub>",
  "pain_point_summary": "<summary>",
  "sentiment": "<Positive | Negative | Neutral>",
  "feature_area": "<Teams SDK | Bots | Adaptive Cards | Authentication | TeamsFX | Other>"
}

Only return the JSON.

Feedback:
"""
${feedback}
"""
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: prompt,
        },
      ],
      max_completion_tokens: 800,
      temperature: 1,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      model: modelName
    });

    const choice = completion?.choices?.[0]?.message?.content;

    if (!choice) {
      console.error("No valid response from AzureOpenAI AI:", completion);
      return null;
    }

    return choice;
  } catch (error) {
    console.error(
      "Error calling AzureOpenAI API:",
      error.response?.data || error.message
    );
    return null;
  }
}

export { extractPainPoints };
