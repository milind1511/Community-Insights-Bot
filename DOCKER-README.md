# 🐳 Docker Setup Instructions

This guide will help you build and run your Microsoft Teams Community Insights Bot using Docker.


## 📁 Prerequisites

- Ensure you have Docker installed on your machine. You can download it from [Docker's official website](https://www.docker.com/get-started).
- `.env` file present in the root of your project with these variables:

```env
MICROSOFT_APP_ID=
MICROSOFT_APP_PASSWORD=
QWEN_API_KEY=your_openrouter_or_qwen_api_key
PORT=80
```

- If you are using Azure Bot Service, make sure to set the `MICROSOFT_APP_ID` and `MICROSOFT_APP_PASSWORD` in the `.env` file. If you are testing locally without Azure Bot Service, leave these variables blank.

## 🛠️ Build the Docker Image

- Open a terminal and navigate to the root directory of your project.
- Run the following command to build the Docker image & run the bot:

```bash
docker-compose up --build -d
```

This command will build the Docker image and start the bot in detached mode.

# 🧪 Test with Bot Framework Emulator

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

### 🧹 Stopping the Bot

To stop the bot, run the following command in your terminal:

```bash
docker-compose down
```
