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