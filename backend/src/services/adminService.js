/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Management Service
 * Real database queries and operations for analytics, attendees, and tickets.
 */

const db = require('../config/database');
const { logAction } = require('./auditService');
const verificationTokenService = require('./verificationTokenService');
const ticketService = require('./ticketService');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const { getCanonicalTrackName, resolveTrack } = require('../utils/trackMapper');

/**
 * Get comprehensive, real-time dashboard analytics
 */
async function getDashboardStats() {
  const pool = db.getPool();
  if (!pool) {
    return {
      connected: false,
      registrations: { total: 0, individual: 0, team: 0 },
      attendees: { total: 0, verified: 0, pending: 0, verificationRate: 0 },
      tickets: { total: 0, active: 0, revoked: 0 },
      checkIns: { checkedIn: 0, remaining: 0, checkInRate: 0, activeSession: null },
      trackBreakdown: {},
      pathwayBreakdown: { INDIVIDUAL: 0, TEAM: 0 }
    };
  }

  // 1. Registrations count & pathway breakdown
  const regRows = await db.query(
    'SELECT pathway, COUNT(*) as count FROM registrations GROUP BY pathway'
  );
  let totalRegistrations = 0;
  let individualRegs = 0;
  let teamRegs = 0;
  for (const r of regRows) {
    const c = parseInt(r.count, 10);
    totalRegistrations += c;
    if (r.pathway === 'INDIVIDUAL') individualRegs += c;
    if (r.pathway === 'TEAM') teamRegs += c;
  }

  // 2. Attendees count & verification breakdown
  const attStats = await db.getOne(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN email_verified = TRUE THEN 1 END) as verified,
       COUNT(CASE WHEN email_verified = FALSE THEN 1 END) as pending
     FROM attendees`
  );
  const totalAttendees = parseInt(attStats ? attStats.total : '0', 10);
  const verifiedAttendees = parseInt(attStats ? attStats.verified : '0', 10);
  const pendingAttendees = parseInt(attStats ? attStats.pending : '0', 10);
  const verificationRate = totalAttendees > 0 ? Math.round((verifiedAttendees / totalAttendees) * 100) : 0;

  // 3. Ticket metrics
  const ticketStats = await db.getOne(
    `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
       COUNT(CASE WHEN status = 'REVOKED' THEN 1 END) as revoked
     FROM tickets`
  );
  const totalTickets = parseInt(ticketStats ? ticketStats.total : '0', 10);
  const activeTickets = parseInt(ticketStats ? ticketStats.active : '0', 10);
  const revokedTickets = parseInt(ticketStats ? ticketStats.revoked : '0', 10);

  // 4. Active session & Check-in metrics
  const activeSession = await db.getOne(
    'SELECT id, session_code, session_name, event_date, is_active FROM event_sessions WHERE is_active = TRUE LIMIT 1'
  );

  let checkedInCount = 0;
  let remainingCount = verifiedAttendees;
  if (activeSession) {
    const checkInRow = await db.getOne(
      'SELECT COUNT(DISTINCT attendee_id) as count FROM attendance WHERE event_session_id = ?',
      [activeSession.id]
    );
    checkedInCount = parseInt(checkInRow ? checkInRow.count : '0', 10);
    remainingCount = Math.max(0, verifiedAttendees - checkedInCount);
  }
  const checkInRate = verifiedAttendees > 0 ? Math.round((checkedInCount / verifiedAttendees) * 100) : 0;

  // 5. Track Breakdown
  const trackRows = await db.query(
    `SELECT COALESCE(t.selected_track, a.preferred_track, 'General') as track_name, COUNT(*) as count
     FROM attendees a
     LEFT JOIN teams t ON a.team_id = t.id
     GROUP BY track_name
     ORDER BY count DESC`
  );
  const trackBreakdown = {};
  for (const tr of trackRows) {
    trackBreakdown[tr.track_name] = parseInt(tr.count, 10);
  }

  return {
    connected: true,
    registrations: {
      total: totalRegistrations,
      individual: individualRegs,
      team: teamRegs
    },
    attendees: {
      total: totalAttendees,
      verified: verifiedAttendees,
      pending: pendingAttendees,
      verificationRate
    },
    tickets: {
      total: totalTickets,
      active: activeTickets,
      revoked: revokedTickets
    },
    checkIns: {
      checkedIn: checkedInCount,
      remaining: remainingCount,
      checkInRate,
      activeSession: activeSession ? {
        id: activeSession.id,
        sessionCode: activeSession.session_code,
        sessionName: activeSession.session_name,
        eventDate: activeSession.event_date
      } : null
    },
    trackBreakdown,
    pathwayBreakdown: {
      INDIVIDUAL: individualRegs,
      TEAM: teamRegs
    }
  };
}

/**
 * List attendees with search, filters, and pagination
 */
async function listAttendees({
  search = '',
  pathway = '',
  track = '',
  verified = '',
  ticketStatus = '',
  participantStatus = '',
  status = '',
  sessionId = '',
  checkedIn = '',
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'DESC'
}) {
  const pool = db.getPool();
  if (!pool) {
    return { attendees: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const offset = (Math.max(1, page) - 1) * limit;
  const whereClauses = [];
  const params = [];

  // Text search
  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(
      '(LOWER(a.full_name) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(COALESCE(a.phone, \'\')) LIKE ? OR LOWER(r.reference_code) LIKE ? OR LOWER(COALESCE(tk.ticket_code, \'\')) LIKE ? OR LOWER(COALESCE(t.team_name, \'\')) LIKE ?)'
    );
    params.push(term, term, term, term, term, term);
  }

  // Pathway filter
  if (pathway && (pathway === 'INDIVIDUAL' || pathway === 'TEAM')) {
    whereClauses.push('r.pathway = ?');
    params.push(pathway);
  }

  // Innovation Track filter with canonical mapping
  if (track && track.trim()) {
    const resolved = resolveTrack(track);
    if (resolved) {
      const placeholders = resolved.aliases.map(() => '?').join(', ');
      whereClauses.push(`(
        a.preferred_track IN (${placeholders}) 
        OR LOWER(COALESCE(a.preferred_track, '')) LIKE ? 
        OR t.selected_track IN (${placeholders}) 
        OR LOWER(COALESCE(t.selected_track, '')) LIKE ?
      )`);
      params.push(
        ...resolved.aliases,
        `%${resolved.matchKeywords[0]}%`,
        ...resolved.aliases,
        `%${resolved.matchKeywords[0]}%`
      );
    } else {
      whereClauses.push('(a.preferred_track = ? OR t.selected_track = ?)');
      params.push(track.trim(), track.trim());
    }
  }

  // Verification filter
  if (verified !== '' && verified !== undefined && verified !== null) {
    const isVer = verified === true || verified === 'true' || verified === '1';
    whereClauses.push('a.email_verified = ?');
    params.push(isVer);
  }

  // Ticket status filter
  if (ticketStatus && ticketStatus.trim()) {
    whereClauses.push('tk.status = ?');
    params.push(ticketStatus.trim().toUpperCase());
  }

  // Participant attendance status filter (overall check-in state or session check-in)
  const pStatus = (participantStatus || status || '').toUpperCase();
  if (pStatus === 'CHECKED_IN' || (!sessionId && (checkedIn === 'true' || checkedIn === true || checkedIn === '1'))) {
    whereClauses.push('(SELECT COUNT(*) FROM attendance att_c WHERE att_c.attendee_id = a.id) > 0');
  } else if (pStatus === 'NOT_CHECKED_IN' || (!sessionId && (checkedIn === 'false' || checkedIn === false || checkedIn === '0'))) {
    whereClauses.push('(SELECT COUNT(*) FROM attendance att_c WHERE att_c.attendee_id = a.id) = 0');
  }

  // Specific Session check-in filter
  let sessionJoin = '';
  if (sessionId) {
    sessionJoin = 'LEFT JOIN attendance att ON att.attendee_id = a.id AND att.event_session_id = ?';
    params.push(sessionId);

    if (checkedIn === 'true' || checkedIn === true || checkedIn === '1') {
      whereClauses.push('att.id IS NOT NULL');
    } else if (checkedIn === 'false' || checkedIn === false || checkedIn === '0') {
      whereClauses.push('att.id IS NULL');
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Safe sort mapping
  const allowedSortCols = {
    created_at: 'a.created_at',
    full_name: 'a.full_name',
    email: 'a.email',
    email_verified: 'a.email_verified'
  };
  const sortCol = allowedSortCols[sortBy] || 'a.created_at';
  const order = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  try {
    // 1. Total count query
    const countSql = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM attendees a
      JOIN registrations r ON a.registration_id = r.id
      LEFT JOIN teams t ON a.team_id = t.id
      LEFT JOIN tickets tk ON tk.attendee_id = a.id
      ${sessionJoin}
      ${whereSql}
    `;
    const countRow = await db.getOne(countSql, params);
    const total = parseInt(countRow ? countRow.total : '0', 10);

    // 2. Data query
    const dataSql = `
      SELECT 
        a.id,
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
        a.created_at,
        r.id as registration_id,
        r.reference_code,
        r.pathway,
        t.id as team_id,
        t.team_name,
        t.selected_track as team_track,
        tk.id as ticket_id,
        tk.ticket_code,
        tk.status as ticket_status,
        tk.revoked_at as ticket_revoked_at,
        tk.revoked_reason as ticket_revoked_reason,
        (SELECT COUNT(*) FROM attendance att_c WHERE att_c.attendee_id = a.id) as check_in_count
      FROM attendees a
      JOIN registrations r ON a.registration_id = r.id
      LEFT JOIN teams t ON a.team_id = t.id
      LEFT JOIN tickets tk ON tk.attendee_id = a.id
      ${sessionJoin}
      ${whereSql}
      ORDER BY ${sortCol} ${order}
      LIMIT ? OFFSET ?
    `;

    const rows = await db.query(dataSql, [...params, limit, offset]);

    return {
      attendees: rows.map(row => {
        const checkInCount = parseInt(row.check_in_count || '0', 10);
        return {
          id: row.id,
          fullName: row.full_name,
          email: row.email,
          phone: row.phone,
          city: row.city,
          discipline: row.discipline,
          experienceLevel: row.experience_level,
          track: getCanonicalTrackName(row.team_track || row.preferred_track),
          isTeamLeader: Boolean(row.is_team_leader),
          emailVerified: Boolean(row.email_verified),
          emailVerifiedAt: row.email_verified_at,
          createdAt: row.created_at,
          checkInCount,
          participantStatus: checkInCount > 0 ? 'CHECKED_IN' : 'NOT_CHECKED_IN',
          registration: {
            id: row.registration_id,
            referenceCode: row.reference_code,
            pathway: row.pathway
          },
          team: row.team_id ? {
            id: row.team_id,
            teamName: row.team_name,
            track: getCanonicalTrackName(row.team_track)
          } : null,
          ticket: row.ticket_id ? {
            id: row.ticket_id,
            ticketCode: row.ticket_code,
            status: row.ticket_status,
            revokedAt: row.ticket_revoked_at,
            revokedReason: row.ticket_revoked_reason
          } : null
        };
      }),
      pagination: {
        page: Math.max(1, page),
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  } catch (err) {
    logger.debug('Database offline or query failed in listAttendees:', err.message);
    return {
      attendees: [],
      pagination: {
        page: Math.max(1, page),
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }
}

/**
 * Get complete details for a single attendee
 */
async function getAttendeeDetails(attendeeId) {
  const pool = db.getPool();
  if (!pool) return null;

  const attendee = await db.getOne(
    `SELECT a.*, r.reference_code, r.pathway, r.team_idea, r.submitted_at,
            t.id as team_id, t.team_name, t.selected_track, t.member_count
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     WHERE a.id = ?`,
    [attendeeId]
  );

  if (!attendee) return null;

  // Fetch ticket
  const ticket = await db.getOne(
    'SELECT * FROM tickets WHERE attendee_id = ?',
    [attendeeId]
  );

  // Fetch team members if team
  let teamMembers = [];
  if (attendee.team_id) {
    teamMembers = await db.query(
      `SELECT id, full_name, email, phone, discipline, is_team_leader, email_verified
       FROM attendees WHERE team_id = ? ORDER BY is_team_leader DESC, created_at ASC`,
      [attendee.team_id]
    );
  }

  // Fetch check-in history across all sessions
  const checkIns = await db.query(
    `SELECT att.id, att.check_in_method, att.checked_in_at,
            es.session_name, es.session_code, es.event_date,
            adm.full_name as staff_name
     FROM attendance att
     JOIN event_sessions es ON att.event_session_id = es.id
     LEFT JOIN admins adm ON att.checked_in_by = adm.id
     WHERE att.attendee_id = ?
     ORDER BY att.checked_in_at DESC`,
    [attendeeId]
  );

  // Fetch email audit logs
  const emailLogs = await db.query(
    `SELECT id, email_type, subject, delivery_status, sent_at, error_message
     FROM email_logs
     WHERE attendee_id = ? OR recipient_email = ?
     ORDER BY sent_at DESC LIMIT 10`,
    [attendeeId, attendee.email]
  );

  return {
    id: attendee.id,
    fullName: attendee.full_name,
    email: attendee.email,
    phone: attendee.phone,
    city: attendee.city,
    discipline: attendee.discipline,
    experienceLevel: attendee.experience_level,
    preferredTrack: getCanonicalTrackName(attendee.preferred_track),
    track: getCanonicalTrackName(attendee.selected_track || attendee.preferred_track),
    participantStatus: checkIns.length > 0 ? 'CHECKED_IN' : 'NOT_CHECKED_IN',
    checkInCount: checkIns.length,
    skills: attendee.skills,
    isTeamLeader: Boolean(attendee.is_team_leader),
    matchingConsent: Boolean(attendee.matching_consent),
    eligibilityConfirmed: Boolean(attendee.eligibility_confirmed),
    safetyPledgeConfirmed: Boolean(attendee.safety_pledge_confirmed),
    emailVerified: Boolean(attendee.email_verified),
    emailVerifiedAt: attendee.email_verified_at,
    createdAt: attendee.created_at,
    registration: {
      id: attendee.registration_id,
      referenceCode: attendee.reference_code,
      pathway: attendee.pathway,
      teamIdea: attendee.team_idea,
      submittedAt: attendee.submitted_at
    },
    team: attendee.team_id ? {
      id: attendee.team_id,
      teamName: attendee.team_name,
      track: getCanonicalTrackName(attendee.selected_track),
      memberCount: attendee.member_count,
      members: teamMembers.map(m => ({
        id: m.id,
        fullName: m.full_name,
        email: m.email,
        phone: m.phone,
        discipline: m.discipline,
        isTeamLeader: Boolean(m.is_team_leader),
        emailVerified: Boolean(m.email_verified)
      }))
    } : null,
    ticket: ticket ? {
      id: ticket.id,
      ticketCode: ticket.ticket_code,
      status: ticket.status,
      generatedAt: ticket.generated_at,
      revokedAt: ticket.revoked_at,
      revokedReason: ticket.revoked_reason,
      qrData: ticket.qr_data
    } : null,
    checkIns: checkIns.map(c => ({
      id: c.id,
      sessionName: c.session_name,
      sessionCode: c.session_code,
      eventDate: c.event_date,
      checkInMethod: c.check_in_method,
      checkedInAt: c.checked_in_at,
      staffName: c.staff_name || 'Admin'
    })),
    emailLogs: emailLogs.map(l => ({
      id: l.id,
      emailType: l.email_type,
      subject: l.subject,
      status: l.delivery_status,
      sentAt: l.sent_at,
      error: l.error_message
    }))
  };
}

/**
 * Revoke an attendee ticket with a recorded audit reason
 */
async function revokeTicket({ ticketId, reason, adminId, ipAddress }) {
  if (!reason || !reason.trim()) {
    throw new Error('A reason is strictly required when revoking a ticket.');
  }

  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const ticket = await db.getOne(
    'SELECT tk.*, a.full_name, a.email FROM tickets tk JOIN attendees a ON tk.attendee_id = a.id WHERE tk.id = ?',
    [ticketId]
  );

  if (!ticket) {
    throw new Error('Ticket not found.');
  }

  if (ticket.status === 'REVOKED') {
    throw new Error('Ticket is already revoked.');
  }

  await db.execute(
    'UPDATE tickets SET status = \'REVOKED\', revoked_at = CURRENT_TIMESTAMP, revoked_reason = ? WHERE id = ?',
    [reason.trim(), ticketId]
  );

  await logAction({
    adminId,
    action: 'TICKET_REVOKED',
    targetType: 'ticket',
    targetId: ticketId,
    details: {
      ticketCode: ticket.ticket_code,
      attendeeName: ticket.full_name,
      attendeeEmail: ticket.email,
      reason: reason.trim()
    },
    ipAddress
  });

  logger.info(`Ticket ${ticket.ticket_code} revoked by admin ${adminId}. Reason: ${reason}`);

  // Queue attendee & ticket status change for Google Sheets synchronization (non-blocking)
  try {
    const googleSheetsSyncService = require('./googleSheetsSyncService');
    await googleSheetsSyncService.queueAttendeeSync(ticket.attendee_id);
  } catch (syncErr) {
    logger.warn('Could not queue attendee for Google Sheets sync on ticket revocation:', syncErr.message);
  }

  return { ticketCode: ticket.ticket_code, status: 'REVOKED', revokedReason: reason.trim() };
}

/**
 * Resend email verification link to attendee
 */
async function resendVerification({ attendeeId, adminId, ipAddress }) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const attendee = await db.getOne(
    `SELECT a.*, r.reference_code, r.pathway, t.team_name, t.selected_track
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     WHERE a.id = ?`,
    [attendeeId]
  );

  if (!attendee) {
    throw new Error('Attendee not found.');
  }

  if (attendee.email_verified) {
    throw new Error('Attendee email is already verified.');
  }

  const { token, expiresAt } = await verificationTokenService.createVerificationToken(attendeeId);

  // Send appropriate verification email
  if (attendee.pathway === 'INDIVIDUAL') {
    await emailService.sendIndividualVerificationEmail(attendee, token, expiresAt);
  } else {
    const team = { team_name: attendee.team_name, selected_track: attendee.selected_track };
    const members = await db.query('SELECT full_name, email, discipline FROM attendees WHERE team_id = ?', [attendee.team_id]);
    await emailService.sendTeamVerificationEmail(attendee, team, members, token, expiresAt);
  }

  await logAction({
    adminId,
    action: 'VERIFICATION_RESENT',
    targetType: 'attendee',
    targetId: attendeeId,
    details: { email: attendee.email, name: attendee.full_name },
    ipAddress
  });

  return { email: attendee.email, resent: true };
}

/**
 * Resend QR ticket pass email to verified attendee
 */
async function resendTicket({ attendeeId, adminId, ipAddress }) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not connected.');

  const attendee = await db.getOne(
    `SELECT a.*, r.reference_code, t.team_name, t.selected_track
     FROM attendees a
     JOIN registrations r ON a.registration_id = r.id
     LEFT JOIN teams t ON a.team_id = t.id
     WHERE a.id = ?`,
    [attendeeId]
  );

  if (!attendee) throw new Error('Attendee not found.');
  if (!attendee.email_verified) {
    throw new Error('Attendee email is not verified yet. Resend verification link first.');
  }

  const ticket = await db.getOne('SELECT * FROM tickets WHERE attendee_id = ?', [attendeeId]);
  if (!ticket) {
    throw new Error('No ticket found for this attendee.');
  }

  if (ticket.status !== 'ACTIVE') {
    throw new Error(`Cannot resend ticket: ticket status is ${ticket.status}.`);
  }

  const team = attendee.team_id ? { team_name: attendee.team_name, selected_track: attendee.selected_track } : null;
  await emailService.sendQrTicketEmail(attendee, ticket, team);

  await logAction({
    adminId,
    action: 'TICKET_RESENT',
    targetType: 'ticket',
    targetId: ticket.id,
    details: { ticketCode: ticket.ticket_code, email: attendee.email },
    ipAddress
  });

  return { email: attendee.email, ticketCode: ticket.ticket_code, resent: true };
}

module.exports = {
  getDashboardStats,
  listAttendees,
  getAttendeeDetails,
  revokeTicket,
  resendVerification,
  resendTicket
};
