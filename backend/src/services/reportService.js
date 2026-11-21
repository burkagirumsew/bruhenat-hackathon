/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Attendance Reporting & CSV Export Service
 * Produces Excel-compatible UTF-8 BOM CSV files and analytics aggregations.
 */

const db = require('../config/database');
const { getActiveSession } = require('./sessionService');
const { logAction } = require('./auditService');
const { getCanonicalTrackName } = require('../utils/trackMapper');

/**
 * Helper to escape CSV field (RFC 4180)
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Canonical 17-Column Attendee CSV Export Specification
 */
const ATTENDEE_CSV_HEADERS = [
  'Reference Code',
  'Pathway',
  'Full Name',
  'Email',
  'Phone',
  'City',
  'Discipline',
  'Experience Level',
  'Track',
  'Team Name',
  'Team Leader',
  'Email Verified',
  'Verified At',
  'Ticket Code',
  'Ticket Status',
  'Check-In Count',
  'Registered At'
];

/**
 * Generate CSV for all registered attendees
 */
async function generateAttendeesCsv(adminId, ipAddress) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const rows = await db.query(
    `SELECT 
       r.reference_code,
       r.pathway,
       a.full_name,
       a.email,
       a.phone,
       a.city,
       a.discipline,
       a.experience_level,
       COALESCE(t.selected_track, a.preferred_track, 'General') as track,
       t.team_name,
       a.is_team_leader,
       a.email_verified,
       a.email_verified_at,
       tk.ticket_code,
       tk.status as ticket_status,
       (SELECT COUNT(*) FROM attendance att_c WHERE att_c.attendee_id = a.id) as check_in_count,
       a.created_at
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON tk.attendee_id = a.id
     ORDER BY a.created_at DESC`
  );

  const lines = [ATTENDEE_CSV_HEADERS.map(escapeCsv).join(',')];

  for (const r of rows) {
    lines.push([
      escapeCsv(r.reference_code),
      escapeCsv(r.pathway),
      escapeCsv(r.full_name),
      escapeCsv(r.email),
      escapeCsv(r.phone || ''),
      escapeCsv(r.city || ''),
      escapeCsv(r.discipline || ''),
      escapeCsv(r.experience_level || ''),
      escapeCsv(getCanonicalTrackName(r.track) || ''),
      escapeCsv(r.team_name || ''),
      escapeCsv(r.is_team_leader ? 'YES' : 'NO'),
      escapeCsv(r.email_verified ? 'VERIFIED' : 'PENDING'),
      escapeCsv(r.email_verified_at || ''),
      escapeCsv(r.ticket_code || ''),
      escapeCsv(r.ticket_status || 'NOT_ISSUED'),
      escapeCsv(r.check_in_count || 0),
      escapeCsv(r.created_at)
    ].join(','));
  }

  // Prepend UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
  const csvContent = '\uFEFF' + lines.join('\r\n');

  await logAction({
    adminId,
    action: 'EXPORT_ATTENDEES',
    targetType: 'export',
    details: { rowCount: rows.length },
    ipAddress
  });

  return {
    filename: `bruh_enat_attendees_${new Date().toISOString().slice(0, 10)}.csv`,
    csvContent,
    rowCount: rows.length
  };
}

/**
 * Generate CSV for attendance in a given session (or active session)
 */
