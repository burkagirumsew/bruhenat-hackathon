/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * QR Ticketing Service
 * Generates unique verifiable ticket passes, secure QR payload codes,
 * and handles ticket retrieval and re-issuance.
 */

const crypto = require('crypto');
const db = require('../config/database');
const qrGenerator = require('../utils/qrGenerator');
const logger = require('../utils/logger');

function generateId(prefix = '') {
  const hex = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${hex}` : hex;
}

/**
 * Generate a unique ticket code: BE26-XXXX-XXXX
 */
function generateTicketCode() {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `BE26-${part1}-${part2}`;
}

/**
 * Create or retrieve the official QR ticket for an attendee
 */
async function createTicketForAttendee({ attendeeId, registrationId, teamId, fullName, referenceCode }, executor = null) {
  const runner = executor || db;

  // 1. Check if a ticket already exists for this attendee
  const existing = await runner.getOne(
    `SELECT id, ticket_code, qr_data, status, generated_at
     FROM tickets
     WHERE attendee_id = ?`,
    [attendeeId]
  );

  if (existing) {
    return {
      id: existing.id,
      ticketCode: existing.ticket_code,
      qrData: existing.qr_data,
      status: existing.status,
      generatedAt: existing.generated_at
    };
  }

  // 2. Generate new ticket credentials
  const ticketId = generateId('tkt');
  const ticketCode = generateTicketCode();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 3. Construct QR code payload string
  // Formatted for rapid offline/online camera scanning at the event check-in desk
  const qrPayload = JSON.stringify({
    event: 'BRUH-ENAT-2026',
    code: ticketCode,
    ref: referenceCode,
    tok: rawToken.slice(0, 16)
  });

  // 4. Generate high-resolution QR image data URI
  const qrDataUrl = await qrGenerator.generateQrDataUrl(qrPayload);

  // 5. Store in tickets table with concurrency conflict safety
  try {
    await runner.execute(
      `INSERT INTO tickets (
        id, attendee_id, registration_id, team_id, ticket_code, ticket_token_hash,
        qr_data, status, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP)`,
      [
        ticketId,
        attendeeId,
        registrationId,
        teamId || null,
        ticketCode,
        tokenHash,
        qrDataUrl
      ]
    );

    logger.info(`Generated official ticket: ${ticketCode} for attendee: ${attendeeId}`);

    return {
      id: ticketId,
      ticketCode,
      ticketToken: rawToken,
      qrData: qrDataUrl,
      status: 'ACTIVE',
      generatedAt: new Date().toISOString()
    };
  } catch (err) {
    // If a concurrent request created a ticket in the race window, retrieve and return the existing ticket
    if (err.code === '23505' || err.message.includes('unique') || err.message.includes('duplicate')) {
      const existing = await runner.getOne(
        `SELECT id, ticket_code, qr_data, status, generated_at
         FROM tickets
         WHERE attendee_id = ?`,
        [attendeeId]
      );
      if (existing) {
        logger.info(`Retrieved existing ticket ${existing.ticket_code} for attendee ${attendeeId} after concurrent creation.`);
        return {
          id: existing.id,
          ticketCode: existing.ticket_code,
          qrData: existing.qr_data,
          status: existing.status,
          generatedAt: existing.generated_at
        };
      }
    }
    throw err;
  }
}

/**
 * Retrieve ticket by ticketCode along with attendee and event details
 */
async function getTicketByCode(ticketCode) {
  if (!ticketCode || typeof ticketCode !== 'string') return null;

  const row = await db.getOne(
    `SELECT 
      t.id as ticket_id, t.ticket_code, t.qr_data, t.status as ticket_status, t.generated_at,
      a.id as attendee_id, a.full_name, a.email, a.discipline, a.preferred_track, a.is_team_leader, a.email_verified,
      r.reference_code, r.pathway,
      tm.team_name
    FROM tickets t
    JOIN attendees a ON a.id = t.attendee_id
    JOIN registrations r ON r.id = a.registration_id
    LEFT JOIN teams tm ON tm.id = a.team_id
    WHERE t.ticket_code = ?`,
    [ticketCode.trim().toUpperCase()]
  );

  if (!row) return null;

  return {
    ticketId: row.ticket_id,
    ticketCode: row.ticket_code,
    status: row.ticket_status,
    generatedAt: row.generated_at,
    qrData: row.qr_data,
    attendee: {
      id: row.attendee_id,
      fullName: row.full_name,
      email: row.email,
      discipline: row.discipline,
      preferredTrack: row.preferred_track,
      isTeamLeader: Boolean(row.is_team_leader),
      emailVerified: Boolean(row.email_verified)
    },
    registration: {
      referenceCode: row.reference_code,
      pathway: row.pathway,
      teamName: row.team_name || null
    },
    event: {
      name: "BRUH-Enat Women's Tech Innovation Hackathon 2026",
      theme: "Her Safety, Our Innovation: Building Safer Futures.",
      date: "Saturday, December 5, 2026",
      checkInTime: "08:30 AM – 09:30 AM EAT",
      venue: "Capstone ALX Tech Hub, Lideta, Addis Ababa, Ethiopia",
      mapsUrl: "https://maps.app.goo.gl/XLH2PN6vTPyP2kP58"
    }
  };
}

/**
 * Get ticket by attendee ID
 */
async function getTicketForAttendee(attendeeId) {
  if (!attendeeId) return null;
  const row = await db.getOne(
    `SELECT id, ticket_code, qr_data, status, generated_at
     FROM tickets
     WHERE attendee_id = ?`,
    [attendeeId]
  );
  if (!row) return null;
  return {
    id: row.id,
    ticketCode: row.ticket_code,
    qrData: row.qr_data,
    status: row.status,
    generatedAt: row.generated_at
  };
}

/**
 * Resend Ticket Email to verified attendee
 */
async function resendTicketEmail(email) {
  if (!email || typeof email !== 'string') {
    return { success: false, statusCode: 400, message: 'Valid email address is required.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  const attendee = await db.getOne(
    `SELECT a.id, a.full_name, a.email, a.email_verified, a.discipline, a.preferred_track,
            r.reference_code, tm.team_name,
            t.id as ticket_id, t.ticket_code, t.qr_data, t.status as ticket_status
     FROM attendees a
     JOIN registrations r ON r.id = a.registration_id
     LEFT JOIN teams tm ON tm.id = a.team_id
     LEFT JOIN tickets t ON t.attendee_id = a.id
     WHERE LOWER(a.email) = ?`,
    [cleanEmail]
  );

  if (!attendee) {
    return {
      success: false,
      statusCode: 404,
      message: `No registration found matching the email "${cleanEmail}".`
    };
  }

  if (!attendee.email_verified) {
    return {
      success: false,
      statusCode: 400,
      message: 'This email has not been verified yet. Please verify your email address first.'
    };
  }

  if (!attendee.ticket_code) {
    // Generate ticket if missing
    const newTicket = await createTicketForAttendee({
      attendeeId: attendee.id,
      registrationId: attendee.registration_id,
      fullName: attendee.full_name,
      referenceCode: attendee.reference_code
    });
    attendee.ticket_code = newTicket.ticketCode;
    attendee.qr_data = newTicket.qrData;
  }

  const emailService = require('./emailService');
  await emailService.sendTicketConfirmationEmail(
    attendee,
    { ticketCode: attendee.ticket_code, qrData: attendee.qr_data },
    attendee.reference_code,
    attendee.team_name || null
  );

  return {
    success: true,
    statusCode: 200,
    message: `Your entry ticket (${attendee.ticket_code}) has been emailed to "${cleanEmail}".`
  };
}

module.exports = {
  createTicketForAttendee,
  getTicketByCode,
  getTicketForAttendee,
  resendTicketEmail
};
