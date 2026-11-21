-- ==============================================================================
-- BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
-- Database Migration 001: Normalized Event Platform Schema
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Administrators Table
CREATE TABLE IF NOT EXISTS admins (
  id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'ADMIN', -- 'SUPER_ADMIN', 'ADMIN', 'CHECKIN_STAFF'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Registrations Table
CREATE TABLE IF NOT EXISTS registrations (
  id VARCHAR(64) PRIMARY KEY,
  reference_code VARCHAR(32) NOT NULL UNIQUE,
  pathway VARCHAR(16) NOT NULL, -- 'INDIVIDUAL' or 'TEAM'
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION', -- 'PENDING_EMAIL_VERIFICATION', 'VERIFIED', 'CONFIRMED', 'CANCELLED'
  team_idea TEXT NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(64) PRIMARY KEY,
  registration_id VARCHAR(64) NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  team_name VARCHAR(150) NOT NULL,
  selected_track VARCHAR(150) NOT NULL,
  team_leader_id VARCHAR(64) NULL,
  member_count INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Attendees Table
CREATE TABLE IF NOT EXISTS attendees (
  id VARCHAR(64) PRIMARY KEY,
  registration_id VARCHAR(64) NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  team_id VARCHAR(64) NULL REFERENCES teams(id) ON DELETE SET NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180) NOT NULL,
  phone VARCHAR(40) NULL,
  city VARCHAR(100) NULL,
  discipline VARCHAR(100) NOT NULL,
  experience_level VARCHAR(60) NULL,
  preferred_track VARCHAR(150) NULL,
  skills TEXT NULL,
  is_team_leader BOOLEAN NOT NULL DEFAULT FALSE,
  matching_consent BOOLEAN NOT NULL DEFAULT FALSE,
  eligibility_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  safety_pledge_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Email Verification Tokens Table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(64) PRIMARY KEY,
  attendee_id VARCHAR(64) NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tickets Table (Official QR Ticket)
CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(64) PRIMARY KEY,
  attendee_id VARCHAR(64) NOT NULL UNIQUE REFERENCES attendees(id) ON DELETE CASCADE,
  registration_id VARCHAR(64) NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  team_id VARCHAR(64) NULL REFERENCES teams(id) ON DELETE SET NULL,
  ticket_code VARCHAR(40) NOT NULL UNIQUE,
  ticket_token_hash VARCHAR(128) NOT NULL UNIQUE,
  qr_data TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'USED'
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  revoked_reason TEXT NULL
);

-- 7. Event Sessions Table
CREATE TABLE IF NOT EXISTS event_sessions (
  id VARCHAR(64) PRIMARY KEY,
  session_code VARCHAR(32) NOT NULL UNIQUE,
  session_name VARCHAR(150) NOT NULL,
  event_date VARCHAR(40) NOT NULL,
  start_time VARCHAR(20) NOT NULL,
  end_time VARCHAR(20) NOT NULL,
  venue_name VARCHAR(150) NOT NULL DEFAULT 'Capstone ALX Tech Hub, Lideta',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Attendance Records Table (Atomic Check-in Tracking)
CREATE TABLE IF NOT EXISTS attendance (
  id VARCHAR(64) PRIMARY KEY,
  attendee_id VARCHAR(64) NOT NULL REFERENCES attendees(id) ON DELETE CASCADE,
  ticket_id VARCHAR(64) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_session_id VARCHAR(64) NOT NULL REFERENCES event_sessions(id) ON DELETE CASCADE,
  check_in_method VARCHAR(20) NOT NULL, -- 'QR_SCAN', 'MANUAL'
  checked_in_by VARCHAR(64) NULL REFERENCES admins(id) ON DELETE SET NULL,
  checked_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attendee_id, event_session_id)
);

-- 9. Email Audit / Delivery Logs Table
CREATE TABLE IF NOT EXISTS email_logs (
  id VARCHAR(64) PRIMARY KEY,
  attendee_id VARCHAR(64) NULL,
  recipient_email VARCHAR(180) NOT NULL,
  email_type VARCHAR(50) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  delivery_status VARCHAR(20) NOT NULL, -- 'SENT', 'FAILED', 'PENDING'
  provider_message_id VARCHAR(100) NULL,
  error_message TEXT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Administrator Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NULL REFERENCES admins(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(40) NULL,
  target_id VARCHAR(64) NULL,
  details_json TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Google Sheets Synchronization Queue Table (Outbox Pattern)
CREATE TABLE IF NOT EXISTS google_sheets_sync (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(30) NOT NULL, -- 'REGISTRATION', 'ATTENDEE', 'ATTENDANCE'
  entity_id VARCHAR(64) NOT NULL,
  target_sheet VARCHAR(60) NOT NULL,
  operation_type VARCHAR(20) NOT NULL DEFAULT 'UPSERT', -- 'UPSERT', 'INSERT', 'UPDATE'
  sync_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'SYNCED', 'FAILED'
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP NULL,
  last_attempt_at TIMESTAMP NULL,
  last_success_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique index to prevent duplicate attendee emails across all registrations
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendees_email ON attendees(LOWER(email));

-- Performance & Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_attendees_email ON attendees(email);
CREATE INDEX IF NOT EXISTS idx_attendees_reg ON attendees(registration_id);
CREATE INDEX IF NOT EXISTS idx_attendees_team ON attendees(team_id);
CREATE INDEX IF NOT EXISTS idx_attendees_verified ON attendees(email_verified);
CREATE INDEX IF NOT EXISTS idx_registrations_ref ON registrations(reference_code);
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_tickets_token ON tickets(ticket_token_hash);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(event_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_attendee ON attendance(attendee_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON google_sheets_sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at);
