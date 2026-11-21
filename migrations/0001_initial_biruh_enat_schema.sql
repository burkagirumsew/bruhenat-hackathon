-- =====================================================================
-- BIRUH ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
-- INITIAL FRESH D1 DATABASE SCHEMA (ZERO HOSPITALITY DATA)
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullName TEXT NOT NULL,
  email TEXT NOT NULL,
  phoneNumber TEXT NOT NULL,
  alxAffiliation TEXT,
  registrationType TEXT NOT NULL,
  teamName TEXT,
  strengths TEXT,
  roleType TEXT NOT NULL,
  ticketNumber TEXT,
  checkInStatus INTEGER DEFAULT 0,
  checkInTime TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  emailStatus TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  fullName TEXT NOT NULL,
  email TEXT NOT NULL,
  phoneNumber TEXT,
  roleType TEXT NOT NULL,
  ticketNumber TEXT,
  alxAffiliation TEXT,
  checkInStatus INTEGER DEFAULT 0,
  checkInTime TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  emailStatus TEXT DEFAULT 'pending',
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance & verification lookup indexes
CREATE INDEX IF NOT EXISTS idx_be_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_be_users_ticket ON users(ticketNumber);
CREATE INDEX IF NOT EXISTS idx_be_team_members_userId ON team_members(userId);
CREATE INDEX IF NOT EXISTS idx_be_team_members_email ON team_members(email);
CREATE INDEX IF NOT EXISTS idx_be_team_members_ticket ON team_members(ticketNumber);
