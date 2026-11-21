/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Event Session Controller
 */

const sessionService = require('../services/sessionService');
const logger = require('../utils/logger');

/**
 * GET /api/admin/sessions
 */
async function getSessions(req, res) {
  try {
    const sessions = await sessionService.listSessions();
    return res.status(200).json({
      success: true,
      sessions,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to list sessions:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve event sessions.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/sessions/active (or /api/check-in/session/active)
 */
async function getActive(req, res) {
  try {
    const session = await sessionService.getActiveSession();
    return res.status(200).json({
      success: true,
      session,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Failed to get active session:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve active session.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/sessions
 */
async function createSession(req, res) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const session = await sessionService.createSession(
      req.body,
      req.admin ? req.admin.id : null,
      ipAddress
    );
    return res.status(201).json({
      success: true,
      message: `Session "${session.sessionName}" created.`,
      session,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const status = err.message.includes('already in use') ? 409 : 400;
    return res.status(status).json({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * PUT /api/admin/sessions/:id
 */
async function updateSession(req, res) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const session = await sessionService.updateSession(
      id,
      req.body,
      req.admin ? req.admin.id : null,
      ipAddress
    );
    return res.status(200).json({
      success: true,
      message: 'Session updated successfully.',
      session,
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
 * POST /api/admin/sessions/:id/activate
 */
async function activateSession(req, res) {
  try {
    const { id } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const session = await sessionService.activateSession(
      id,
      req.admin ? req.admin.id : null,
      ipAddress
    );
    return res.status(200).json({
      success: true,
      message: `Session "${session.sessionName}" activated for check-in desks.`,
      session,
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
 * GET /api/admin/sessions/:id/attendance
 */
async function getSessionAttendance(req, res) {
  try {
    const { id } = req.params;
    const { page, limit, search } = req.query;
    const data = await sessionService.getSessionAttendance(id, {
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '50', 10),
      search
    });

    return res.status(200).json({
      success: true,
      ...data,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to retrieve session attendance.',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getSessions,
  getActive,
  createSession,
  updateSession,
  activateSession,
  getSessionAttendance
};
