/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * HTTP Request Header and Body Validator Middleware
 */

const { errorResponse } = require('../utils/responseHelper');

function requireJson(req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return errorResponse(res, 415, 'Unsupported Media Type. Requests must provide Content-Type: application/json.');
    }
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      return errorResponse(res, 400, 'Invalid request body. JSON payload cannot be empty.');
    }
  }
  next();
}

module.exports = {
  requireJson
};
