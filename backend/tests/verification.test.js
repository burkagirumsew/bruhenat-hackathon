/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Round 2: Email Verification & QR Ticketing Tests
 */

const assert = require('assert');
const crypto = require('crypto');
const verificationTokenService = require('../src/services/verificationTokenService');
const ticketService = require('../src/services/ticketService');
const emailService = require('../src/services/emailService');
const qrGenerator = require('../src/utils/qrGenerator');
const verificationController = require('../src/controllers/verificationController');
const ticketController = require('../src/controllers/ticketController');
const db = require('../src/config/database');

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    }
  };
}

async function runVerificationTests() {
  console.log('\n--- Running Round 2: Email Verification & QR Ticketing Tests ---');
  let passed = 0;
  let failed = 0;

  const test = (name, fn) => {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  const asyncTest = async (name, fn) => {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  /* --------------------------------------------------------------------------
     1. CRYPTOGRAPHIC TOKEN GENERATION & HASHING
     -------------------------------------------------------------------------- */
  test('Token Hashing: hashToken produces consistent 64-char SHA-256 hex string', () => {
    const raw = 'a'.repeat(64);
    const expected = crypto.createHash('sha256').update(raw).digest('hex');
    const actual = verificationTokenService.hashToken(raw);
    assert.strictEqual(actual, expected);
    assert.strictEqual(actual.length, 64);
  });

  test('Token Hashing: Distinct tokens produce distinct cryptographic hashes', () => {
    const t1 = crypto.randomBytes(32).toString('hex');
    const t2 = crypto.randomBytes(32).toString('hex');
    const h1 = verificationTokenService.hashToken(t1);
    const h2 = verificationTokenService.hashToken(t2);
    assert.notStrictEqual(h1, h2);
  });

  /* --------------------------------------------------------------------------
     2. QR CODE DATA URI GENERATOR
     -------------------------------------------------------------------------- */
  await asyncTest('QR Generator: Generates valid data URI from ticket payload', async () => {
    const payload = JSON.stringify({ event: 'BRUH-ENAT-2026', code: 'BE26-TEST-CODE' });
    const dataUri = await qrGenerator.generateQrDataUrl(payload);
    assert(typeof dataUri === 'string', 'Expected string data URI');
    assert(dataUri.startsWith('data:image/'), 'Data URI must start with data:image/');
    assert(dataUri.length > 50, 'Data URI must contain image data');
  });

  /* --------------------------------------------------------------------------
     3. EMAIL TEMPLATE RENDERING
     -------------------------------------------------------------------------- */
  test('Email Templates: verify-individual.html renders with all variables populated', () => {
    const data = {
      fullName: 'Abeba Tesfaye',
      referenceCode: 'BE-2026-IND-1234',
      discipline: 'Software Developer',
      trackName: 'Safe Reporting & Digital Protection',
      teamMatchingNotice: 'Opted-in for Dec 3 Zoom Matching',
      expiresInHours: 48,
      verificationUrl: 'http://localhost:5000/verify.html?token=test_token_123'
    };
    const html = emailService.renderTemplate('verify-individual.html', data);
    assert(html.includes('Abeba Tesfaye'), 'Expected attendee full name');
    assert(html.includes('BE-2026-IND-1234'), 'Expected reference code');
    assert(html.includes('http://localhost:5000/verify.html?token=test_token_123'), 'Expected verification URL');
    assert(!html.includes('{{fullName}}'), 'All placeholders should be replaced');
  });

  test('Email Templates: verify-team.html renders with team & member details', () => {
    const data = {
      fullName: 'Hanna Solomon',
      teamName: 'InnovateHer',
      leaderName: 'Sara Bekele',
      role: 'UI/UX Designer',
      trackName: 'AI-Powered Support',
      referenceCode: 'BE-2026-TEAM-5678',
      expiresInHours: 48,
      verificationUrl: 'http://localhost:5000/verify.html?token=test_team_token'
    };
    const html = emailService.renderTemplate('verify-team.html', data);
    assert(html.includes('Hanna Solomon'));
    assert(html.includes('InnovateHer'));
    assert(html.includes('Sara Bekele'));
    assert(html.includes('BE-2026-TEAM-5678'));
  });

  test('Email Templates: qr-ticket.html renders ticket pass with QR code and reminders', () => {
    const data = {
      fullName: 'Tigist Alemu',
      pathwayType: 'Individual Participant',
      teamName: '',
      qrCodeDataUrl: 'data:image/svg+xml;utf8,test_qr',
      ticketCode: 'BE26-4B1C-9D2E',
      referenceCode: 'BE-2026-IND-9999',
      discipline: 'Full Stack Engineer',
      trackName: 'Safe Reporting',
      ticketPageUrl: 'http://localhost:5000/ticket.html?code=BE26-4B1C-9D2E'
    };
    const html = emailService.renderTemplate('qr-ticket.html', data);
    assert(html.includes('Tigist Alemu'));
    assert(html.includes('BE26-4B1C-9D2E'));
    assert(html.includes('Capstone ALX Tech Hub'));
    assert(html.includes('Survivor Safety Pledge'));
  });

  /* --------------------------------------------------------------------------
     4. CONTROLLER ENDPOINT VALIDATION (MISSING & MALFORMED TOKENS)
     -------------------------------------------------------------------------- */
  await asyncTest('Controller: GET /api/verify without token returns 400 Bad Request', async () => {
    const req = { query: {}, headers: {} };
    const res = createMockRes();
    await verificationController.verifyEmail(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert(res.body.error.includes('token parameter is required'));
  });

  await asyncTest('Controller: POST /api/verify/resend without email returns 400 Bad Request', async () => {
    const req = { body: {} };
    const res = createMockRes();
    await verificationController.resendVerification(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert(res.body.error.includes('email'));
  });

  await asyncTest('Controller: GET /api/tickets/:ticketCode with empty param returns 400', async () => {
    const req = { params: { ticketCode: '' } };
    const res = createMockRes();
    await ticketController.getTicket(req, res);
    assert.strictEqual(res.statusCode, 400);
  });

  /* --------------------------------------------------------------------------
     5. LIVE DATABASE VERIFICATION TESTS (CONDITIONAL)
     -------------------------------------------------------------------------- */
  const dbHealth = await db.checkConnection();

  if (!dbHealth.connected) {
    console.log('\n  ============================================================');
    console.log('  [NOTICE: AWAITING POSTGRESQL CREDENTIALS]');
    console.log('  The following live PostgreSQL database tests were skipped:');
    console.log('    1. Full token verification lifecycle (unverified -> verified)');
    console.log('    2. One-time use enforcement (re-use rejection)');
    console.log('    3. Token expiration rejection in PostgreSQL');
    console.log('    4. Automatic QR ticket creation and storage in PostgreSQL');
    console.log('  Reason: DATABASE_URL is not configured in backend/.env');
    console.log('  Configure DATABASE_URL in backend/.env to run live database tests.');
    console.log('  ============================================================\n');
  } else {
    console.log('\n--- Running Live PostgreSQL Database Verification & Ticket Tests ---');

    // Live test: Create attendee, create token, verify token, assert ticket generated, assert re-use blocked
    await asyncTest('PostgreSQL: Full verification lifecycle and ticket pass activation', async () => {
      const email = `test.verify.${Date.now()}@example.com`;
      const regId = `reg_test_${Date.now()}`;
      const attId = `att_test_${Date.now()}`;
      const refCode = `BE-2026-IND-${Math.floor(1000 + Math.random() * 9000)}`;

      // 1. Insert test registration and attendee
      await db.execute(
        `INSERT INTO registrations (id, reference_code, pathway, status, submitted_at, updated_at)
         VALUES (?, ?, 'INDIVIDUAL', 'PENDING_EMAIL_VERIFICATION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [regId, refCode]
      );

      await db.execute(
        `INSERT INTO attendees (
          id, registration_id, full_name, email, phone, city, discipline,
          preferred_track, is_team_leader, matching_consent, eligibility_confirmed,
          safety_pledge_confirmed, email_verified, created_at, updated_at
        ) VALUES (?, ?, 'Verify Test User', ?, '+251911000000', 'Addis Ababa', 'Dev', 'Track 1', false, false, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [attId, regId, email]
      );

      // 2. Create verification token
      const tokenData = await verificationTokenService.createTokenForAttendee(attId);
      assert(tokenData.rawToken, 'Expected rawToken');
      assert(tokenData.tokenHash, 'Expected tokenHash');

      // 3. Process verification with rawToken
      const verifyRes = await verificationTokenService.processVerificationToken(tokenData.rawToken);
      assert.strictEqual(verifyRes.success, true, 'Verification must succeed');
      assert.strictEqual(verifyRes.statusCode, 200);
      assert(verifyRes.data.ticket, 'Ticket must be returned upon verification');
      assert(verifyRes.data.ticket.ticketCode.startsWith('BE26-'), 'Ticket code must match BE26 prefix');

      // 4. Verify DB state: attendee email_verified = true
      const updatedAttendee = await db.getOne('SELECT email_verified, email_verified_at FROM attendees WHERE id = ?', [attId]);
      assert.strictEqual(Boolean(updatedAttendee.email_verified), true);
      assert(updatedAttendee.email_verified_at, 'email_verified_at must be populated');

      // 5. Verify DB state: ticket exists in tickets table
      const savedTicket = await db.getOne('SELECT ticket_code, status FROM tickets WHERE attendee_id = ?', [attId]);
      assert(savedTicket, 'Ticket must exist in database');
      assert.strictEqual(savedTicket.status, 'ACTIVE');

      // 6. Test Re-use Prevention: attempting to use token again must NOT verify again
      const reuseRes = await verificationTokenService.processVerificationToken(tokenData.rawToken);
      assert.strictEqual(reuseRes.success, false);
      assert.strictEqual(reuseRes.error, 'ALREADY_VERIFIED');
    });

    await asyncTest('PostgreSQL: Expired token is rejected', async () => {
      const email = `test.expired.${Date.now()}@example.com`;
      const regId = `reg_exp_${Date.now()}`;
      const attId = `att_exp_${Date.now()}`;
      const refCode = `BE-2026-IND-${Math.floor(1000 + Math.random() * 9000)}`;

      await db.execute(
        `INSERT INTO registrations (id, reference_code, pathway, status, submitted_at, updated_at)
         VALUES (?, ?, 'INDIVIDUAL', 'PENDING_EMAIL_VERIFICATION', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [regId, refCode]
      );

      await db.execute(
        `INSERT INTO attendees (
          id, registration_id, full_name, email, phone, city, discipline,
          preferred_track, is_team_leader, matching_consent, eligibility_confirmed,
          safety_pledge_confirmed, email_verified, created_at, updated_at
        ) VALUES (?, ?, 'Expired Test User', ?, '+251911000000', 'Addis Ababa', 'Dev', 'Track 1', false, false, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [attId, regId, email]
      );

      // Create token expired in the past
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = verificationTokenService.hashToken(rawToken);
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      await db.execute(
        `INSERT INTO email_verification_tokens (id, attendee_id, token_hash, expires_at, used_at, created_at)
         VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
        [`tok_exp_${Date.now()}`, attId, tokenHash, pastDate]
      );

      const result = await verificationTokenService.processVerificationToken(rawToken);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'TOKEN_EXPIRED');
    });
  }

  console.log(`Verification Tests Finished: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) throw new Error(`${failed} verification tests failed.`);
}

if (require.main === module) {
  runVerificationTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runVerificationTests };
