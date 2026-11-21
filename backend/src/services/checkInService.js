/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Check-In Service
 * QR Code scanning, manual check-in, duplicate prevention, and attendee search.
 */

const crypto = require('crypto');
const db = require('../config/database');
const { getActiveSession } = require('./sessionService');
const { logAction } = require('./auditService');
const logger = require('../utils/logger');

/**
 * Extract ticket code from QR payload or raw string
 */
function extractTicketCode(rawInput) {
  if (!rawInput) return null;

  if (typeof rawInput === 'object' && rawInput.code) {
    return String(rawInput.code).trim().toUpperCase();
  }

  const str = String(rawInput).trim();

  // Try JSON parse if it looks like a JSON object
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.code) return String(parsed.code).trim().toUpperCase();
    } catch (e) {
      // not json, continue
    }
  }

  // Check if it matches BE26-XXXX-XXXX
  const match = str.match(/BE26-[A-F0-9]{4}-[A-F0-9]{4}/i);
  if (match) {
    return match[0].toUpperCase();
  }

  return str.toUpperCase();
}

/**
 * Perform QR check-in
 */
async function checkInByQr({ qrData, ticketCode, sessionId, adminId, ipAddress }) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const code = extractTicketCode(ticketCode || qrData);
  if (!code) {
    const error = new Error('Invalid QR code format. Could not extract valid ticket code.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Resolve Session
  let targetSessionId = sessionId;
  let sessionName = '';
  if (!targetSessionId) {
    const active = await getActiveSession();
    if (!active) {
      const error = new Error('No active event session found. Please activate an event session in the admin panel before checking in attendees.');
      error.statusCode = 400;
      throw error;
    }
    targetSessionId = active.id;
    sessionName = active.sessionName;
  } else {
    const s = await db.getOne('SELECT id, session_name FROM event_sessions WHERE id = ?', [targetSessionId]);
    if (!s) {
      const error = new Error('Specified event session not found.');
      error.statusCode = 404;
      throw error;
    }
    sessionName = s.session_name;
  }

  // 2. Fetch Ticket & Attendee Details
  const ticket = await db.getOne(
    `SELECT tk.id as ticket_id, tk.ticket_code, tk.status as ticket_status, tk.revoked_reason,
            a.id as attendee_id, a.full_name, a.email, a.phone, a.discipline, a.preferred_track,
            a.is_team_leader, a.email_verified,
            r.reference_code, r.pathway,
            t.team_name, t.selected_track
     FROM tickets tk
     JOIN attendees a ON tk.attendee_id = a.id
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     WHERE tk.ticket_code = ?`,
    [code]
  );

  if (!ticket) {
    const error = new Error(`Ticket "${code}" not found. Please verify the ticket or assist attendee at the help desk.`);
    error.statusCode = 404;
    throw error;
  }

  // 3. Ticket Status Check
  if (ticket.ticket_status === 'REVOKED') {
    const reason = ticket.revoked_reason ? ` Reason: ${ticket.revoked_reason}` : '';
    const error = new Error(`Ticket "${code}" has been REVOKED.${reason}`);
    error.statusCode = 403;
    error.ticketStatus = 'REVOKED';
    throw error;
  }

  // 4. Verification Check
  if (!ticket.email_verified) {
    const error = new Error(`Attendee "${ticket.full_name}" has not verified their email address.`);
    error.statusCode = 400;
    error.unverified = true;
    throw error;
  }

  // 5. Duplicate Check
  const existingCheckIn = await db.getOne(
    `SELECT att.id, att.checked_in_at, att.check_in_method, adm.full_name as staff_name
     FROM attendance att
     LEFT JOIN admins adm ON att.checked_in_by = adm.id
     WHERE att.attendee_id = ? AND att.event_session_id = ?`,
    [ticket.attendee_id, targetSessionId]
  );

  if (existingCheckIn) {
    const checkedAt = new Date(existingCheckIn.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const staff = existingCheckIn.staff_name || 'Staff';
    const error = new Error(`ALREADY CHECKED IN: ${ticket.full_name} was already checked in for "${sessionName}" at ${checkedAt} by ${staff}.`);
    error.statusCode = 409;
    error.alreadyCheckedIn = true;
    error.existingCheckIn = {
      checkedInAt: existingCheckIn.checked_in_at,
      checkInMethod: existingCheckIn.check_in_method,
      staffName: staff
    };
    error.attendee = {
      fullName: ticket.full_name,
      teamName: ticket.team_name,
      track: ticket.selected_track || ticket.preferred_track
    };
    throw error;
  }

  // 6. Record Check-In & Transactional Outbox inside Transaction
  const checkInId = `att_${crypto.randomBytes(8).toString('hex')}`;
  try {
    await db.transaction(async (tx) => {
      // 6a. Record Attendance
      await tx.execute(
        `INSERT INTO attendance (id, attendee_id, ticket_id, event_session_id, check_in_method, checked_in_by, checked_in_at)
         VALUES (?, ?, ?, ?, 'QR_SCAN', ?, CURRENT_TIMESTAMP)`,
        [checkInId, ticket.attendee_id, ticket.ticket_id, targetSessionId, adminId || null]
      );

      // 6b. Transactional Outbox: Queue attendance record for Google Sheets
      const syncAttendanceId = `sync_${crypto.randomBytes(12).toString('hex')}`;
      await tx.execute(
        `INSERT INTO google_sheets_sync (
           id, entity_type, entity_id, target_sheet, operation_type,
           sync_status, retry_count, created_at, updated_at
         ) VALUES (?, 'ATTENDANCE', ?, 'Attendance Records', 'INSERT', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [syncAttendanceId, checkInId]
      );

      // 6c. Transactional Outbox: Queue attendee record for Google Sheets (updates check-in status in All Attendees)
      const syncAttendeeId = `sync_${crypto.randomBytes(12).toString('hex')}`;
      await tx.execute(
        `INSERT INTO google_sheets_sync (
           id, entity_type, entity_id, target_sheet, operation_type,
           sync_status, retry_count, created_at, updated_at
         ) VALUES (?, 'ATTENDEE', ?, 'All Attendees', 'UPSERT', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [syncAttendeeId, ticket.attendee_id]
      );
    });
  } catch (err) {
    // Catch database unique constraint violation (code 23505 in PostgreSQL)
    if (err.code === '23505' || err.message.includes('unique') || err.message.includes('duplicate')) {
      const error = new Error(`ALREADY CHECKED IN: ${ticket.full_name} was just checked in for "${sessionName}".`);
      error.statusCode = 409;
      error.alreadyCheckedIn = true;
      throw error;
    }
    throw err;
  }

  // 7. Record in audit log
  await logAction({
    adminId,
    action: 'CHECKIN_SUCCESS',
    targetType: 'attendance',
    targetId: checkInId,
    details: {
      ticketCode: ticket.ticket_code,
      attendeeName: ticket.full_name,
      sessionId: targetSessionId,
      sessionName,
      method: 'QR_SCAN'
    },
    ipAddress
  });

  logger.info(`Checked in ${ticket.full_name} (${ticket.ticket_code}) for ${sessionName} via QR_SCAN`);

  return {
    success: true,
    checkInId,
    checkedInAt: new Date().toISOString(),
    session: { id: targetSessionId, name: sessionName },
    attendee: {
      id: ticket.attendee_id,
      fullName: ticket.full_name,
      email: ticket.email,
      phone: ticket.phone,
      discipline: ticket.discipline,
      track: ticket.selected_track || ticket.preferred_track || 'General',
      pathway: ticket.pathway,
      teamName: ticket.team_name,
      isTeamLeader: Boolean(ticket.is_team_leader),
      referenceCode: ticket.reference_code,
      ticketCode: ticket.ticket_code
    }
  };
}

/**
 * Perform Manual check-in with reason
 */
async function checkInManual({ attendeeId, sessionId, reason, adminId, ipAddress }) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  if (!attendeeId) throw new Error('attendeeId is required for manual check-in.');
  if (!reason || !reason.trim()) throw new Error('A reason is required for manual check-in.');

  // 1. Resolve Session
  let targetSessionId = sessionId;
  let sessionName = '';
  if (!targetSessionId) {
    const active = await getActiveSession();
    if (!active) {
      const error = new Error('No active event session found.');
      error.statusCode = 400;
      throw error;
    }
    targetSessionId = active.id;
    sessionName = active.sessionName;
  } else {
    const s = await db.getOne('SELECT id, session_name FROM event_sessions WHERE id = ?', [targetSessionId]);
    if (!s) {
      const error = new Error('Specified event session not found.');
      error.statusCode = 404;
      throw error;
    }
    sessionName = s.session_name;
  }

  // 2. Fetch attendee & ticket
  const attendee = await db.getOne(
    `SELECT a.*, r.reference_code, r.pathway, t.team_name, t.selected_track,
            tk.id as ticket_id, tk.ticket_code, tk.status as ticket_status, tk.revoked_reason
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON tk.attendee_id = a.id
     WHERE a.id = ?`,
    [attendeeId]
  );

  if (!attendee) {
    const error = new Error('Attendee not found.');
    error.statusCode = 404;
    throw error;
  }

  if (attendee.ticket_status === 'REVOKED') {
    const error = new Error(`Attendee ticket has been REVOKED: ${attendee.revoked_reason || 'No reason provided'}.`);
    error.statusCode = 403;
    throw error;
  }

  // 3. Duplicate Check
  const existingCheckIn = await db.getOne(
    `SELECT att.id, att.checked_in_at, att.check_in_method, adm.full_name as staff_name
     FROM attendance att
     LEFT JOIN admins adm ON att.checked_in_by = adm.id
     WHERE att.attendee_id = ? AND att.event_session_id = ?`,
    [attendeeId, targetSessionId]
  );

  if (existingCheckIn) {
    const checkedAt = new Date(existingCheckIn.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const staff = existingCheckIn.staff_name || 'Staff';
    const error = new Error(`ALREADY CHECKED IN: ${attendee.full_name} was already checked in for "${sessionName}" at ${checkedAt} by ${staff}.`);
    error.statusCode = 409;
    error.alreadyCheckedIn = true;
    error.existingCheckIn = {
      checkedInAt: existingCheckIn.checked_in_at,
      checkInMethod: existingCheckIn.check_in_method,
      staffName: staff
    };
    throw error;
  }

  // 4. Record Check-In & Transactional Outbox inside Transaction
  const checkInId = `att_${crypto.randomBytes(8).toString('hex')}`;
  try {
    await db.transaction(async (tx) => {
      // 4a. Record Attendance
      await tx.execute(
        `INSERT INTO attendance (id, attendee_id, ticket_id, event_session_id, check_in_method, checked_in_by, checked_in_at)
         VALUES (?, ?, ?, ?, 'MANUAL', ?, CURRENT_TIMESTAMP)`,
        [checkInId, attendeeId, attendee.ticket_id || null, targetSessionId, adminId || null]
      );

      // 4b. Transactional Outbox: Queue attendance record for Google Sheets
      const syncAttendanceId = `sync_${crypto.randomBytes(12).toString('hex')}`;
      await tx.execute(
        `INSERT INTO google_sheets_sync (
           id, entity_type, entity_id, target_sheet, operation_type,
           sync_status, retry_count, created_at, updated_at
         ) VALUES (?, 'ATTENDANCE', ?, 'Attendance Records', 'INSERT', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [syncAttendanceId, checkInId]
      );

      // 4c. Transactional Outbox: Queue attendee record for Google Sheets (updates check-in status in All Attendees)
      const syncAttendeeId = `sync_${crypto.randomBytes(12).toString('hex')}`;
      await tx.execute(
        `INSERT INTO google_sheets_sync (
           id, entity_type, entity_id, target_sheet, operation_type,
           sync_status, retry_count, created_at, updated_at
         ) VALUES (?, 'ATTENDEE', ?, 'All Attendees', 'UPSERT', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [syncAttendeeId, attendeeId]
      );
    });
  } catch (err) {
    if (err.code === '23505' || err.message.includes('unique') || err.message.includes('duplicate')) {
      const error = new Error(`ALREADY CHECKED IN: ${attendee.full_name} is already checked in.`);
      error.statusCode = 409;
      error.alreadyCheckedIn = true;
      throw error;
    }
    throw err;
  }

  // 5. Record Audit Log
  await logAction({
    adminId,
    action: 'CHECKIN_MANUAL',
    targetType: 'attendance',
    targetId: checkInId,
    details: {
      attendeeName: attendee.full_name,
      attendeeEmail: attendee.email,
      ticketCode: attendee.ticket_code,
      sessionId: targetSessionId,
      sessionName,
      method: 'MANUAL',
      reason: reason.trim()
    },
    ipAddress
  });

  logger.info(`Manually checked in ${attendee.full_name} for ${sessionName}. Reason: ${reason}`);

  return {
    success: true,
    checkInId,
    checkedInAt: new Date().toISOString(),
    session: { id: targetSessionId, name: sessionName },
    attendee: {
      id: attendee.id,
      fullName: attendee.full_name,
      email: attendee.email,
      phone: attendee.phone,
      discipline: attendee.discipline,
      track: attendee.selected_track || attendee.preferred_track || 'General',
      pathway: attendee.pathway,
      teamName: attendee.team_name,
      isTeamLeader: Boolean(attendee.is_team_leader),
      referenceCode: attendee.reference_code,
      ticketCode: attendee.ticket_code
    }
  };
}

/**
 * Search attendees for on-site check-in desk
 */
async function searchAttendeesForCheckIn(queryStr, sessionId = null) {
  const pool = db.getPool();
  if (!pool || !queryStr || !queryStr.trim()) return [];

  let targetSessionId = sessionId;
  if (!targetSessionId) {
    const active = await getActiveSession();
    if (active) targetSessionId = active.id;
  }

  const term = `%${queryStr.trim().toLowerCase()}%`;
  const sessionJoin = targetSessionId
    ? 'LEFT JOIN attendance att ON att.attendee_id = a.id AND att.event_session_id = ?'
    : 'LEFT JOIN attendance att ON 1=0';
  const params = targetSessionId
    ? [targetSessionId, term, term, term, term, term, term]
    : [term, term, term, term, term, term];

  const rows = await db.query(
    `SELECT 
       a.id, a.full_name, a.email, a.phone, a.discipline, a.preferred_track, a.is_team_leader, a.email_verified,
       r.reference_code, r.pathway,
       t.team_name, t.selected_track,
       tk.id as ticket_id, tk.ticket_code, tk.status as ticket_status,
       att.id as attendance_id, att.checked_in_at, att.check_in_method
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON tk.attendee_id = a.id
     ${sessionJoin}
     WHERE (LOWER(a.full_name) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(COALESCE(a.phone, '')) LIKE ? OR LOWER(r.reference_code) LIKE ? OR LOWER(COALESCE(tk.ticket_code, '')) LIKE ? OR LOWER(COALESCE(t.team_name, '')) LIKE ?)
     ORDER BY a.full_name ASC
     LIMIT 25`,
    params
  );

  return rows.map(r => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    discipline: r.discipline,
    track: r.selected_track || r.preferred_track || 'General',
    pathway: r.pathway,
    teamName: r.team_name,
    isTeamLeader: Boolean(r.is_team_leader),
    referenceCode: r.reference_code,
    ticketCode: r.ticket_code,
    ticketStatus: r.ticket_status || 'NONE',
    emailVerified: Boolean(r.email_verified),
    isCheckedIn: Boolean(r.attendance_id),
    checkedInAt: r.checked_in_at,
    checkInMethod: r.check_in_method
  }));
}

/**
 * Get recent check-ins for the active session (live desk feed)
 */
async function getRecentCheckIns(sessionId = null, limit = 10) {
  const pool = db.getPool();
  if (!pool) return [];

  let targetSessionId = sessionId;
  if (!targetSessionId) {
    const active = await getActiveSession();
    if (active) targetSessionId = active.id;
  }

  const whereSql = targetSessionId ? 'WHERE att.event_session_id = ?' : '';
  const params = targetSessionId ? [targetSessionId, limit] : [limit];

  const rows = await db.query(
    `SELECT att.id, att.checked_in_at, att.check_in_method,
            a.full_name, a.email, a.preferred_track,
            t.team_name, t.selected_track,
            tk.ticket_code,
            adm.full_name as staff_name
     FROM attendance att
     JOIN attendees a ON att.attendee_id = a.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON att.ticket_id = tk.id
     LEFT JOIN admins adm ON att.checked_in_by = adm.id
     ${whereSql}
     ORDER BY att.checked_in_at DESC
     LIMIT ?`,
    params
  );

  return rows.map(r => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    teamName: r.team_name,
    track: r.selected_track || r.preferred_track || 'General',
    ticketCode: r.ticket_code,
    method: r.check_in_method,
    checkedInAt: r.checked_in_at,
    staffName: r.staff_name || 'Staff'
  }));
}

module.exports = {
  extractTicketCode,
  checkInByQr,
  checkInManual,
  searchAttendeesForCheckIn,
  getRecentCheckIns
};
