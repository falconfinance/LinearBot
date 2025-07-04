# Falcon Linear Ticket Bot

A Telegram bot that streamlines the process of creating Linear tickets for the Falcon Protocol team.

## Features

- 🎫 Guided ticket creation workflow
- ✅ Input validation and quality checks
- 🏷️ Automatic labeling and prioritization
- 👤 Auto-assignment to Regina for triaging
- 📊 Rate limiting (5 tickets per user per day)
- 💾 Session management with 30-minute timeout
- 📝 Templates for bug reports and feature requests

## Prerequisites

- Node.js v16 or higher
- npm or yarn
- Telegram Bot Token (from @BotFather)
- Linear API Key and workspace details
- SQLite3

## Setup

1. **Clone the repository**
```bash
git clone [repository-url]
cd LinearBot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather
- `LINEAR_API_KEY`: Your Linear API key
- `LINEAR_TEAM_ID`: Your Linear team ID
- `LINEAR_PROJECT_ID`: The "Request Tickets" project ID
- `LINEAR_REGINA_USER_ID`: Regina's Linear user ID

4. **Build the TypeScript code**
```bash
npm run build
```

5. **Initialize the database**
The database will be automatically initialized on first run.

## Running the Bot

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start ecosystem.config.js

# View logs
pm2 logs linear-bot

# Monitor
pm2 monit
```

## Usage

1. **Register with the bot**
   - Send `/start YourName_Department` (e.g., `/start John_Engineering`)

2. **Create a ticket**
   - Click "Create New Ticket"
   - Follow the guided steps:
     - Enter title (10-100 characters)
     - Provide description (minimum 50 characters)
     - Select label (Bug, Improvement, Design, Feature, Other)
     - Choose priority (Urgent, High, Medium, Low)
     - Review and confirm

3. **Other commands**
   - `/help` - Show help information
   - `/cancel` - Cancel current operation

## Project Structure

```
LinearBot/
├── src/
│   ├── api/           # Linear API integration
│   ├── bot/           # Telegram bot logic
│   ├── config/        # Configuration
│   ├── db/            # Database layer
│   ├── types/         # TypeScript types
│   └── utils/         # Utilities
├── data/              # SQLite database
├── logs/              # Application logs
├── tests/             # Test files
└── dist/              # Compiled JavaScript
```

## Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Run in development mode with hot reload
- `npm start` - Run compiled code
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run format` - Format code

## Troubleshooting

### Bot not responding
1. Check if the bot token is correct
2. Verify internet connection
3. Check logs: `pm2 logs linear-bot`

### Linear tickets not creating
1. Verify Linear API credentials
2. Check if Regina's user ID is correct
3. Ensure project ID exists in Linear

### Database errors
1. Check file permissions on `data/` directory
2. Delete `data/bot.db` to reset database

## Security

- Never commit `.env` file
- Keep API keys secure
- Regularly update dependencies
- Use proper file permissions for database

## Support

- Slack: #linear-bot-help
- Email: support@falconprotocol.io