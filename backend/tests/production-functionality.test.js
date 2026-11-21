/**
 * BRUH-ENAT HACKATHON 2026 - PRODUCTION FUNCTIONALITY AUDIT
 * Tests all user-facing, admin, API, and validation flows under NODE_ENV=production
 * WITHOUT creating any real participants in the live database.
 */

const assert = require('assert');
const http = require('http');
const path = require('path');

// Ensure NODE_ENV=production for this audit
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890';
process.env.FRONTEND_URL = 'https://bruhenat-production.up.railway.app';
process.env.BACKEND_URL = 'https://bruhenat-production.up.railway.app';

const config = require('../src/config/environment');
const db = require('../src/config/database');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/authMiddleware');
const { validateIndividualRegistration, validateTeamRegistration } = require('../src/validators/registrationValidator');

function makeRequest(server, path, options = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const reqOptions = {
      host: '127.0.0.1',
      port: addr.port,
      path: path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runProductionAudit() {
  console.log('================================================================');
  console.log('  BRUH-ENAT HACKATHON 2026 — PRODUCTION FUNCTIONALITY AUDIT');
  console.log(`  Environment: ${config.env.toUpperCase()} (NODE_ENV=production)`);
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 1. Homepage & Registration UI
    console.log('--- 1. Public Pages & Registration Forms ---');
    const resHome = await makeRequest(server, '/');
    assert.strictEqual(resHome.status, 200, 'Homepage must return 200');
    assert(resHome.body.includes('BRUH-Enat'), 'Homepage must contain BRUH-Enat branding');
    assert(resHome.body.includes('form-individual'), 'Homepage must include individual registration form');
    assert(resHome.body.includes('form-team'), 'Homepage must include team registration form');
    assert(resHome.body.includes('250,000 ETB'), 'Homepage must contain 1st prize card (250,000 ETB)');
    console.log('  [PASS] Homepage: Serves 200 OK with branding, registration forms & 1st prize card');

    const resVerify = await makeRequest(server, '/verify.html');
    assert.strictEqual(resVerify.status, 200);
    assert(resVerify.body.includes('Email Verification') || resVerify.body.includes('Verification'));
    console.log('  [PASS] Verification Page: Serves 200 OK');

    const resTicket = await makeRequest(server, '/ticket.html');
    assert.strictEqual(resTicket.status, 200);
    assert(resTicket.body.includes('Official Entry Ticket') || resTicket.body.includes('Ticket'));
    console.log('  [PASS] Ticket Page: Serves 200 OK');

    // 2. Pure Validator Verification (Zero Database Records Created)
    console.log('\n--- 2. Production Input Validation (Zero DB writes) ---');
    
    // 2a. Individual Registration Validation
    const invalidInd1 = validateIndividualRegistration({ fullName: '', email: 'not-an-email' });
    assert.strictEqual(invalidInd1.isValid, false);
    assert(invalidInd1.errors.some(e => e.field === 'fullName'));
    assert(invalidInd1.errors.some(e => e.field === 'email'));
    assert(invalidInd1.errors.some(e => e.field === 'eligibilityConfirmed'));
    assert(invalidInd1.errors.some(e => e.field === 'safetyPledgeConfirmed'));

    const validInd = validateIndividualRegistration({
      fullName: 'Dr. Selamawit Hailu',
      email: 'selamawit.hailu@example.org',
      phone: '+251911234567',
      city: 'Addis Ababa',
      discipline: 'Software Engineering',
      experienceLevel: 'Mid-Level',
      preferredTrack: 'Safe Reporting & Digital Protection',
      skillsSummary: 'Full stack development, TypeScript, PostgreSQL',
      consentTeamMatching: false,
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true
    });
    assert.strictEqual(validInd.isValid, true, 'Valid individual payload must pass validator');
    console.log('  [PASS] Individual Registration Validation: Rejects invalid, accepts valid (0 DB writes)');

    // 2b. Team Registration Validation
    const invalidTeamRoster = validateTeamRegistration({
      teamName: 'InnovateHer',
      track: 'Safe Reporting & Digital Protection',
      leader: { fullName: 'Amina', email: 'amina@example.com', phone: '+251911000000', role: 'Team Lead' },
      members: [
        { memberIndex: 2, fullName: 'Bethel', email: 'bethel@example.com', role: 'UI Designer' }
        // Only 2 total members - below minimum 3
      ],
      totalTeamSize: 2,
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true
    });
    assert.strictEqual(invalidTeamRoster.isValid, false);
    assert(invalidTeamRoster.errors.some(e => e.field === 'members'));

    const validTeamRoster = validateTeamRegistration({
      teamName: 'InnovateHer',
      track: 'Safe Reporting & Digital Protection',
      leader: { fullName: 'Amina', email: 'amina@example.com', phone: '+251911000000', role: 'Team Lead' },
      members: [
        { memberIndex: 2, fullName: 'Bethel', email: 'bethel@example.com', role: 'UI Designer' },
        { memberIndex: 3, fullName: 'Chaltu', email: 'chaltu@example.com', role: 'Backend Engineer' }
      ],
      totalTeamSize: 3,
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true
    });
    assert.strictEqual(validTeamRoster.isValid, true, 'Valid 3-member team must pass validator');
    console.log('  [PASS] Team Registration Validation: Enforces 3-5 member roster strictly (0 DB writes)');

    // 2c. Controller HTTP 400 on Invalid Submissions (Live API test, DB write prevented by validator)
    const resIndInvalidHttp = await makeRequest(server, '/api/registrations/individual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { pathway: 'individual', applicant: { fullName: '' } }
    });
    assert.strictEqual(resIndInvalidHttp.status, 400);
    assert.strictEqual(resIndInvalidHttp.json.success, false);

    const resTeamInvalidHttp = await makeRequest(server, '/api/registrations/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { pathway: 'team', team: { teamName: '' } }
    });
    assert.strictEqual(resTeamInvalidHttp.status, 400);
    assert.strictEqual(resTeamInvalidHttp.json.success, false);
    console.log('  [PASS] Registration API Endpoints: Safely reject bad inputs with 400 Bad Request');

    // 3. API Health & Production Reporting
    console.log('\n--- 3. API Health & Diagnostics ---');
    const resHealth = await makeRequest(server, '/api/health');
    assert.strictEqual(resHealth.status, 200);
    assert.strictEqual(resHealth.json.status, 'healthy');
    assert.strictEqual(resHealth.json.environment, 'production');
    assert.strictEqual(resHealth.json.database.connected, true);
    console.log(`  [PASS] Health API: Status "${resHealth.json.status}", Environment "${resHealth.json.environment}", DB Latency: ${resHealth.json.database.latencyMs}ms`);

    // 4. Admin Pages & Security
    console.log('\n--- 4. Admin Portal & Protected RBAC ---');
    const resAdminLogin = await makeRequest(server, '/admin/login');
    assert.strictEqual(resAdminLogin.status, 200);
    console.log('  [PASS] Admin Login Page: Serves 200 OK');

    const resAdminIndex = await makeRequest(server, '/admin');
    assert.strictEqual(resAdminIndex.status, 200);
    console.log('  [PASS] Admin Dashboard Shell: Serves 200 OK');

    const resAdminCheckIn = await makeRequest(server, '/admin/check-in');
    assert.strictEqual(resAdminCheckIn.status, 200);
    console.log('  [PASS] QR Check-In Page: Serves 200 OK');

    // Protected API: Access without token must be 401
    const resUnauthOverview = await makeRequest(server, '/api/admin/stats');
    assert.strictEqual(resUnauthOverview.status, 401);
    console.log('  [PASS] Protected Route (/api/admin/stats): Unauthenticated request blocked with 401');

    // Protected API: Access with invalid token must be 401
    const resBadToken = await makeRequest(server, '/api/admin/stats', {
      headers: { Authorization: 'Bearer forged.token.payload' }
    });
    assert.strictEqual(resBadToken.status, 401);
    console.log('  [PASS] Protected Route: Forged JWT token rejected with 401 Unauthorized');

    // RBAC: Verify requireRole guard blocks unauthorized role with 403 Forbidden
    const { requireRole } = require('../src/middleware/authMiddleware');
    const guardAdminOnly = requireRole('SUPER_ADMIN');
    let rbacStatus = 0;
    const mockStaffReq = { admin: { id: 'adm_staff', role: 'CHECKIN_STAFF' } };
    const mockRes = {
      status: (c) => { rbacStatus = c; return mockRes; },
      json: () => {}
    };
    guardAdminOnly(mockStaffReq, mockRes, () => {});
    assert.strictEqual(rbacStatus, 403, 'requireRole must block unauthorized role with 403');
    console.log('  [PASS] RBAC: Unauthorized role (CHECKIN_STAFF) blocked from SUPER_ADMIN route with 403 Forbidden');

    // Protected API: Access with valid SUPER_ADMIN JWT
    const validSuperAdminJwt = generateToken({
      id: 'adm_adddc94a-2027-4acd-8046-b8cd799cc648',
      email: 'admin@bruhenat.et',
      role: 'SUPER_ADMIN'
    });

    const resAuthOverview = await makeRequest(server, '/api/admin/stats', {
      headers: { Authorization: `Bearer ${validSuperAdminJwt}` }
    });
    assert.strictEqual(resAuthOverview.status, 200);
    assert.strictEqual(resAuthOverview.json.success, true);
    assert(resAuthOverview.json.stats !== undefined);
    console.log(`  [PASS] Protected Route: Valid SUPER_ADMIN JWT grants access (Total attendees: ${resAuthOverview.json.stats.attendees.total})`);

    // Check-in scan protected route
    const resCheckInScanUnauth = await makeRequest(server, '/api/check-in/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { ticketCode: 'BE26-0000-0000' }
    });
    assert.strictEqual(resCheckInScanUnauth.status, 401);
    console.log('  [PASS] Protected Route (/api/check-in/scan): Unauthenticated scan blocked with 401');

    // 5. Verification & Ticket Lookup APIs
    console.log('\n--- 5. Verification & Ticket APIs ---');
    const resVerifyBad = await makeRequest(server, '/api/verify?token=0000000000000000000000000000000000000000000000000000000000000000');
    assert.strictEqual(resVerifyBad.status, 404);
    console.log('  [PASS] Verification API: Nonexistent token safely rejected with 404 Not Found');

    const resTicketBad = await makeRequest(server, '/api/tickets/BE26-FAKE-0000');
    assert.strictEqual(resTicketBad.status, 404);
    console.log('  [PASS] Ticket API: Nonexistent ticket code safely returns 404');

    // 6. Static Assets & Path Traversal Guards
    console.log('\n--- 6. Static Assets & Security Traversal Guards ---');
    const staticAssets = [
      '/css/base.css',
      '/css/components.css',
      '/css/responsive.css',
      '/css/variables.css',
      '/js/main.js',
      '/js/eventConfig.js',
      '/js/registration.js',
      '/admin/css/admin.css',
      '/admin/js/admin.js',
      '/admin/js/checkin.js'
    ];

    for (const assetPath of staticAssets) {
      const resAsset = await makeRequest(server, assetPath);
      assert.strictEqual(resAsset.status, 200, `Asset ${assetPath} must return 200`);
    }
    console.log(`  [PASS] Whitelisted Static Assets: All ${staticAssets.length} CSS and JS assets return 200 OK`);

    const blockedPaths = [
      '/backend/src/app.js',
      '/backend/src/server.js',
      '/backend/src/config/environment.js',
      '/.env',
      '/backend/.env',
      '/.git/config',
      '/package.json',
      '/backend/package.json',
      '/backend/database/migrations/001_initial_schema.sql',
      '/backend/database/migrations/002_google_sheets_sync_enhancements.sql',
      '/backend/database/migrations/003_email_delivery_reliability.sql',
      '/README.md'
    ];

    for (const bPath of blockedPaths) {
      const resBlocked = await makeRequest(server, bPath);
      assert.strictEqual(resBlocked.status, 404, `Sensitive path ${bPath} must return 404`);
    }
    console.log(`  [PASS] Security Guards: All ${blockedPaths.length} internal backend, secrets, and git paths return 404`);

    console.log('\n================================================================');
    console.log('  PRODUCTION FUNCTIONALITY AUDIT: ALL TESTS PASSED! [PASS]');
    console.log('================================================================');

  } finally {
    server.close();
    await db.closePool();
  }
}

if (require.main === module) {
  runProductionAudit().catch(err => {
    console.error('Audit Failure:', err);
    process.exit(1);
  });
}

module.exports = { runProductionAudit };
