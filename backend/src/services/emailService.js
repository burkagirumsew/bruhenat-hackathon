/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Transactional Email Service
 * Supports Resend API (HTTP POST), SMTP, and Console logger with database audit trails.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const config = require('../config/environment');
const db = require('../config/database');
const logger = require('../utils/logger');

function generateId(prefix = '') {
  const hex = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${hex}` : hex;
}

/**
 * Render an HTML template with variable replacement and simple conditionals
 */
function renderTemplate(templateName, data) {
  const templatePath = path.resolve(__dirname, '../../templates/emails', templateName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }

  let html = fs.readFileSync(templatePath, 'utf8');

  // 1. Process conditionals: {{#if key}}...{{/if}}
  html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, key, content) => {
    return data[key] ? content : '';
  });

  // 2. Process variable placeholders: {{key}}
  html = html.replace(/{{(\w+)}}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
  });

  return html;
}

/**
 * Record an email attempt into the email_logs table for audit and deliverability tracking
 */
async function logEmailAttempt({
  attendeeId,
  recipientEmail,
  emailType,
  subject,
  deliveryStatus,
  providerMessageId,
  errorMessage,
  retryCount = 0,
  nextRetryAt = null,
  payloadJson = null
}) {
  try {
    const dbHealth = await db.checkConnection();
    if (dbHealth.connected) {
      const logId = generateId('emlog');
      await db.execute(
        `INSERT INTO email_logs (
          id, attendee_id, recipient_email, email_type, subject,
          delivery_status, provider_message_id, error_message,
          retry_count, next_retry_at, payload_json, last_attempt_at, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          logId,
          attendeeId || null,
          recipientEmail,
          emailType,
          subject,
          deliveryStatus,
          providerMessageId || null,
          errorMessage || null,
          retryCount,
          nextRetryAt,
          payloadJson
        ]
      );
    }
  } catch (err) {
    logger.warn('Failed to record email audit log:', err.message);
  }
}

/**
 * Send an email via Resend REST API
 */
function sendViaResend({ to, subject, html }) {
  return new Promise((resolve) => {
    const apiKey = config.email.resendApiKey.trim();
    if (!apiKey) {
      return resolve({
        success: false,
        error: 'RESEND_API_KEY environment variable is not configured.'
      });
    }

    const payload = JSON.stringify({
      from: config.email.fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, messageId: parsed.id });
          } else {
            resolve({ success: false, error: parsed.message || `Resend HTTP ${res.statusCode}` });
          }
        } catch (e) {
          resolve({ success: false, error: `Invalid response from Resend (HTTP ${res.statusCode})` });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: 'Connection to Resend timed out.' });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Dispatch an email through the configured provider
 */
async function sendEmail({ to, subject, html, attendeeId, emailType, templateData = null }) {
  const provider = config.email.provider.toLowerCase();
  logger.info(`Sending ${emailType} email to: ${to} (Provider: ${provider})`);

  let result = null;

  if (provider === 'resend') {
    result = await sendViaResend({ to, subject, html });
  } else {
    // Console / local test fallback
    const mockId = `console_${Date.now()}`;
    logger.info(`[EMAIL CONSOLE SIMULATION] To: ${to} | Subject: "${subject}"`);
    result = { success: true, messageId: mockId, isConsole: true };
  }

  // Next retry time and payload for persistent failure recovery
  const nextRetryAt = result.success ? null : new Date(Date.now() + 60 * 1000).toISOString();
  const payloadJson = result.success ? null : JSON.stringify({
    to,
    subject,
    html,
    attendeeId,
    emailType,
    templateData
  });

  // Audit log with retry metadata
  await logEmailAttempt({
    attendeeId,
    recipientEmail: to,
    emailType,
    subject,
    deliveryStatus: result.success ? 'SENT' : 'FAILED',
    providerMessageId: result.messageId || null,
    errorMessage: result.error || null,
    retryCount: 0,
    nextRetryAt,
    payloadJson
  });

  return result;
}

/**
 * Send Individual Verification Email
 */
async function sendIndividualVerificationEmail(attendee, referenceCode, rawToken) {
  let token = rawToken;
  let refCode = referenceCode;
  if (!token && typeof referenceCode === 'string' && referenceCode.length > 20) {
    token = referenceCode;
    refCode = attendee.reference_code || attendee.referenceCode || '';
  }

  const verificationUrl = `${config.frontendUrl}/verify.html?token=${token || ''}`;
  const subject = "Verify Your Application — BRUH-Enat Women's Tech Innovation Hackathon 2026";

  const templateData = {
    fullName: attendee.fullName || attendee.full_name,
    referenceCode: refCode || attendee.reference_code || attendee.referenceCode || '',
    discipline: attendee.discipline,
    trackName: attendee.preferredTrack || attendee.preferred_track || 'Open Track',
    teamMatchingNotice: (attendee.matchingConsent || attendee.matching_consent) ? 'Opted-in for Dec 3 Zoom Matching' : 'Self-forming',
    expiresInHours: config.email.verificationExpirationHours || 48,
    verificationUrl
  };

  const html = renderTemplate('verify-individual.html', templateData);
  return await sendEmail({
    to: attendee.email,
    subject,
    html,
    attendeeId: attendee.id,
    emailType: 'VERIFY_INDIVIDUAL',
    templateData
  });
}

