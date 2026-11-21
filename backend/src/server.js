/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Server Entry Point
 */

const http = require('http');
const app = require('./app');
const config = require('./config/environment');
const db = require('./config/database');
const logger = require('./utils/logger');

async function startServer() {
  logger.info("============================================================");
  logger.info("BRUH-Enat Women's Tech Innovation Hackathon 2026 - Backend");
  logger.info(`Environment : ${config.env}`);
  logger.info(`Configured Port : ${config.port}`);
  logger.info("============================================================");

  // 1. Check PostgreSQL Database Connection
  logger.info('Testing database connection...');
  const dbHealth = await db.checkConnection();

  if (dbHealth.connected) {
    logger.info(`Database connected: [${dbHealth.provider}] (${dbHealth.database}) - ${dbHealth.latencyMs}ms`);
    try {
      await db.runMigrations();
    } catch (migErr) {
      logger.error('Database migration error:', migErr.message);
      if (config.isProduction) {
        logger.error('FATAL: Database migrations failed in production. Halting server startup.');
        process.exit(1);
      }
    }
  } else {
    logger.warn('------------------------------------------------------------');
    logger.warn('DATABASE NOTICE:');
    logger.warn(`PostgreSQL is not connected: ${dbHealth.error}`);
    logger.warn('To connect a live PostgreSQL database (e.g. Supabase):');
    logger.warn('1. Copy backend/.env.example to backend/.env');
    logger.warn('2. Set DATABASE_URL=postgresql://user:pass@host:5432/dbname');
    logger.warn('The server will start and serve frontend & health diagnostics.');
    logger.warn('------------------------------------------------------------');

    if (config.isProduction) {
      logger.error('FATAL: Database connection is required in production mode. Halting server startup.');
      process.exit(1);
    }
  }

  // Notice for controlled production testing with console email provider
  if (config.isProduction && config.email.provider === 'console') {
    logger.warn('************************************************************************');
    logger.warn('NOTICE: EMAIL_PROVIDER is set to "console" in production.');
    logger.warn('Verification links and tickets will only be logged to server console.');
    logger.warn('To deliver real emails to applicants, configure EMAIL_PROVIDER=resend and RESEND_API_KEY in Railway.');
    logger.warn('************************************************************************');
  }

  // 2. Start HTTP Server
  const server = http.createServer(app);
  const host = '0.0.0.0';

  await new Promise((resolve, reject) => {
    server.listen(config.port, host, () => {
      logger.info(`BRUH-Enat Server is actively listening on http://${host}:${config.port}`);
      logger.info(`Health check available at : http://localhost:${config.port}/api/health`);
      logger.info(`Individual Registration  : http://localhost:${config.port}/api/registrations/individual`);
      logger.info(`Team Registration        : http://localhost:${config.port}/api/registrations/team`);
      resolve();
    });
    server.once('error', reject);
  });

  // 3. Graceful Shutdown Handlers
  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await db.closePool();
        logger.info('Database connection pool drained.');
      } catch (err) {
        logger.error('Error closing database pool:', err.message);
      }
      process.exit(0);
    });

    // Force exit if not terminated within 5s
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  return { server, app };
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Fatal server startup failure:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
