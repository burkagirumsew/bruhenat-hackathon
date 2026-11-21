/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Health API Diagnostic Tests
 */

const assert = require('assert');
const healthController = require('../src/controllers/healthController');
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

async function runHealthTests() {
  console.log('\n--- Running Health & Foundation Tests ---');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  await test('GET /api/health accurately reports real connection status (no fake connected: true)', async () => {
    const req = {};
    const res = createMockRes();

    await healthController.getHealth(req, res);

    const actualDbHealth = await db.checkConnection();
    assert(typeof res.body === 'object', 'Response must be JSON object');
    assert(typeof res.body.database === 'object', 'Response must contain database object');
    assert.strictEqual(res.body.database.connected, actualDbHealth.connected, 'Database connection status must match reality');
    assert.strictEqual(res.body.database.provider, 'postgresql');

    if (!actualDbHealth.connected) {
      assert.strictEqual(res.statusCode, 503, 'Expected 503 when database is not connected');
      assert.strictEqual(res.body.status, 'degraded', 'Expected status to be degraded when offline');
      assert(res.body.database.error, 'Expected explanation of why database is disconnected');
    } else {
      assert.strictEqual(res.statusCode, 200, 'Expected 200 when database is connected');
      assert.strictEqual(res.body.status, 'healthy');
    }
  });

  console.log(`Health Tests Finished: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) throw new Error(`${failed} health tests failed.`);
}

if (require.main === module) {
  runHealthTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runHealthTests };