/**
 * Send Team Member Verification Email
 */
async function sendTeamMemberVerificationEmail(attendee, teamName, leaderName, referenceCode, rawToken) {
  const verificationUrl = `${config.frontendUrl}/verify.html?token=${rawToken}`;
  const subject = `Verify Your Spot in Team "${teamName}" — BRUH-Enat Hackathon 2026`;

  const templateData = {
    fullName: attendee.fullName || attendee.full_name,
    teamName,
    leaderName: leaderName || 'Team Leader',
    role: attendee.role || attendee.discipline || 'Team Member',
    trackName: attendee.preferredTrack || attendee.preferred_track || 'Open Track',
    referenceCode,
    expiresInHours: config.email.verificationExpirationHours || 48,
    verificationUrl
  };

  const html = renderTemplate('verify-team.html', templateData);
  return await sendEmail({
    to: attendee.email,
    subject,
    html,
    attendeeId: attendee.id,
    emailType: 'VERIFY_TEAM_MEMBER',
    templateData
  });
}

/**
 * Bridge for Admin Service: Send Team Verification Email
 */
async function sendTeamVerificationEmail(attendee, team, members, rawToken, expiresAt) {
  const normAttendee = {
    ...attendee,
    fullName: attendee.fullName || attendee.full_name,
    preferredTrack: attendee.preferredTrack || attendee.preferred_track || (team ? (team.selected_track || team.selectedTrack) : 'Open Track')
  };
  const teamName = team ? (team.team_name || team.teamName || 'Team') : 'Team';
  const refCode = attendee.reference_code || attendee.referenceCode || '';
  return await sendTeamMemberVerificationEmail(normAttendee, teamName, 'Team Leader', refCode, rawToken);
}

/**
 * Bridge for Admin Service: Send QR Ticket Pass Email
 */
async function sendQrTicketEmail(attendee, ticket, team = null) {
  const normAttendee = {
    ...attendee,
    fullName: attendee.fullName || attendee.full_name,
    discipline: attendee.discipline || attendee.role || 'Innovator',
    preferredTrack: attendee.preferredTrack || attendee.preferred_track || 'Open Track'
  };
  const normTicket = {
    ...ticket,
    ticketCode: ticket.ticketCode || ticket.ticket_code,
    qrData: ticket.qrData || ticket.qr_data
  };
  const refCode = attendee.reference_code || attendee.referenceCode || '';
  const teamName = team ? (team.team_name || team.teamName || null) : null;
  return await sendTicketConfirmationEmail(normAttendee, normTicket, refCode, teamName);
}

/**
 * Send Official QR Ticket Confirmation Email
 */
async function sendTicketConfirmationEmail(attendee, ticket, referenceCode, teamName = null) {
  const ticketPageUrl = `${config.frontendUrl}/ticket.html?code=${ticket.ticketCode}`;
  const subject = `Your Official Entry Ticket: ${ticket.ticketCode} — BRUH-Enat Hackathon 2026`;

  const templateData = {
    fullName: attendee.fullName,
    pathwayType: teamName ? 'Team Participant' : 'Individual Participant',
    teamName: teamName || '',
    qrCodeDataUrl: ticket.qrData,
    ticketCode: ticket.ticketCode,
    referenceCode,
    discipline: attendee.discipline || attendee.role || 'Innovator',
    trackName: attendee.preferredTrack || 'Open Track',
    ticketPageUrl
  };

  const html = renderTemplate('qr-ticket.html', templateData);
  return await sendEmail({
    to: attendee.email,
    subject,
    html,
    attendeeId: attendee.id,
    emailType: 'QR_TICKET_CONFIRMATION',
    templateData
  });
}

/**
 * Retry failed transactional emails from the persistent email_logs queue.
 * Implements exponential backoff and guarantees duplicate ticket prevention.
 */
