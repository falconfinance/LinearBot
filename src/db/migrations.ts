import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import winston from 'winston';

export class DatabaseMigrations {
  private logger: winston.Logger;
  private run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  private all: (sql: string, params?: any[]) => Promise<any[]>;

  constructor(db: sqlite3.Database, logger: winston.Logger) {
    this.logger = logger;
    this.run = promisify(db.run.bind(db));
    this.all = promisify(db.all.bind(db));
  }

  async runMigrations(): Promise<void> {
    try {
      // Create migrations table if it doesn't exist
      await this.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Get list of applied migrations
      const appliedMigrations = await this.all('SELECT name FROM migrations');
      const appliedNames = appliedMigrations.map(m => m.name);

      // Define migrations
      const migrations = [
        {
          name: 'add_is_authenticated_column',
          sql: `ALTER TABLE users ADD COLUMN is_authenticated INTEGER DEFAULT 0`,
        },
      ];

      // Run pending migrations
      for (const migration of migrations) {
        if (!appliedNames.includes(migration.name)) {
          try {
            await this.run(migration.sql);
            await this.run('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
            this.logger.info(`Applied migration: ${migration.name}`);
          } catch (error: any) {
            // Check if column already exists (for SQLite)
            if (error.message.includes('duplicate column name')) {
              // Column already exists, mark migration as applied
              await this.run('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
              this.logger.info(`Migration already applied: ${migration.name}`);
            } else {
              throw error;
            }
          }
        }
      }

      this.logger.info('All migrations completed successfully');
    } catch (error) {
      this.logger.error('Error running migrations:', error);
      throw error;
    }
  }
}