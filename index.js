import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Vercel Serverless Function Entrypoint
 */
export default function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;

  // Route rewrites
  if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin/index.html';
  } else if (pathname === '/admin/login') {
    pathname = '/admin/login.html';
  } else if (pathname === '/admin/check-in') {
    pathname = '/admin/check-in.html';
  } else if (pathname === '/ticket') {
    pathname = '/ticket.html';
  } else if (pathname === '/verify') {
    pathname = '/verify.html';
  } else if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg'
    };
    res.statusCode = 200;
    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    return fs.createReadStream(filePath).pipe(res);
  }

  // Fallback to index.html
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return fs.createReadStream(indexPath).pipe(res);
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('BRUH-ENAT Hackathon 2026 Platform Online');
}
