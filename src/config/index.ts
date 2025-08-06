import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    pollingOptions: {
      interval: 300,
      autoStart: true,
      params: {
        timeout: 30, // Increased from 10 to 30 seconds
      },
      request: {
        timeout: 35000, // 35 seconds request timeout
      },
    },
  },
  linear: {
    apiKey: process.env.LINEAR_API_KEY || '',
    teamId: process.env.LINEAR_TEAM_ID || '',
    projectId: process.env.LINEAR_PROJECT_ID || '',
    reginaUserId: process.env.LINEAR_REGINA_USER_ID || '',
  },
  database: {
    path: path.resolve(process.env.DATABASE_PATH || './data/bot.db'),
  },
  session: {
    timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30', 10),
  },
  // Rate limiting removed
  // rateLimit: {
  //   maxTicketsPerDay: parseInt(process.env.MAX_TICKETS_PER_DAY || '5', 10),
  //   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '86400000', 10),
  // },
  bot: {
    name: process.env.BOT_NAME || 'Falcon Linear Ticket Bot',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: path.resolve(process.env.LOG_FILE_PATH || './logs/bot.log'),
  },
  env: process.env.NODE_ENV || 'development',
  auth: {
    authorizedChatIds: process.env.AUTHORIZED_CHAT_IDS?.split(',').map(id => id.trim()) || [],
    reginaChatId: process.env.REGINA_CHAT_ID || '',
    password: process.env.BOT_PASSWORD || 'test123@falcon',
  },
};

export function validateConfig(): void {
  const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'LINEAR_API_KEY',
    'LINEAR_TEAM_ID',
    'LINEAR_PROJECT_ID',
    'LINEAR_REGINA_USER_ID',
  ];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}. Please check your .env file.`
    );
  }
}