# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Telegram Bot for Linear Integration built with TypeScript and Node.js. It helps the Falcon Protocol team create and manage tickets in Linear through a conversational Telegram interface.

## Development Commands

### Core Development
```bash
npm run dev          # Start development server with hot reload (nodemon + ts-node)
npm run build        # Compile TypeScript to JavaScript
npm start            # Run production build from dist/
```

### Code Quality
```bash
npm run lint         # Run ESLint to check code quality
npm run format       # Format code with Prettier
npm test             # Run Jest tests (when implemented)
```

### Utilities
```bash
npm run get-linear-ids    # Fetch team/project IDs from Linear API
```

## Architecture

### Core Components
- **src/bot/**: Main bot logic with handlers for commands, messages, and callbacks
- **src/api/**: Linear API integration using @linear/sdk
- **src/db/**: SQLite database layer with user, session, and ticket management
- **src/config/**: Configuration management with environment validation
- **src/utils/**: Logging (Winston) and validation (Joi) utilities

### Key Design Patterns
1. **Session Management**: 30-minute sessions stored in SQLite, cleaned up automatically
2. **Handler Pattern**: Separate handlers for commands, messages, and callback queries
3. **Rate Limiting**: 5 tickets per user per day, tracked in database
4. **Guided Workflow**: Step-by-step ticket creation with state management

### Database Schema
- **users**: Telegram user registration with departments
- **ticket_requests**: All submitted tickets with metadata
- **sessions**: Active user sessions for multi-step workflows
- **audit_log**: Activity tracking for debugging

## Important Context

### Linear Integration
- Uses Linear SDK for API calls
- Auto-assigns tickets to Regina (user ID stored in config)
- Supports both bug reports and feature requests
- Team and project IDs configured via environment variables

### Telegram Bot Features
- Long polling mode (no webhooks)
- Inline keyboards for navigation
- Markdown formatting for messages
- Command-based interactions (/start, /help, /ticket, etc.)

### Production Setup
- Uses PM2 for process management
- Winston logging with separate error/app logs
- SQLite file-based database (configure path in .env)
- Environment-based configuration with Joi validation

## Development Notes

### Adding New Features
1. For new commands: Add handler in src/bot/handlers/commandHandlers.ts
2. For Linear operations: Extend src/api/linearService.ts
3. For database changes: Update schema in src/db/database.ts
4. For new workflows: Use sessionManager for state tracking

### Testing
- Jest configured with ts-jest
- Test files should use .test.ts extension
- Mock Linear API calls when testing integrations

### Deployment
1. Build with `npm run build`
2. Set all required environment variables (see .env.example)
3. Use PM2 for production: `pm2 start ecosystem.config.js`
4. Monitor logs in pm2-logs/ directory