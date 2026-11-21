/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Rate Limiting Middleware
 */

const config = require('../config/environment');

let rateLimit = null;
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  // express-rate-limit will be loaded after npm install
}

// General API rate limiter (100 requests per 15 minutes by default)
const apiLimiter = rateLimit
  ? rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many requests from this IP. Please wait a few minutes before trying again.',
        timestamp: new Date().toISOString()
      }
    })
  : (req, res, next) => next();

// Stricter registration submission limiter (20 submissions per 15 mins per IP)
const registrationLimiter = rateLimit
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many registration attempts submitted from this network. Please wait 15 minutes.',
        timestamp: new Date().toISOString()
      }
    })
  : (req, res, next) => next();

// Admin login rate limiter (10 attempts per 15 minutes per IP to block brute-force attacks)
const loginLimiter = rateLimit
  ? rateLimit({
      windowMs: 15 * 60 * 1000,
      max: config.rateLimit.loginMax || 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: 'Too many login attempts. Account temporarily locked for 15 minutes to prevent unauthorized access.',
        timestamp: new Date().toISOString()
      }
    })
  : (req, res, next) => next();

module.exports = {
  apiLimiter,
  registrationLimiter,
  loginLimiter
};
