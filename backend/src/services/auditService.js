/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Audit Logging Service
 */

const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Record an action into admin_audit_logs
 */
async function logAction({
  adminId = null,
  action,
  targetType = null,
  targetId = null,
  details = null,
  ipAddress = null,
  userAgent = null
}) {
  const pool = db.getPool();
  if (!pool) {
    logger.debug(`[AUDIT (OFFLINE)] ${action} | admin: ${adminId || 'anon'} | target: ${targetType}:${targetId}`);
    return null;
  }

  const id = `audit_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')}`;
  const detailsJson = details ? JSON.stringify(details) : null;

  try {
    await db.execute(
      `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details_json, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [id, adminId, action, targetType, targetId, detailsJson, ipAddress, userAgent]
    );
    return id;
  } catch (err) {
    logger.error(`Failed to record audit log (${action}):`, err.message);
    return null;
  }
}

/**
 * Fetch paginated audit logs
 */
async function getAuditLogs({ page = 1, limit = 50, action = null, adminId = null, search = null }) {
  const pool = db.getPool();
  if (!pool) {
    return { logs: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  const offset = (Math.max(1, page) - 1) * limit;
  const whereClauses = [];
  const params = [];

  if (action && action.trim()) {
    whereClauses.push('l.action = ?');
    params.push(action.trim());
  }
  if (adminId && adminId.trim()) {
    whereClauses.push('l.admin_id = ?');
    params.push(adminId.trim());
  }
  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(l.action) LIKE ? OR LOWER(COALESCE(a.full_name, \'\')) LIKE ? OR LOWER(COALESCE(a.email, \'\')) LIKE ? OR LOWER(COALESCE(l.target_type, \'\')) LIKE ? OR LOWER(COALESCE(l.target_id, \'\')) LIKE ? OR LOWER(COALESCE(l.details_json, \'\')) LIKE ?)');
    params.push(term, term, term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    const countRow = await db.getOne(
      `SELECT COUNT(*) as total
       FROM admin_audit_logs l
       LEFT JOIN admins a ON l.admin_id = a.id
       ${whereSql}`,
      [...params]
    );
    const total = parseInt(countRow ? countRow.total : '0', 10);

    const logs = await db.query(
      `SELECT l.id, l.admin_id, a.full_name as admin_name, a.email as admin_email,
              l.action, l.target_type, l.target_id, l.details_json, l.ip_address,
              l.created_at
       FROM admin_audit_logs l
       LEFT JOIN admins a ON l.admin_id = a.id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      logs: logs.map(row => ({
        ...row,
        details: row.details_json ? JSON.parse(row.details_json) : null
      })),
      pagination: {
        page: Math.max(1, page),
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  } catch (err) {
    logger.debug('Database offline or query failed in getAuditLogs:', err.message);
    return { logs: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }
}

module.exports = {
  logAction,
  getAuditLogs
};
