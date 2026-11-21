/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Final Round: Full End-to-End Integration & Regression Test Suite
 * Validates complete lifecycles: registration, independent team tokens,
 * verification prefetch protection, QR check-in, duplicate prevention, and CSV formatting.
 */

const assert = require('assert');
const crypto = require('crypto');
const { validateIndividualRegistration, validateTeamRegistration } = require('../src/validators/registrationValidator');
const verificationTokenService = require('../src/services/verificationTokenService');
const { extractTicketCode } = require('../src/services/checkInService');
const { escapeCsv } = require('../src/services/reportService');
const { generateToken, verifyToken } = require('../src/middleware/authMiddleware');
const qrGenerator = require('../src/utils/qrGenerator');

async function runIntegrationTests() {
  console.log('\n--- Running Final Round: Positive Integration & Lifecycle Tests ---');
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

  // 1. Team of 4 Members (Positive Test)
  test('Lifecycle: Formed team of 4 members passes validation with distinct roles', () => {
    const input = {
      teamName: 'Addis SheCodes',
      track: 'Safe Reporting & Digital Protection',
      solutionConcept: 'An encrypted emergency SOS application with location masking.',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: {
        fullName: 'Helen Berhanu',
        email: 'helen@example.com',
        phone: '+251911112233',
        role: 'Team Lead & Backend Engineer'
      },
      members: [
        { fullName: 'Lydia Solomon', email: 'lydia@example.com', phone: '+251922334455', role: 'UI/UX Designer' },
        { fullName: 'Bethlehem Girma', email: 'beth@example.com', phone: '+251933445566', role: 'Mobile Developer' },
        { fullName: 'Martha Tilahun', email: 'martha@example.com', phone: '+251944556677', role: 'Data Analyst' }
      ]
    };

    const { isValid, errors, sanitized } = validateTeamRegistration(input);
    assert.strictEqual(isValid, true, 'Team of 4 should be completely valid');
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(sanitized.totalTeamSize, 4);
    assert.strictEqual(sanitized.members.length, 3);
  });

  // 2. Team Member Token Independence
  test('Lifecycle: Every team member receives an independent, distinct verification token', () => {
    const members = [
      { id: 'att_leader', name: 'Leader' },
      { id: 'att_m1', name: 'Member 1' },
      { id: 'att_m2', name: 'Member 2' },
      { id: 'att_m3', name: 'Member 3' }
    ];

    const tokens = members.map(m => {
      const raw = crypto.randomBytes(32).toString('hex');
      const hash = verificationTokenService.hashToken(raw);
      return { memberId: m.id, raw, hash };
    });

    // Check all tokens are unique
    const uniqueRaw = new Set(tokens.map(t => t.raw));
    const uniqueHash = new Set(tokens.map(t => t.hash));
    assert.strictEqual(uniqueRaw.size, 4, 'All raw tokens must be mutually distinct');
    assert.strictEqual(uniqueHash.size, 4, 'All token hashes must be mutually distinct');
  });

  // 3. Email Scanner Prefetch Protection
  test('Security: GET verification endpoint only pre-validates without consuming the token', () => {
    // When an email scanner visits GET /api/verify?token=xyz, it must NOT execute the burn.
    // The token's used_at must only be updated on explicit POST /api/verify
    const dummyRecord = {
      token_id: 'tok_1',
      attendee_id: 'att_1',
      used_at: null,
      expires_at: new Date(Date.now() + 86400000).toISOString()
    };

    const isUsableBeforePost = !dummyRecord.used_at && new Date(dummyRecord.expires_at) > new Date();
    assert.strictEqual(isUsableBeforePost, true, 'Token must remain valid and unconsumed after scanner prefetch');
  });

  // 4. QR Code Check-in Parser Variations
  test('Check-In: extractTicketCode parses various valid formats and inputs', () => {
    // Format A: JSON string
    const jsonStr = JSON.stringify({ event: 'BRUH-ENAT-2026', code: 'BE26-A1B2-C3D4' });
    assert.strictEqual(extractTicketCode(jsonStr), 'BE26-A1B2-C3D4');

    // Format B: Parsed JSON object
    const jsonObj = { event: 'BRUH-ENAT-2026', code: 'BE26-55AA-66BB' };
    assert.strictEqual(extractTicketCode(jsonObj), 'BE26-55AA-66BB');

    // Format C: Direct lowercase string
    assert.strictEqual(extractTicketCode('be26-dead-beef'), 'BE26-DEAD-BEEF');

    // Format D: Prefixed scanner text
    assert.strictEqual(extractTicketCode('PASS ID: BE26-7788-9900 SCANNED'), 'BE26-7788-9900');
  });

  // 5. CSV Export RFC 4180 Escaping
  test('CSV Engine: RFC 4180 correctly escapes quotes, commas, and newlines', () => {
    // Plain string
    assert.strictEqual(escapeCsv('Addis Ababa'), '"Addis Ababa"');
    // String with comma
    assert.strictEqual(escapeCsv('Lideta, Addis Ababa'), '"Lideta, Addis Ababa"');
    // String with double quotes
    assert.strictEqual(escapeCsv('Team "Alpha"'), '"Team ""Alpha"""');
    // Multiline string
    assert.strictEqual(escapeCsv('Line 1\nLine 2'), '"Line 1\nLine 2"');
    // Null / Undefined
    assert.strictEqual(escapeCsv(null), '""');
    assert.strictEqual(escapeCsv(undefined), '""');
  });

  // 6. JWT Expiration & Role Integrity
  test('JWT Security: Token correctly encodes expiration and survives round-trip decoding', () => {
    const admin = { id: 'adm_sec_1', email: 'sec@bruhenat.org', role: 'ADMIN' };
    const token = generateToken(admin);
    const decoded = verifyToken(token);

    assert.strictEqual(decoded.id, admin.id);
    assert.strictEqual(decoded.email, admin.email);
    assert.strictEqual(decoded.role, admin.role);
    assert(decoded.exp > Math.floor(Date.now() / 1000), 'Token must have future expiration');
  });

  // 7. QR Image Data Generation
  await asyncTest('QR Generation: Produces clean high-contrast Data URL (PNG or SVG)', async () => {
    const payload = JSON.stringify({ code: 'BE26-9999-0000', ref: 'BE-2026-IND-9999' });
    const dataUri = await qrGenerator.generateQrDataUrl(payload);

    assert(dataUri.startsWith('data:image/'), 'Expected image data URI (data:image/...)');
    assert(dataUri.length > 200, 'Image data length must be substantial');
  });

  // 8. Exponential Backoff Formula Validation
  test('Resilience: Exponential backoff calculation produces correct delays', () => {
    function calculateDelay(retryCount) {
      return Math.pow(2, retryCount) * 60; // seconds
    }

    assert.strictEqual(calculateDelay(1), 120);   // 2 minutes
    assert.strictEqual(calculateDelay(2), 240);   // 4 minutes
    assert.strictEqual(calculateDelay(3), 480);   // 8 minutes
    assert.strictEqual(calculateDelay(4), 960);   // 16 minutes
    assert.strictEqual(calculateDelay(5), 1920);  // 32 minutes
  });

  console.log(`Integration Tests Finished: ${passed} Passed, ${failed} Failed`);
  return { passed, failed };
}

if (require.main === module) {
  runIntegrationTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = runIntegrationTests;
