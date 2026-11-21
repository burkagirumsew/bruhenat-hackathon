/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Express Application Setup
 */

const express = require('express');
const path = require('path');

let cors = null;
try {
  cors = require('cors');
} catch (e) {
  // cors will be loaded after npm install
}

let helmet = null;
try {
  helmet = require('helmet');
} catch (e) {
  // helmet will be loaded after npm install
}

const config = require('./config/environment');
const logger = require('./utils/logger');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Route Handlers
const healthRoutes = require('./routes/healthRoutes');
const registrationRoutes = require('./routes/registrationRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const adminRoutes = require('./routes/adminRoutes');
const checkInRoutes = require('./routes/checkInRoutes');
const googleSheetsRoutes = require('./routes/googleSheetsRoutes');

const app = express();

// 1. Security Headers via Helmet (with fallback)
if (helmet) {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    })
  );
} else {
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
}

// 2. CORS Configuration
const allowedOrigins = [
  config.frontendUrl,
  config.appBaseUrl,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://localhost:8080',
  'http://127.0.0.1:5500'
];

if (cors) {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || !config.isProduction) {
          return callback(null, true);
        }
        return callback(new Error('CORS policy: Not allowed by origin'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );
} else {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

// 3. Request Body Parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 4. Request Logging (in development)
if (!config.isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
    });
    next();
  });
}

// 5. Apply Global API Rate Limiting to /api
app.use('/api', apiLimiter);

// 6. Mount API Routes
app.use('/api', healthRoutes);
app.use('/api', registrationRoutes);
app.use('/api', verificationRoutes);
app.use('/api', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/check-in', checkInRoutes);
app.use('/api/admin/google-sheets', googleSheetsRoutes);

// 7. Security: Block direct access to internal server files, secrets, and repository internals
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (
    p.startsWith('/backend') ||
    p.startsWith('/.backup') ||
    p.startsWith('/.git') ||
    p.includes('.env') ||
    p.endsWith('.json') ||
    p.endsWith('.md') ||
    p.endsWith('.sql')
  ) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  next();
});

// 8. Admin Clean UI URL Routes & Static Assets
const adminDir = path.resolve(__dirname, '../../admin');
app.use('/admin/css', express.static(path.join(adminDir, 'css')));
app.use('/admin/js', express.static(path.join(adminDir, 'js')));
app.get('/admin/login', (req, res) => res.sendFile(path.join(adminDir, 'login.html')));
app.get('/admin/check-in', (req, res) => res.sendFile(path.join(adminDir, 'check-in.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(adminDir, 'index.html')));

// 9. Public Frontend Static Assets (Strictly Whitelisted Folders)
const frontendRoot = path.resolve(__dirname, '../../');
app.use('/css', express.static(path.join(frontendRoot, 'css')));
app.use('/js', express.static(path.join(frontendRoot, 'js')));
app.use('/assets', express.static(path.join(frontendRoot, 'assets')));

// Public HTML Page Routes
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));
app.get('/verify.html', (req, res) => res.sendFile(path.join(frontendRoot, 'verify.html')));
app.get('/ticket.html', (req, res) => res.sendFile(path.join(frontendRoot, 'ticket.html')));

// 10. 404 Handler for Unmatched API Routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// 11. Centralized Error Handler
app.use(errorHandler);

module.exports = app;
