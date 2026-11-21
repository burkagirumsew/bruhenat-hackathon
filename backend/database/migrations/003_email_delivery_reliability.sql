-- ==============================================================================
-- BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
-- Database Migration 003: Email Delivery Reliability & Retry Queue
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Add retry and delivery tracking columns safely to email_logs
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS payload_json TEXT NULL;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP NULL;

-- 2. Lookup and ordering index for background email retry worker
CREATE INDEX IF NOT EXISTS idx_email_logs_retry ON email_logs(delivery_status, next_retry_at, retry_count);
