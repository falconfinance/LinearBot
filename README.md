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
git clone https://github.com/falconfinance/LinearBot.git
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

### Using PM2 (Recommended for Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start ecosystem.config.js --env production

# View logs
pm2 logs linear-bot

# Monitor
pm2 monit

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot (Linux/Mac)
pm2 startup
```

## Deployment

### Generic Server Deployment

1. **Prepare your server**
   - Ensure Node.js 16+ is installed
   - Install PM2 globally: `npm install -g pm2`
   - Create application directory

2. **Deploy the application**
   ```bash
   # Clone repository
   git clone https://github.com/falconfinance/LinearBot.git
   cd LinearBot
   
   # Install dependencies
   npm install
   
   # Build application
   npm run build
   
   # Create directories
   mkdir -p data logs
   ```

3. **Set up environment variables**
   - Create `.env` file with all required variables
   - Ensure proper file permissions: `chmod 600 .env`

4. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   ```

### Environment Variables

The bot requires the following environment variables to be set:

| Variable | Description | Required |
|----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | Yes |
| `LINEAR_API_KEY` | Linear API key | Yes |
| `LINEAR_TEAM_ID` | Linear team ID | Yes |
| `LINEAR_PROJECT_ID` | Linear project ID for tickets | Yes |
| `LINEAR_REGINA_USER_ID` | User ID for auto-assignment | Yes |
| `DATABASE_PATH` | Path to SQLite database | No (default: ./data/bot.db) |
| `NODE_ENV` | Environment (development/production) | No (default: development) |

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
- `npm run get-linear-ids` - Utility to fetch Linear team/project IDs

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
- Consider using environment variable management tools in production

## Daily Reset

The bot includes a daily reset cron job that runs at midnight to clean up old sessions and reset daily ticket limits. This is automatically configured in the PM2 ecosystem file.

## Support

- Slack: #linear-bot-help
- Email: support@falconprotocol.io