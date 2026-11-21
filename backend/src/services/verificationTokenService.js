/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Email Verification Token Service
 * Cryptographic token generation, secure SHA-256 storage, expiration validation,
 * and one-time use verification processing.
 */

const crypto = require('crypto');
const config = require('../config/environment');
const db = require('../config/database');
const logger = require('../utils/logger');

function generateId(prefix = '') {
  const hex = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${hex}` : hex;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generate a cryptographically secure random verification token for an attendee
 * Stores only the SHA-256 hash in the database.
 */
async function createTokenForAttendee(attendeeId, executor = null) {
  const runner = executor || db;
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const tokenId = generateId('tok');

  const expirationHours = config.email.verificationExpirationHours || 48;
  const expiresAt = new Date(Date.now() + expirationHours * 3600 * 1000).toISOString();

  await runner.execute(
    `INSERT INTO email_verification_tokens (id, attendee_id, token_hash, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
    [tokenId, attendeeId, tokenHash, expiresAt]
  );

  return {
    tokenId,
    rawToken,
    token: rawToken,
    tokenHash,
    expiresAt,
    expirationHours
  };
}

/**
 * Validate and verify a submitted verification token
 * Atomically marks token as used, updates attendee verification status,
 * and invokes ticket generation.
 */
async function processVerificationToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
    return {
      success: false,
      error: 'INVALID_TOKEN',
      statusCode: 400,
      message: 'Verification token is invalid or missing.'
    };
  }

  const tokenHash = hashToken(rawToken);

  // Look up token and associated attendee data
  const record = await db.getOne(
    `SELECT 
      t.id as token_id, t.attendee_id, t.token_hash, t.expires_at, t.used_at,
      a.full_name, a.email, a.discipline, a.preferred_track, a.is_team_leader, a.email_verified,
      r.id as registration_id, r.reference_code, r.pathway,
      tm.id as team_id, tm.team_name
    FROM email_verification_tokens t
    JOIN attendees a ON a.id = t.attendee_id
    JOIN registrations r ON r.id = a.registration_id
    LEFT JOIN teams tm ON tm.id = a.team_id
    WHERE t.token_hash = ?`,
    [tokenHash]
  );

  if (!record) {
    return {
      success: false,
      error: 'TOKEN_NOT_FOUND',
      statusCode: 404,
      message: 'The verification link is invalid or does not exist.'
    };
  }

  // Check 1: Already used
  if (record.used_at) {
    // If already verified, retrieve the ticket so the user can still see it
    const ticketService = require('./ticketService');
    const existingTicket = await ticketService.getTicketForAttendee(record.attendee_id);

    return {
      success: false,
      error: 'ALREADY_VERIFIED',
      statusCode: 200, // Return 200 with notice so client can display ticket
      message: 'This email address has already been verified.',
      data: {
        attendee: {
          id: record.attendee_id,
          fullName: record.full_name,
          email: record.email,
          referenceCode: record.reference_code,
          pathway: record.pathway,
          teamName: record.team_name || null
        },
        ticket: existingTicket
      }
    };
  }

  // Check 2: Expired
  const now = new Date();
  const expiresAt = new Date(record.expires_at);
  if (expiresAt < now) {
    return {
      success: false,
      error: 'TOKEN_EXPIRED',
      statusCode: 410,
      message: 'This verification link has expired. Please request a new verification email.',
      attendeeEmail: record.email
    };
  }

  // Atomic Verification and Ticket Generation inside Transaction
  const ticketService = require('./ticketService');
  const emailService = require('./emailService');

  let verificationResult;
  try {
    verificationResult = await db.transaction(async (tx) => {
      // 1. Atomically mark token as used with concurrency check (UPDATE ... WHERE used_at IS NULL)
      const tokenUpdate = await tx.execute(
        'UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL',
        [record.token_id]
      );

      if (!tokenUpdate || tokenUpdate.rowCount === 0) {
        const err = new Error('TOKEN_ALREADY_USED');
        err.code = 'TOKEN_ALREADY_USED';
        throw err;
      }

      // 2. Mark attendee as email_verified
      await tx.execute(
        'UPDATE attendees SET email_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?',
        [record.attendee_id]
      );

      // 3. Check if all attendees for this registration are verified
      const pendingCountRow = await tx.getOne(
        'SELECT COUNT(*) as count FROM attendees WHERE registration_id = ? AND email_verified = false',
        [record.registration_id]
      );
      const pendingCount = parseInt(pendingCountRow ? pendingCountRow.count : 0, 10);
      if (pendingCount === 0) {
        await tx.execute(
          "UPDATE registrations SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [record.registration_id]
        );
      }

      // 4. Generate official QR ticket pass inside transaction
      const ticket = await ticketService.createTicketForAttendee(
        {
          attendeeId: record.attendee_id,
          registrationId: record.registration_id,
          teamId: record.team_id || null,
          fullName: record.full_name,
          referenceCode: record.reference_code
        },
        tx
      );

      // 5. Transactional Outbox: Insert Google Sheets synchronization record inside the EXACT SAME transaction
      const syncId = generateId('sync');
      await tx.execute(
        `INSERT INTO google_sheets_sync (
          id, entity_type, entity_id, target_sheet, operation_type,
          sync_status, retry_count, created_at, updated_at
        ) VALUES (?, 'ATTENDEE', ?, 'All Attendees', 'UPSERT', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [syncId, record.attendee_id]
      );

      return {
        attendee: {
          id: record.attendee_id,
          fullName: record.full_name,
          email: record.email,
          discipline: record.discipline,
          preferredTrack: record.preferred_track,
          referenceCode: record.reference_code,
          pathway: record.pathway,
          teamName: record.team_name || null,
          isTeamLeader: Boolean(record.is_team_leader),
          emailVerified: true
        },
        ticket
      };
    });
  } catch (txErr) {
    if (txErr.code === 'TOKEN_ALREADY_USED' || txErr.message === 'TOKEN_ALREADY_USED') {
      const existingTicket = await ticketService.getTicketForAttendee(record.attendee_id);
      return {
        success: false,
        error: 'ALREADY_VERIFIED',
        statusCode: 200,
        message: 'This email address has already been verified.',
        data: {
          attendee: {
            id: record.attendee_id,
            fullName: record.full_name,
            email: record.email,
            referenceCode: record.reference_code,
            pathway: record.pathway,
            teamName: record.team_name || null
          },
          ticket: existingTicket
        }
      };
    }
    throw txErr;
  }

  // 6. Send QR ticket confirmation email post-transaction with failure tracking
  try {
    await emailService.sendTicketConfirmationEmail(
      verificationResult.attendee,
      verificationResult.ticket,
      record.reference_code,
      record.team_name || null
    );
  } catch (mailErr) {
    logger.warn('Could not dispatch ticket confirmation email:', mailErr.message);
  }

  logger.info(`Successfully verified email for attendee: ${record.email} (${verificationResult.ticket.ticketCode})`);

  return {
    success: true,
    statusCode: 200,
    message: 'Your email has been successfully verified and your entry pass is now active!',
    data: verificationResult
  };
}

/**
 * Request a fresh verification token for an unverified email address
 */
async function resendVerificationEmail(email) {
  if (!email || typeof email !== 'string') {
    return { success: false, statusCode: 400, message: 'A valid email address is required.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  const attendee = await db.getOne(
    `SELECT a.id, a.full_name, a.email, a.email_verified, r.reference_code, r.pathway, tm.team_name, tm.team_leader_id
     FROM attendees a
     JOIN registrations r ON r.id = a.registration_id
     LEFT JOIN teams tm ON tm.id = a.team_id
     WHERE LOWER(a.email) = ?`,
    [cleanEmail]
  );

  if (!attendee) {
    return {
      success: false,
      statusCode: 404,
      message: `No application was found matching the email "${cleanEmail}".`
    };
  }

  if (attendee.email_verified === 1) {
    return {
      success: false,
      statusCode: 409,
      message: 'This email address is already verified. Your ticket is active.'
    };
  }

  // Create a fresh token
  const tokenData = await createTokenForAttendee(attendee.id);

  // Send email
  const emailService = require('./emailService');
  if (attendee.pathway === 'TEAM' && attendee.team_name) {
    await emailService.sendTeamMemberVerificationEmail(
      attendee,
      attendee.team_name,
      'Team Leader',
      attendee.reference_code,
      tokenData.rawToken
    );
  } else {
    await emailService.sendIndividualVerificationEmail(
      attendee,
      attendee.reference_code,
      tokenData.rawToken
    );
  }

  return {
    success: true,
    statusCode: 200,
    message: `A new verification email has been dispatched to "${cleanEmail}". Please check your inbox and spam folder.`
  };
}

/**
 * Pre-validate a verification token without consuming it.
 * Used by GET requests and link previews so security scanners do not burn single-use tokens.
 */
async function validateTokenOnly(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
    return {
      success: false,
      error: 'INVALID_TOKEN',
      statusCode: 400,
      message: 'Verification token is invalid or missing.'
    };
  }

  const tokenHash = hashToken(rawToken);

  const record = await db.getOne(
    `SELECT 
      t.id as token_id, t.expires_at, t.used_at,
      a.id as attendee_id, a.full_name, a.email, a.discipline, a.preferred_track, a.email_verified,
      r.reference_code, r.pathway,
      tm.team_name
    FROM email_verification_tokens t
    JOIN attendees a ON a.id = t.attendee_id
    JOIN registrations r ON r.id = a.registration_id
    LEFT JOIN teams tm ON tm.id = a.team_id
    WHERE t.token_hash = ?`,
    [tokenHash]
  );

  if (!record) {
    return {
      success: false,
      error: 'TOKEN_NOT_FOUND',
      statusCode: 404,
      message: 'The verification link is invalid or does not exist.'
    };
  }

  if (record.used_at) {
    const ticketService = require('./ticketService');
    const existingTicket = await ticketService.getTicketForAttendee(record.attendee_id);
    return {
      success: false,
      error: 'ALREADY_VERIFIED',
      statusCode: 200,
      message: 'This email address has already been verified.',
      data: {
        attendee: {
          fullName: record.full_name,
          email: record.email,
          referenceCode: record.reference_code,
          pathway: record.pathway,
          teamName: record.team_name || null
        },
        ticket: existingTicket
      }
    };
  }

  const now = new Date();
  const expiresAt = new Date(record.expires_at);
  if (expiresAt < now) {
    return {
      success: false,
      error: 'TOKEN_EXPIRED',
      statusCode: 410,
      message: 'This verification link has expired. Please request a new verification email.',
      attendeeEmail: record.email
    };
  }

  return {
    success: true,
    statusCode: 200,
    message: 'Token is valid and ready for confirmation.',
    data: {
      attendeeName: record.full_name,
      referenceCode: record.reference_code,
      pathway: record.pathway,
      teamName: record.team_name || null,
      preferredTrack: record.preferred_track
    }
  };
}

module.exports = {
  hashToken,
  createTokenForAttendee,
  createVerificationToken: createTokenForAttendee,
  processVerificationToken,
  validateTokenOnly,
  resendVerificationEmail
};
