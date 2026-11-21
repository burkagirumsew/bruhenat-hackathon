/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Google Sheets Integration & Synchronization Controller
 */

const googleSheetsSyncService = require('../services/googleSheetsSyncService');
const googleSheetsClient = require('../services/googleSheetsClient');
const auditService = require('../services/auditService');
const config = require('../config/environment');
const logger = require('../utils/logger');

/**
 * GET /api/admin/google-sheets/status
 */
async function getStatus(req, res) {
  try {
    const status = await googleSheetsSyncService.getSyncStatus();
    return res.status(200).json({
      success: true,
      ...status
    });
  } catch (err) {
    logger.error('Failed to get Google Sheets status:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve Google Sheets status.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/google-sheets/sync
 * Trigger queue processing
 */
async function triggerSync(req, res) {
  try {
    const { batchSize } = req.body || {};
    const result = await googleSheetsSyncService.processSyncQueue({
      batchSize: parseInt(batchSize || '25', 10)
    });

    return res.status(200).json({
      success: true,
      message: `Processed ${result.processed} queue items (${result.successful} synced, ${result.failed} failed).`,
      result
    });
  } catch (err) {
    logger.error('Failed to trigger Google Sheets sync:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to process synchronization queue.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/google-sheets/sync/bulk
 * Trigger bulk synchronization of all existing database records
 */
async function triggerBulkSync(req, res) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await googleSheetsSyncService.bulkSyncExistingRecords(
      req.admin ? req.admin.id : null,
      ipAddress
    );

    return res.status(200).json({
      success: true,
      message: 'Bulk synchronization completed.',
      result
    });
  } catch (err) {
    logger.error('Failed to execute bulk Google Sheets sync:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Bulk synchronization failed.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/google-sheets/retry-failed
 * Reset failed items to PENDING and process queue
 */
async function retryFailed(req, res) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await googleSheetsSyncService.retryFailedRecords(
      req.admin ? req.admin.id : null,
      ipAddress
    );

    return res.status(200).json({
      success: true,
      message: `Reset ${result.resetCount} failed records and triggered queue processing.`,
      result
    });
  } catch (err) {
    logger.error('Failed to retry failed Google Sheets sync:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retry failed records.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/google-sheets/queue
 */
async function getQueue(req, res) {
  try {
    const { page, limit, status } = req.query;
    const result = await googleSheetsSyncService.getSyncQueue({
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
      status
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('Failed to get Google Sheets sync queue:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync queue.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/google-sheets/history
 */
async function getHistory(req, res) {
  try {
    const { page, limit } = req.query;
    const result = await auditService.getAuditLogs({
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
      action: 'GOOGLE_SHEETS_BULK_SYNC'
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error('Failed to get Google Sheets sync history:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync history.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * GET /api/admin/google-sheets/spreadsheet
 * Return safe spreadsheet link and information
 */
async function getSpreadsheetInfo(req, res) {
  try {
    const spreadsheetId = (config.googleSheets.spreadsheetId || '').trim();
    if (!spreadsheetId) {
      return res.status(404).json({
        success: false,
        error: 'GOOGLE_SPREADSHEET_ID is not configured.',
        timestamp: new Date().toISOString()
      });
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return res.status(200).json({
      success: true,
      spreadsheetId: `${spreadsheetId.slice(0, 8)}...${spreadsheetId.slice(-4)}`,
      spreadsheetUrl,
      sheetNames: config.googleSheets.sheetNames,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve spreadsheet information.',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  getStatus,
  triggerSync,
  triggerBulkSync,
  retryFailed,
  getQueue,
  getHistory,
  getSpreadsheetInfo
};
