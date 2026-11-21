/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Vercel Static Production Build Script
 * 
 * Assembles all static frontend assets into the /dist directory
 * for high-speed edge delivery on Vercel CDN.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('[Build] Preparing static distribution directory:', DIST_DIR);

// 1. Recreate dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Directories to copy recursively
const DIRS_TO_COPY = ['admin', 'assets', 'css', 'js'];
for (const dirName of DIRS_TO_COPY) {
  const src = path.join(ROOT_DIR, dirName);
  const dest = path.join(DIST_DIR, dirName);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log(`[Build] Copied directory: ${dirName}`);
  }
}

// 3. Standalone files to copy
const FILES_TO_COPY = [
  'index.html',
  'ticket.html',
  'verify.html',
  'README.md',
  'supabase_schema_and_policies.sql'
];

for (const fileName of FILES_TO_COPY) {
  const src = path.join(ROOT_DIR, fileName);
  const dest = path.join(DIST_DIR, fileName);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`[Build] Copied file: ${fileName}`);
  }
}

console.log('[Build] Static site production build complete! Output ready in /dist');
