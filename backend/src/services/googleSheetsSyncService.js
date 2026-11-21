/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Google Sheets Synchronization Queue Service
 * Reliable background outbox queue, exponential backoff, and idempotent sync.
 */

const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config/environment');
const googleSheetsClient = require('./googleSheetsClient');
const { logAction } = require('./auditService');
const logger = require('../utils/logger');

function generateSyncId() {
  const hex = crypto.randomBytes(12).toString('hex');
  return `sync_${hex}`;
}

/**
 * Queue an attendee record for Google Sheets synchronization
 */
async function queueAttendeeSync(attendeeId, operation = 'UPSERT', executor = null) {
  const runner = executor || db;
  const pool = db.getPool();
  if (!pool) return null;

  try {
    // Check if there is an existing PENDING queue item for this attendee
    const existing = await runner.getOne(
      `SELECT id FROM google_sheets_sync 
       WHERE entity_type = 'ATTENDEE' AND entity_id = ? AND sync_status = 'PENDING'
       LIMIT 1`,
      [attendeeId]
    );

    if (existing) {
      // Update existing pending item rather than creating duplicates
      await runner.execute(
        `UPDATE google_sheets_sync 
         SET operation_type = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [operation, existing.id]
      );
      return existing.id;
    }

    const id = generateSyncId();
    await runner.execute(
      `INSERT INTO google_sheets_sync (
         id, entity_type, entity_id, target_sheet, operation_type,
         sync_status, retry_count, created_at, updated_at
       ) VALUES (?, 'ATTENDEE', ?, 'ALL_AND_TYPE', ?, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, attendeeId, operation]
    );

    logger.debug(`Queued attendee ${attendeeId} for Google Sheets sync (${id})`);
    return id;
  } catch (err) {
    logger.warn(`Could not queue attendee ${attendeeId} for Google Sheets sync:`, err.message);
    return null;
  }
}

/**
 * Queue an attendance record for Google Sheets synchronization
 */
async function queueAttendanceSync(attendanceId, operation = 'INSERT', executor = null) {
  const runner = executor || db;
  const pool = db.getPool();
  if (!pool) return null;

  try {
    const existing = await runner.getOne(
      `SELECT id FROM google_sheets_sync 
       WHERE entity_type = 'ATTENDANCE' AND entity_id = ? AND sync_status = 'PENDING'
       LIMIT 1`,
      [attendanceId]
    );

    if (existing) {
      await runner.execute(
        `UPDATE google_sheets_sync 
         SET operation_type = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [operation, existing.id]
      );
      return existing.id;
    }

    const id = generateSyncId();
    await runner.execute(
      `INSERT INTO google_sheets_sync (
         id, entity_type, entity_id, target_sheet, operation_type,
         sync_status, retry_count, created_at, updated_at
       ) VALUES (?, 'ATTENDANCE', ?, 'ATTENDANCE', ?, 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, attendanceId, operation]
    );

    logger.debug(`Queued attendance ${attendanceId} for Google Sheets sync (${id})`);
    return id;
  } catch (err) {
    logger.warn(`Could not queue attendance ${attendanceId} for Google Sheets sync:`, err.message);
    return null;
  }
}

/**
 * Synchronize a single attendee into:
 * 1. Sheet A: 'All Attendees'
 * 2. Sheet B or C: 'Individual Registrations' or 'Team Registrations'
 */
async function syncAttendeeToSheets(attendeeId) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const attendee = await db.getOne(
    `SELECT 
       a.id as attendee_id,
       a.full_name,
       a.email,
       a.phone,
       a.city,
       a.discipline,
       a.experience_level,
       a.preferred_track,
       a.is_team_leader,
       a.email_verified,
       a.email_verified_at,
       a.created_at as attendee_created_at,
       r.id as registration_id,
       r.reference_code,
       r.pathway,
       r.submitted_at as registration_submitted_at,
       t.id as team_id,
       t.team_name,
       t.selected_track as team_track,
       tk.ticket_code,
       tk.status as ticket_status,
       (SELECT COUNT(*) FROM attendance att WHERE att.attendee_id = a.id) as check_in_count,
       (SELECT MAX(checked_in_at) FROM attendance att WHERE att.attendee_id = a.id) as last_check_in_time
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON tk.attendee_id = a.id
     WHERE a.id = ?`,
    [attendeeId]
  );

  if (!attendee) {
    throw new Error(`Attendee ${attendeeId} not found in database.`);
  }

  const syncTime = new Date().toISOString();
  const sheetNames = config.googleSheets.sheetNames;
  const track = attendee.team_track || attendee.preferred_track || 'General';
  const role = attendee.pathway === 'INDIVIDUAL' 
    ? 'Individual' 
    : (attendee.is_team_leader ? 'Team Leader' : 'Team Member');
  const verifiedStr = attendee.email_verified ? 'VERIFIED' : 'PENDING';
  const ticketStatusStr = attendee.ticket_status || 'NOT_ISSUED';
  const checkInCount = parseInt(attendee.check_in_count || '0', 10);
  const attendanceStatus = checkInCount > 0 ? 'CHECKED_IN' : 'NOT_ATTENDED';

  // 1. Sync to Sheet A: "All Attendees"
  const allAttendeesRow = [
    attendee.attendee_id,
    attendee.registration_id,
    attendee.pathway,
    attendee.team_id || '',
    attendee.team_name || '',
    attendee.full_name,
    attendee.email,
    attendee.phone || '',
    attendee.city || 'Addis Ababa',
    attendee.discipline || '',
    attendee.experience_level || '',
    track,
    role,
    attendee.attendee_created_at ? new Date(attendee.attendee_created_at).toISOString() : '',
    verifiedStr,
    attendee.email_verified_at ? new Date(attendee.email_verified_at).toISOString() : '',
    attendee.ticket_code || '',
    ticketStatusStr,
    attendanceStatus,
    attendee.last_check_in_time ? new Date(attendee.last_check_in_time).toISOString() : '',
    syncTime
  ];

  await googleSheetsClient.upsertRow(sheetNames.allAttendees, attendee.attendee_id, 0, allAttendeesRow);

  // 2. Sync to Sheet B or Sheet C based on pathway
  if (attendee.pathway === 'INDIVIDUAL') {
    const individualRow = [
      attendee.registration_id,
      attendee.attendee_id,
      attendee.reference_code,
      attendee.full_name,
      attendee.email,
      attendee.phone || '',
      attendee.city || 'Addis Ababa',
      attendee.discipline || '',
      attendee.experience_level || '',
      track,
      attendee.registration_submitted_at ? new Date(attendee.registration_submitted_at).toISOString() : '',
      verifiedStr,
      attendee.ticket_code || '',
      ticketStatusStr,
      syncTime
    ];
    await googleSheetsClient.upsertRow(sheetNames.individualRegistrations, attendee.attendee_id, 1, individualRow);
  } else if (attendee.pathway === 'TEAM' && attendee.team_id) {
    // Find team leader name & email for team sheet
    const leader = await db.getOne(
      'SELECT full_name, email FROM attendees WHERE team_id = ? AND is_team_leader = TRUE LIMIT 1',
      [attendee.team_id]
    );

    const teamRow = [
      attendee.team_id,
      attendee.registration_id,
      attendee.reference_code,
      attendee.team_name || '',
      attendee.team_track || track,
      leader ? leader.full_name : attendee.full_name,
      leader ? leader.email : attendee.email,
      attendee.attendee_id,
      attendee.full_name,
      attendee.email,
      attendee.phone || '',
      attendee.is_team_leader ? 'LEADER' : 'MEMBER',
      attendee.discipline || '',
      attendee.registration_submitted_at ? new Date(attendee.registration_submitted_at).toISOString() : '',
      verifiedStr,
      attendee.ticket_code || '',
      ticketStatusStr,
      syncTime
    ];
    // Attendee ID is at column index 7 (Column H)
    await googleSheetsClient.upsertRow(sheetNames.teamRegistrations, attendee.attendee_id, 7, teamRow);
  }

  return { attendeeId, syncedAt: syncTime };
}

/**
 * Synchronize a single attendance record into Sheet D: 'Attendance Records'
 */
async function syncAttendanceToSheets(attendanceId) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const row = await db.getOne(
    `SELECT 
       att.id as attendance_id,
       att.attendee_id,
       att.check_in_method,
       att.checked_in_at,
       a.full_name,
       a.email,
       r.pathway,
       t.team_name,
       tk.ticket_code,
       es.id as session_id,
       es.session_name,
       es.event_date,
       adm.full_name as staff_name
     FROM attendance att
     JOIN attendees a ON att.attendee_id = a.id
     JOIN registrations r ON a.registration_id = r.id
     JOIN event_sessions es ON att.event_session_id = es.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON att.ticket_id = tk.id
     LEFT JOIN admins adm ON att.checked_in_by = adm.id
     WHERE att.id = ?`,
    [attendanceId]
  );

  if (!row) {
    throw new Error(`Attendance record ${attendanceId} not found in database.`);
  }

  const syncTime = new Date().toISOString();
  const sheetNames = config.googleSheets.sheetNames;

  const attendanceRow = [
    row.attendance_id,
    row.attendee_id,
    row.full_name,
    row.email,
    row.pathway,
    row.team_name || '',
    row.ticket_code || '',
    row.session_id,
    row.session_name,
    row.event_date,
    row.checked_in_at ? new Date(row.checked_in_at).toISOString() : '',
    row.check_in_method,
    row.staff_name || 'Staff',
    syncTime
  ];

  // Upsert on Attendance ID (Column A, index 0)
  await googleSheetsClient.upsertRow(sheetNames.attendanceRecords, row.attendance_id, 0, attendanceRow);

  // Also update attendee's row in "All Attendees" to reflect new attendance status & last check-in time
  try {
    await syncAttendeeToSheets(row.attendee_id);
  } catch (attErr) {
    logger.warn(`Could not update attendee ${row.attendee_id} summary in All Attendees:`, attErr.message);
  }

  return { attendanceId, syncedAt: syncTime };
}

