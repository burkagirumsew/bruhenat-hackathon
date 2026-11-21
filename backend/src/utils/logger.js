/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Structured Application Logger
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLevel = process.env.NODE_ENV === 'test' ? LOG_LEVELS.ERROR : LOG_LEVELS.DEBUG;

function formatTimestamp() {
  return new Date().toISOString();
}

function log(level, message, ...args) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const prefix = `[${formatTimestamp()}] [${level}]`;
  if (level === 'ERROR') {
    console.error(prefix, message, ...args);
  } else if (level === 'WARN') {
    console.warn(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

module.exports = {
  debug: (msg, ...args) => log('DEBUG', msg, ...args),
  info: (msg, ...args) => log('INFO', msg, ...args),
  warn: (msg, ...args) => log('WARN', msg, ...args),
  error: (msg, ...args) => log('ERROR', msg, ...args)
};
