/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Google Sheets API Routes
 */

const express = require('express');
const router = express.Router();

const googleSheetsController = require('../controllers/googleSheetsController');
const { authenticateAdmin, requireRole } = require('../middleware/authMiddleware');

// All Google Sheets integration endpoints require authentication and SUPER_ADMIN or ADMIN role
router.use(authenticateAdmin);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/status', googleSheetsController.getStatus);
router.post('/sync', googleSheetsController.triggerSync);
router.post('/sync/bulk', googleSheetsController.triggerBulkSync);
router.post('/retry-failed', googleSheetsController.retryFailed);
router.get('/queue', googleSheetsController.getQueue);
router.get('/history', googleSheetsController.getHistory);
router.get('/spreadsheet', googleSheetsController.getSpreadsheetInfo);

module.exports = router;
