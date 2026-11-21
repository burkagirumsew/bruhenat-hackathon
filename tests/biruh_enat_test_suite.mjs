/**
 * =====================================================================
 * BIRUH ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * INDEPENDENT BACKEND AUTOMATED TEST SUITE
 * =====================================================================
 */

import { DatabaseSync } from 'node:sqlite';
import worker from '../cloudflare-worker.js';

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');

  // Initialize fresh Biruh Enat schema
  sqlite.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL,
      phoneNumber TEXT NOT NULL,
      alxAffiliation TEXT,
      registrationType TEXT NOT NULL,
      teamName TEXT,
      strengths TEXT,
      roleType TEXT NOT NULL,
      ticketNumber TEXT,
      checkInStatus INTEGER DEFAULT 0,
      checkInTime TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      emailStatus TEXT DEFAULT 'pending'
    );

    CREATE TABLE team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL,
      phoneNumber TEXT,
      roleType TEXT NOT NULL,
      ticketNumber TEXT,
      alxAffiliation TEXT,
      checkInStatus INTEGER DEFAULT 0,
      checkInTime TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      emailStatus TEXT DEFAULT 'pending',
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  function wrapStatement(stmt, boundParams = []) {
    return {
      bind(...params) {
        return wrapStatement(stmt, params);
      },
      async first() {
        const rows = stmt.all(...boundParams);
        return rows.length > 0 ? rows[0] : null;
      },
      async all() {
        const rows = stmt.all(...boundParams);
        return { results: rows };
      },
      async run() {
        const result = stmt.run(...boundParams);
        return {
          meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
          changes: Number(result.changes)
        };
      },
      _stmt: stmt,
      _boundParams: boundParams
    };
  }

  return {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return wrapStatement(stmt, []);
    },
    async batch(statements) {
      sqlite.exec('BEGIN TRANSACTION;');
      const results = [];
      try {
        for (const s of statements) {
          const res = s._stmt.run(...(s._boundParams || []));
          results.push({
            meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) }
          });
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (err) {
        sqlite.exec('ROLLBACK;');
        throw err;
      }
    }
  };
}

