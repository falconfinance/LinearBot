import { Database } from '../db/database';
import { Session, SessionState } from '../types';
import { logger } from '../utils/logger';

export class SessionManager {
  private db: Database;
  private timeoutMinutes: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(db: Database, timeoutMinutes: number) {
    this.db = db;
    this.timeoutMinutes = timeoutMinutes;
  }

  async createSession(userId: string): Promise<Session> {
    const session: Session = {
      userId,
      state: SessionState.IDLE,
      ticketData: {},
      lastActivity: new Date(),
      createdAt: new Date(),
    };

    await this.db.saveSession(session);
    await this.db.addAuditLog(userId, 'SESSION_CREATED');
    
    return session;
  }

  async getSession(userId: string): Promise<Session | null> {
    const session = await this.db.getSession(userId);
    
    if (session) {
      // Check if session is expired
      const minutesSinceActivity = 
        (Date.now() - session.lastActivity.getTime()) / (1000 * 60);
      
      if (minutesSinceActivity > this.timeoutMinutes) {
        await this.deleteSession(userId);
        return null;
      }
    }
    
    return session;
  }

  async updateSession(
    userId: string,
    updates: Partial<Session>
  ): Promise<void> {
    const session = await this.getSession(userId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    const updatedSession: Session = {
      ...session,
      ...updates,
      lastActivity: new Date(),
    };

    await this.db.saveSession(updatedSession);
  }

  async updateSessionState(
    userId: string,
    state: SessionState
  ): Promise<void> {
    await this.updateSession(userId, { state });
  }

  async updateTicketData(
    userId: string,
    ticketData: Partial<Session['ticketData']>
  ): Promise<void> {
    const session = await this.getSession(userId);
    
    if (!session) {
      throw new Error('Session not found');
    }

    await this.updateSession(userId, {
      ticketData: { ...session.ticketData, ...ticketData },
    });
  }

  async deleteSession(userId: string): Promise<void> {
    await this.db.deleteSession(userId);
    await this.db.addAuditLog(userId, 'SESSION_DELETED');
  }

  async isSessionActive(userId: string): Promise<boolean> {
    const session = await this.getSession(userId);
    return session !== null;
  }

  startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.db.cleanupExpiredSessions(this.timeoutMinutes);
        logger.debug('Cleaned up expired sessions');
      } catch (error) {
        logger.error('Error cleaning up sessions:', error);
      }
    }, 5 * 60 * 1000);
  }

  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}