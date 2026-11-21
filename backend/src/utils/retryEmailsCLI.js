/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Manual Email Retry CLI Utility
 * Usage: node src/utils/retryEmailsCLI.js [--limit 50] [--max-retries 5]
 */

const emailService = require('../services/emailService');
const db = require('../config/database');
const logger = require('./logger');

async function main() {
  const args = process.argv.slice(2);
  let limit = 20;
  let maxRetries = 5;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
    }
    if (args[i] === '--max-retries' && args[i + 1]) {
      maxRetries = parseInt(args[i + 1], 10);
    }
  }

  logger.info(`Starting email retry process (limit=${limit}, maxRetries=${maxRetries})...`);
  const result = await emailService.retryFailedEmails({ limit, maxRetries });
  logger.info('Email retry result:', JSON.stringify(result, null, 2));

  await db.closePool();
  process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(err => {
  logger.error('Email retry CLI error:', err.message);
  process.exit(1);
});
