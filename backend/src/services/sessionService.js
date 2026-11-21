/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Event Session Management Service
 * Multi-day sprint & tentative day 2 session tracking
 */

const crypto = require('crypto');
const db = require('../config/database');
const { logAction } = require('./auditService');
const logger = require('../utils/logger');

/**
 * Ensure default hackathon sessions exist
 */
async function ensureDefaultSessions() {
  const pool = db.getPool();
  if (!pool) return;

  const countRow = await db.getOne('SELECT COUNT(*) as count FROM event_sessions');
  const count = parseInt(countRow ? countRow.count : '0', 10);
  if (count === 0) {
    logger.info('Initializing default event sessions in database...');
    const s1Id = `ses_${crypto.randomBytes(8).toString('hex')}`;
    const s2Id = `ses_${crypto.randomBytes(8).toString('hex')}`;

    await db.execute(
      `INSERT INTO event_sessions (id, session_code, session_name, event_date, start_time, end_time, venue_name, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)`,
      [s1Id, 'DAY-1', 'Day 1: Innovation Sprint & Opening', '2026-03-27', '08:00 AM', '06:00 PM', 'Capstone ALX Tech Hub, Lideta']
    );

    await db.execute(
      `INSERT INTO event_sessions (id, session_code, session_name, event_date, start_time, end_time, venue_name, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP)`,
      [s2Id, 'DAY-2', 'Day 2: Demo Day, Judging & Awards Ceremony', '2026-03-28', '09:00 AM', '05:00 PM', 'Capstone ALX Tech Hub, Lideta']
    );
  }
}

/**
 * List all sessions with checked-in metrics
 */
async function listSessions() {
  const pool = db.getPool();
  if (!pool) return [];

  await ensureDefaultSessions();

  const sessions = await db.query(
    `SELECT es.*, COUNT(att.id) as checked_in_count
     FROM event_sessions es
     LEFT JOIN attendance att ON att.event_session_id = es.id
     GROUP BY es.id
     ORDER BY es.created_at ASC`
  );

  return sessions.map(s => ({
    id: s.id,
    sessionCode: s.session_code,
    sessionName: s.session_name,
    eventDate: s.event_date,
    startTime: s.start_time,
    endTime: s.end_time,
    venueName: s.venue_name,
    isActive: Boolean(s.is_active),
    checkedInCount: parseInt(s.checked_in_count || '0', 10),
    createdAt: s.created_at
  }));
}

/**
 * Get currently active session
 */
async function getActiveSession() {
  const pool = db.getPool();
  if (!pool) return null;

  await ensureDefaultSessions();

  const session = await db.getOne(
    `SELECT es.*, COUNT(att.id) as checked_in_count
     FROM event_sessions es
     LEFT JOIN attendance att ON att.event_session_id = es.id
     WHERE es.is_active = TRUE
     GROUP BY es.id
     LIMIT 1`
  );

  if (!session) return null;

  return {
    id: session.id,
    sessionCode: session.session_code,
    sessionName: session.session_name,
    eventDate: session.event_date,
    startTime: session.start_time,
    endTime: session.end_time,
    venueName: session.venue_name,
    isActive: Boolean(session.is_active),
    checkedInCount: parseInt(session.checked_in_count || '0', 10),
    createdAt: session.created_at
  };
}

/**
 * Create a new event session
 */
async function createSession(data, adminId, ipAddress) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const { sessionCode, sessionName, eventDate, startTime, endTime, venueName } = data;
  if (!sessionCode || !sessionName || !eventDate) {
    throw new Error('sessionCode, sessionName, and eventDate are required.');
  }

  const existing = await db.getOne('SELECT id FROM event_sessions WHERE session_code = ?', [sessionCode.trim().toUpperCase()]);
  if (existing) {
    throw new Error(`Session code "${sessionCode}" is already in use.`);
  }

  const id = `ses_${crypto.randomBytes(8).toString('hex')}`;
  await db.execute(
    `INSERT INTO event_sessions (id, session_code, session_name, event_date, start_time, end_time, venue_name, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, CURRENT_TIMESTAMP)`,
    [
      id,
      sessionCode.trim().toUpperCase(),
      sessionName.trim(),
      eventDate.trim(),
      startTime || '08:00 AM',
      endTime || '06:00 PM',
      venueName || 'Capstone ALX Tech Hub, Lideta'
    ]
  );

  await logAction({
    adminId,
    action: 'SESSION_CREATED',
    targetType: 'event_session',
    targetId: id,
    details: { sessionCode, sessionName, eventDate },
    ipAddress
  });

  return { id, sessionCode, sessionName, eventDate };
}

/**
 * Update an existing session
 */
