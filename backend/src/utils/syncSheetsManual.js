/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Manual Google Sheets Synchronization Utility
 * Usage: npm run sync-sheets [--bulk]
 */

const googleSheetsSyncService = require('../services/googleSheetsSyncService');
const googleSheetsClient = require('../services/googleSheetsClient');
const db = require('../config/database');
const config = require('../config/environment');

async function run() {
  console.log('================================================================');
  console.log('  BRUH-ENAT HACKATHON 2026 - GOOGLE SHEETS MANUAL SYNC');
  console.log('================================================================');

  if (!config.googleSheets.enabled) {
    console.log('[INFO] Google Sheets integration is currently DISABLED via GOOGLE_SHEETS_ENABLED=false.');
    console.log('To enable, set GOOGLE_SHEETS_ENABLED=true and configure credentials in backend/.env');
    process.exit(0);
  }

  console.log('Testing Google Sheets connection...');
  const conn = await googleSheetsClient.testConnection();
  if (!conn.connected) {
    console.error(`[ERROR] Connection failed: ${conn.message}`);
    process.exit(1);
  }

  console.log(`[CONNECTED] Target Spreadsheet: "${conn.spreadsheetTitle}" (${conn.spreadsheetId})`);

  const isBulk = process.argv.includes('--bulk');

  if (isBulk) {
    console.log('\nStarting BULK synchronization of all database records...');
    const result = await googleSheetsSyncService.bulkSyncExistingRecords('CLI_MANUAL', '127.0.0.1');
    console.log('\n--- Bulk Synchronization Results ---');
    console.log(`Attendees:  ${result.attendees.synced} / ${result.attendees.total} synced (${result.attendees.failed} failed)`);
    console.log(`Attendance: ${result.attendance.synced} / ${result.attendance.total} synced (${result.attendance.failed} failed)`);
    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }
  } else {
    console.log('\nProcessing pending synchronization queue items...');
    const result = await googleSheetsSyncService.processSyncQueue({ batchSize: 50 });
    console.log(`[RESULT] Processed: ${result.processed}, Synced: ${result.successful}, Failed: ${result.failed}`);
  }

  await db.closePool();
  console.log('\nDone.');
  process.exit(0);
}

run().catch(err => {
  console.error('[FATAL ERROR]:', err.message);
  process.exit(1);
});
