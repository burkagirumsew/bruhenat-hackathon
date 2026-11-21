/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Environment Configuration Loader & Validator
 */

const path = require('path');
// Load environment variables from .env if present and dotenv is available
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
} catch (e) {
  // dotenv module not yet installed; falls back to process.env
}

const isProd = process.env.NODE_ENV === 'production';
const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || '';
const defaultPublicUrl = railwayDomain ? `https://${railwayDomain}` : (isProd ? '' : 'http://localhost:5000');

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: isProd,
  port: parseInt(process.env.PORT || '5000', 10),
  appBaseUrl: process.env.BACKEND_URL || process.env.APP_BASE_URL || defaultPublicUrl || 'http://localhost:5000',
  backendUrl: process.env.BACKEND_URL || process.env.APP_BASE_URL || defaultPublicUrl || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || defaultPublicUrl || 'http://localhost:5000',

  database: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.DATABASE_SSL === 'true',
    ca: (process.env.DATABASE_CA || '').replace(/\\n/g, '\n'),
    caPath: process.env.DATABASE_CA_PATH || process.env.SUPABASE_CA_PATH || path.resolve(__dirname, '../../config/prod-ca-2021.crt'),
    sqlitePath: path.resolve(__dirname, '../../database/hackathon.db')
  },

  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'bruh_enat_default_dev_secret_replace_in_production_key_924d'),
    expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRATION || '7d',
    cookieName: process.env.ADMIN_SESSION_COOKIE_NAME || process.env.ADMIN_COOKIE_NAME || 'bruh_enat_admin_session'
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    loginMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10)
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'console'),
    fromAddress: process.env.EMAIL_FROM || process.env.FROM_EMAIL || process.env.EMAIL_FROM_ADDRESS || 'registration@bruhenat-hackathon.org',
    fromName: process.env.EMAIL_FROM_NAME || "BRUH-Enat Hackathon Organizing Committee",
    resendApiKey: process.env.RESEND_API_KEY || '',
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    verificationExpirationHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRATION_HOURS || '48', 10)
  },

  googleSheets: {
    enabled: process.env.GOOGLE_SHEETS_ENABLED === 'true',
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID || '',
    clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    keyFilePath: process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '',
    sheetNames: {
      allAttendees: process.env.GOOGLE_SHEET_NAME_ALL_ATTENDEES || 'All Attendees',
      individualRegistrations: process.env.GOOGLE_SHEET_NAME_INDIVIDUAL || 'Individual Registrations',
      teamRegistrations: process.env.GOOGLE_SHEET_NAME_TEAMS || 'Team Registrations',
      attendanceRecords: process.env.GOOGLE_SHEET_NAME_ATTENDANCE || 'Attendance Records'
    }
  },

  initialAdmin: {
    email: process.env.INITIAL_ADMIN_EMAIL || 'admin@bruhenat-hackathon.org',
    password: process.env.INITIAL_ADMIN_PASSWORD || '',
    name: process.env.INITIAL_ADMIN_NAME || 'Platform Administrator'
  }
};

// Fail-safe security validation for production deployments
if (config.isProduction) {
  const jwtSecret = process.env.JWT_SECRET || '';
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes('default_dev_secret') || jwtSecret.includes('replace_in_production')) {
    throw new Error('FATAL SECURITY ERROR: In production (NODE_ENV=production), JWT_SECRET must be configured with a cryptographically secure random string with minimum 32 characters.');
  }

  const isLocalhost = (url) => url && (url.includes('localhost') || url.includes('127.0.0.1'));
  if (isLocalhost(config.frontendUrl) || isLocalhost(config.backendUrl)) {
    throw new Error('FATAL CONFIGURATION ERROR: In production (NODE_ENV=production), FRONTEND_URL and BACKEND_URL must be configured with valid public HTTPS domain URLs. Localhost is prohibited in production.');
  }
}

module.exports = config;