async function updateSession(id, data, adminId, ipAddress) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const session = await db.getOne('SELECT * FROM event_sessions WHERE id = ?', [id]);
  if (!session) throw new Error('Session not found.');

  const sessionName = data.sessionName !== undefined ? data.sessionName : session.session_name;
  const eventDate = data.eventDate !== undefined ? data.eventDate : session.event_date;
  const startTime = data.startTime !== undefined ? data.startTime : session.start_time;
  const endTime = data.endTime !== undefined ? data.endTime : session.end_time;
  const venueName = data.venueName !== undefined ? data.venueName : session.venue_name;

  await db.execute(
    `UPDATE event_sessions
     SET session_name = ?, event_date = ?, start_time = ?, end_time = ?, venue_name = ?
     WHERE id = ?`,
    [sessionName, eventDate, startTime, endTime, venueName, id]
  );

  await logAction({
    adminId,
    action: 'SESSION_UPDATED',
    targetType: 'event_session',
    targetId: id,
    details: { sessionName, eventDate },
    ipAddress
  });

  return { id, sessionName, eventDate };
}

/**
 * Activate a session (deactivates others so only one is active at a time)
 */
async function activateSession(id, adminId, ipAddress) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const session = await db.getOne('SELECT * FROM event_sessions WHERE id = ?', [id]);
  if (!session) throw new Error('Session not found.');

  // Transaction: Deactivate all, activate this one
  await db.transaction(async (tx) => {
    await tx.execute('UPDATE event_sessions SET is_active = FALSE');
    await tx.execute('UPDATE event_sessions SET is_active = TRUE WHERE id = ?', [id]);
  });

  await logAction({
    adminId,
    action: 'SESSION_ACTIVATED',
    targetType: 'event_session',
    targetId: id,
    details: { sessionCode: session.session_code, sessionName: session.session_name },
    ipAddress
  });

  return { id, sessionCode: session.session_code, sessionName: session.session_name, isActive: true };
}

/**
 * Get attendance records for a specific session
 */
async function getSessionAttendance(sessionId, { page = 1, limit = 50, search = '' } = {}) {
  const pool = db.getPool();
  if (!pool) {
    return {
      session: { id: sessionId },
      attendees: [],
      pagination: { page, limit, total: 0, totalPages: 0 }
    };
  }

  try {
    const session = await db.getOne(
      `SELECT id, session_code, session_name, event_date, start_time, end_time, venue_name, is_active
       FROM event_sessions
       WHERE id = ?`,
      [sessionId]
    );
    if (!session) throw new Error('Session not found.');

    const whereClauses = ['att.event_session_id = ?'];
    const params = [sessionId];

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(a.full_name) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(COALESCE(r.reference_id, \'\')) LIKE ? OR LOWER(COALESCE(tk.ticket_code, \'\')) LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const countRow = await db.getOne(
      `SELECT COUNT(*) as total
       FROM attendance att
       JOIN attendees a ON att.attendee_id = a.id
       JOIN registrations r ON a.registration_id = r.id
       LEFT JOIN tickets tk ON att.ticket_id = tk.id
       ${whereSql}`,
      [...params]
    );
    const total = parseInt(countRow ? countRow.total : '0', 10);
    const offset = (Math.max(1, page) - 1) * limit;

    const rows = await db.query(
      `SELECT att.id as attendance_id, att.checked_in_at, att.check_in_method,
              a.id as attendee_id, a.full_name, a.email, a.preferred_track,
              r.reference_id, r.pathway,
              t.team_name,
              tk.ticket_code, tk.status as ticket_status,
              adm.full_name as staff_name
       FROM attendance att
       JOIN attendees a ON att.attendee_id = a.id
       JOIN registrations r ON a.registration_id = r.id
       LEFT JOIN teams t ON a.team_id = t.id
       LEFT JOIN tickets tk ON att.ticket_id = tk.id
       LEFT JOIN admins adm ON att.checked_in_by = adm.id
       ${whereSql}
       ORDER BY att.checked_in_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      session: {
        id: session.id,
        sessionCode: session.session_code,
        sessionName: session.session_name,
        eventDate: session.event_date,
        startTime: session.start_time,
        endTime: session.end_time,
        venueName: session.venue_name,
        isActive: Boolean(session.is_active)
      },
      attendees: rows.map(r => ({
        attendanceId: r.attendance_id,
        attendeeId: r.attendee_id,
        fullName: r.full_name,
        email: r.email,
        track: r.preferred_track || 'General',
        referenceId: r.reference_id,
        pathway: r.pathway,
        teamName: r.team_name,
        ticketCode: r.ticket_code,
        ticketStatus: r.ticket_status,
        checkInMethod: r.check_in_method,
        checkedInAt: r.checked_in_at,
        staffName: r.staff_name || 'Staff'
      })),
      pagination: {
        page: Math.max(1, page),
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  } catch (err) {
    if (err.message === 'Session not found.') throw err;
    logger.debug('Database offline or query failed in getSessionAttendance:', err.message);
    return {
      session: { id: sessionId, sessionName: 'Event Session', sessionCode: 'SESS' },
      attendees: [],
      pagination: { page, limit, total: 0, totalPages: 0 }
    };
  }
}

module.exports = {
  ensureDefaultSessions,
  listSessions,
  getActiveSession,
  createSession,
  updateSession,
  activateSession,
  getSessionAttendance
};
