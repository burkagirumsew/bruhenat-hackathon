/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Standardized HTTP API Response Helper
 */

function successResponse(res, statusCode, message, data = null) {
  const payload = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  if (data !== null && data !== undefined) {
    payload.data = data;
  }
  return res.status(statusCode).json(payload);
}

function errorResponse(res, statusCode, message, details = null) {
  const payload = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  if (details !== null && details !== undefined) {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

function validationErrorResponse(res, errors) {
  return errorResponse(res, 400, 'Validation failed. Please correct the highlighted issues.', errors);
}

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse
};
