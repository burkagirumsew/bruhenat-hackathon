/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Database Migration Script
 * Run with: node database/migrate.js
 */

const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function run() {
  logger.info('Starting manual database schema migration...');
  const health = await db.checkConnection();
  if (!health.connected) {
    logger.error('Cannot run migration. Database is not connected:');
    logger.error(health.error);
    process.exit(1);
  }

  try {
    await db.runMigrations();
    logger.info('Schema migration completed successfully.');
    await db.closePool();
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed:', err);
    await db.closePool();
    process.exit(1);
  }
}

run();
