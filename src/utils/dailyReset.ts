import { Database } from '../db/database';
import { logger } from './logger';

export async function resetDailyTicketCounts(): Promise<void> {
  try {
    const db = new Database(logger);
    await db.initialize();
    
    await db.resetDailyTicketCounts();
    logger.info('Successfully reset daily ticket counts for all users');
    
    await db.close();
  } catch (error) {
    logger.error('Failed to reset daily ticket counts:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  resetDailyTicketCounts()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}