/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Ticket API Routes
 */

const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { registrationLimiter } = require('../middleware/rateLimiter');

// GET /api/tickets/:ticketCode
router.get('/tickets/:ticketCode', ticketController.getTicket);

// POST /api/tickets/resend
router.post('/tickets/resend', registrationLimiter, ticketController.resendTicket);

module.exports = router;
