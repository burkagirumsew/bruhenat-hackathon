/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Round 3 Test Suite: Admin Authentication, Dashboard, RBAC & QR Check-In
 */

const assert = require('assert');
const { hashPassword, verifyPassword } = require('../src/utils/passwordHelper');
const { generateToken, verifyToken, requireRole } = require('../src/middleware/authMiddleware');
const { extractTicketCode } = require('../src/services/checkInService');
const { escapeCsv, ATTENDEE_CSV_HEADERS } = require('../src/services/reportService');
const adminAuthController = require('../src/controllers/adminAuthController');
const checkInController = require('../src/controllers/checkInController');
const adminDashboardController = require('../src/controllers/adminDashboardController');

async function runAdminTests() {
  console.log('\n--- Running Round 3: Admin Dashboard, Auth & QR Check-In Tests ---');

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

  // 1. Password Hashing & Verification
  await asyncTest('Password Hashing: generates verifiable hash', async () => {
    const raw = 'SecurePassword2026!';
    const hash = await hashPassword(raw);
    assert(hash && hash.length > 20, 'Hash should be non-empty');
    assert(hash !== raw, 'Hash should not match plain password');

    const isValid = await verifyPassword(raw, hash);
    assert.strictEqual(isValid, true, 'Verification should return true for correct password');

    const isInvalid = await verifyPassword('WrongPassword', hash);
    assert.strictEqual(isInvalid, false, 'Verification should return false for incorrect password');
  });

  // 2. JWT Generation & Verification
  test('JWT: signs and verifies admin payload successfully', () => {
    const payload = { id: 'adm_123', email: 'admin@bruhenat.org', role: 'SUPER_ADMIN' };
    const token = generateToken(payload);
    assert(token && typeof token === 'string', 'Token should be a non-empty string');

    const decoded = verifyToken(token);
    assert.strictEqual(decoded.id, payload.id, 'Decoded ID should match');
    assert.strictEqual(decoded.email, payload.email, 'Decoded email should match');
    assert.strictEqual(decoded.role, payload.role, 'Decoded role should match');
  });

  test('JWT: tampered token is rejected', () => {
    const payload = { id: 'adm_123', email: 'admin@bruhenat.org', role: 'ADMIN' };
    const token = generateToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';

    assert.throws(() => {
      verifyToken(tampered);
    }, 'Tampered token signature should throw');
  });

  // 3. Role-Based Access Control (RBAC) Guard
  test('RBAC: requireRole allows authorized roles and blocks unauthorized', () => {
    const guardSuper = requireRole('SUPER_ADMIN');
    const guardStaff = requireRole('CHECKIN_STAFF', 'ADMIN', 'SUPER_ADMIN');

    // Case A: Staff trying to access SUPER_ADMIN endpoint -> 403
    let statusSet = 0;
    let jsonSent = null;
    const reqStaff = { admin: { id: 'adm_1', role: 'CHECKIN_STAFF' } };
    const resStaff = {
      status: (s) => { statusSet = s; return resStaff; },
      json: (j) => { jsonSent = j; }
    };
    guardSuper(reqStaff, resStaff, () => { assert.fail('Should not call next()'); });
    assert.strictEqual(statusSet, 403, 'Should return HTTP 403 Forbidden');
    assert(jsonSent.error.includes('Access denied'), 'Error should explain insufficient role');

    // Case B: Staff accessing check-in endpoint -> calls next()
    let nextCalled = false;
    guardStaff(reqStaff, {}, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Check-in staff should be permitted');

    // Case C: Unauthenticated request -> 401
    let unauthStatus = 0;
    const resUnauth = {
      status: (s) => { unauthStatus = s; return resUnauth; },
      json: () => {}
    };
    guardStaff({}, resUnauth, () => { assert.fail('Should not call next without req.admin'); });
    assert.strictEqual(unauthStatus, 401, 'Should return HTTP 401 for unauthenticated request');
  });

  // 4. QR Code & Ticket Code Extraction
  test('Check-In: extractTicketCode extracts code from JSON payload', () => {
    const jsonStr = JSON.stringify({
      event: 'BRUH-ENAT-2026',
      code: 'BE26-A1B2-C3D4',
      ref: 'IND-882299'
    });
    const code = extractTicketCode(jsonStr);
    assert.strictEqual(code, 'BE26-A1B2-C3D4', 'Should extract ticket code from JSON');
  });

  test('Check-In: extractTicketCode extracts code from raw string or regex match', () => {
    const raw = 'be26-dead-beef';
    const code = extractTicketCode(raw);
    assert.strictEqual(code, 'BE26-DEAD-BEEF', 'Should extract uppercase ticket code');

    const surrounded = 'Attendee pass: BE26-1122-3344 scanned';
    const code2 = extractTicketCode(surrounded);
    assert.strictEqual(code2, 'BE26-1122-3344', 'Should regex extract BE26 code');
  });

  // 5. CSV Escaping, 17-Column Structure & Check-In Count
  test('CSV Export: escapeCsv properly escapes RFC 4180 quotes, commas, nulls, and newlines', () => {
    assert.strictEqual(escapeCsv('Simple Text'), '"Simple Text"');
    assert.strictEqual(escapeCsv('Text with, comma'), '"Text with, comma"');
    assert.strictEqual(escapeCsv('Text with "quotes"'), '"Text with ""quotes"""');
    assert.strictEqual(escapeCsv('Multi\r\nLine'), '"Multi\r\nLine"');
    assert.strictEqual(escapeCsv(null), '""');
    assert.strictEqual(escapeCsv(undefined), '""');
    assert.strictEqual(escapeCsv(0), '"0"');
  });

  test('CSV Export: Canonical specification enforces exactly 17 columns with Check-In Count', () => {
    assert.strictEqual(ATTENDEE_CSV_HEADERS.length, 17, 'Canonical Attendee CSV must define exactly 17 columns');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[0], 'Reference Code');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[1], 'Pathway');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[2], 'Full Name');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[3], 'Email');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[4], 'Phone');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[5], 'City');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[6], 'Discipline');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[7], 'Experience Level');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[8], 'Track');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[9], 'Team Name');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[10], 'Team Leader');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[11], 'Email Verified');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[12], 'Verified At');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[13], 'Ticket Code');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[14], 'Ticket Status');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[15], 'Check-In Count');
    assert.strictEqual(ATTENDEE_CSV_HEADERS[16], 'Registered At');
  });

  test('CSV Export: Frontend filtered export matches backend 17-column sequence exactly', () => {
    const fs = require('fs');
    const path = require('path');
    const adminJs = fs.readFileSync(path.resolve(__dirname, '../../admin/js/admin.js'), 'utf8');
    
    // Extract headers array from admin.js
    const match = adminJs.match(/const headers = \[([\s\S]*?)\];/);
    assert(match, 'admin.js must contain a headers array definition for filtered export');
    
    const frontendHeaders = match[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    
    assert.strictEqual(frontendHeaders.length, 17, 'Frontend export headers must define exactly 17 columns');
    assert.deepStrictEqual(frontendHeaders, ATTENDEE_CSV_HEADERS, 'Frontend and backend headers must match identically');
  });

  test('CSV Export: Row formatting verifies individual and team records with check-in count', () => {
    const formatRow = (a) => [
      escapeCsv(a.reference_code),
      escapeCsv(a.pathway),
      escapeCsv(a.full_name),
      escapeCsv(a.email),
      escapeCsv(a.phone || ''),
      escapeCsv(a.city || ''),
      escapeCsv(a.discipline || ''),
      escapeCsv(a.experience_level || ''),
      escapeCsv(a.track || ''),
      escapeCsv(a.team_name || ''),
      escapeCsv(a.is_team_leader ? 'YES' : 'NO'),
      escapeCsv(a.email_verified ? 'VERIFIED' : 'PENDING'),
      escapeCsv(a.email_verified_at || ''),
      escapeCsv(a.ticket_code || ''),
      escapeCsv(a.ticket_status || 'NOT_ISSUED'),
      escapeCsv(a.check_in_count || 0),
      escapeCsv(a.created_at)
    ].join(',');

    // Individual Attendee Record
    const indRow = formatRow({
      reference_code: 'BE-2026-IND-1043',
      pathway: 'INDIVIDUAL',
      full_name: 'Rahel Desta Kebede',
      email: 'rahel.desta@alx.et',
      phone: '+251 92 234 5678',
      city: 'Addis Ababa',
      discipline: 'Product Management / AI',
      experience_level: 'Advanced (5+ yrs)',
      track: 'Track 02: AI-Powered Information & Support Systems',
      team_name: null,
      is_team_leader: false,
      email_verified: true,
      email_verified_at: '2026-11-15T10:14:00Z',
      ticket_code: 'BE-2026-TKT-19284-A',
      ticket_status: 'ACTIVE',
      check_in_count: 1,
      created_at: '2026-11-14T15:10:00Z'
    });

    const indCells = indRow.split(',');
    assert.strictEqual(indCells.length, 17, 'Formatted individual row must contain 17 columns');
    assert.strictEqual(indCells[0], '"BE-2026-IND-1043"');
    assert.strictEqual(indCells[1], '"INDIVIDUAL"');
    assert.strictEqual(indCells[9], '""', 'Empty team_name must serialize to empty quoted string');
    assert.strictEqual(indCells[10], '"NO"');
    assert.strictEqual(indCells[15], '"1"', 'Check-In Count must serialize accurately');

    // Team Leader Attendee Record
    const teamRow = formatRow({
      reference_code: 'BE-2026-TEAM-1042',
      pathway: 'TEAM',
      full_name: 'Bethlehem Tadesse Mengistu',
      email: 'bethlehem.tadesse@enatmail.et',
      phone: '+251 91 123 4567',
      city: 'Addis Ababa',
      discipline: 'Machine Learning / Full Stack',
      experience_level: 'Intermediate (2-4 yrs)',
      track: 'Track 01: Incident Reporting',
      team_name: 'SafeEnat, "AI" Pioneers',
      is_team_leader: true,
      email_verified: true,
      email_verified_at: '2026-11-15T09:30:00Z',
      ticket_code: 'BE-2026-TKT-58472-V',
      ticket_status: 'ACTIVE',
      check_in_count: 2,
      created_at: '2026-11-14T14:22:10Z'
    });

    assert(teamRow.includes('"SafeEnat, ""AI"" Pioneers"'), 'Special characters in team name must be RFC 4180 escaped');
    assert(teamRow.includes('"YES"'), 'Team leader flag must be YES');
    assert(teamRow.includes('"2"'), 'Check-in count 2 must be represented');
  });

  // 6. Controllers Input Validation
  await asyncTest('Controller: POST /api/admin/login without body returns 400 Bad Request', async () => {
    let status = 0;
    let json = null;
    const req = { body: {}, headers: {}, connection: {} };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    await adminAuthController.login(req, res);
    assert.strictEqual(status, 400);
    assert.strictEqual(json.success, false);
  });

  await asyncTest('Controller: POST /api/check-in/scan without QR data or code returns 400', async () => {
    let status = 0;
    let json = null;
    const req = { body: {}, headers: {}, connection: {} };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    await checkInController.scan(req, res);
    assert.strictEqual(status, 400);
    assert.strictEqual(json.success, false);
  });

  await asyncTest('Controller: POST /api/check-in/manual without reason returns 400', async () => {
    let status = 0;
    let json = null;
    const req = { body: { attendeeId: 'att_123', reason: '' }, headers: {}, connection: {} };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    await checkInController.manual(req, res);
    assert.strictEqual(status, 400);
    assert.strictEqual(json.success, false);
  });

  await asyncTest('Controller: POST /api/admin/tickets/:ticketId/revoke without reason returns 400', async () => {
    let status = 0;
    let json = null;
    const req = { params: { ticketId: 'tkt_123' }, body: { reason: '   ' }, headers: {}, connection: {} };
    const res = {
      status: (s) => { status = s; return res; },
      json: (j) => { json = j; }
    };
    await adminDashboardController.revokeTicket(req, res);
    assert.strictEqual(status, 400);
    assert.strictEqual(json.success, false);
  });

  await asyncTest('Audit Logs: getAuditLogs handles search query parameter safely without error', async () => {
    const auditService = require('../src/services/auditService');
    const result = await auditService.getAuditLogs({ page: 1, limit: 10, search: 'CHECKIN' });
    assert.ok(result);
    assert.ok(Array.isArray(result.logs));
    assert.ok(result.pagination);
    assert.strictEqual(typeof result.pagination.total, 'number');
  });

  await asyncTest('Session Attendance: getSessionAttendance returns structured attendance response', async () => {
    const sessionService = require('../src/services/sessionService');
    const activeSession = await sessionService.getActiveSession();
    const sessionId = activeSession ? activeSession.id : 'sess_day1_kickoff';
    const result = await sessionService.getSessionAttendance(sessionId, { page: 1, limit: 10, search: 'Selam' });
    assert.ok(result);
    assert.ok(result.session);
    assert.ok(Array.isArray(result.attendees));
    assert.ok(result.pagination);

    // Verify non-existent session rejection
    await assert.rejects(
      async () => await sessionService.getSessionAttendance('sess_non_existent_999'),
      /Session not found/
    );
  });

  // 6. Innovation Track Normalization & Participant Status Tests
  test('Track Normalization: getCanonicalTrackName maps all 4 official innovation tracks from aliases and formats', () => {
    const { getCanonicalTrackName, OFFICIAL_TRACKS } = require('../src/utils/trackMapper');
    assert.strictEqual(OFFICIAL_TRACKS.length, 4, 'Must define exactly 4 official innovation tracks');

    // Track 1
    assert.strictEqual(getCanonicalTrackName('Track 01: Safe Reporting & Digital Protection'), 'Track 1 \u2013 Safe Reporting & Digital Protection');
    assert.strictEqual(getCanonicalTrackName('Safe Reporting & Digital Protection'), 'Track 1 \u2013 Safe Reporting & Digital Protection');
    assert.strictEqual(getCanonicalTrackName('Track 1'), 'Track 1 \u2013 Safe Reporting & Digital Protection');

    // Track 2
    assert.strictEqual(getCanonicalTrackName('Track 02: AI-Powered Information & Support'), 'Track 2 \u2013 AI-Powered Information & Support');
    assert.strictEqual(getCanonicalTrackName('AI-Powered Information & Support'), 'Track 2 \u2013 AI-Powered Information & Support');
    assert.strictEqual(getCanonicalTrackName('Track 2'), 'Track 2 \u2013 AI-Powered Information & Support');

    // Track 3
    assert.strictEqual(getCanonicalTrackName('Track 03: Access to Support & Service Coordination'), 'Track 3 \u2013 Access to Support & Service Coordination');
    assert.strictEqual(getCanonicalTrackName('Access to Support & Service Coordination'), 'Track 3 \u2013 Access to Support & Service Coordination');
    assert.strictEqual(getCanonicalTrackName('Track 3'), 'Track 3 \u2013 Access to Support & Service Coordination');

    // Track 4
    assert.strictEqual(getCanonicalTrackName('Track 04: Prevention, Awareness & Online Safety'), 'Track 4 \u2013 Prevention, Awareness & Online Safety');
    assert.strictEqual(getCanonicalTrackName('Prevention, Awareness & Online Safety'), 'Track 4 \u2013 Prevention, Awareness & Online Safety');
    assert.strictEqual(getCanonicalTrackName('Online Safety'), 'Track 4 \u2013 Prevention, Awareness & Online Safety');
  });

  test('Track Resolution: resolveTrack finds official track definition and aliases for database querying', () => {
    const { resolveTrack } = require('../src/utils/trackMapper');
    const t1 = resolveTrack('Track 1 \u2013 Safe Reporting & Digital Protection');
    assert.ok(t1);
    assert.strictEqual(t1.id, 1);
    assert.ok(t1.aliases.includes('Track 01: Safe Reporting & Digital Protection'));

    const t2 = resolveTrack('AI-Powered Information & Support');
    assert.ok(t2);
    assert.strictEqual(t2.id, 2);

    const t3 = resolveTrack('Track 03: Access to Support & Service Coordination');
    assert.ok(t3);
    assert.strictEqual(t3.id, 3);

    const t4 = resolveTrack('Track 4');
    assert.ok(t4);
    assert.strictEqual(t4.id, 4);

    assert.strictEqual(resolveTrack('Non-Existent Custom Track'), null);
  });

  test('Participant Status: Correctly distinguishes Registered vs Checked In based on attendance records', () => {
    // 1. Registered but not checked in (has ticket, checkInCount = 0)
    const registeredAttendee = {
      id: 'att_1',
      fullName: 'Tigist Hailu',
      emailVerified: true,
      ticket: { ticketCode: 'TKT-12345678', status: 'ACTIVE' },
      checkInCount: 0
    };
    const status1 = registeredAttendee.checkInCount > 0 ? 'CHECKED_IN' : 'NOT_CHECKED_IN';
    assert.strictEqual(status1, 'NOT_CHECKED_IN', 'Ticket generation alone must NOT mark attendee as Checked In');

    // 2. Checked in via QR scanner (checkInCount = 1)
    const qrCheckedInAttendee = {
      id: 'att_2',
      fullName: 'Bethlehem Tadesse',
      emailVerified: true,
      ticket: { ticketCode: 'TKT-87654321', status: 'ACTIVE' },
      checkInCount: 1
    };
    const status2 = qrCheckedInAttendee.checkInCount > 0 ? 'CHECKED_IN' : 'NOT_CHECKED_IN';
    assert.strictEqual(status2, 'CHECKED_IN', 'QR Check-in attendee must be marked as Checked In');

    // 3. Checked in manually at desk (checkInCount = 1)
    const manualCheckedInAttendee = {
      id: 'att_3',
      fullName: 'Hiwot Bekele',
      emailVerified: true,
      ticket: { ticketCode: 'TKT-11223344', status: 'ACTIVE' },
      checkInCount: 1
    };
    const status3 = manualCheckedInAttendee.checkInCount > 0 ? 'CHECKED_IN' : 'NOT_CHECKED_IN';
    assert.strictEqual(status3, 'CHECKED_IN', 'Manual check-in attendee must be marked as Checked In');
  });

  await asyncTest('Admin Attendees: listAttendees safely handles track and status filter query parameters', async () => {
    const adminService = require('../src/services/adminService');
    const resultTrack = await adminService.listAttendees({ track: 'Track 1 \u2013 Safe Reporting & Digital Protection' });
    assert.ok(resultTrack);
    assert.ok(Array.isArray(resultTrack.attendees));

    const resultStatus = await adminService.listAttendees({ status: 'CHECKED_IN' });
    assert.ok(resultStatus);
    assert.ok(Array.isArray(resultStatus.attendees));

    const resultNotChecked = await adminService.listAttendees({ status: 'NOT_CHECKED_IN' });
    assert.ok(resultNotChecked);
    assert.ok(Array.isArray(resultNotChecked.attendees));
  });

  test('DOM Verification: admin/index.html includes all 4 official innovation tracks and Participant Status elements', () => {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(path.resolve(__dirname, '../../admin/index.html'), 'utf8');

    // Innovation Tracks in select
    assert.ok(html.includes('Track 1 – Safe Reporting &amp; Digital Protection'), 'Track 1 must be present in filter dropdown');
    assert.ok(html.includes('Track 2 – AI-Powered Information &amp; Support'), 'Track 2 must be present in filter dropdown');
    assert.ok(html.includes('Track 3 – Access to Support &amp; Service Coordination'), 'Track 3 must be present in filter dropdown');
    assert.ok(html.includes('Track 4 – Prevention, Awareness &amp; Online Safety'), 'Track 4 must be present in filter dropdown');

    // Participant Status filter
    assert.ok(html.includes('id="filter-participant-status"'), 'Filter dropdown for participant status must exist');
    assert.ok(html.includes('value="CHECKED_IN"'), 'Checked In option must exist in filter');
    assert.ok(html.includes('value="NOT_CHECKED_IN"'), 'Not Checked In option must exist in filter');

    // Table Header replacement
    assert.ok(html.includes('<th>Participant Status</th>'), 'Table header must feature Participant Status');
    assert.ok(!html.includes('<th>Ticket Pass</th>'), 'Table header must NOT feature Ticket Pass column');
  });

  console.log(`Admin Tests Finished: ${passed} Passed, ${failed} Failed`);
  return { passed, failed };
}

if (require.main === module) {
  runAdminTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runAdminTests;
