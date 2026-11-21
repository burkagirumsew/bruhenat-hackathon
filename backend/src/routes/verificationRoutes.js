/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Verification API Routes
 */

const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const { registrationLimiter } = require('../middleware/rateLimiter');

// GET /api/verify?token=...
router.get('/verify', verificationController.verifyEmail);

// POST /api/verify
router.post('/verify', verificationController.verifyEmail);

// POST /api/verify/resend
router.post('/verify/resend', registrationLimiter, verificationController.resendVerification);

module.exports = router;