/**
 * Process pending and retryable items in the synchronization queue
 */
async function processSyncQueue({ batchSize = 10 } = {}) {
  if (!config.googleSheets.enabled) {
    return { processed: 0, successful: 0, failed: 0, message: 'Google Sheets integration is disabled in configuration.' };
  }

  const pool = db.getPool();
  if (!pool) {
    return { processed: 0, successful: 0, failed: 0, message: 'Database is not connected.' };
  }

  // 1. Ensure worksheets and headers exist before syncing
  await googleSheetsClient.ensureWorksheetsExist();

  // 2. Fetch up to batchSize items eligible for processing
  const items = await db.query(
    `SELECT * FROM google_sheets_sync
     WHERE sync_status = 'PENDING'
        OR (sync_status = 'FAILED' AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP) AND retry_count < 5)
     ORDER BY created_at ASC
     LIMIT ?`,
    [batchSize]
  );

  if (items.length === 0) {
    return { processed: 0, successful: 0, failed: 0, message: 'Queue is clear.' };
  }

  let successful = 0;
  let failed = 0;

  for (const item of items) {
    // Atomically mark item as PROCESSING
    await db.execute(
      `UPDATE google_sheets_sync 
       SET sync_status = 'PROCESSING', last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [item.id]
    );

    try {
      if (item.entity_type === 'ATTENDEE' || item.entity_type === 'INDIVIDUAL') {
        await syncAttendeeToSheets(item.entity_id);
      } else if (item.entity_type === 'TEAM') {
        const members = await db.query('SELECT id FROM attendees WHERE team_id = ?', [item.entity_id]);
        for (const m of members) {
          await syncAttendeeToSheets(m.id);
        }
      } else if (item.entity_type === 'ATTENDANCE') {
        await syncAttendanceToSheets(item.entity_id);
      } else {
        logger.warn(`Unknown sync entity_type: ${item.entity_type}`);
      }

      // Mark SYNCED
      await db.execute(
        `UPDATE google_sheets_sync 
         SET sync_status = 'SYNCED', last_success_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP,
             error_message = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [item.id]
      );
      successful++;
    } catch (err) {
      failed++;
      const nextRetryCount = item.retry_count + 1;
      const sanitizedError = (err.message || 'Unknown synchronization error').replace(/(\b[A-Za-z0-9_-]{20,}\b)/g, '[REDACTED]');

      if (nextRetryCount >= 5) {
        // Max retries exceeded -> FAILED
        await db.execute(
          `UPDATE google_sheets_sync 
           SET sync_status = 'FAILED', retry_count = ?, next_retry_at = NULL,
               error_message = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [nextRetryCount, sanitizedError, item.id]
        );
      } else {
        // Exponential backoff: 2^retry * 60 seconds (1m, 2m, 4m, 8m)
        const delaySeconds = Math.pow(2, nextRetryCount) * 60;
        await db.execute(
          `UPDATE google_sheets_sync 
           SET sync_status = 'FAILED', retry_count = ?,
               next_retry_at = CURRENT_TIMESTAMP + (? || ' seconds')::INTERVAL,
               error_message = ?, updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [nextRetryCount, String(delaySeconds), sanitizedError, item.id]
        );
      }

      logger.error(`Google Sheets sync failed for item ${item.id} (${item.entity_type}:${item.entity_id}):`, err.message);
    }
  }

  return {
    processed: items.length,
    successful,
    failed,
    timestamp: new Date().toISOString()
  };
}

