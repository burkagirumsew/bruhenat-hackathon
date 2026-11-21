/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Master Test Runner (Rounds 1, 2, 3, 4, and Final Integration Test Suites)
 */

const { runHealthTests } = require('./health.test');
const { runRegistrationTests } = require('./registration.test');
const { runVerificationTests } = require('./verification.test');
const runAdminTests = require('./admin.test');
const runGoogleSheetsTests = require('./googleSheets.test');
const runIntegrationTests = require('./integration.test');
const { runRound5Tests } = require('./round5.test');
const { runSmokeTests } = require('./routes-smoke.test');

async function main() {
  console.log("================================================================");
  console.log("  BRUH-ENAT HACKATHON 2026 - MASTER AUTOMATED TEST SUITE");
  console.log("  Round 1: Backend Foundation & Registration");
  console.log("  Round 2: Email Verification & QR Ticketing Pass Issuance");
  console.log("  Round 3: Admin Dashboard, RBAC & QR Check-In System");
  console.log("  Round 4: Google Sheets Integration & Synchronization");
  console.log("  Round 5: Data Integrity, Outbox Atomicity & Migrations");
  console.log("  Final Round: End-to-End Positive Integration & Regression");
  console.log("================================================================");

  try {
    await runHealthTests();
    await runRegistrationTests();
    await runVerificationTests();
    const adminRes = await runAdminTests();
    const sheetsRes = await runGoogleSheetsTests();
    const round5Res = await runRound5Tests();
    const integrationRes = await runIntegrationTests();
    await runSmokeTests();

    if (adminRes && adminRes.failed > 0) {
      throw new Error(`${adminRes.failed} admin tests failed.`);
    }
    if (sheetsRes && sheetsRes.failed > 0) {
      throw new Error(`${sheetsRes.failed} Google Sheets tests failed.`);
    }
    if (round5Res && round5Res.failed > 0) {
      throw new Error(`${round5Res.failed} Round 5 data integrity tests failed.`);
    }
    if (integrationRes && integrationRes.failed > 0) {
      throw new Error(`${integrationRes.failed} integration tests failed.`);
    }

    console.log("================================================================");
    console.log("  ALL TESTS ACROSS ALL MODULES COMPLETED SUCCESSFULLY! [PASS]");
    console.log("================================================================");
    process.exit(0);
  } catch (err) {
    console.error("\n[TEST SUITE FAILURE]:", err.message);
    process.exit(1);
  }
}

main();
