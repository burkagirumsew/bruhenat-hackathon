/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Registration Controller (Endpoints for Individual & Team Pathways)
 */

const { validateIndividualRegistration, validateTeamRegistration } = require('../validators/registrationValidator');
const registrationService = require('../services/registrationService');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/responseHelper');
const logger = require('../utils/logger');

/**
 * Determine if an error is caused by a database connection failure or network outage
 */
function isDatabaseConnectionError(err) {
  if (!err) return false;
  const code = (err.code || '').toString().toUpperCase();
  const message = (err.message || '').toLowerCase();

  // Network and DNS resolution errors
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(code)) {
    return true;
  }

  // PostgreSQL standard connection exception classes:
  // Class 08 — Connection Exception (08000, 08003, 08006, 08001, 08004, 08007, 08P01)
  // Class 57 — Operator Intervention (57P01 admin shutdown, 57P02 crash shutdown, 57P03 cannot connect now)
  if (code.startsWith('08') || code.startsWith('57P')) {
    return true;
  }

  // Common PostgreSQL & node-postgres client connection message signatures
  if (
    message.includes('database is not connected') ||
    message.includes('database connection offline') ||
    message.includes('connection terminated') ||
    message.includes('connection timeout') ||
    message.includes('timeout exceeded when trying to connect') ||
    message.includes('failed to connect') ||
    message.includes('getaddrinfo') ||
    message.includes('remaining connection slots are reserved') ||
    message.includes('could not connect to server') ||
    message.includes('database_url is not configured') ||
    message.includes('database_url environment variable is not configured') ||
    message.includes('postgresql client module')
  ) {
    return true;
  }

  return false;
}

/**
 * Handle Individual Registration
 * POST /api/registrations/individual
 */
async function registerIndividual(req, res, next) {
  try {
    const { isValid, errors, sanitized } = validateIndividualRegistration(req.body);
    if (!isValid) {
      return validationErrorResponse(res, errors);
    }

    const registration = await registrationService.registerIndividual(sanitized);

    return successResponse(
      res,
      201,
      'Your individual registration has been received and safely stored in the database. Initial status: Pending Email Verification. Official email verification and QR ticketing will be activated in the next step.',
      registration
    );
  } catch (err) {
    logger.error('Individual registration error:', err.message);

    if (err.statusCode === 409) {
      return errorResponse(res, 409, err.message);
    }

    if (isDatabaseConnectionError(err)) {
      return errorResponse(
        res,
        503,
        'Registration database is temporarily unreachable. Please try again shortly or contact the organizers.',
        { reason: 'Database connection offline', code: err.code || 'DB_UNAVAILABLE' }
      );
    }

    return next(err);
  }
}

/**
 * Handle Team Registration (3 to 5 Members)
 * POST /api/registrations/team
 */
async function registerTeam(req, res, next) {
  try {
    const { isValid, errors, sanitized } = validateTeamRegistration(req.body);
    if (!isValid) {
      return validationErrorResponse(res, errors);
    }

    const registration = await registrationService.registerTeam(sanitized);

    return successResponse(
      res,
      201,
      `Team "${sanitized.teamName}" registration has been received and safely stored in the database. All ${sanitized.totalTeamSize} member records have been created with initial status: Pending Email Verification.`,
      registration
    );
  } catch (err) {
    logger.error('Team registration error:', err.message);

    if (err.statusCode === 409) {
      return errorResponse(res, 409, err.message);
    }

    if (isDatabaseConnectionError(err)) {
      return errorResponse(
        res,
        503,
        'Registration database is temporarily unreachable. Please try again shortly or contact the organizers.',
        { reason: 'Database connection offline', code: err.code || 'DB_UNAVAILABLE' }
      );
    }

    return next(err);
  }
}

/**
 * Handle Unified Registration Router
 * POST /api/register
 * Detects pathway ('individual' or 'team') from payload
 */
async function registerUnified(req, res, next) {
  const pathway = (req.body.pathway || '').toLowerCase();
  if (pathway === 'team' || req.body.team) {
    return registerTeam(req, res, next);
  }
  return registerIndividual(req, res, next);
}

module.exports = {
  registerIndividual,
  registerTeam,
  registerUnified
};
