/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Check-In Controller
 * Handles live QR camera scans, manual lookups, duplicate detection, and recent feed.
 */

const checkInService = require('../services/checkInService');
const logger = require('../utils/logger');

/**
 * POST /api/check-in/scan
 */
async function scan(req, res) {
  try {
    const { qrData, ticketCode, sessionId } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!qrData && !ticketCode) {
      return res.status(400).json({
        success: false,
        error: 'Either qrData or ticketCode is required for scan check-in.',
        timestamp: new Date().toISOString()
      });
    }

    const result = await checkInService.checkInByQr({
      qrData,
      ticketCode,
      sessionId,
      adminId: req.admin ? req.admin.id : null,
      ipAddress
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message,
      alreadyCheckedIn: Boolean(err.alreadyCheckedIn),
      existingCheckIn: err.existingCheckIn || null,
      ticketStatus: err.ticketStatus || null,
      unverified: Boolean(err.unverified),
      attendee: err.attendee || null,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/check-in/manual
 */
async function manual(req, res) {
  try {
    const { attendeeId, sessionId, reason } = req.body || {};
    const ipAddress = req.ip || req.connection.remoteAddress;

    if (!attendeeId) {
      return res.status(400).json({
        success: false,
        error: 'attendeeId is required for manual check-in.',
        timestamp: new Date().toISOString()
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A reason must be provided for manual check-in.',
        timestamp: new Date().toISOString()
      });
    }

    const result = await checkInService.checkInManual({
      attendeeId,
      sessionId,
      reason: reason.trim(),
      adminId: req.admin ? req.admin.id : null,
      ipAddress
    });

    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message,
      alreadyCheckedIn: Boolean(err.alreadyCheckedIn),
      existingCheckIn: err.existingCheckIn || null,
      ticketStatus: err.ticketStatus || null,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/check-in/search
 */
async function search(req, res) {
  try {
    const { q, query, sessionId } = req.query;
    const searchTerm = q || query || '';

    const results = await checkInService.searchAttendeesForCheckIn(searchTerm, sessionId);
    return res.status(200).json({
      success: true,
      query: searchTerm,
      count: results.length,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to search attendees for check-in:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to search attendees.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/check-in/recent
 */
async function getRecent(req, res) {
  try {
    const { sessionId, limit } = req.query;
    const recent = await checkInService.getRecentCheckIns(
      sessionId,
      parseInt(limit || '10', 10)
    );

    return res.status(200).json({
      success: true,
      recent,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get recent check-ins:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent check-ins.',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  scan,
  manual,
  search,
  getRecent
};
