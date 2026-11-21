/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Secure Password Hashing & Verification Utility
 */

const crypto = require('crypto');

let bcrypt = null;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  // Fallback to native crypto pbkdf2 when bcryptjs is not installed
}

/**
 * Hash a plain text password
 * @param {string} password 
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (bcrypt) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  // Native PBKDF2 fallback (safe, salted, 100,000 iterations)
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$100000$${salt}$${derivedKey}`;
}

/**
 * Verify a plain text password against a hash
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 4) return false;
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const key = parts[3];
    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derivedKey, 'hex'), Buffer.from(key, 'hex'));
  }

  if (bcrypt) {
    return bcrypt.compare(password, storedHash);
  }

  // If storedHash is bcrypt but bcrypt module is missing, attempt dynamic require
  try {
    const dynamicBcrypt = require('bcryptjs');
    return dynamicBcrypt.compare(password, storedHash);
  } catch (err) {
    throw new Error('bcryptjs module required to verify bcrypt hashes. Run "npm install".');
  }
}

module.exports = {
  hashPassword,
  verifyPassword
};
