import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';
import { User, TicketRequest, Session } from '../types';
import winston from 'winston';
import { DatabaseMigrations } from './migrations';

export class Database {
  private db: sqlite3.Database;
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    const dbPath = config.database.path;
    const dbDir = path.dirname(dbPath);

    // Ensure data directory exists
    fs.mkdir(dbDir, { recursive: true }).catch((err) => {
      this.logger.error('Failed to create database directory:', err);
    });

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        this.logger.error('Error opening database:', err);
        throw err;
      }
      this.logger.info('Connected to SQLite database');
    });

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');

    // Promisify database methods
    this.run = promisify(this.db.run.bind(this.db));
    this.get = promisify(this.db.get.bind(this.db));
  }

  private run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  private get: (sql: string, params?: any[]) => Promise<any>;

  async initialize(): Promise<void> {
    try {
      const schema = `
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            telegram_user_id TEXT UNIQUE NOT NULL,
            telegram_username TEXT,
            full_name TEXT NOT NULL,
            department TEXT NOT NULL,
            email TEXT,
            is_active INTEGER DEFAULT 1,
            is_authenticated INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
            tickets_created_today INTEGER DEFAULT 0,
            total_tickets_created INTEGER DEFAULT 0
        );

        -- Ticket requests table
        CREATE TABLE IF NOT EXISTS ticket_requests (
            id TEXT PRIMARY KEY,
            telegram_user_id TEXT NOT NULL,
            telegram_username TEXT,
            department TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            label TEXT NOT NULL CHECK (label IN ('Bug', 'Improvement', 'Design', 'Feature', 'Other')),
            priority TEXT NOT NULL CHECK (priority IN ('Urgent', 'High', 'Medium', 'Low')),
            status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'created', 'failed')),
            linear_ticket_id TEXT,
            linear_ticket_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            submitted_at DATETIME,
            session_data TEXT,
            FOREIGN KEY (telegram_user_id) REFERENCES users(telegram_user_id)
        );

        -- Sessions table
        CREATE TABLE IF NOT EXISTS sessions (
            user_id TEXT PRIMARY KEY,
            state TEXT NOT NULL,
            ticket_data TEXT,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_user_id)
        );

        -- Audit log table
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(telegram_user_id)
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_user_id);
        CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON ticket_requests(telegram_user_id);
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON ticket_requests(status);
        CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON ticket_requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);
        CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
      `;
      
      // Execute each statement separately
      const statements = schema.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await this.run(statement);
        }
      }
      
      this.logger.info('Database schema initialized');
      
      // Run migrations
      const migrations = new DatabaseMigrations(this.db, this.logger);
      await migrations.runMigrations();
    } catch (error) {
      this.logger.error('Error initializing database:', error);
      throw error;
    }
  }

  // User methods
  async createUser(user: Omit<User, 'id' | 'created_at' | 'last_active' | 'tickets_created_today' | 'total_tickets_created'>): Promise<User> {
    const id = this.generateId();
    const sql = `
      INSERT INTO users (id, telegram_user_id, telegram_username, full_name, department, email, is_active, is_authenticated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      id,
      user.telegram_user_id,
      user.telegram_username || null,
      user.full_name,
      user.department,
      user.email || null,
      user.is_active ? 1 : 0,
      user.is_authenticated ? 1 : 0,
    ]);

    const newUser = await this.getUserById(user.telegram_user_id);
    if (!newUser) {
      throw new Error('Failed to create user');
    }
    return newUser;
  }

  async getUserById(telegramUserId: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE telegram_user_id = ?';
    const row = await this.get(sql, [telegramUserId]);
    return row ? this.mapRowToUser(row) : null;
  }

  async updateUserLastActive(telegramUserId: string): Promise<void> {
    const sql = 'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE telegram_user_id = ?';
    await this.run(sql, [telegramUserId]);
  }

  async updateUserAuthentication(telegramUserId: string, isAuthenticated: boolean): Promise<void> {
    const sql = 'UPDATE users SET is_authenticated = ? WHERE telegram_user_id = ?';
    await this.run(sql, [isAuthenticated ? 1 : 0, telegramUserId]);
  }

  async incrementUserTicketCount(telegramUserId: string): Promise<void> {
    const sql = `
      UPDATE users 
      SET tickets_created_today = tickets_created_today + 1,
          total_tickets_created = total_tickets_created + 1
      WHERE telegram_user_id = ?
    `;
    await this.run(sql, [telegramUserId]);
  }

  async resetDailyTicketCounts(): Promise<void> {
    const sql = 'UPDATE users SET tickets_created_today = 0';
    await this.run(sql);
  }

  async getUserTicketsToday(telegramUserId: string): Promise<number> {
    const sql = 'SELECT tickets_created_today FROM users WHERE telegram_user_id = ?';
    const row = await this.get(sql, [telegramUserId]);
    return row ? row.tickets_created_today : 0;
  }

  // Ticket methods
  async createTicket(ticket: Omit<TicketRequest, 'id' | 'created_at'>): Promise<TicketRequest> {
    const id = this.generateId();
    
    // Map 'Request' to 'Other' for database compatibility
    const dbLabel = ticket.label === 'Request' ? 'Other' : ticket.label;
    
    const sql = `
      INSERT INTO ticket_requests (
        id, telegram_user_id, telegram_username, department, title, description,
        label, priority, status, linear_ticket_id, linear_ticket_url, submitted_at, session_data
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.run(sql, [
      id,
      ticket.telegram_user_id,
      ticket.telegram_username || null,
      ticket.department,
      ticket.title,
      ticket.description,
      dbLabel,  // Use mapped label
      ticket.priority,
      ticket.status,
      ticket.linear_ticket_id || null,
      ticket.linear_ticket_url || null,
      ticket.submitted_at || null,
      ticket.session_data ? JSON.stringify(ticket.session_data) : null,
    ]);

    const newTicket = await this.getTicketById(id);
    if (!newTicket) {
      throw new Error('Failed to create ticket');
    }
    return newTicket;
  }

  async getTicketById(id: string): Promise<TicketRequest | null> {
    const sql = 'SELECT * FROM ticket_requests WHERE id = ?';
    const row = await this.get(sql, [id]);
    return row ? this.mapRowToTicket(row) : null;
  }

  async updateTicketStatus(
    id: string,
    status: string,
    linearTicketId?: string,
    linearTicketUrl?: string
  ): Promise<void> {
    let sql = 'UPDATE ticket_requests SET status = ?';
    const params: any[] = [status];

    if (linearTicketId && linearTicketUrl) {
      sql += ', linear_ticket_id = ?, linear_ticket_url = ?, submitted_at = CURRENT_TIMESTAMP';
      params.push(linearTicketId, linearTicketUrl);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await this.run(sql, params);
  }

  async findDuplicateTicket(title: string, dayLimit: number = 30): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) as count FROM ticket_requests
      WHERE title = ? AND created_at >= date('now', '-${dayLimit} days')
    `;
    const row = await this.get(sql, [title]);
    return row.count > 0;
  }

  // Session methods
  async saveSession(session: Session): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO sessions (user_id, state, ticket_data, last_activity, created_at)
      VALUES (?, ?, ?, ?, ?)
    `;

    await this.run(sql, [
      session.userId,
      session.state,
      JSON.stringify(session.ticketData),
      session.lastActivity.toISOString(),
      session.createdAt.toISOString(),
    ]);
  }

  async getSession(userId: string): Promise<Session | null> {
    const sql = 'SELECT * FROM sessions WHERE user_id = ?';
    const row = await this.get(sql, [userId]);
    
    if (!row) return null;

    return {
      userId: row.user_id,
      state: row.state,
      ticketData: row.ticket_data ? JSON.parse(row.ticket_data) : {},
      lastActivity: new Date(row.last_activity),
      createdAt: new Date(row.created_at),
    };
  }

  async deleteSession(userId: string): Promise<void> {
    const sql = 'DELETE FROM sessions WHERE user_id = ?';
    await this.run(sql, [userId]);
  }

  async cleanupExpiredSessions(timeoutMinutes: number): Promise<void> {
    const sql = `
      DELETE FROM sessions
      WHERE datetime(last_activity) < datetime('now', '-${timeoutMinutes} minutes')
    `;
    await this.run(sql);
  }

  // Audit methods
  async addAuditLog(userId: string, action: string, details?: string): Promise<void> {
    const sql = 'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)';
    await this.run(sql, [userId, action, details || null]);
  }

  // Utility methods
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      telegram_user_id: row.telegram_user_id,
      telegram_username: row.telegram_username,
      full_name: row.full_name,
      department: row.department,
      email: row.email,
      is_active: Boolean(row.is_active),
      is_authenticated: Boolean(row.is_authenticated),
      created_at: new Date(row.created_at),
      last_active: new Date(row.last_active),
      tickets_created_today: row.tickets_created_today,
      total_tickets_created: row.total_tickets_created,
    };
  }

  private mapRowToTicket(row: any): TicketRequest {
    // Map 'Other' back to 'Request' for application compatibility
    const appLabel = row.label === 'Other' ? 'Request' : row.label;
    
    return {
      id: row.id,
      telegram_user_id: row.telegram_user_id,
      telegram_username: row.telegram_username,
      department: row.department,
      title: row.title,
      description: row.description,
      label: appLabel,  // Use mapped label
      priority: row.priority,
      status: row.status,
      linear_ticket_id: row.linear_ticket_id,
      linear_ticket_url: row.linear_ticket_url,
      created_at: new Date(row.created_at),
      submitted_at: row.submitted_at ? new Date(row.submitted_at) : undefined,
      session_data: row.session_data ? JSON.parse(row.session_data) : undefined,
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          this.logger.error('Error closing database:', err);
          reject(err);
        } else {
          this.logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}