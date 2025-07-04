import { validateConfig } from './config';
import { logger } from './utils/logger';
import { Bot } from './bot';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    logger.info('Starting Falcon Linear Ticket Bot...');
    
    // Check for lock file to prevent multiple instances
    const lockFile = path.join(process.cwd(), '.bot.lock');
    if (fs.existsSync(lockFile)) {
      const pid = fs.readFileSync(lockFile, 'utf8');
      logger.warn(`Lock file exists with PID: ${pid}. Checking if process is still running...`);
      
      try {
        process.kill(parseInt(pid), 0);
        logger.error('Another bot instance is already running! Exiting...');
        process.exit(1);
      } catch (err) {
        logger.info('Previous instance not running, removing stale lock file');
        fs.unlinkSync(lockFile);
      }
    }
    
    // Create lock file with current PID
    fs.writeFileSync(lockFile, process.pid.toString());
    
    // Ensure lock file is removed on exit
    const cleanup = () => {
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
    };
    
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('uncaughtException', cleanup);
    
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Add a small delay to ensure any previous instances have stopped
    logger.info('Waiting 2 seconds to ensure clean startup...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create and start bot
    const bot = new Bot();
    await bot.start();

    // Handle graceful shutdown (overwrite the previous handlers)
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      cleanup();
      await bot.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  logger.error('Unhandled error in main:', error);
  process.exit(1);
});