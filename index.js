/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Platform Entrypoint for Vercel Deployment
 */

export default function handler(req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/"></head><body>Redirecting to <a href="/">BRUH-ENAT Hackathon 2026</a>...</body></html>');
}
