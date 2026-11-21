/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Registration Validation & Endpoint Integration Tests
 */

const assert = require('assert');
const { validateIndividualRegistration, validateTeamRegistration } = require('../src/validators/registrationValidator');
const registrationController = require('../src/controllers/registrationController');
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
    }
  };
}

async function runRegistrationTests() {
  console.log('\n--- Running Registration Validator & Controller Tests ---');
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
     1. INDIVIDUAL ELIGIBILITY & SAFETY PLEDGE VALIDATION
     -------------------------------------------------------------------------- */
  test('Individual: Missing eligibility confirmation fails validation', () => {
    const input = {
      fullName: 'Selamawit Bekele',
      email: 'selam@example.com',
      phone: '+251911223344',
      discipline: 'Software Developer',
      preferredTrack: 'Safe Reporting & Digital Protection',
      safetyPledgeConfirmed: true
      // eligibilityConfirmed omitted
    };
    const { isValid, errors } = validateIndividualRegistration(input);
    assert.strictEqual(isValid, false, 'Expected rejection when eligibility is omitted');
    assert(errors.some(e => e.field === 'eligibilityConfirmed'), 'Expected eligibilityConfirmed error');
  });

  test('Individual: False eligibility confirmation fails validation', () => {
    const input = {
      fullName: 'Selamawit Bekele',
      email: 'selam@example.com',
      phone: '+251911223344',
      discipline: 'Software Developer',
      preferredTrack: 'Safe Reporting & Digital Protection',
      eligibilityConfirmed: false,
      safetyPledgeConfirmed: true
    };
    const { isValid, errors } = validateIndividualRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'eligibilityConfirmed'));
  });

  test('Individual: Missing safety pledge fails validation', () => {
    const input = {
      fullName: 'Selamawit Bekele',
      email: 'selam@example.com',
      phone: '+251911223344',
      discipline: 'Software Developer',
      preferredTrack: 'Safe Reporting & Digital Protection',
      eligibilityConfirmed: true
      // safetyPledgeConfirmed omitted
    };
    const { isValid, errors } = validateIndividualRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'safetyPledgeConfirmed'));
  });

  test('Individual: False safety pledge fails validation', () => {
    const input = {
      fullName: 'Selamawit Bekele',
      email: 'selam@example.com',
      phone: '+251911223344',
      discipline: 'Software Developer',
      preferredTrack: 'Safe Reporting & Digital Protection',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: false
    };
    const { isValid, errors } = validateIndividualRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'safetyPledgeConfirmed'));
  });

  test('Individual: Valid payload with true confirmations passes validation', () => {
    const input = {
      fullName: 'Selamawit Bekele',
      email: 'selam@example.com',
      phone: '+251911223344',
      city: 'Addis Ababa',
      discipline: 'Software Developer',
      experienceLevel: 'Mid-Level',
      preferredTrack: 'Safe Reporting & Digital Protection',
      skillsSummary: 'Node.js, PostgreSQL',
      consentTeamMatching: true,
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true
    };
    const { isValid, errors, sanitized } = validateIndividualRegistration(input);
    assert.strictEqual(isValid, true);
    assert.strictEqual(errors.length, 0);
    assert.strictEqual(sanitized.eligibilityConfirmed, true);
    assert.strictEqual(sanitized.safetyPledgeConfirmed, true);
  });

  /* --------------------------------------------------------------------------
     2. TEAM ELIGIBILITY & SAFETY PLEDGE VALIDATION
     -------------------------------------------------------------------------- */
  test('Team: Missing eligibility confirmation fails validation', () => {
    const input = {
      teamName: 'Tech Enat',
      track: 'AI-Powered Information & Support',
      safetyPledgeConfirmed: true,
      // eligibilityConfirmed omitted
      leader: { fullName: 'Rahel Tadesse', email: 'rahel@example.com', phone: '+251911111111', role: 'Team Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'eligibilityConfirmed'));
  });

  test('Team: False eligibility confirmation fails validation', () => {
    const input = {
      teamName: 'Tech Enat',
      track: 'AI-Powered Information & Support',
      eligibilityConfirmed: false,
      safetyPledgeConfirmed: true,
      leader: { fullName: 'Rahel Tadesse', email: 'rahel@example.com', phone: '+251911111111', role: 'Team Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'eligibilityConfirmed'));
  });

  test('Team: Missing safety pledge fails validation', () => {
    const input = {
      teamName: 'Tech Enat',
      track: 'AI-Powered Information & Support',
      eligibilityConfirmed: true,
      // safetyPledgeConfirmed omitted
      leader: { fullName: 'Rahel Tadesse', email: 'rahel@example.com', phone: '+251911111111', role: 'Team Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'safetyPledgeConfirmed'));
  });

  test('Team: False safety pledge fails validation', () => {
    const input = {
      teamName: 'Tech Enat',
      track: 'AI-Powered Information & Support',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: false,
      leader: { fullName: 'Rahel Tadesse', email: 'rahel@example.com', phone: '+251911111111', role: 'Team Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'safetyPledgeConfirmed'));
  });

  /* --------------------------------------------------------------------------
     3. TEAM STRUCTURE & MEMBERSHIP VALIDATION
     -------------------------------------------------------------------------- */
  test('Team: Valid team of 3 members passes validation', () => {
    const input = {
      teamName: 'Tech Enat',
      track: 'AI-Powered Information & Support',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: { fullName: 'Rahel Tadesse', email: 'rahel@example.com', phone: '+251911111111', role: 'Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Designer' }
      ]
    };
    const { isValid, errors, sanitized } = validateTeamRegistration(input);
    assert.strictEqual(isValid, true);
    assert.strictEqual(sanitized.totalTeamSize, 3);
  });

  test('Team: Valid team of 5 members passes validation', () => {
    const input = {
      teamName: 'Cyber Safe Squad',
      track: 'Safe Reporting & Digital Protection',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: { fullName: 'Abeba K.', email: 'abeba@example.com', phone: '+251911111111', role: 'Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' },
        { fullName: 'M3', email: 'm3@example.com', role: 'Designer' },
        { fullName: 'M4', email: 'm4@example.com', role: 'Advocate' }
      ]
    };
    const { isValid, errors, sanitized } = validateTeamRegistration(input);
    assert.strictEqual(isValid, true);
    assert.strictEqual(sanitized.totalTeamSize, 5);
  });

  test('Team: Fewer than 3 members (Leader + 1 Member = 2) is rejected', () => {
    const input = {
      teamName: 'Under-strength',
      track: 'Track 1',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: { fullName: 'Lead', email: 'lead@example.com', phone: '+251911111111', role: 'Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'members' && e.message.includes('between 3 and 5 members')));
  });

  test('Team: More than 5 members (Leader + 5 Members = 6) is rejected', () => {
    const input = {
      teamName: 'Over-strength',
      track: 'Track 1',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: { fullName: 'Lead', email: 'lead@example.com', phone: '+251911111111', role: 'Lead' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' },
        { fullName: 'M3', email: 'm3@example.com', role: 'Dev' },
        { fullName: 'M4', email: 'm4@example.com', role: 'Dev' },
        { fullName: 'M5', email: 'm5@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'members' && e.message.includes('between 3 and 5 members')));
  });

  test('Team: Duplicate emails in roster are rejected', () => {
    const input = {
      teamName: 'Duplicate Email Squad',
      track: 'Track 1',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: { fullName: 'Lead', email: 'duplicate@example.com', phone: '+251911111111', role: 'Lead' },
      members: [
        { fullName: 'Member 1', email: 'duplicate@example.com', role: 'Dev' }, // DUPLICATE
        { fullName: 'Member 2', email: 'other@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.message.includes('already used by another team member')));
  });

  test('Team: Missing team leader details is rejected', () => {
    const input = {
      teamName: 'Leaderless Squad',
      track: 'Track 1',
      eligibilityConfirmed: true,
      safetyPledgeConfirmed: true,
      leader: { fullName: '', email: '', phone: '', role: '' },
      members: [
        { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
        { fullName: 'M2', email: 'm2@example.com', role: 'Dev' }
      ]
    };
    const { isValid, errors } = validateTeamRegistration(input);
    assert.strictEqual(isValid, false);
    assert(errors.some(e => e.field === 'leader.fullName'));
  });

  /* --------------------------------------------------------------------------
     4. CONTROLLER VALIDATION FAILURE HANDLING
     -------------------------------------------------------------------------- */
  await asyncTest('Controller: Invalid individual registration returns 400 Bad Request with details', async () => {
    const req = { body: { fullName: '' } };
    const res = createMockRes();
    await registrationController.registerIndividual(req, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert(Array.isArray(res.body.details));
  });

  await asyncTest('Controller: Invalid team registration returns 400 Bad Request with details', async () => {
    const req = { body: { teamName: 'Too Small', members: [] } };
    const res = createMockRes();
    await registrationController.registerTeam(req, res, () => {});
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
  });

  /* --------------------------------------------------------------------------
     5. DATABASE UNAVAILABLE BEHAVIOR TESTS
     -------------------------------------------------------------------------- */
  const dbHealth = await db.checkConnection();

  if (!dbHealth.connected) {
    await asyncTest('Database Unavailable: Individual registration fails safely with 503 Service Unavailable', async () => {
      const validPayload = {
        fullName: 'Selamawit Bekele',
        email: 'selam@example.com',
        phone: '+251911223344',
        discipline: 'Software Developer',
        preferredTrack: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true
      };
      const req = { body: validPayload };
      const res = createMockRes();

      await registrationController.registerIndividual(req, res, (err) => {
        if (err) res.status(500).json({ error: err.message });
      });

      assert.strictEqual(res.statusCode, 503, 'Must return 503 when database is not connected');
      assert.strictEqual(res.body.success, false);
      assert(res.body.error.includes('database is temporarily unreachable') || res.body.error.includes('Database is not connected'));
    });

    await asyncTest('Database Unavailable: Team registration fails safely with 503 Service Unavailable', async () => {
      const validPayload = {
        teamName: 'Tech Enat',
        track: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true,
        leader: { fullName: 'Lead', email: 'lead@example.com', phone: '+251911111111', role: 'Lead' },
        members: [
          { fullName: 'M1', email: 'm1@example.com', role: 'Dev' },
          { fullName: 'M2', email: 'm2@example.com', role: 'Dev' }
        ]
      };
      const req = { body: validPayload };
      const res = createMockRes();

      await registrationController.registerTeam(req, res, (err) => {
        if (err) res.status(500).json({ error: err.message });
      });

      assert.strictEqual(res.statusCode, 503, 'Must return 503 when database is not connected');
      assert.strictEqual(res.body.success, false);
    });

    console.log('\n  ============================================================');
    console.log('  [NOTICE: AWAITING POSTGRESQL CREDENTIALS]');
    console.log('  The following live PostgreSQL database tests were skipped:');
    console.log('    1. Valid individual registration persistence in PostgreSQL');
    console.log('    2. Valid team registration persistence (3 and 5 members) in PostgreSQL');
    console.log('    3. Duplicate email rejection in PostgreSQL');
    console.log('    4. Transaction rollback on team registration failure in PostgreSQL');
    console.log('  Reason: DATABASE_URL is not configured in backend/.env');
    console.log('  To execute live persistence tests, configure a live PostgreSQL or');
    console.log('  Supabase instance in backend/.env and re-run.');
    console.log('  ============================================================\n');
  } else {
    /* --------------------------------------------------------------------------
       6. LIVE POSTGRESQL PERSISTENCE TESTS (Runs only when real DB is connected)
       -------------------------------------------------------------------------- */
    console.log('\n--- Running Live PostgreSQL Database Persistence Tests ---');

    await asyncTest('PostgreSQL: Valid individual registration persists atomically', async () => {
      const email = `test.ind.${Date.now()}@example.com`;
      const input = {
        fullName: 'Test Applicant',
        email,
        phone: '+251911000000',
        discipline: 'Dev',
        preferredTrack: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true
      };
      const req = { body: input };
      const res = createMockRes();

      await registrationController.registerIndividual(req, res, () => {});
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.status, 'PENDING_EMAIL_VERIFICATION');

      // Verify row exists in PostgreSQL
      const savedAttendee = await db.getOne('SELECT id, email, email_verified FROM attendees WHERE email = ?', [email]);
      assert(savedAttendee, 'Attendee record must exist in PostgreSQL');
    });

    await asyncTest('PostgreSQL: Duplicate email rejection produces 409 Conflict', async () => {
      const email = `test.duplicate.${Date.now()}@example.com`;
      const input = {
        fullName: 'Test Applicant',
        email,
        phone: '+251911000000',
        discipline: 'Dev',
        preferredTrack: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true
      };

      const res1 = createMockRes();
      await registrationController.registerIndividual({ body: input }, res1, () => {});
      assert.strictEqual(res1.statusCode, 201);

      // Attempt second registration with same email
      const res2 = createMockRes();
      await registrationController.registerIndividual({ body: input }, res2, () => {});
      assert.strictEqual(res2.statusCode, 409, 'Expected 409 Conflict for duplicate email');
    });

    await asyncTest('PostgreSQL: Team registration persists atomically (3 members)', async () => {
      const timestamp = Date.now();
      const input = {
        teamName: `Team 3 ${timestamp}`,
        track: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true,
        leader: { fullName: 'Lead', email: `lead.${timestamp}@example.com`, phone: '+251911000001', role: 'Lead' },
        members: [
          { fullName: 'M1', email: `m1.${timestamp}@example.com`, role: 'Dev' },
          { fullName: 'M2', email: `m2.${timestamp}@example.com`, role: 'Dev' }
        ]
      };
      const res = createMockRes();
      await registrationController.registerTeam({ body: input }, res, () => {});
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.team.totalMembers, 3);
    });

    await asyncTest('PostgreSQL: Team registration persists atomically (5 members)', async () => {
      const timestamp = Date.now();
      const input = {
        teamName: `Team 5 ${timestamp}`,
        track: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true,
        leader: { fullName: 'Lead', email: `lead5.${timestamp}@example.com`, phone: '+251911000001', role: 'Lead' },
        members: [
          { fullName: 'M1', email: `m1_5.${timestamp}@example.com`, role: 'Dev' },
          { fullName: 'M2', email: `m2_5.${timestamp}@example.com`, role: 'Dev' },
          { fullName: 'M3', email: `m3_5.${timestamp}@example.com`, role: 'Dev' },
          { fullName: 'M4', email: `m4_5.${timestamp}@example.com`, role: 'Dev' }
        ]
      };
      const res = createMockRes();
      await registrationController.registerTeam({ body: input }, res, () => {});
      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.team.totalMembers, 5);
    });

    await asyncTest('PostgreSQL: Transaction rollback on team registration failure leaves 0 orphan records', async () => {
      const timestamp = Date.now();
      const existingEmail = `existing.${timestamp}@example.com`;

      // Pre-register an individual with existingEmail
      const preReq = {
        fullName: 'Pre Existing',
        email: existingEmail,
        phone: '+251911000000',
        discipline: 'Dev',
        preferredTrack: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true
      };
      await registrationController.registerIndividual({ body: preReq }, createMockRes(), () => {});

      // Now attempt team registration where Member 2 collides with existingEmail
      const collidingTeam = {
        teamName: `Colliding Team ${timestamp}`,
        track: 'Track 1',
        eligibilityConfirmed: true,
        safetyPledgeConfirmed: true,
        leader: { fullName: 'Lead', email: `lead_col.${timestamp}@example.com`, phone: '+251911000001', role: 'Lead' },
        members: [
          { fullName: 'M1', email: `m1_col.${timestamp}@example.com`, role: 'Dev' },
          { fullName: 'M2', email: existingEmail, role: 'Dev' } // COLLISION!
        ]
      };

      const res = createMockRes();
      await registrationController.registerTeam({ body: collidingTeam }, res, () => {});
      assert.strictEqual(res.statusCode, 409);

      // Verify rollback: Leader and M1 must NOT exist in the database!
      const orphanLeader = await db.getOne('SELECT id FROM attendees WHERE email = ?', [`lead_col.${timestamp}@example.com`]);
      assert.strictEqual(orphanLeader, null, 'Transaction rollback failed: orphan leader was found in database');

      const orphanTeam = await db.getOne('SELECT id FROM teams WHERE team_name = ?', [`Colliding Team ${timestamp}`]);
      assert.strictEqual(orphanTeam, null, 'Transaction rollback failed: orphan team was found in database');
    });
  }

  console.log(`Registration Tests Finished: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) throw new Error(`${failed} registration tests failed.`);
}

if (require.main === module) {
  runRegistrationTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runRegistrationTests };
