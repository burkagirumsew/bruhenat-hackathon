/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Health & Diagnostics Controller
 */

const db = require('../config/database');
const config = require('../config/environment');

/**
 * Health check reporting actual server and database connection status
 * GET /api/health
 */
async function getHealth(req, res) {
  const dbHealth = await db.checkConnection();
  const uptimeSeconds = Math.floor(process.uptime());

  const isHealthy = dbHealth.connected;
  const statusCode = isHealthy ? 200 : 503;

  const responseBody = {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    eventName: "BRUH-Enat Women's Tech Innovation Hackathon 2026",
    environment: config.env,
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
    database: {
      connected: dbHealth.connected,
      provider: dbHealth.provider,
      ...(dbHealth.connected ? {
        latencyMs: dbHealth.latencyMs,
        database: dbHealth.database,
        serverTime: dbHealth.serverTime,
        engineVersion: dbHealth.version
      } : {
        error: dbHealth.error,
        help: 'Configure DATABASE_URL in .env to connect to your PostgreSQL / Supabase cluster.'
      })
    }
  };

  return res.status(statusCode).json(responseBody);
}

module.exports = {
  getHealth
};
