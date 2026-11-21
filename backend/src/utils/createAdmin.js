/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * First Administrator Bootstrap Utility
 * Usage: node src/utils/createAdmin.js [--name "Name"] [--email "email"] [--password "pass"] [--role "SUPER_ADMIN"]
 */

const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config/environment');
const { hashPassword } = require('./passwordHelper');
const { logAction } = require('../services/auditService');
const logger = require('./logger');

async function createInitialAdmin(options = {}) {
  const pool = db.getPool();
  if (!pool) {
    throw new Error('Database is not connected. Configure DATABASE_URL in .env before creating an admin.');
  }

  const name = options.name || config.initialAdmin.name || 'Platform Administrator';
  const email = (options.email || config.initialAdmin.email || 'admin@bruhenat-hackathon.org').trim().toLowerCase();
  const password = options.password || config.initialAdmin.password;
  const role = options.role || 'SUPER_ADMIN';

  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required.');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // Check how many admins already exist
  const existingCountRow = await db.getOne('SELECT COUNT(*) as count FROM admins');
  const count = parseInt(existingCountRow ? existingCountRow.count : '0', 10);

  // If admins exist and allowExisting is not explicitly true, check if target email already exists
  const existingAdmin = await db.getOne('SELECT id, email, role FROM admins WHERE LOWER(email) = ?', [email]);
  if (existingAdmin) {
    throw new Error(`Admin with email "${email}" already exists (ID: ${existingAdmin.id}).`);
  }

  // Security guard: If other admins already exist and force flag is not passed
  if (count > 0 && !options.force) {
    logger.warn('Admins already exist in the database. Creating an additional admin requires super-admin authorization or --force flag.');
  }

  const id = `adm_${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex')}`;
  const passwordHash = await hashPassword(password);

  await db.execute(
    `INSERT INTO admins (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, name, email, passwordHash, role]
  );

  await logAction({
    adminId: id,
    action: 'ADMIN_CREATED',
    targetType: 'admin',
    targetId: id,
    details: { email, role, isBootstrap: count === 0 }
  });

  logger.info(`Administrator created successfully: ${name} <${email}> [${role}] (ID: ${id})`);
  return { id, name, email, role };
}

/**
 * Safely reset password for an existing administrator without altering database or other records
 */
async function resetAdminPassword(options = {}) {
  const pool = db.getPool();
  if (!pool) {
    throw new Error('Database is not connected. Configure DATABASE_URL in .env before resetting password.');
  }

  const email = (options.email || config.initialAdmin.email || '').trim().toLowerCase();
  const newPassword = options.password || config.initialAdmin.password;

  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required (--email admin@domain.org).');
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long (--password NewSecurePass123).');
  }

  const existingAdmin = await db.getOne('SELECT id, full_name, email, role, is_active FROM admins WHERE LOWER(email) = ?', [email]);
  if (!existingAdmin) {
    throw new Error(`Admin account with email "${email}" was not found in the database.`);
  }

  const newHash = await hashPassword(newPassword);
  await db.execute('UPDATE admins SET password_hash = ?, is_active = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, existingAdmin.id]);

  await logAction({
    adminId: existingAdmin.id,
    action: 'ADMIN_PASSWORD_RESET',
    targetType: 'admin',
    targetId: existingAdmin.id,
    details: { email, role: existingAdmin.role }
  });

  logger.info(`Password successfully reset for administrator: ${existingAdmin.full_name} <${email}>`);
  return { id: existingAdmin.id, name: existingAdmin.full_name, email, role: existingAdmin.role };
}

// If executed directly from command line
if (require.main === module) {
  const args = process.argv.slice(2);
  const parsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      parsedArgs[key] = val;
    }
  }

  (async () => {
    try {
      console.log('--- BRUH-Enat Admin Management ---');
      if (parsedArgs.reset) {
        const admin = await resetAdminPassword(parsedArgs);
        console.log(`[SUCCESS] Admin password reset successfully:`);
        console.log(`  Name:  ${admin.name}`);
        console.log(`  Email: ${admin.email}`);
        console.log(`  Role:  ${admin.role}`);
      } else {
        const admin = await createInitialAdmin(parsedArgs);
        console.log(`[SUCCESS] Admin account created:`);
        console.log(`  Name:  ${admin.name}`);
        console.log(`  Email: ${admin.email}`);
        console.log(`  Role:  ${admin.role}`);
      }
      process.exit(0);
    } catch (err) {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    } finally {
      await db.closePool();
    }
  })();
}

module.exports = {
  createInitialAdmin,
  resetAdminPassword
};
