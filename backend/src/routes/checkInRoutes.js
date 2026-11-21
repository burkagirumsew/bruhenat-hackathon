/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Check-In API Routes
 */

const express = require('express');
const router = express.Router();

const checkInController = require('../controllers/checkInController');
const sessionController = require('../controllers/sessionController');
const { authenticateAdmin, requireRole } = require('../middleware/authMiddleware');

// Check-in endpoints require authentication and CHECKIN_STAFF, ADMIN, or SUPER_ADMIN role
router.use(authenticateAdmin);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'CHECKIN_STAFF'));

// Check-in operations
router.post('/scan', checkInController.scan);
router.post('/manual', checkInController.manual);
router.get('/search', checkInController.search);
router.get('/recent', checkInController.getRecent);
router.get('/session/active', sessionController.getActive);

module.exports = router;
