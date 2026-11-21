/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Verification Controller
 * Endpoints for email verification link processing and resend requests.
 * Protects against email prefetch scanners by requiring an explicit POST action to burn tokens.
 */

const verificationTokenService = require('../services/verificationTokenService');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const config = require('../config/environment');
const logger = require('../utils/logger');

function isDatabaseConnectionError(err) {
  if (!err) return false;
  const code = (err.code || '').toString().toUpperCase();
  const message = (err.message || '').toLowerCase();
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) return true;
  if (code.startsWith('08') || code.startsWith('57P')) return true;
  if (
    message.includes('database is not connected') ||
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('timeout exceeded') ||
    message.includes('failed to connect') ||
    message.includes('getaddrinfo')
  ) return true;
  return false;
}

/**
 * Handle Token Pre-Validation (GET) and Token Verification (POST)
 * GET /api/verify?token=... (Pre-checks token without consuming it)
 * POST /api/verify { token } (Consumes token, verifies email, and activates pass)
 */
async function verifyEmail(req, res) {
  const token = req.query.token || req.body?.token;

  if (!token) {
    return errorResponse(res, 400, 'Verification token parameter is required.');
  }

  // If request is from browser navigation (Accept: text/html), redirect to frontend verify page
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  if (req.method === 'GET' && acceptsHtml) {
    return res.redirect(`${config.frontendUrl}/verify.html?token=${encodeURIComponent(token.trim())}`);
  }

  try {
    // GET requests ONLY pre-validate to protect against email security prefetch scanners
    if (req.method === 'GET') {
      const preCheck = await verificationTokenService.validateTokenOnly(token);
      if (!preCheck.success && preCheck.error !== 'ALREADY_VERIFIED') {
        return errorResponse(res, preCheck.statusCode || 400, preCheck.message, { errorCode: preCheck.error });
      }
      return successResponse(res, preCheck.statusCode || 200, preCheck.message, preCheck.data);
    }

    // POST requests perform the actual single-use verification and ticket creation
    const result = await verificationTokenService.processVerificationToken(token);

    if (!result.success && result.error !== 'ALREADY_VERIFIED') {
      return errorResponse(res, result.statusCode || 400, result.message, { errorCode: result.error });
    }

    return successResponse(res, result.statusCode || 200, result.message, result.data);
  } catch (err) {
    logger.error('Error during token verification:', err.message);

    if (isDatabaseConnectionError(err)) {
      return errorResponse(
        res,
        503,
        'Verification database is temporarily offline. Please try again in a few moments.'
      );
    }

    return errorResponse(res, 500, 'An unexpected error occurred while verifying your email.');
  }
}

/**
 * Handle Resend Verification Email
 * POST /api/verify/resend
 */
async function resendVerification(req, res) {
  const email = req.body?.email;

  if (!email || typeof email !== 'string') {
    return errorResponse(res, 400, 'A valid email address is required.');
  }

  try {
    const result = await verificationTokenService.resendVerificationEmail(email);

    if (!result.success) {
      return errorResponse(res, result.statusCode, result.message);
    }

    return successResponse(res, 200, result.message);
  } catch (err) {
    logger.error('Error during verification resend:', err.message);

    if (isDatabaseConnectionError(err)) {
      return errorResponse(
        res,
        503,
        'Database is temporarily unreachable. Please try again shortly.'
      );
    }

    return errorResponse(res, 500, 'Unable to process resend request.');
  }
}

module.exports = {
  verifyEmail,
  resendVerification
};
