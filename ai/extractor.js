import { OpenAI } from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.QWEN_API_KEY,
});

async function extractPainPoints(feedback) {
  const prompt = `
You are an AI assistant helping the Microsoft Teams product team identify key developer pain points from online community feedback.  
Given a piece of feedback from Stack Overflow or GitHub Issues, perform the following tasks:

1. Identify and summarize the **primary pain point** described.
2. Classify the **sentiment** as one of: Positive, Negative, or Neutral.
3. Determine the **feature or area** being discussed (e.g., Teams SDK, Bots, Adaptive Cards, Authentication, TeamsFX).

{
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
      model: "qwen/qwen3-30b-a3b:free",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const choice = completion?.choices?.[0]?.message?.content;

    if (!choice) {
      console.error("No valid response from OpenRouter AI:", completion);
      return null;
    }

    console.log(choice);
    return choice;

  } catch (error) {
    console.error("Error calling OpenRouter API:", error.response?.data || error.message);
    return null;
  }
}

export { extractPainPoints };



