/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Centralized Application Error Handling Middleware
 */

const logger = require('../utils/logger');
const config = require('../config/environment');

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isServerFault = statusCode >= 500;

  if (isServerFault) {
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}:`, err.stack || err.message);
  } else {
    logger.warn(`[Client Error] ${req.method} ${req.originalUrl} (${statusCode}):`, err.message);
  }

  // Prevent sending sensitive stack traces in production
  const response = {
    success: false,
    error: isServerFault && config.isProduction
      ? 'An internal server error occurred. Please contact event support.'
      : err.message || 'An unexpected error occurred.',
    timestamp: new Date().toISOString()
  };

  if (!config.isProduction && err.stack) {
    response.stack = err.stack;
  }

  if (err.details) {
    response.details = err.details;
  }

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;
