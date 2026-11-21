/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Authentication & RBAC Middleware
 */

const crypto = require('crypto');
const config = require('../config/environment');
const db = require('../config/database');
const logger = require('../utils/logger');

let jwt = null;
try {
  jwt = require('jsonwebtoken');
} catch (e) {
  // jsonwebtoken module will be loaded when available; fallback below
}

/**
 * Fallback HMAC-SHA256 token generator for offline / test environments
 */
function signFallbackToken(payload, secret, expiresInSeconds = 7 * 86400) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Fallback HMAC-SHA256 token verifier
 */
function verifyFallbackToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token structure');
  }
  const [header, body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (signature !== expectedSig) {
    throw new Error('Invalid token signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload;
}

/**
 * Sign an admin JWT token
 */
function generateToken(payload) {
  if (jwt) {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn || '7d' });
  }
  return signFallbackToken(payload, config.jwt.secret, 7 * 86400);
}

/**
 * Verify an admin JWT token
 */
function verifyToken(token) {
  if (jwt) {
    return jwt.verify(token, config.jwt.secret);
  }
  return verifyFallbackToken(token, config.jwt.secret);
}

/**
 * Extract token from Authorization header or Cookie
 */
function extractToken(req) {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Cookie: bruh_enat_admin_session=<token>
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const cookieName = config.jwt.cookieName || 'bruh_enat_admin_session';
    for (const c of cookies) {
      if (c.startsWith(`${cookieName}=`)) {
        return decodeURIComponent(c.substring(cookieName.length + 1).trim());
      }
    }
  }

  return null;
}

/**
 * Authenticate Admin Middleware
 */
async function authenticateAdmin(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No session or token provided.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const decoded = verifyToken(token);
    
    // Check if database is connected; if connected, verify admin is active
    const pool = db.getPool();
    if (pool) {
      const admin = await db.getOne(
        'SELECT id, full_name, email, role, is_active FROM admins WHERE id = ?',
        [decoded.id]
      );

      if (!admin) {
        return res.status(401).json({
          success: false,
          error: 'Administrator account no longer exists.',
          timestamp: new Date().toISOString()
        });
      }

      if (!admin.is_active) {
        return res.status(403).json({
          success: false,
          error: 'Administrator account has been deactivated.',
          timestamp: new Date().toISOString()
        });
      }

      req.admin = {
        id: admin.id,
        fullName: admin.full_name,
        email: admin.email,
        role: admin.role
      };
    } else {
      // In disconnected or mock/test mode without DB pool
      req.admin = {
        id: decoded.id,
        fullName: decoded.fullName || decoded.full_name || 'Admin',
        email: decoded.email,
        role: decoded.role || 'ADMIN'
      };
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.name === 'TokenExpiredError' || err.message === 'Token expired'
        ? 'Session has expired. Please log in again.'
        : 'Invalid session token.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Guard
 * Usage: requireRole('SUPER_ADMIN', 'ADMIN')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required before checking roles.',
        timestamp: new Date().toISOString()
      });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role "${req.admin.role}" lacks required permissions (${allowedRoles.join(', ')}).`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  verifyToken,
  extractToken,
  authenticateAdmin,
  requireRole
};
