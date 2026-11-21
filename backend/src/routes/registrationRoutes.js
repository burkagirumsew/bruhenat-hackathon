/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Registration API Routes
 */

const express = require('express');
const router = express.Router();
const registrationController = require('../controllers/registrationController');
const { requireJson } = require('../middleware/requestValidator');
const { registrationLimiter } = require('../middleware/rateLimiter');

// POST /api/registrations/individual
router.post(
  '/registrations/individual',
  registrationLimiter,
  requireJson,
  registrationController.registerIndividual
);

// POST /api/registrations/team
router.post(
  '/registrations/team',
  registrationLimiter,
  requireJson,
  registrationController.registerTeam
);

// POST /api/register (Unified Endpoint for the existing frontend)
router.post(
  '/register',
  registrationLimiter,
  requireJson,
  registrationController.registerUnified
);

module.exports = router;
