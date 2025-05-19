# 🤖 Community Insights Bot (Teams AI + OpenRouter + MCP)

A Microsoft Teams bot that ingests developer feedback (e.g., from GitHub, Stack Overflow), extracts pain points using an OpenRouter LLM (e.g., Qwen), and responds to user queries using Adaptive Cards and natural language.
This bot is designed to help product managers and developers quickly understand community sentiment and feature requests, making it easier to prioritize development efforts.

## 📦 Features

- 🧠 Uses OpenRouter's LLM (e.g., Qwen) to extract:
  - Pain point summary
  - Sentiment (Positive, Negative, Neutral)
  - Feature area
- 🗂️ Presents insights as Adaptive Cards in Teams
- 💬 Supports questions like:
  - `"pain points"`
  - `"show me positive feedback"`
  - `"what percentage of feedback is neutral?"`

## 🛠️ Project Structure

```text
.
├── ingestion/
│   └── mcpServer.js        # Simulated ingestion of feedback
├── ai/
│   └── extractor.js        # LLM interaction via OpenRouter
├── cards/
│   └── adaptiveCard.js     # Adaptive Card generator
├── index.js                # Express server and bot handler
├── .env                    # Environment variables
├── package.json
└── README.md
```

## 🧪 Simulated Ingestion

The ingestFeedback() method is currently a placeholder returning static/mock feedback. You can extend it to fetch from:

- GitHub Issues

- Stack Overflow tags

- JIRA tickets

- Azure DevOps feedback API

## 🤖 LLM Extraction

The extractPainPoints() function sends developer feedback to an OpenRouter-compatible endpoint (e.g., Qwen or GPT) and expects structured output like:

```json
{
  "pain_point_summary": "Too many redirects when logging in",
  "sentiment": "Negative",
  "feature_area": "Authentication"
}
```

This output is validated and formatted into Adaptive Cards.

## 🧠 Query Intelligence

After insights are stored in memory, users can ask:

| Query Example                    | What it does                          |
| -------------------------------- | ------------------------------------- |
| `pain points`                    | Ingests & extracts insights           |
| `how many are negative`          | Counts negative insights              |
| `show me positive pain points`   | Lists positive insights               |
| `percentage of neutral feedback` | Calculates neutral insight percentage |
| `show all feature areas`         | Groups insights by feature area       |

## ✅ Requirements

- Node.js 18+

- Azure Bot Registration (for App ID & Password)

- Bot Framework Emulator for local/dev testing

## 🔐 Environment Variables

| Variable                 | Description                          |
| ------------------------ | ------------------------------------ |
| `MICROSOFT_APP_ID`       | Azure Bot App ID                     |
| `MICROSOFT_APP_PASSWORD` | Azure Bot Password                   |
| `QWEN_API_KEY`           | OpenRouter API Key (for LLM queries) |
| `PORT`                   | Optional. Defaults to `3000`         |

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/milind1511/Community-Insights-Bot.git
cd community-insights-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env` file

```bash
touch .env
```

Fill in your credentials:

```bash
MICROSOFT_APP_ID=your-bot-app-id
MICROSOFT_APP_PASSWORD=your-bot-password
QWEN_API_KEY=your-openrouter-api-key
PORT=80
```

You can get the `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD` by registering your bot in the Azure portal. The `QWEN_API_KEY` can be obtained from [OpenRouter](https://openrouter.ai/). The `PORT` is the port on which your bot will run. You can change it if needed but make sure to update the bot's messaging endpoint accordingly.

Leave `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD` blank if you are testing locally without Azure Bot Service.

### 4. Start the bot

```bash
npm start
```

The bot should now be running on:

```bash
http://localhost/api/messages
```

#### For Dockerized Setup, Checkout [this](https://github.com/milind1511/Community-Insights-Bot/blob/main/DOCKER-README.md)

# 🧪 Testing Locally with Bot Framework Emulator

### 📥 Step 1: Install the Bot Framework Emulator

Download and install from the official Microsoft site:

👉 <https://aka.ms/botframework-emulator>

### 📡 Step 2: Connect to your bot

1. Launch the Bot Framework Emulator.
2. Click on "Open Bot".
3. Enter the following settings:
   - **Bot URL**: `http://localhost/api/messages`
   - **Microsoft App ID**: Leave blank (unless you have set up an app ID)
   - **Microsoft App Password**: Leave blank (unless you have set up a password)
4. Click **Connect**.

### 💬 Step 3: Test the bot

Try these messages in the emulator:

- `pain points`
- `show me positive feedback`
- `what is the percentage of neutral feedback?`

You'll see structured responses and Adaptive Cards.
