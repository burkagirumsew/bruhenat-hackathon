/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Round 4 Test Suite: Google Sheets API Integration & Automatic Synchronization
 */

const assert = require('assert');
const { SHEET_HEADERS, testConnection } = require('../src/services/googleSheetsClient');
const googleSheetsSyncService = require('../src/services/googleSheetsSyncService');
const googleSheetsController = require('../src/controllers/googleSheetsController');
const { requireRole } = require('../src/middleware/authMiddleware');

async function runGoogleSheetsTests() {
  console.log('\n--- Running Round 4: Google Sheets Integration & Synchronization Tests ---');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Worksheet Headers & Schema Completeness
  test('Sheet Schemas: All 4 worksheets have complete header specifications', () => {
    assert(SHEET_HEADERS.allAttendees && SHEET_HEADERS.allAttendees.length >= 18, 'All Attendees headers must exist');
    assert(SHEET_HEADERS.allAttendees.includes('Attendee ID'), 'All Attendees must have Attendee ID');
    assert(SHEET_HEADERS.allAttendees.includes('Email Verification Status'), 'Must have Verification Status');
    assert(SHEET_HEADERS.allAttendees.includes('Ticket Code'), 'Must have Ticket Code');
    assert(SHEET_HEADERS.allAttendees.includes('Attendance Status'), 'Must have Attendance Status');

    assert(SHEET_HEADERS.individualRegistrations && SHEET_HEADERS.individualRegistrations.includes('Registration ID'));
    assert(SHEET_HEADERS.individualRegistrations.includes('Attendee ID'));

    assert(SHEET_HEADERS.teamRegistrations && SHEET_HEADERS.teamRegistrations.includes('Team ID'));
    assert(SHEET_HEADERS.teamRegistrations.includes('Team Leader Name'));
    assert(SHEET_HEADERS.teamRegistrations.includes('Attendee ID'));

    assert(SHEET_HEADERS.attendanceRecords && SHEET_HEADERS.attendanceRecords.includes('Attendance ID'));
    assert(SHEET_HEADERS.attendanceRecords.includes('Attendee ID'));
    assert(SHEET_HEADERS.attendanceRecords.includes('Session ID'));
    assert(SHEET_HEADERS.attendanceRecords.includes('Check-in Method'));
  });

  // 2. Safe Disabled / Missing Credentials Behavior
  await asyncTest('Resilience: testConnection gracefully handles disabled or unconfigured credentials without crash', async () => {
    const conn = await testConnection();
    assert.strictEqual(typeof conn, 'object');
    assert.strictEqual(conn.connected, false, 'Should be disconnected when unconfigured');
    assert(conn.message, 'Should provide friendly diagnostic message');
    assert(!conn.message.includes('BEGIN PRIVATE KEY'), 'Must NEVER expose private keys in diagnostics');
  });

  // 3. Queue Methods Exist & Handle Both Online and Disconnected DB Safely
  await asyncTest('Queue Resilience: queueAttendeeSync and queueAttendanceSync do not throw and handle state safely', async () => {
    const res1 = await googleSheetsSyncService.queueAttendeeSync('att_test_123');
    assert(res1 === null || typeof res1 === 'string', 'Should return sync ID when DB is online, or null when offline');

    const res2 = await googleSheetsSyncService.queueAttendanceSync('att_test_456');
    assert(res2 === null || typeof res2 === 'string', 'Should return sync ID when DB is online, or null when offline');
  });

  // 4. Status Reporting
  await asyncTest('Status Report: getSyncStatus returns complete metrics structure', async () => {
    const status = await googleSheetsSyncService.getSyncStatus();
    assert(typeof status === 'object');
    assert('enabled' in status);
    assert('connection' in status);
    assert('queue' in status);
    assert.strictEqual(typeof status.queue.total, 'number');
    assert.strictEqual(typeof status.queue.synced, 'number');
    assert.strictEqual(typeof status.queue.pending, 'number');
    assert.strictEqual(typeof status.queue.failed, 'number');
  });

  // 5. RBAC Protection
  test('RBAC: Google Sheets integration is restricted from CHECKIN_STAFF', () => {
    const guard = requireRole('SUPER_ADMIN', 'ADMIN');
    let status = 0;
    let json = null;
    const req = { admin: { id: 'staff_1', role: 'CHECKIN_STAFF' } };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    guard(req, res, () => { assert.fail('CHECKIN_STAFF should be blocked'); });
    assert.strictEqual(status, 403, 'Should return HTTP 403 Forbidden for staff');
  });

  test('RBAC: Google Sheets integration permits ADMIN and SUPER_ADMIN', () => {
    const guard = requireRole('SUPER_ADMIN', 'ADMIN');
    let nextCalled = false;
    const reqAdmin = { admin: { id: 'adm_1', role: 'ADMIN' } };
    guard(reqAdmin, {}, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'ADMIN should be permitted');

    nextCalled = false;
    const reqSuper = { admin: { id: 'sup_1', role: 'SUPER_ADMIN' } };
    guard(reqSuper, {}, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'SUPER_ADMIN should be permitted');
  });

  // 6. Controllers Input & Error Handling
  await asyncTest('Controller: POST /api/admin/google-sheets/sync/bulk requires database connection', async () => {
    let status = 0;
    let json = null;
    const req = { admin: { id: 'adm_1' }, ip: '127.0.0.1' };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    await googleSheetsController.triggerBulkSync(req, res);
    assert.strictEqual(status, 500);
    assert.strictEqual(json.success, false);
    assert(json.error, 'Should return descriptive error');
  });

  await asyncTest('Controller: GET /api/admin/google-sheets/status returns 200 with diagnostics', async () => {
    let status = 0;
    let json = null;
    const req = { admin: { id: 'adm_1' } };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    await googleSheetsController.getStatus(req, res);
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, true);
    assert('queue' in json);
  });

  console.log(`Google Sheets Tests Finished: ${passed} Passed, ${failed} Failed`);
  return { passed, failed };
}

if (require.main === module) {
  runGoogleSheetsTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runGoogleSheetsTests;
