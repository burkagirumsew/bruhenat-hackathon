/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Ticket Controller
 * Public ticket retrieval, digital pass rendering, and ticket re-delivery.
 */

const ticketService = require('../services/ticketService');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Get ticket details by ticketCode
 * GET /api/tickets/:ticketCode
 */
async function getTicket(req, res) {
  const { ticketCode } = req.params;

  if (!ticketCode) {
    return errorResponse(res, 400, 'Ticket code is required.');
  }

  try {
    const ticket = await ticketService.getTicketByCode(ticketCode);

    if (!ticket) {
      return errorResponse(res, 404, `No active ticket found for code "${ticketCode}".`);
    }

    return successResponse(res, 200, 'Ticket retrieved successfully.', ticket);
  } catch (err) {
    logger.error('Error fetching ticket:', err.message);

    if (err.message && err.message.includes('Database is not connected')) {
      return errorResponse(res, 503, 'Ticket database is temporarily offline.');
    }

    return errorResponse(res, 500, 'Unable to retrieve ticket details.');
  }
}

/**
 * Resend ticket email
 * POST /api/tickets/resend
 */
async function resendTicket(req, res) {
  const email = req.body?.email;

  if (!email || typeof email !== 'string') {
    return errorResponse(res, 400, 'Email address is required.');
  }

  try {
    const result = await ticketService.resendTicketEmail(email);

    if (!result.success) {
      return errorResponse(res, result.statusCode, result.message);
    }

    return successResponse(res, 200, result.message);
  } catch (err) {
    logger.error('Error resending ticket:', err.message);

    if (err.message && err.message.includes('Database is not connected')) {
      return errorResponse(res, 503, 'Ticket database is temporarily offline.');
    }

    return errorResponse(res, 500, 'Unable to process ticket resend.');
  }
}

module.exports = {
  getTicket,
  resendTicket
};
