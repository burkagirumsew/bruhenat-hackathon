/**
 * Production Environment & Security Audit Test
 */

const assert = require('assert');
const path = require('path');

async function testProductionValidation() {
  console.log('Testing Production Environment Validation Rules...');

  // 1. Verify missing or weak JWT_SECRET fails in production
  const origEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '';
    process.env.FRONTEND_URL = 'https://bruhenat.up.railway.app';
    process.env.BACKEND_URL = 'https://bruhenat.up.railway.app';

    // Clear module cache
    const envModulePath = path.resolve(__dirname, '../src/config/environment.js');
    delete require.cache[require.resolve(envModulePath)];

    assert.throws(
      () => { require(envModulePath); },
      /FATAL SECURITY ERROR: In production/i,
      'Should throw fatal security error when JWT_SECRET is missing in production'
    );
    console.log('  [PASS] Missing JWT_SECRET is rejected in production');

    // Weak / short JWT secret
    process.env.JWT_SECRET = 'short_secret';
    delete require.cache[require.resolve(envModulePath)];
    assert.throws(
      () => { require(envModulePath); },
      /FATAL SECURITY ERROR: In production/i,
      'Should throw fatal security error when JWT_SECRET is shorter than 32 chars'
    );
    console.log('  [PASS] Weak (<32 chars) JWT_SECRET is rejected in production');

    // 2. Verify localhost URLs are rejected in production
    process.env.JWT_SECRET = 'a'.repeat(64);
    process.env.FRONTEND_URL = 'http://localhost:5000';
    process.env.BACKEND_URL = 'http://localhost:5000';
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RAILWAY_STATIC_URL;
    delete require.cache[require.resolve(envModulePath)];

    assert.throws(
      () => { require(envModulePath); },
      /FATAL CONFIGURATION ERROR: In production/i,
      'Should throw fatal config error when localhost URLs are configured in production'
    );
    console.log('  [PASS] Localhost URL in production is prohibited and rejected');

    // 3. Verify valid production environment config succeeds
    process.env.FRONTEND_URL = 'https://bruhenat.up.railway.app';
    process.env.BACKEND_URL = 'https://bruhenat.up.railway.app';
    process.env.PORT = '8080';
    delete require.cache[require.resolve(envModulePath)];

    const config = require(envModulePath);
    assert.strictEqual(config.isProduction, true);
    assert.strictEqual(config.env, 'production');
    assert.strictEqual(config.port, 8080);
    assert.strictEqual(config.frontendUrl, 'https://bruhenat.up.railway.app');
    assert(!config.frontendUrl.includes('localhost'));
    console.log('  [PASS] Valid production configuration loads correctly with PORT=8080 and HTTPS domain');
  } finally {
    // Restore original process.env
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    for (const [key, val] of Object.entries(origEnv)) {
      process.env[key] = val;
    }
    const envModulePath = path.resolve(__dirname, '../src/config/environment.js');
    delete require.cache[require.resolve(envModulePath)];
  }
}

async function testProductionDatabaseAndHealth() {
  console.log('\nTesting Production Server Startup, Health & DB Connection...');

  const origEnv = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'f9c8d7e6b5a41234567890abcdef1234567890abcdef1234567890abcdef1234';
    process.env.FRONTEND_URL = 'https://bruhenat-hackathon.up.railway.app';
    process.env.BACKEND_URL = 'https://bruhenat-hackathon.up.railway.app';
    process.env.PORT = '5055';

    const envModulePath = path.resolve(__dirname, '../src/config/environment.js');
    delete require.cache[require.resolve(envModulePath)];
    delete require.cache[require.resolve('../src/config/database')];
    delete require.cache[require.resolve('../src/app')];

    const db = require('../src/config/database');
    const dbHealth = await db.checkConnection();
    assert.strictEqual(dbHealth.connected, true, `DB should connect: ${dbHealth.error}`);
    console.log(`  [PASS] Live Database connected in production mode (${dbHealth.database}, ${dbHealth.latencyMs}ms)`);

    // Verify migrations are already applied (idempotent, does not reset)
    const applied = await db.getAppliedMigrations();
    assert(applied.length >= 3, `Expected at least 3 migrations applied, found ${applied.length}`);
    console.log(`  [PASS] Database migrations are already applied (Total: ${applied.length} migrations)`);

    // Verify Health endpoint outputs environment: 'production'
    const app = require('../src/app');
    const http = require('http');
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(5055, '127.0.0.1', resolve));

    const healthResponse = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:5055/api/health', (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
      }).on('error', reject);
    });

    server.close();
    await db.closePool();

    assert.strictEqual(healthResponse.status, 200);
    assert.strictEqual(healthResponse.body.status, 'healthy');
    assert.strictEqual(healthResponse.body.environment, 'production');
    assert.strictEqual(healthResponse.body.database.connected, true);
    console.log(`  [PASS] GET /api/health accurately reports "environment": "${healthResponse.body.environment}"`);

  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    for (const [key, val] of Object.entries(origEnv)) {
      process.env[key] = val;
    }
    delete require.cache[require.resolve('../src/config/environment')];
    delete require.cache[require.resolve('../src/config/database')];
    delete require.cache[require.resolve('../src/app')];
  }
}

async function run() {
  await testProductionValidation();
  await testProductionDatabaseAndHealth();
  console.log('\n================================================================');
  console.log('ALL PRODUCTION ENVIRONMENT CHECKS PASSED!');
  console.log('================================================================');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
}

module.exports = { run };