async function runBiruhEnatTests() {
  console.log('===============================================================');
  console.log('BIRUH ENAT HACKATHON 2026 - INDEPENDENT BACKEND TEST SUITE');
  console.log('===============================================================\n');

  const mockDb = createMockD1();
  const testEnv = {
    DB: mockDb,
    ADMIN_USERNAME: 'biruh_admin_prod',
    ADMIN_PASSWORD: 'super_secure_biruh_enat_password_2026',
    JWT_SECRET: 'biruh_enat_dedicated_jwt_secret_32bytes_long_entropy',
    CHECKIN_ACCESS_CODE: 'BIRUH_STATION_CODE_987',
    RESEND_API_KEY: 're_biruh_test_key_123'
  };

  let adminToken = null;
  let checkinToken = null;
  let indTicket = null;
  let teamLeadTicket = null;

  // TEST 1: Health check endpoint
  console.log('[TEST 1] Verifying Biruh Enat Health Check endpoint...');
  const healthRes = await worker.fetch(new Request('https://biruhenathackathon.et/'), testEnv);
  assert(healthRes.status === 200, `Expected 200, got ${healthRes.status}`);
  const healthData = await healthRes.json();
  assert(healthData.database === 'biruh-enat-db', 'Database must identify as biruh-enat-db');
  console.log(' -> PASS: Independent worker health check verified with biruh-enat-db binding.');

  // TEST 2: Admin Login with JWT
  console.log('\n[TEST 2] Verifying Admin Login with signed JWT...');
  const loginRes = await worker.fetch(new Request('https://biruhenathackathon.et/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testEnv.ADMIN_USERNAME, password: testEnv.ADMIN_PASSWORD })
  }), testEnv);
  assert(loginRes.status === 200, `Expected 200, got ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert(loginData.token, 'Expected JWT token');
  adminToken = loginData.token;
  console.log(' -> PASS: Admin authenticated and received signed JWT.');

  // TEST 3: Check-in Desk Station Auth
  console.log('\n[TEST 3] Verifying Check-in Station Authorization...');
  const checkinRes = await worker.fetch(new Request('https://biruhenathackathon.et/api/auth/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessCode: testEnv.CHECKIN_ACCESS_CODE })
  }), testEnv);
  assert(checkinRes.status === 200, `Expected 200, got ${checkinRes.status}`);
  const checkinData = await checkinRes.json();
  assert(checkinData.token, 'Expected checkin token');
  checkinToken = checkinData.token;
  console.log(' -> PASS: Check-in desk authorized.');

  // TEST 4: Biruh Enat Individual Pathway Registration
  console.log('\n[TEST 4] Verifying Biruh Enat Individual Pathway Registration...');
  const indPayload = {
    referenceCode: 'BE-2026-IND-1001',
    pathway: 'individual',
    applicant: {
      fullName: 'Bethlehem Tilahun',
      email: 'bethlehem.tilahun@example.com',
      phone: '+251911334455',
      city: 'Addis Ababa',
      discipline: 'Software Engineer',
      preferredTrack: 'Track 1 – Safe Reporting & Digital Protection'
    }
  };
  const indRes = await worker.fetch(new Request('https://biruhenathackathon.et/api/registrations/individual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(indPayload)
  }), testEnv);
  assert(indRes.status === 201, `Expected 201, got ${indRes.status}`);
  const indData = await indRes.json();
  assert(indData.success === true, 'Expected success: true');
  assert(indData.data && indData.data.referenceCode, 'Expected referenceCode in data');
  indTicket = indData.data.referenceCode;
  
  // Verify database row reflects delivery status (updated from 'pending')
  const userRow = await mockDb.prepare('SELECT emailStatus FROM users WHERE ticketNumber = ?').bind(indTicket).first();
  assert(userRow.emailStatus === 'failed' || userRow.emailStatus === 'sent', 'emailStatus must update from pending upon delivery attempt');
  console.log(' -> PASS: Individual registration stored in biruh-enat-db with ticket:', indTicket, 'emailStatus:', userRow.emailStatus);

  // TEST 5: Biruh Enat Team Pathway Registration (Atomic Batch)
  console.log('\n[TEST 5] Verifying Biruh Enat Team Pathway Registration...');
  const teamPayload = {
    referenceCode: 'BE-2026-TEAM-2002',
    pathway: 'team',
    team: {
      teamName: 'Enat Innovators',
      track: 'Track 2 – AI-Powered Information & Support',
      leader: {
        fullName: 'Rahel Belay',
        email: 'rahel.belay@example.com',
        phone: '+251911887766',
        role: 'Team Lead'
      },
      members: [
        { fullName: 'Hiwot Alemu', email: 'hiwot.alemu@example.com', phone: '+251911221100', role: 'Data Scientist' },
        { fullName: 'Selam Tesfaye', email: 'selam.tesfaye@example.com', phone: '+251911445566', role: 'UI/UX Designer' }
      ]
    }
  };
  const teamRes = await worker.fetch(new Request('https://biruhenathackathon.et/api/registrations/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamPayload)
  }), testEnv);
  assert(teamRes.status === 201, `Expected 201, got ${teamRes.status}`);
  const teamData = await teamRes.json();
  assert(teamData.success === true, 'Expected success: true');
  teamLeadTicket = teamData.data.referenceCode;
  console.log(' -> PASS: Team registration saved atomically in biruh-enat-db.');

  // TEST 6: Idempotent Submission (Zero Duplicates on Retry)
  console.log('\n[TEST 6] Verifying Idempotent Submission...');
  const retryRes = await worker.fetch(new Request('https://biruhenathackathon.et/api/registrations/individual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(indPayload)
  }), testEnv);
  assert(retryRes.status === 200, `Expected 200 on retry, got ${retryRes.status}`);
  const retryData = await retryRes.json();
  assert(retryData.alreadyRegistered === true, 'Expected alreadyRegistered: true');
  console.log(' -> PASS: Exact resubmission recognized without creating duplicate rows.');

  // TEST 7: Duplicate Email Conflict Detection
  console.log('\n[TEST 7] Verifying Duplicate Email Conflict Detection...');
  const dupPayload = {
    referenceCode: 'BE-2026-IND-9999',
    applicant: {
      fullName: 'Different Person',
      email: 'bethlehem.tilahun@example.com', // same email
      phone: '+251999999999',
      discipline: 'Cybersecurity'
    }
  };
  const dupRes = await worker.fetch(new Request('https://biruhenathackathon.et/api/registrations/individual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dupPayload)
  }), testEnv);
  assert(dupRes.status === 400, `Expected 400 for duplicate email, got ${dupRes.status}`);
  console.log(' -> PASS: Duplicate email rejected.');

  // TEST 8: Atomic Check-in & Double-Scan Prevention
  console.log('\n[TEST 8] Verifying Atomic Check-in & Double-Scan Prevention...');
  const scanReq = new Request('https://biruhenathackathon.et/api/check-in/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${checkinToken}` },
    body: JSON.stringify({ ticketNumber: indTicket })
  });
  const scanRes1 = await worker.fetch(scanReq, testEnv);
  assert(scanRes1.status === 200, `Expected 200, got ${scanRes1.status}`);

  // Duplicate scan attempt
  const scanReq2 = new Request('https://biruhenathackathon.et/api/check-in/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${checkinToken}` },
    body: JSON.stringify({ ticketNumber: indTicket })
  });
  const scanRes2 = await worker.fetch(scanReq2, testEnv);
  assert(scanRes2.status === 400, `Expected 400 for duplicate scan, got ${scanRes2.status}`);
  const scanData2 = await scanRes2.json();
  assert(scanData2.error === 'Already checked in', 'Expected Already checked in');
  console.log(' -> PASS: Ticket checked in and duplicate scan rejected.');

  // TEST 9: Strict RBAC Protection
  console.log('\n[TEST 9] Verifying Strict RBAC Protection...');
  const statsReq = new Request('https://biruhenathackathon.et/api/admin/stats', {
    headers: { Authorization: `Bearer ${checkinToken}` }
  });
  const statsRes = await worker.fetch(statsReq, testEnv);
  assert(statsRes.status === 401, 'Checkin token must NOT access admin stats');
  console.log(' -> PASS: Role checkin_agent denied access to administrative endpoints.');

  // TEST 10: Missing Secret Fails Closed
  console.log('\n[TEST 10] Verifying Missing Secrets Fail Closed...');
  const brokenEnv = { ...testEnv, JWT_SECRET: undefined };
  const failLogin = await worker.fetch(new Request('https://biruhenathackathon.et/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: testEnv.ADMIN_USERNAME, password: testEnv.ADMIN_PASSWORD })
  }), brokenEnv);
  assert(failLogin.status === 500, 'Must fail closed when JWT_SECRET missing');
  console.log(' -> PASS: Authentication fails closed when secrets are unconfigured.');

  console.log('\n===============================================================');
  console.log('ALL BIRUH ENAT INDEPENDENT TESTS PASSED (10/10)');
  console.log('===============================================================\n');
}

runBiruhEnatTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
