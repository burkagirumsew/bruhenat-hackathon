/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin API Routes
 */

const express = require('express');
const router = express.Router();

const adminAuthController = require('../controllers/adminAuthController');
const adminDashboardController = require('../controllers/adminDashboardController');
const sessionController = require('../controllers/sessionController');

const { authenticateAdmin, requireRole } = require('../middleware/authMiddleware');
const { loginLimiter } = require('../middleware/rateLimiter');

// 1. Authentication Routes (Public with strict brute-force rate limiter)
router.post('/login', loginLimiter, adminAuthController.login);

// 2. Authenticated Session Routes (All authenticated roles)
router.use(authenticateAdmin);

router.post('/logout', adminAuthController.logout);
router.get('/me', adminAuthController.getMe);
router.get('/sessions/active', sessionController.getActive);

// 3. Management & Analytics Routes (SUPER_ADMIN and ADMIN only)
const adminGuard = requireRole('SUPER_ADMIN', 'ADMIN');

router.get('/stats', adminGuard, adminDashboardController.getStats);
router.get('/attendees', adminGuard, adminDashboardController.getAttendees);
router.get('/attendees/:id', adminGuard, adminDashboardController.getAttendee);
router.post('/attendees/:id/resend-verification', adminGuard, adminDashboardController.resendVerification);
router.post('/attendees/:id/resend-ticket', adminGuard, adminDashboardController.resendTicket);
router.post('/tickets/:ticketId/revoke', adminGuard, adminDashboardController.revokeTicket);

router.get('/audit-logs', adminGuard, adminDashboardController.getAuditLogs);
router.get('/reports/attendance', adminGuard, adminDashboardController.getAttendanceReport);
router.get('/export/attendees', adminGuard, adminDashboardController.exportAttendees);
router.get('/export/attendance', adminGuard, adminDashboardController.exportAttendance);

// Email Queue & Deliverability Management
router.get('/emails/status', adminGuard, adminDashboardController.getEmailStatus);
router.post('/emails/retry', adminGuard, adminDashboardController.retryEmails);

// Schema Migrations Status
router.get('/migrations', requireRole('SUPER_ADMIN'), adminDashboardController.getMigrations);

// Session Management
router.get('/sessions', adminGuard, sessionController.getSessions);
router.post('/sessions', adminGuard, sessionController.createSession);
router.get('/sessions/:id/attendance', adminGuard, sessionController.getSessionAttendance);
router.put('/sessions/:id', adminGuard, sessionController.updateSession);
router.post('/sessions/:id/activate', adminGuard, sessionController.activateSession);

module.exports = router;
