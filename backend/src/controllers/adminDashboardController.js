/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Dashboard & Attendees Controller
 */

const adminService = require('../services/adminService');
const auditService = require('../services/auditService');
const reportService = require('../services/reportService');
const logger = require('../utils/logger');

/**
 * GET /api/admin/stats
 */
async function getStats(req, res) {
  try {
    const stats = await adminService.getDashboardStats();
    return res.status(200).json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get dashboard stats:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve dashboard analytics.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/attendees
 */
async function getAttendees(req, res) {
  try {
    const {
      search,
      pathway,
      track,
      verified,
      ticketStatus,
      participantStatus,
      status,
      sessionId,
      checkedIn,
      page,
      limit,
      sortBy,
      sortOrder
    } = req.query;

    const result = await adminService.listAttendees({
      search,
      pathway,
      track,
      verified,
      ticketStatus,
      participantStatus: participantStatus || status,
      sessionId,
      checkedIn,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
      sortBy,
      sortOrder
    });

    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to list attendees:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve attendees list.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/attendees/:id
 */
async function getAttendee(req, res) {
  try {
    const { id } = req.params;
    const attendee = await adminService.getAttendeeDetails(id);

    if (!attendee) {
      return res.status(404).json({
        success: false,
        error: 'Attendee not found.',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      attendee,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get attendee details:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve attendee details.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/tickets/:ticketId/revoke
 */
async function revokeTicket(req, res) {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A revocation reason is required.',
        timestamp: new Date().toISOString()
      });
    }

    const result = await adminService.revokeTicket({
      ticketId,
      reason: reason.trim(),
      adminId: req.admin ? req.admin.id : null,
      ipAddress
    });

    return res.status(200).json({
      success: true,
      message: `Ticket ${result.ticketCode} has been revoked.`,
      ticket: result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/attendees/:id/resend-verification
 */
async function resendVerification(req, res) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await adminService.resendVerification({
      attendeeId: id,
      adminId: req.admin ? req.admin.id : null,
      ipAddress
    });

    return res.status(200).json({
      success: true,
      message: `Verification email resent to ${result.email}.`,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/attendees/:id/resend-ticket
 */
async function resendTicket(req, res) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await adminService.resendTicket({
      attendeeId: id,
      adminId: req.admin ? req.admin.id : null,
      ipAddress
    });

    return res.status(200).json({
      success: true,
      message: `Ticket pass resent to ${result.email}.`,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/audit-logs
 */
async function getAuditLogs(req, res) {
  try {
    const { page, limit, action, adminId, search } = req.query;
    const result = await auditService.getAuditLogs({
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10),
      action,
      adminId,
      search
    });

    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get audit logs:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/export/attendees
 */
async function exportAttendees(req, res) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { filename, csvContent } = await reportService.generateAttendeesCsv(
      req.admin ? req.admin.id : null,
      ipAddress
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    logger.error('Failed to export attendees CSV:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate attendees CSV export.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/export/attendance
 */
async function exportAttendance(req, res) {
  try {
    const { sessionId } = req.query;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { filename, csvContent } = await reportService.generateAttendanceCsv(
      sessionId,
      req.admin ? req.admin.id : null,
      ipAddress
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    logger.error('Failed to export attendance CSV:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate attendance CSV export.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/reports/attendance
 */
async function getAttendanceReport(req, res) {
  try {
    const { sessionId } = req.query;
    const report = await reportService.getAttendanceReport(sessionId);
    return res.status(200).json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get attendance report:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate attendance report.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/emails/status
 */
async function getEmailStatus(req, res) {
  try {
    const emailService = require('../services/emailService');
    const status = await emailService.getEmailQueueStatus();
    return res.status(200).json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get email queue status:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve email queue status.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/emails/retry
 */
async function retryEmails(req, res) {
  try {
    const { limit, maxRetries } = req.body || {};
    const emailService = require('../services/emailService');
    const result = await emailService.retryFailedEmails({
      limit: parseInt(limit, 10) || 20,
      maxRetries: parseInt(maxRetries, 10) || 5
    });

    await auditService.logAction({
      adminId: req.admin?.id,
      action: 'EMAIL_RETRY_TRIGGERED',
      targetType: 'email_logs',
      targetId: 'batch',
      details: { processed: result.processed, successful: result.successful, failed: result.failed },
      ipAddress: req.ip
    });

    return res.status(200).json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to retry failed emails:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retry failed emails.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/migrations
 */
async function getMigrations(req, res) {
  try {
    const db = require('../config/database');
    const migrations = await db.getAppliedMigrations();
    return res.status(200).json({
      success: true,
      migrations,
      count: migrations.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get applied migrations:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve schema migrations.',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getStats,
  getAttendees,
  getAttendee,
  revokeTicket,
  resendVerification,
  resendTicket,
  getAuditLogs,
  exportAttendees,
  exportAttendance,
  getAttendanceReport,
  getEmailStatus,
  retryEmails,
  getMigrations
};