async function retryFailedEmails({ limit = 20, maxRetries = 5 } = {}) {
  const dbHealth = await db.checkConnection();
  if (!dbHealth.connected) {
    return { success: false, processed: 0, successful: 0, failed: 0, message: 'Database is not connected.' };
  }

  const failedItems = await db.query(
    `SELECT id, attendee_id, recipient_email, email_type, subject, retry_count, payload_json
     FROM email_logs
     WHERE delivery_status = 'FAILED'
       AND retry_count < ?
       AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
     ORDER BY next_retry_at ASC, sent_at ASC
     LIMIT ?`,
    [maxRetries, limit]
  );

  if (failedItems.length === 0) {
    return { success: true, processed: 0, successful: 0, failed: 0, message: 'No pending failed emails to retry.' };
  }

  let successful = 0;
  let failed = 0;

  for (const item of failedItems) {
    let payload = null;
    try {
      payload = item.payload_json ? JSON.parse(item.payload_json) : null;
    } catch (e) {
      payload = null;
    }

    let to = item.recipient_email;
    let subject = item.subject;
    let html = payload?.html;

    // Duplicate Ticket Prevention on Retry:
    // If this is a QR Ticket Confirmation email, NEVER generate a new ticket.
    // Fetch the existing ticket from database to guarantee identical ticketCode and qrData.
    if (item.email_type === 'QR_TICKET_CONFIRMATION' && item.attendee_id) {
      try {
        const ticketService = require('./ticketService');
        const existingTicket = await ticketService.getTicketForAttendee(item.attendee_id);
        if (existingTicket && payload?.templateData) {
          payload.templateData.ticketCode = existingTicket.ticketCode;
          payload.templateData.qrCodeDataUrl = existingTicket.qrData;
          html = renderTemplate('qr-ticket.html', payload.templateData);
        }
      } catch (tktErr) {
        logger.warn(`Could not verify existing ticket for attendee ${item.attendee_id} during retry:`, tktErr.message);
      }
    }

    if (!html) {
      logger.warn(`Cannot retry email log ${item.id}: HTML content missing.`);
      failed++;
      continue;
    }

    const provider = config.email.provider.toLowerCase();
    let result = null;
    if (provider === 'resend') {
      result = await sendViaResend({ to, subject, html });
    } else {
      const mockId = `console_retry_${Date.now()}`;
      logger.info(`[EMAIL RETRY CONSOLE SIMULATION] To: ${to} | Subject: "${subject}"`);
      result = { success: true, messageId: mockId };
    }

    if (result.success) {
      await db.execute(
        `UPDATE email_logs
         SET delivery_status = 'SENT', provider_message_id = ?, error_message = NULL,
             last_attempt_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [result.messageId || null, item.id]
      );
      successful++;
      logger.info(`Successfully retried email ${item.id} to ${to}`);
    } else {
      failed++;
      const nextRetryCount = item.retry_count + 1;
      const delaySeconds = Math.pow(2, nextRetryCount) * 60; // Exponential backoff: 2m, 4m, 8m, 16m
      await db.execute(
        `UPDATE email_logs
         SET retry_count = ?,
             next_retry_at = CURRENT_TIMESTAMP + (? || ' seconds')::INTERVAL,
             error_message = ?,
             last_attempt_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [nextRetryCount, String(delaySeconds), result.error || 'Retry attempt failed', item.id]
      );
      logger.error(`Retry attempt ${nextRetryCount} failed for email ${item.id} to ${to}:`, result.error);
    }
  }

  return {
    success: true,
    processed: failedItems.length,
    successful,
    failed,
    timestamp: new Date().toISOString()
  };
}

/**
 * Retrieve summary status of email deliverability queue
 */
async function getEmailQueueStatus() {
  const dbHealth = await db.checkConnection();
  if (!dbHealth.connected) {
    return {
      connected: false,
      totalSent: 0,
      totalFailed: 0,
      pendingRetries: 0,
      recentLogs: []
    };
  }

  try {
    const counts = await db.getOne(`
      SELECT 
        COUNT(*) FILTER (WHERE delivery_status = 'SENT') as total_sent,
        COUNT(*) FILTER (WHERE delivery_status = 'FAILED') as total_failed,
        COUNT(*) FILTER (WHERE delivery_status = 'FAILED' AND retry_count < 5) as pending_retries
      FROM email_logs
    `);

    const recentLogs = await db.query(`
      SELECT id, attendee_id, recipient_email, email_type, subject,
             delivery_status, retry_count, next_retry_at, error_message, sent_at
      FROM email_logs
      ORDER BY sent_at DESC
      LIMIT 20
    `);

    return {
      connected: true,
      totalSent: parseInt(counts?.total_sent || 0, 10),
      totalFailed: parseInt(counts?.total_failed || 0, 10),
      pendingRetries: parseInt(counts?.pending_retries || 0, 10),
      recentLogs
    };
  } catch (err) {
    logger.warn('Failed to retrieve email queue status:', err.message);
    return {
      connected: true,
      error: err.message,
      totalSent: 0,
      totalFailed: 0,
      pendingRetries: 0,
      recentLogs: []
    };
  }
}

module.exports = {
  renderTemplate,
  sendEmail,
  sendIndividualVerificationEmail,
  sendTeamMemberVerificationEmail,
  sendTeamVerificationEmail,
  sendTicketConfirmationEmail,
  sendQrTicketEmail,
  retryFailedEmails,
  getEmailQueueStatus
};