/**
 * Perform a full bulk synchronization of all existing PostgreSQL records
 */
async function bulkSyncExistingRecords(adminId, ipAddress) {
  if (!config.googleSheets.enabled) {
    throw new Error('Google Sheets integration is disabled via GOOGLE_SHEETS_ENABLED=false.');
  }

  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  // Verify connection first
  const conn = await googleSheetsClient.testConnection();
  if (!conn.connected) {
    throw new Error(`Google Sheets connection test failed: ${conn.message}`);
  }

  // Ensure worksheets exist
  await googleSheetsClient.ensureWorksheetsExist();

  // 1. Fetch all attendees
  const attendees = await db.query('SELECT id FROM attendees ORDER BY created_at ASC');

  // 2. Fetch all attendance records
  const attendance = await db.query('SELECT id FROM attendance ORDER BY checked_in_at ASC');

  let attendeesSynced = 0;
  let attendeesFailed = 0;
  let attendanceSynced = 0;
  let attendanceFailed = 0;
  const errors = [];

  // Sync attendees
  for (const a of attendees) {
    try {
      await syncAttendeeToSheets(a.id);
      attendeesSynced++;
      // Mark any pending queue items for this attendee as SYNCED
      await db.execute(
        `UPDATE google_sheets_sync 
         SET sync_status = 'SYNCED', last_success_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE entity_type = 'ATTENDEE' AND entity_id = ?`,
        [a.id]
      );
    } catch (err) {
      attendeesFailed++;
      if (errors.length < 5) errors.push(`Attendee ${a.id}: ${err.message}`);
    }
  }

  // Sync attendance
  for (const att of attendance) {
    try {
      await syncAttendanceToSheets(att.id);
      attendanceSynced++;
      await db.execute(
        `UPDATE google_sheets_sync 
         SET sync_status = 'SYNCED', last_success_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE entity_type = 'ATTENDANCE' AND entity_id = ?`,
        [att.id]
      );
    } catch (err) {
      attendanceFailed++;
      if (errors.length < 5) errors.push(`Attendance ${att.id}: ${err.message}`);
    }
  }

  await logAction({
    adminId,
    action: 'GOOGLE_SHEETS_BULK_SYNC',
    targetType: 'google_sheets',
    details: {
      attendeesProcessed: attendees.length,
      attendeesSynced,
      attendanceProcessed: attendance.length,
      attendanceSynced
    },
    ipAddress
  });

  return {
    success: attendeesFailed === 0 && attendanceFailed === 0,
    attendees: { total: attendees.length, synced: attendeesSynced, failed: attendeesFailed },
    attendance: { total: attendance.length, synced: attendanceSynced, failed: attendanceFailed },
    errors,
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset all failed records to PENDING and trigger queue processing
 */
async function retryFailedRecords(adminId, ipAddress) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const updateRes = await db.execute(
    `UPDATE google_sheets_sync 
     SET sync_status = 'PENDING', retry_count = 0, next_retry_at = NULL, updated_at = CURRENT_TIMESTAMP 
     WHERE sync_status = 'FAILED'`
  );

  await logAction({
    adminId,
    action: 'GOOGLE_SHEETS_RETRY_FAILED',
    targetType: 'google_sheets',
    details: { retriedCount: updateRes.rowCount },
    ipAddress
  });

  const processResult = await processSyncQueue();

  return {
    resetCount: updateRes.rowCount,
    processResult
  };
}

/**
 * Retrieve comprehensive status and metrics for the Admin Dashboard
 */
async function getSyncStatus() {
  const pool = db.getPool();

  let queueMetrics = {
    total: 0,
    synced: 0,
    pending: 0,
    processing: 0,
    failed: 0,
    awaitingRetry: 0,
    lastSuccessfulSync: null,
    lastAttempt: null
  };

  if (pool) {
    try {
      const statsRow = await db.getOne(
        `SELECT 
           COUNT(*) as total,
           COUNT(CASE WHEN sync_status = 'SYNCED' THEN 1 END) as synced,
           COUNT(CASE WHEN sync_status = 'PENDING' THEN 1 END) as pending,
           COUNT(CASE WHEN sync_status = 'PROCESSING' THEN 1 END) as processing,
           COUNT(CASE WHEN sync_status = 'FAILED' THEN 1 END) as failed,
           COUNT(CASE WHEN sync_status = 'FAILED' AND next_retry_at > CURRENT_TIMESTAMP THEN 1 END) as awaiting_retry,
           MAX(last_success_at) as last_success_at,
           MAX(last_attempt_at) as last_attempt_at
         FROM google_sheets_sync`
      );

      if (statsRow) {
        queueMetrics = {
          total: parseInt(statsRow.total || '0', 10),
          synced: parseInt(statsRow.synced || '0', 10),
          pending: parseInt(statsRow.pending || '0', 10),
          processing: parseInt(statsRow.processing || '0', 10),
          failed: parseInt(statsRow.failed || '0', 10),
          awaitingRetry: parseInt(statsRow.awaiting_retry || '0', 10),
          lastSuccessfulSync: statsRow.last_success_at,
          lastAttempt: statsRow.last_attempt_at
        };
      }
    } catch (dbErr) {
      logger.debug('Could not query google_sheets_sync metrics (database offline or unreachable):', dbErr.message);
    }
  }

  // Real connection test
  const connection = await googleSheetsClient.testConnection();

  const spreadsheetId = config.googleSheets.spreadsheetId;
  const spreadsheetUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null;

  return {
    enabled: config.googleSheets.enabled,
    connection,
    spreadsheetId: spreadsheetId ? `${spreadsheetId.slice(0, 8)}...${spreadsheetId.slice(-4)}` : null,
    spreadsheetUrl,
    sheetNames: config.googleSheets.sheetNames,
    queue: queueMetrics,
    timestamp: new Date().toISOString()
  };
}

/**
 * Retrieve paginated synchronization queue items
 */
async function getSyncQueue({ page = 1, limit = 20, status = '' } = {}) {
  const pool = db.getPool();
  if (!pool) return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };

  const offset = (Math.max(1, page) - 1) * limit;
  const whereClauses = [];
  const params = [];

  if (status && status.trim()) {
    whereClauses.push('sync_status = ?');
    params.push(status.trim().toUpperCase());
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRow = await db.getOne(
    `SELECT COUNT(*) as total FROM google_sheets_sync ${whereSql}`,
    params
  );
  const total = parseInt(countRow ? countRow.total : '0', 10);

  const items = await db.query(
    `SELECT * FROM google_sheets_sync
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    items: items.map(i => ({
      id: i.id,
      entityType: i.entity_type,
      entityId: i.entity_id,
      targetSheet: i.target_sheet,
      operationType: i.operation_type,
      status: i.sync_status,
      retryCount: i.retry_count,
      nextRetryAt: i.next_retry_at,
      lastAttemptAt: i.last_attempt_at,
      lastSuccessAt: i.last_success_at,
      completedAt: i.completed_at,
      error: i.error_message,
      createdAt: i.created_at
    })),
    pagination: {
      page: Math.max(1, page),
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

module.exports = {
  queueAttendeeSync,
  queueAttendanceSync,
  syncAttendeeToSheets,
  syncAttendanceToSheets,
  processSyncQueue,
  bulkSyncExistingRecords,
  retryFailedRecords,
  getSyncStatus,
  getSyncQueue
};
