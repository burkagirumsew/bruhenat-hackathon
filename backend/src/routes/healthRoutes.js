/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Health API Routes
 */

const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

// GET /api/health
router.get('/health', healthController.getHealth);

module.exports = router;
