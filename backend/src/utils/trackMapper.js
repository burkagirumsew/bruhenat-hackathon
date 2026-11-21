/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Canonical Innovation Track Definition & Normalization Utility
 */

const OFFICIAL_TRACKS = [
  {
    id: 1,
    name: 'Track 1 \u2013 Safe Reporting & Digital Protection',
    aliases: [
      'Track 1 \u2013 Safe Reporting & Digital Protection',
      'Track 1 - Safe Reporting & Digital Protection',
      'Track 01: Safe Reporting & Digital Protection',
      'Track 1: Safe Reporting & Digital Protection',
      'Track 1',
      'Track 01',
      'Safe Reporting & Digital Protection',
      'Safe Reporting and Digital Protection',
      'Safe Reporting & Digital Security'
    ],
    matchKeywords: ['safe reporting', 'digital protection']
  },
  {
    id: 2,
    name: 'Track 2 \u2013 AI-Powered Information & Support',
    aliases: [
      'Track 2 \u2013 AI-Powered Information & Support',
      'Track 2 - AI-Powered Information & Support',
      'Track 02: AI-Powered Information & Support',
      'Track 2: AI-Powered Information & Support',
      'Track 2',
      'Track 02',
      'AI-Powered Information & Support',
      'AI-Powered Information and Support',
      'AI Information & Support'
    ],
    matchKeywords: ['information & support', 'information and support', 'ai-powered']
  },
  {
    id: 3,
    name: 'Track 3 \u2013 Access to Support & Service Coordination',
    aliases: [
      'Track 3 \u2013 Access to Support & Service Coordination',
      'Track 3 - Access to Support & Service Coordination',
      'Track 03: Access to Support & Service Coordination',
      'Track 3: Access to Support & Service Coordination',
      'Track 3',
      'Track 03',
      'Access to Support & Service Coordination',
      'Access to Support and Service Coordination',
      'Service Coordination'
    ],
    matchKeywords: ['service coordination', 'access to support']
  },
  {
    id: 4,
    name: 'Track 4 \u2013 Prevention, Awareness & Online Safety',
    aliases: [
      'Track 4 \u2013 Prevention, Awareness & Online Safety',
      'Track 4 - Prevention, Awareness & Online Safety',
      'Track 04: Prevention, Awareness & Online Safety',
      'Track 4: Prevention, Awareness & Online Safety',
      'Track 4',
      'Track 04',
      'Prevention, Awareness & Online Safety',
      'Prevention, Awareness and Online Safety',
      'Online Safety'
    ],
    matchKeywords: ['prevention, awareness', 'online safety', 'awareness & online safety']
  }
];

/**
 * Normalize any raw track value to its canonical full display name
 * @param {string} rawTrack 
 * @returns {string} Canonical track name
 */
function getCanonicalTrackName(rawTrack) {
  if (!rawTrack) return 'General';
  const str = String(rawTrack).trim();
  const lower = str.toLowerCase();
  for (const t of OFFICIAL_TRACKS) {
    if (t.aliases.some(a => a.toLowerCase() === lower)) {
      return t.name;
    }
    if (t.matchKeywords.some(kw => lower.includes(kw))) {
      return t.name;
    }
  }
  return str;
}

/**
 * Resolve filter input to its corresponding official track definition
 * @param {string} filterInput 
 * @returns {object|null} Official track object or null if custom/unmatched
 */
function resolveTrack(filterInput) {
  if (!filterInput) return null;
  const str = String(filterInput).trim();
  const lower = str.toLowerCase();
  for (const t of OFFICIAL_TRACKS) {
    if (t.name.toLowerCase() === lower) return t;
    if (t.aliases.some(a => a.toLowerCase() === lower)) return t;
    if (t.matchKeywords.some(kw => lower.includes(kw))) return t;
  }
  return null;
}

module.exports = {
  OFFICIAL_TRACKS,
  getCanonicalTrackName,
  resolveTrack
};