async function generateAttendanceCsv(sessionId, adminId, ipAddress) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  let targetSessionId = sessionId;
  let sessionName = 'All Sessions';

  if (!targetSessionId) {
    const active = await getActiveSession();
    if (active) {
      targetSessionId = active.id;
      sessionName = active.sessionName;
    }
  }

  const whereSql = targetSessionId ? 'WHERE att.event_session_id = ?' : '';
  const params = targetSessionId ? [targetSessionId] : [];

  const rows = await db.query(
    `SELECT 
       es.session_name,
       es.session_code,
       es.event_date,
       a.full_name,
       a.email,
       a.phone,
       r.pathway,
       t.team_name,
       COALESCE(t.selected_track, a.preferred_track, 'General') as track,
       tk.ticket_code,
       att.checked_in_at,
       att.check_in_method,
       adm.full_name as staff_name
     FROM attendance att
     JOIN event_sessions es ON att.event_session_id = es.id
     JOIN attendees a ON att.attendee_id = a.id
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     LEFT JOIN tickets tk ON att.ticket_id = tk.id
     LEFT JOIN admins adm ON att.checked_in_by = adm.id
     ${whereSql}
     ORDER BY att.checked_in_at ASC`,
    params
  );

  const headers = [
    'Session Name',
    'Session Code',
    'Event Date',
    'Full Name',
    'Email',
    'Phone',
    'Pathway',
    'Team Name',
    'Track',
    'Ticket Code',
    'Checked In At',
    'Method',
    'Staff Name'
  ];

  const lines = [headers.map(escapeCsv).join(',')];

  for (const r of rows) {
    lines.push([
      escapeCsv(r.session_name),
      escapeCsv(r.session_code),
      escapeCsv(r.event_date),
      escapeCsv(r.full_name),
      escapeCsv(r.email),
      escapeCsv(r.phone || ''),
      escapeCsv(r.pathway),
      escapeCsv(r.team_name || ''),
      escapeCsv(r.track),
      escapeCsv(r.ticket_code || ''),
      escapeCsv(r.checked_in_at),
      escapeCsv(r.check_in_method),
      escapeCsv(r.staff_name || 'Staff')
    ].join(','));
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');

  await logAction({
    adminId,
    action: 'EXPORT_ATTENDANCE',
    targetType: 'export',
    details: { sessionId: targetSessionId, sessionName, rowCount: rows.length },
    ipAddress
  });

  const safeSessionName = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    filename: `bruh_enat_attendance_${safeSessionName}_${new Date().toISOString().slice(0, 10)}.csv`,
    csvContent,
    rowCount: rows.length
  };
}

/**
 * Get aggregated attendance report metrics
 */
async function getAttendanceReport(sessionId) {
  const pool = db.getPool();
  if (!pool) {
    return {
      totalCheckedIn: 0,
      totalVerified: 0,
      checkInPercentage: 0,
      byTrack: {},
      byPathway: {},
      byMethod: {},
      hourlyDistribution: []
    };
  }

  let targetSessionId = sessionId;
  if (!targetSessionId) {
    const active = await getActiveSession();
    if (active) targetSessionId = active.id;
  }

  const whereSql = targetSessionId ? 'WHERE att.event_session_id = ?' : '';
  const params = targetSessionId ? [targetSessionId] : [];

  // Total checkins
  const totalRow = await db.getOne(
    `SELECT COUNT(*) as count FROM attendance att ${whereSql}`,
    params
  );
  const totalCheckedIn = parseInt(totalRow ? totalRow.count : '0', 10);

  // Total verified attendees
  const verRow = await db.getOne('SELECT COUNT(*) as count FROM attendees WHERE email_verified = TRUE');
  const totalVerified = parseInt(verRow ? verRow.count : '0', 10);
  const checkInPercentage = totalVerified > 0 ? Math.round((totalCheckedIn / totalVerified) * 100) : 0;

  // Breakdown by track
  const trackRows = await db.query(
    `SELECT COALESCE(t.selected_track, a.preferred_track, 'General') as track, COUNT(*) as count
     FROM attendance att
     JOIN attendees a ON att.attendee_id = a.id
     LEFT JOIN teams t ON a.team_id = t.id
     ${whereSql}
     GROUP BY track
     ORDER BY count DESC`,
    params
  );
  const byTrack = {};
  for (const tr of trackRows) {
    byTrack[tr.track] = parseInt(tr.count, 10);
  }

  // Breakdown by pathway
  const pathRows = await db.query(
    `SELECT r.pathway, COUNT(*) as count
     FROM attendance att
     JOIN attendees a ON att.attendee_id = a.id
     JOIN registrations r ON a.registration_id = r.id
     ${whereSql}
     GROUP BY r.pathway`,
    params
  );
  const byPathway = {};
  for (const pr of pathRows) {
    byPathway[pr.pathway] = parseInt(pr.count, 10);
  }

  // Breakdown by method
  const methodRows = await db.query(
    `SELECT att.check_in_method, COUNT(*) as count
     FROM attendance att
     ${whereSql}
     GROUP BY att.check_in_method`,
    params
  );
  const byMethod = {};
  for (const mr of methodRows) {
    byMethod[mr.check_in_method] = parseInt(mr.count, 10);
  }

  return {
    totalCheckedIn,
    totalVerified,
    checkInPercentage,
    byTrack,
    byPathway,
    byMethod
  };
}

module.exports = {
  escapeCsv,
  ATTENDEE_CSV_HEADERS,
  generateAttendeesCsv,
  generateAttendanceCsv,
  getAttendanceReport
};
