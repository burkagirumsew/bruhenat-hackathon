/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Authentication Controller
 */

const db = require('../config/database');
const config = require('../config/environment');
const { generateToken } = require('../middleware/authMiddleware');
const { verifyPassword, hashPassword } = require('../utils/passwordHelper');
const { logAction } = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * POST /api/admin/login
 */
async function login(req, res) {
  const { email, password } = req.body || {};
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required.',
      timestamp: new Date().toISOString()
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const pool = db.getPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database is not connected. Configure DATABASE_URL in .env',
        timestamp: new Date().toISOString()
      });
    }

    const admin = await db.getOne(
      'SELECT id, full_name, email, password_hash, role, is_active FROM admins WHERE LOWER(email) = ?',
      [normalizedEmail]
    );

    if (!admin) {
      await logAction({
        action: 'ADMIN_LOGIN_FAILED',
        details: { email: normalizedEmail, reason: 'User not found' },
        ipAddress,
        userAgent
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        timestamp: new Date().toISOString()
      });
    }

    if (!admin.is_active) {
      await logAction({
        adminId: admin.id,
        action: 'ADMIN_LOGIN_FAILED',
        details: { email: normalizedEmail, reason: 'Account deactivated' },
        ipAddress,
        userAgent
      });

      return res.status(403).json({
        success: false,
        error: 'Administrator account has been deactivated. Please contact the lead administrator.',
        timestamp: new Date().toISOString()
      });
    }

    const isMatch = await verifyPassword(password, admin.password_hash);
    if (!isMatch) {
      await logAction({
        adminId: admin.id,
        action: 'ADMIN_LOGIN_FAILED',
        details: { email: normalizedEmail, reason: 'Invalid password' },
        ipAddress,
        userAgent
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.',
        timestamp: new Date().toISOString()
      });
    }

    // Update last_login_at
    await db.execute(
      'UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // Issue JWT
    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role
    };

    const token = generateToken(tokenPayload);

    // Set HttpOnly Cookie
    const cookieOptions = {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    };
    res.cookie(config.jwt.cookieName, token, cookieOptions);

    await logAction({
      adminId: admin.id,
      action: 'ADMIN_LOGIN_SUCCESS',
      targetType: 'admin',
      targetId: admin.id,
      details: { email: admin.email, role: admin.role },
      ipAddress,
      userAgent
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      admin: {
        id: admin.id,
        fullName: admin.full_name,
        email: admin.email,
        role: admin.role
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Admin login error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'An unexpected authentication error occurred.',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * POST /api/admin/logout
 */
async function logout(req, res) {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];

  if (req.admin) {
    await logAction({
      adminId: req.admin.id,
      action: 'ADMIN_LOGOUT',
      targetType: 'admin',
      targetId: req.admin.id,
      details: { email: req.admin.email },
      ipAddress,
      userAgent
    });
  }

  res.clearCookie(config.jwt.cookieName, { path: '/' });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
    timestamp: new Date().toISOString()
  });
}

/**
 * GET /api/admin/me
 */
async function getMe(req, res) {
  if (!req.admin) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated.',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const pool = db.getPool();
    if (pool) {
      const admin = await db.getOne(
        'SELECT id, full_name, email, role, is_active, last_login_at, created_at FROM admins WHERE id = ?',
        [req.admin.id]
      );
      if (admin) {
        return res.status(200).json({
          success: true,
          admin: {
            id: admin.id,
            fullName: admin.full_name,
            email: admin.email,
            role: admin.role,
            isActive: admin.is_active,
            lastLoginAt: admin.last_login_at,
            createdAt: admin.created_at
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    return res.status(200).json({
      success: true,
      admin: req.admin,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin profile.',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  login,
  logout,
  getMe
};
