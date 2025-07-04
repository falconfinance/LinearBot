import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Database } from '../db/database';
import { CommandHandler } from './handlers/commandHandler';
import { MessageHandler } from './handlers/messageHandler';
import { CallbackHandler } from './handlers/callbackHandler';
import { SessionManager } from './sessionManager';
import { LinearService } from '../api/linearService';

export class Bot {
  private bot: TelegramBot;
  private db: Database;
  private sessionManager: SessionManager;
  private linearService: LinearService;
  private commandHandler: CommandHandler;
  private messageHandler: MessageHandler;
  private callbackHandler: CallbackHandler;

  constructor() {
    this.bot = new TelegramBot(config.telegram.botToken, {
      polling: config.telegram.pollingOptions,
    });

    this.db = new Database(logger);
    this.sessionManager = new SessionManager(this.db, config.session.timeoutMinutes);
    this.linearService = new LinearService(logger);
    
    this.commandHandler = new CommandHandler(this.bot, this.db, this.sessionManager, this.linearService, logger);
    this.messageHandler = new MessageHandler(
      this.bot,
      this.db,
      this.sessionManager,
      this.linearService,
      logger
    );
    this.callbackHandler = new CallbackHandler(
      this.bot,
      this.db,
      this.sessionManager,
      this.linearService,
      logger
    );

    this.setupHandlers();
    this.setupErrorHandlers();
  }

  private setupHandlers(): void {
    // Command handlers
    this.bot.onText(/\/start/, (msg) => {
      this.commandHandler.handleStart(msg, null).catch((err) => {
        logger.error('Error in /start handler:', err);
      });
    });

    this.bot.onText(/\/help/, (msg) => {
      this.commandHandler.handleHelp(msg).catch((err) => {
        logger.error('Error in /help handler:', err);
      });
    });

    this.bot.onText(/\/cancel/, (msg) => {
      this.commandHandler.handleCancel(msg).catch((err) => {
        logger.error('Error in /cancel handler:', err);
      });
    });

    // Linear-specific commands
    this.bot.onText(/\/tickets/, (msg) => {
      this.commandHandler.handleTickets(msg).catch((err) => {
        logger.error('Error in /tickets handler:', err);
      });
    });

    this.bot.onText(/\/mytickets/, (msg) => {
      this.commandHandler.handleMyTickets(msg).catch((err) => {
        logger.error('Error in /mytickets handler:', err);
      });
    });

    this.bot.onText(/\/ticket\s+(.+)/, (msg, match) => {
      this.commandHandler.handleTicket(msg, match).catch((err) => {
        logger.error('Error in /ticket handler:', err);
      });
    });

    this.bot.onText(/\/search\s+(.+)/, (msg, match) => {
      this.commandHandler.handleSearch(msg, match).catch((err) => {
        logger.error('Error in /search handler:', err);
      });
    });

    this.bot.onText(/\/urgent/, (msg) => {
      this.commandHandler.handleUrgent(msg).catch((err) => {
        logger.error('Error in /urgent handler:', err);
      });
    });

    this.bot.onText(/\/projects/, (msg) => {
      this.commandHandler.handleProjects(msg).catch((err) => {
        logger.error('Error in /projects handler:', err);
      });
    });

    this.bot.onText(/\/teams/, (msg) => {
      this.commandHandler.handleTeams(msg).catch((err) => {
        logger.error('Error in /teams handler:', err);
      });
    });

    this.bot.onText(/\/status\s+(.+)/, (msg, match) => {
      this.commandHandler.handleStatus(msg, match).catch((err) => {
        logger.error('Error in /status handler:', err);
      });
    });

    this.bot.onText(/\/comment\s+(.+)/, (msg, match) => {
      this.commandHandler.handleComment(msg, match).catch((err) => {
        logger.error('Error in /comment handler:', err);
      });
    });

    // Message handler for non-commands
    this.bot.on('message', (msg) => {
      if (!msg.text || msg.text.startsWith('/')) {
        return; // Skip commands, they're handled above
      }

      this.messageHandler.handleMessage(msg).catch((err) => {
        logger.error('Error in message handler:', err);
      });
    });

    // Callback query handler for inline keyboards
    this.bot.on('callback_query', (query) => {
      this.callbackHandler.handleCallback(query).catch((err) => {
        logger.error('Error in callback handler:', err);
      });
    });
  }

  private setupErrorHandlers(): void {
    this.bot.on('polling_error', (error: any) => {
      // Handle ETIMEDOUT errors gracefully
      if (error.code === 'ETIMEDOUT' || error.message?.includes('ETIMEDOUT')) {
        logger.warn('Polling timeout - this is normal for long polling, bot will retry automatically');
      } else if (error.code === 'EFATAL') {
        logger.warn('Network error during polling - bot will recover automatically');
      } else if (error.code === 'ETELEGRAM' && error.response?.statusCode === 409) {
        logger.error('Another bot instance is running! Shutting down this instance...');
        logger.error('Please ensure only one bot instance is running.');
        this.stop().then(() => {
          process.exit(1);
        });
      } else {
        logger.error('Polling error:', error);
      }
    });

    this.bot.on('error', (error) => {
      logger.error('Bot error:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }

  async start(): Promise<void> {
    try {
      logger.info('Initializing database...');
      await this.db.initialize();

      logger.info('Starting session cleanup interval...');
      this.sessionManager.startCleanupInterval();

      logger.info('Bot started successfully!');
      logger.info(`Bot username: @${(await this.bot.getMe()).username}`);
    } catch (error) {
      logger.error('Failed to start bot:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping bot...');
    this.sessionManager.stopCleanupInterval();
    this.bot.stopPolling();
    await this.db.close();
    logger.info('Bot stopped');
  }
}