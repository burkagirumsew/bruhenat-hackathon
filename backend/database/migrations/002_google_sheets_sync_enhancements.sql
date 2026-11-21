-- ==============================================================================
-- BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
-- Database Migration 002: Google Sheets Synchronization Queue Enhancements
-- Adds idempotency tracking, operation types, retry scheduling, and completion times.
-- Target: PostgreSQL / Supabase
-- ==============================================================================

-- 1. Add columns safely if not already present
ALTER TABLE google_sheets_sync ADD COLUMN IF NOT EXISTS operation_type VARCHAR(20) NOT NULL DEFAULT 'UPSERT';
ALTER TABLE google_sheets_sync ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP NULL;
ALTER TABLE google_sheets_sync ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL;

-- 2. Performance & Lookup Indexes for Queue Processing
CREATE INDEX IF NOT EXISTS idx_sheets_sync_queue ON google_sheets_sync(sync_status, next_retry_at, created_at);
CREATE INDEX IF NOT EXISTS idx_sheets_sync_entity ON google_sheets_sync(entity_type, entity_id);
