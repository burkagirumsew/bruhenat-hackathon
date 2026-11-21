/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Database Connection & Query Interface (PostgreSQL / Supabase)
 *
 * PostgreSQL is the primary source of truth for all hackathon data.
 * This module manages the connection pool, transactions, migrations,
 * and connection health reporting.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./environment');
const logger = require('../utils/logger');

let pg = null;
try {
  pg = require('pg');
} catch (e) {
  // pg will be loaded when available after npm install
}

let pgPool = null;
let isConnected = false;
let lastConnectionError = null;

/**
 * Resiliently resolve CA certificate file path across different process cwd locations
 */
function resolveCaPath(configuredPath) {
  if (!configuredPath) {
    return path.resolve(__dirname, '../../config/prod-ca-2021.crt');
  }
  if (path.isAbsolute(configuredPath) && fs.existsSync(configuredPath)) {
    return configuredPath;
  }
  const cwdPath = path.resolve(process.cwd(), configuredPath);
  if (fs.existsSync(cwdPath)) return cwdPath;

  const rootBackendPath = path.resolve(process.cwd(), 'backend', configuredPath.replace(/^\.\//, ''));
  if (fs.existsSync(rootBackendPath)) return rootBackendPath;

  const relativeToSrc = path.resolve(__dirname, '../../', configuredPath.replace(/^\.\//, ''));
  if (fs.existsSync(relativeToSrc)) return relativeToSrc;

  return configuredPath;
}

/**
 * Configure and initialize the PostgreSQL connection pool
 */
function getPool() {
  if (pgPool) return pgPool;

  const dbUrl = (config.database.url || '').trim();
  if (!dbUrl) {
    lastConnectionError = 'DATABASE_URL is not configured. PostgreSQL connection required.';
    return null;
  }

  if (!pg) {
    try {
      pg = require('pg');
    } catch (e) {
      lastConnectionError = 'PostgreSQL client module ("pg") is not installed. Please run "npm install".';
      return null;
    }
  }

  try {
    const isSslRequired = config.database.ssl || dbUrl.includes('supabase.co') || dbUrl.includes('supabase.com') || dbUrl.includes('sslmode=require');
    let sslConfig = false;
    if (isSslRequired) {
      let caCert = null;
      if (config.database.ca && config.database.ca.trim().length > 0) {
        if (!config.database.ca.includes('-----BEGIN CERTIFICATE-----')) {
          const errMsg = 'DATABASE SECURITY ERROR: The provided DATABASE_CA environment variable is invalid. It must be a valid PEM-encoded certificate authority starting with -----BEGIN CERTIFICATE-----.';
          logger.error(errMsg);
          lastConnectionError = errMsg;
          throw new Error(errMsg);
        }
        caCert = config.database.ca.trim();
        logger.info('PostgreSQL SSL configured with custom CA certificate string (strict verification enabled).');
      } else {
        const resolvedPath = resolveCaPath(config.database.caPath);
        if (resolvedPath && fs.existsSync(resolvedPath)) {
          const fileContent = fs.readFileSync(resolvedPath, 'utf8').trim();
          if (fileContent.includes('-----BEGIN CERTIFICATE-----')) {
            caCert = fileContent;
            logger.info(`PostgreSQL SSL configured with CA cert file: ${resolvedPath} (strict verification enabled).`);
          }
        }
      }

      if (caCert) {
        sslConfig = {
          rejectUnauthorized: true,
          ca: caCert
        };
      } else {
        if (config.isProduction) {
          const errMsg = 'DATABASE SECURITY ERROR: In production (NODE_ENV=production), PostgreSQL connections require strict TLS certificate verification. Configure DATABASE_CA (the Supabase Root CA certificate content) or DATABASE_CA_PATH (path to prod-ca-2021.crt) in environment variables. Insecure SSL fallback (rejectUnauthorized: false) is prohibited in production.';
          logger.error(errMsg);
          lastConnectionError = errMsg;
          throw new Error(errMsg);
        } else {
          logger.warn('PostgreSQL SSL active without strict CA verification (rejectUnauthorized: false). Suitable for local development only.');
          sslConfig = { rejectUnauthorized: false };
        }
      }
    }

    const { Pool } = pg;
    pgPool = new Pool({
      connectionString: dbUrl,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pgPool.on('connect', (client) => {
      client.on('error', (err) => {
        logger.warn('PostgreSQL client socket error:', err.message);
      });
    });

    pgPool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client:', err.message);
      isConnected = false;
      lastConnectionError = err.message;
    });

    return pgPool;
  } catch (err) {
    logger.error('Failed to create PostgreSQL pool:', err.message);
    lastConnectionError = err.message;
    return null;
  }
}

/**
 * Test real connection to the PostgreSQL database
 * @returns {Promise<{ connected: boolean, provider: string, latencyMs?: number, error?: string, database?: string, timestamp?: string }>}
 */
async function checkConnection() {
  const pool = getPool();
  if (!pool) {
    return {
      connected: false,
      provider: 'postgresql',
      error: lastConnectionError || 'DATABASE_URL environment variable is not configured.'
    };
  }

  const start = Date.now();
  let client = null;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW() as server_time, current_database() as db_name, version() as pg_version');
    const latencyMs = Date.now() - start;
    isConnected = true;
    lastConnectionError = null;

    const row = result.rows[0];
    return {
      connected: true,
      provider: 'postgresql',
      latencyMs,
      database: row.db_name,
      serverTime: row.server_time,
      version: row.pg_version ? row.pg_version.split(' ')[0] + ' ' + row.pg_version.split(' ')[1] : 'PostgreSQL'
    };
  } catch (err) {
    isConnected = false;
    lastConnectionError = err.message;
    return {
      connected: false,
      provider: 'postgresql',
      error: err.message
    };
  } finally {
    if (client) client.release();
  }
}

/**
 * Run database schema migrations with persistent schema_migrations tracking,
 * PostgreSQL advisory locking for concurrent execution protection,
 * and automatic backward-compatibility bootstrap for existing databases.
 */
async function runMigrations() {
  const pool = getPool();
  if (!pool) {
    throw new Error('Cannot run migrations: PostgreSQL pool is not configured.');
  }

  const client = await pool.connect();
  const ADVISORY_LOCK_ID = 882601; // Deterministic lock ID for BRUH-Enat migrations
  let lockAcquired = false;

  try {
    // 1. Acquire PostgreSQL session-level advisory lock to serialize concurrent migrations
    logger.info('Acquiring migration advisory lock...');
    await client.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_ID]);
    lockAcquired = true;

    // 2. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(120) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NULL,
        execution_time_ms INTEGER NULL
      )
    `);

    // 3. Backward Compatibility Bootstrap:
    // If tables like 'attendees' or columns in 'google_sheets_sync' already exist from prior rounds,
    // ensure migrations 001 and 002 are registered as applied so existing databases upgrade smoothly.
    const checkAttendees = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'attendees'
      ) as exists
    `);
    if (checkAttendees.rows[0]?.exists) {
      await client.query(`
        INSERT INTO schema_migrations (id, applied_at, checksum, execution_time_ms)
        VALUES ('001_initial_schema.sql', CURRENT_TIMESTAMP, 'legacy_bootstrap', 0)
        ON CONFLICT (id) DO NOTHING
      `);
    }

    const checkColCompleted = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'google_sheets_sync' 
          AND column_name = 'completed_at'
      ) as exists
    `);
    if (checkColCompleted.rows[0]?.exists) {
      await client.query(`
        INSERT INTO schema_migrations (id, applied_at, checksum, execution_time_ms)
        VALUES ('002_google_sheets_sync_enhancements.sql', CURRENT_TIMESTAMP, 'legacy_bootstrap', 0)
        ON CONFLICT (id) DO NOTHING
      `);
    }

    // 4. Retrieve list of already applied migrations
    const appliedRes = await client.query('SELECT id FROM schema_migrations');
    const appliedIds = new Set(appliedRes.rows.map(r => r.id));

    // 5. Read all migration files from disk in deterministic sorted order
    const migrationsDir = path.resolve(__dirname, '../../database/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (appliedIds.has(file)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const ddl = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(ddl.trim()).digest('hex');
      const startMs = Date.now();

      logger.info(`Applying database migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(ddl);
        const durationMs = Date.now() - startMs;
        await client.query(
          `INSERT INTO schema_migrations (id, applied_at, checksum, execution_time_ms)
           VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
          [file, checksum, durationMs]
        );
        await client.query('COMMIT');
        appliedCount++;
        logger.info(`Successfully applied migration ${file} (${durationMs}ms, SHA: ${checksum.slice(0, 8)}).`);
      } catch (migErr) {
        await client.query('ROLLBACK');
        logger.error(`Migration ${file} failed, rolled back atomically:`, migErr.message);
        throw migErr;
      }
    }

    if (appliedCount === 0) {
      logger.info('Database schema is up to date. No new migrations needed.');
    } else {
      logger.info(`Database schema updated: ${appliedCount} migration(s) applied successfully.`);
    }

    return { success: true, appliedCount };
  } catch (err) {
    logger.error('Migration execution failed:', err.message);
    throw err;
  } finally {
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
      } catch (unlockErr) {
        logger.warn('Failed to release migration advisory lock:', unlockErr.message);
      }
    }
    client.release();
  }
}

/**
 * Retrieve list of applied schema migrations for diagnostics and admin dashboard
 */
async function getAppliedMigrations() {
  const pool = getPool();
  if (!pool) return [];
  try {
    const rows = await query('SELECT id, applied_at, checksum, execution_time_ms FROM schema_migrations ORDER BY id ASC');
    return rows;
  } catch (err) {
    logger.debug('Could not query schema_migrations:', err.message);
    return [];
  }
}

/**
 * Execute a query that returns multiple rows
 * Converts '?' placeholders to '$1, $2, ...' for PostgreSQL compatibility
 */
async function query(sql, params = []) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database is not connected. Configure DATABASE_URL in .env');
  }

  let paramIndex = 1;
  const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  const res = await pool.query(pgSql, params);
  return res.rows;
}

/**
 * Execute a query that returns a single row
 */
async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT, UPDATE, or DELETE statement
 */
async function execute(sql, params = []) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database is not connected. Configure DATABASE_URL in .env');
  }

  let paramIndex = 1;
  const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  const res = await pool.query(pgSql, params);
  return { rowCount: res.rowCount };
}

/**
 * Execute operations inside a PostgreSQL transaction (BEGIN ... COMMIT / ROLLBACK)
 */
async function transaction(callback) {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database is not connected. Configure DATABASE_URL in .env');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tx = {
      query: async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await client.query(pgSql, params);
        return res.rows;
      },
      getOne: async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await client.query(pgSql, params);
        return res.rows[0] || null;
      },
      execute: async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        const res = await client.query(pgSql, params);
        return { rowCount: res.rowCount };
      }
    };

    const result = await callback(tx);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Gracefully close the pool
 */
async function closePool() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    isConnected = false;
  }
}

module.exports = {
  getPool,
  checkConnection,
  runMigrations,
  getAppliedMigrations,
  query,
  getOne,
  execute,
  transaction,
  closePool
};
