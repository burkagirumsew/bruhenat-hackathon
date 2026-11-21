/**
 * =====================================================================
 * BIRUH ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * INDEPENDENT PRODUCTION API WORKER (HARDENED)
 * =====================================================================
 * Complete, standalone Cloudflare Worker for Biruh Enat Hackathon:
 * - Dedicated D1 Database Binding: env.DB (biruh-enat-db)
 * - HMAC-SHA256 signed expiring JWT authentication (independent secret, >=32 chars)
 * - Strict Role-Based Access Control (RBAC): 'admin' and 'checkin_agent'
 * - Atomic check-in operations preventing double-scanning race conditions
 * - Idempotent, persistence-first registration architecture
 * - Native support for both Biruh Enat and standard payload schemas
 * - Collision-resistant ticket generation
 * - Spreadsheet formula injection defense in CSV exports
 * - Strict CORS allowlist for Biruh Enat domains & localhost
 * - Zero hardcoded credentials or fallback secrets (fails closed)
 * - Safe logging with zero PII leakage
 * =====================================================================
 */

// ─── IN-MEMORY BRUTE-FORCE RATE LIMITER ───────────────────────────────
const failedAuthAttempts = new Map(); // ip -> { count, lockUntil }

function checkRateLimit(ip) {
  if (!ip) return { allowed: true };
  const record = failedAuthAttempts.get(ip);
  if (!record) return { allowed: true };
  if (record.lockUntil && Date.now() < record.lockUntil) {
    const remainingSeconds = Math.ceil((record.lockUntil - Date.now()) / 1000);
    return { allowed: false, remainingSeconds };
  }
  return { allowed: true };
}

function recordAuthFailure(ip) {
  if (!ip) return;
  const now = Date.now();
  const record = failedAuthAttempts.get(ip) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockUntil = now + (10 * 60 * 1000); // 10-minute lockout
    record.count = 0;
  }
  failedAuthAttempts.set(ip, record);
}

function recordAuthSuccess(ip) {
  if (ip) failedAuthAttempts.delete(ip);
}

// ─── UTILITY HELPERS ──────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

function normalizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  // Prevent CSV Formula Injection in Excel/Google Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str}"`;
}

function generateBiruhEnatTicket(pathway = 'individual') {
  const prefix = pathway === 'team' ? 'BE-2026-TEAM' : 'BE-2026-IND';
  const rand = crypto.getRandomValues(new Uint8Array(2));
  const hex = Array.from(rand, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}-${hex}`;
}

// ─── CRYPTO & JWT HELPERS (Web Crypto API) ────────────────────────────

const MIN_JWT_SECRET_LENGTH = 32;

function getValidatedJwtSecret(env) {
  const secret = env?.JWT_SECRET;
  if (!secret || typeof secret !== 'string') {
    return null;
  }
  const trimmed = secret.trim();
  if (trimmed.length < MIN_JWT_SECRET_LENGTH) {
    return null;
  }
  return trimmed;
}

function base64UrlEncode(data) {
  let base64;
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data);
    base64 = btoa(String.fromCharCode(...bytes));
  } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  } else {
    throw new Error('Unsupported data type for base64UrlEncode');
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToUint8(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64UrlEncode(JSON.stringify(header));
  const encPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encHeader}.${encPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToSign));
  return `${dataToSign}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function verifyJwt(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const dataToVerify = `${encHeader}.${encPayload}`;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlDecodeToUint8(encSig);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(dataToVerify));
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecodeToUint8(encPayload));
    const payload = JSON.parse(payloadJson);

    // Verify expiration timestamp
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ─── STRICT CORS HELPER (BIRUH ENAT DOMAINS) ──────────────────────────

function getCorsHeaders(origin) {
  const allowedOrigins = [
    'https://biruhenathackathon.et',
    'https://www.biruhenathackathon.et',
    'https://biruh-enat-hackathon-2026.vercel.app',
    'https://bruh-enat-hackathon-2026.vercel.app',
  ];

  let isAllowed = allowedOrigins.includes(origin);
  if (!isAllowed && origin) {
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
        /^https:\/\/(biruh|bruh)-enat-hackathon-2026(-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) {
      isAllowed = true;
    }
  }

  const corsOrigin = isAllowed ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

// ─── AUTHENTICATION / RBAC HELPER ─────────────────────────────────────

async function authenticateRequest(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { authenticated: false, role: null, error: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.slice(7).trim();
  const secret = getValidatedJwtSecret(env);

  if (!secret) {
    console.error('Security alert: JWT_SECRET is not configured or does not meet cryptographic strength requirements (minimum 32 characters required)');
    return { authenticated: false, role: null, error: 'Server authentication unconfigured' };
  }

  const payload = await verifyJwt(token, secret);
  if (!payload) {
    return { authenticated: false, role: null, error: 'Invalid or expired token' };
  }

  return {
    authenticated: true,
    role: payload.role,
    user: payload.sub,
    payload
  };
}

// ─── EMAIL SENDER HELPER ──────────────────────────────────────────────

async function sendEmailWithFallback(env, to, subject, html) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }

  const senders = [
    'Biruh Enat Hackathon <noreply@biruhenathackathon.et>',
    'Biruh Enat Hackathon <onboarding@resend.dev>',
  ];

  const errors = [];
  for (const from of senders) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });

      if (res.ok) return { ok: true };
      const errText = await res.text();
      errors.push({ from, status: res.status, error: errText });

      if (res.status === 403 || errText.includes('domain') || errText.includes('verify')) {
        continue;
      }
      return { ok: false, error: errText };
    } catch (err) {
      errors.push({ from, error: err.message || String(err) });
      continue;
    }
  }
  return { ok: false, error: JSON.stringify(errors) };
}

// ─── WORKER EXPORT ────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const clientIp = request.headers.get('CF-Connecting-IP') || 'local';
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // ─── Health check ───────────────────────────────────────────
      if (path === '/') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          event: "Biruh Enat Women's Tech Innovation Hackathon 2026",
          database: 'biruh-enat-db'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── POST /api/admin/login ──────────────────────────────────
      if (path === '/api/admin/login' && request.method === 'POST') {
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          return new Response(
            JSON.stringify({ error: `Too many failed login attempts. Please wait ${rateCheck.remainingSeconds} seconds.` }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await request.json().catch(() => ({}));
        const username = sanitizeText(body.username || body.email);
        const password = sanitizeText(body.password);

        if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
          console.error('Server configuration error: ADMIN_USERNAME or ADMIN_PASSWORD not configured in environment');
          return new Response(
            JSON.stringify({ error: 'Administrator credentials not configured in environment' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const secret = getValidatedJwtSecret(env);
        if (!secret) {
          console.error('Server configuration error: JWT_SECRET is not configured or fails cryptographic strength requirements (minimum 32 characters required)');
          return new Response(
            JSON.stringify({ error: 'Server authentication service unconfigured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
          recordAuthFailure(clientIp);
          return new Response(
            JSON.stringify({ error: 'Invalid credentials' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        recordAuthSuccess(clientIp);
        const token = await signJwt({
          sub: username,
          role: 'admin',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 3600) // 24-hour expiration
        }, secret);

        return new Response(
          JSON.stringify({ 
            success: true, 
            token,
            admin: {
              role: 'admin',
              username: env.ADMIN_USERNAME
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ─── GET /api/admin/me ──────────────────────────────────────
      if (path === '/api/admin/me' && request.method === 'GET') {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated) {
          return new Response(JSON.stringify({ success: false, error: auth.error }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({
          success: true,
          admin: { role: auth.role, username: auth.user }
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── POST /api/auth/checkin (Check-in desk agent authorization) 
      if (path === '/api/auth/checkin' && request.method === 'POST') {
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          return new Response(
            JSON.stringify({ error: `Too many failed authorization attempts. Please wait ${rateCheck.remainingSeconds} seconds.` }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const expectedCode = typeof env.CHECKIN_ACCESS_CODE === 'string' ? env.CHECKIN_ACCESS_CODE.trim() : '';
        if (!expectedCode) {
          console.error('Server configuration error: CHECKIN_ACCESS_CODE is not configured in environment');
          return new Response(
            JSON.stringify({ error: 'Check-in authentication service unconfigured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const secret = getValidatedJwtSecret(env);
        if (!secret) {
          console.error('Server configuration error: JWT_SECRET is not configured or fails cryptographic strength requirements');
          return new Response(
            JSON.stringify({ error: 'Server authentication service unconfigured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body = await request.json().catch(() => ({}));
        const accessCode = sanitizeText(body.accessCode);

        if (!accessCode || accessCode.toUpperCase() !== expectedCode.toUpperCase()) {
          recordAuthFailure(clientIp);
          return new Response(
            JSON.stringify({ error: 'Invalid access code' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        recordAuthSuccess(clientIp);
        const token = await signJwt({
          sub: 'checkin_station',
          role: 'checkin_agent',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (24 * 3600)
        }, secret);

        return new Response(
          JSON.stringify({ success: true, token }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ─── POST /api/register & /api/registrations/(individual|team) ──
      if (
        (path === '/api/register' || path === '/api/registrations/individual' || path === '/api/registrations/team') &&
        request.method === 'POST'
      ) {
        const data = await request.json().catch(() => null);
        if (!data) {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Normalize payload: handles both Biruh Enat nested payload and flat payload
        let fullName, email, phoneNumber, roleType, registrationType, teamName, strengths, alxAffiliation;
        let incomingMembers = [];

        if (data.applicant) {
          // Biruh Enat Individual Pathway
          fullName = sanitizeText(data.applicant.fullName);
          email = normalizeEmail(data.applicant.email);
          phoneNumber = sanitizeText(data.applicant.phone);
          roleType = sanitizeText(data.applicant.discipline || 'Innovator');
          registrationType = 'individual';
          teamName = null;
          strengths = sanitizeText(data.applicant.preferredTrack || data.applicant.skillsSummary);
          alxAffiliation = sanitizeText(data.applicant.city || 'Addis Ababa');
        } else if (data.team) {
          // Biruh Enat Team Pathway
          const leader = data.team.leader || {};
          fullName = sanitizeText(leader.fullName);
          email = normalizeEmail(leader.email);
          phoneNumber = sanitizeText(leader.phone);
          roleType = sanitizeText(leader.role || 'Team Lead');
          registrationType = 'team';
          teamName = sanitizeText(data.team.teamName);
          strengths = sanitizeText(data.team.track || data.team.solutionConcept);
          alxAffiliation = 'Team Lead';
          incomingMembers = Array.isArray(data.team.members) ? data.team.members : [];
        } else {
          // Standard flat payload
          fullName = sanitizeText(data.fullName);
          email = normalizeEmail(data.email);
          phoneNumber = sanitizeText(data.phoneNumber);
          roleType = sanitizeText(data.roleType);
          registrationType = data.registrationType === 'team' ? 'team' : 'individual';
          teamName = registrationType === 'team' ? sanitizeText(data.teamName) : null;
          strengths = sanitizeText(data.strengths);
          alxAffiliation = sanitizeText(data.alxAffiliation);
          incomingMembers = Array.isArray(data.teamMembers) ? data.teamMembers : [];
        }

        if (!fullName || !email || !phoneNumber || !roleType) {
          return new Response(
            JSON.stringify({ error: 'Full name, email, phone number, and discipline/role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!isValidEmail(email)) {
          return new Response(
            JSON.stringify({ error: 'Please provide a valid email address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (registrationType === 'team' && !teamName) {
          return new Response(
            JSON.stringify({ error: 'Team name is required for team registration' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validate and normalize team members
        const sanitizedMembers = [];
        const allRegistrationEmails = [email];

        if (registrationType === 'team') {
          for (let idx = 0; idx < incomingMembers.length; idx++) {
            const member = incomingMembers[idx];
            const mName = sanitizeText(member.fullName);
            const mEmail = normalizeEmail(member.email);
            const mPhone = sanitizeText(member.phoneNumber || member.phone);
            const mRole = sanitizeText(member.roleType || member.role || 'Member');
            const mAffiliation = sanitizeText(member.alxAffiliation || '');

            if (!mName && !mEmail) continue;

            if (!mName || !mEmail) {
              return new Response(
                JSON.stringify({
                  error: 'Team member registration incomplete',
                  details: [{ message: `Team member #${idx + 2} must have a name and email` }]
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            if (!isValidEmail(mEmail)) {
              return new Response(
                JSON.stringify({
                  error: 'Team member registration invalid email',
                  details: [{ message: `Team member with email ${mEmail} has an invalid email` }]
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            allRegistrationEmails.push(mEmail);
            sanitizedMembers.push({
              fullName: mName,
              email: mEmail,
              phoneNumber: mPhone,
              roleType: mRole,
              alxAffiliation: mAffiliation
            });
          }

          const uniquePayloadEmails = new Set(allRegistrationEmails);
          if (uniquePayloadEmails.size !== allRegistrationEmails.length) {
            return new Response(
              JSON.stringify({
                error: 'Duplicate email addresses found within the registration payload',
                details: [{ message: 'Each participant and team member must have a unique email address' }]
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // ─── IDEMPOTENCY & DUPLICATE CHECK ───────────────────────────
        const existingLead = await env.DB.prepare(
          'SELECT id, fullName, email, phoneNumber, ticketNumber, registrationType, teamName FROM users WHERE email = ?'
        ).bind(email).first();

        if (existingLead) {
          if (
            existingLead.fullName === fullName &&
            existingLead.phoneNumber === phoneNumber &&
            existingLead.registrationType === registrationType &&
            (registrationType === 'individual' || existingLead.teamName === teamName)
          ) {
            return new Response(
              JSON.stringify({
                success: true,
                message: 'Registration already confirmed',
                data: {
                  referenceCode: existingLead.ticketNumber,
                  ticketNumber: existingLead.ticketNumber,
                  alreadyRegistered: true
                },
                ticketNumber: existingLead.ticketNumber,
                alreadyRegistered: true,
                emailStatus: existingLead.emailStatus || 'pending'
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({
              error: 'This email is already registered either as a participant or team member',
              details: [{ message: `Email ${email} is already registered` }]
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const leadInMembers = await env.DB.prepare('SELECT email FROM team_members WHERE email = ?').bind(email).first();
        if (leadInMembers) {
          return new Response(
            JSON.stringify({
              error: 'This email is already registered as a team member',
              details: [{ message: `Email ${email} is already registered as a team member` }]
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        for (const m of sanitizedMembers) {
          const mInUsers = await env.DB.prepare('SELECT email FROM users WHERE email = ?').bind(m.email).first();
          const mInMembers = await env.DB.prepare('SELECT email FROM team_members WHERE email = ?').bind(m.email).first();
          if (mInUsers || mInMembers) {
            return new Response(
              JSON.stringify({
                error: 'Team member registration conflict',
                details: [{ message: `Team member email ${m.email} is already registered` }]
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Generate tickets
        const leadTicketNumber = generateBiruhEnatTicket(registrationType);
        const membersWithTickets = sanitizedMembers.map(m => ({
          ...m,
          ticketNumber: generateBiruhEnatTicket('team')
        }));

        // ─── PERSISTENCE FIRST (ATOMIC EXECUTION) ────────────────────
        try {
          const batchStatements = [
            env.DB.prepare(`
              INSERT INTO users (
                fullName, email, phoneNumber, alxAffiliation,
                registrationType, teamName, strengths, roleType,
                ticketNumber, checkInStatus, emailStatus
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending')
            `).bind(
              fullName,
              email,
              phoneNumber,
              alxAffiliation,
              registrationType,
              teamName,
              strengths,
              roleType,
              leadTicketNumber
            )
          ];

          for (const m of membersWithTickets) {
            batchStatements.push(
              env.DB.prepare(`
                INSERT INTO team_members (
                  userId, fullName, email, phoneNumber,
                  roleType, ticketNumber, alxAffiliation, checkInStatus, emailStatus
                ) VALUES (
                  (SELECT id FROM users WHERE ticketNumber = ?),
                  ?, ?, ?, ?, ?, ?, 0, 'pending'
                )
              `).bind(
                leadTicketNumber,
                m.fullName,
                m.email,
                m.phoneNumber,
                m.roleType,
                m.ticketNumber,
                m.alxAffiliation
              )
            );
          }

          await env.DB.batch(batchStatements);
        } catch (dbErr) {
          console.error('Database registration batch error:', dbErr.message);
          return new Response(
            JSON.stringify({ error: 'Failed to save registration to database. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ─── EMAIL DISPATCH SECOND (RESILIENT) ────────────────────────
        let emailErrors = [];
        const qrData = JSON.stringify({ ticketNumber: leadTicketNumber, email, name: fullName });
        const emailHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9f9f9;"><div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #eee;"><h2 style="color:#7C3AED;margin-top:0;">Biruh Enat Hackathon 2026</h2><p>Hello <strong>${escapeHtml(fullName)}</strong>,</p><p>Your registration is confirmed!</p><p>Ticket Number: <strong>${escapeHtml(leadTicketNumber)}</strong></p><p>Role / Track: ${escapeHtml(roleType)}</p><div style="text-align:center;margin:24px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrData)}&size=260x260" style="width:220px;height:220px;"/></div><p style="font-size:12px;color:#888;">Present this ticket code at check-in.</p></div></body></html>`;

        const emailRes = await sendEmailWithFallback(env, email, "Biruh Enat Hackathon 2026 Confirmation", emailHtml);
        if (emailRes.ok) {
          try { await env.DB.prepare("UPDATE users SET emailStatus = 'sent' WHERE ticketNumber = ?").bind(leadTicketNumber).run(); } catch {}
        } else {
          emailErrors.push({ email, error: emailRes.error });
          try { await env.DB.prepare("UPDATE users SET emailStatus = 'failed' WHERE ticketNumber = ?").bind(leadTicketNumber).run(); } catch {}
        }

        // Team members email dispatch
        if (registrationType === 'team') {
          for (const m of membersWithTickets) {
            const mQrData = JSON.stringify({ ticketNumber: m.ticketNumber, email: m.email, name: m.fullName });
            const mEmailHtml = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9f9f9;"><div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #eee;"><h2 style="color:#7C3AED;margin-top:0;">Biruh Enat Hackathon 2026</h2><p>Hello <strong>${escapeHtml(m.fullName)}</strong>,</p><p>You have been registered as a team member in <strong>${escapeHtml(teamName)}</strong>!</p><p>Ticket Number: <strong>${escapeHtml(m.ticketNumber)}</strong></p><p>Role / Track: ${escapeHtml(m.roleType)}</p><div style="text-align:center;margin:24px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(mQrData)}&size=260x260" style="width:220px;height:220px;"/></div><p style="font-size:12px;color:#888;">Present this ticket code at check-in.</p></div></body></html>`;

            const mEmailRes = await sendEmailWithFallback(env, m.email, "Biruh Enat Hackathon 2026 Team Member Confirmation", mEmailHtml);
            if (mEmailRes.ok) {
              try { await env.DB.prepare("UPDATE team_members SET emailStatus = 'sent' WHERE ticketNumber = ?").bind(m.ticketNumber).run(); } catch {}
            } else {
              emailErrors.push({ email: m.email, error: mEmailRes.error });
              try { await env.DB.prepare("UPDATE team_members SET emailStatus = 'failed' WHERE ticketNumber = ?").bind(m.ticketNumber).run(); } catch {}
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Registration successful',
            data: {
              referenceCode: leadTicketNumber,
              ticketNumber: leadTicketNumber,
              alreadyRegistered: false
            },
            ticketNumber: leadTicketNumber,
            emailStatus: emailErrors.length === 0 ? 'sent' : 'failed'
          }),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ─── POST /api/contact ──────────────────────────────────────
      if (path === '/api/contact' && request.method === 'POST') {
        const data = await request.json().catch(() => null);
        if (!data) {
          return new Response(JSON.stringify({ error: 'Invalid payload' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const name = sanitizeText(data.name);
        const email = normalizeEmail(data.email);
        const subject = sanitizeText(data.subject);
        const message = sanitizeText(data.message);

        if (!name || !email || !subject || !message) {
          return new Response(
            JSON.stringify({ error: 'All fields are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!isValidEmail(email)) {
          return new Response(
            JSON.stringify({ error: 'Please provide a valid email address' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          await env.DB.prepare(`
            INSERT INTO contact_messages (name, email, subject, message, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).bind(name, email, subject, message).run();

          return new Response(
            JSON.stringify({ message: 'Message sent successfully' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (dbError) {
          console.error('Contact write error:', dbError.message);
          return new Response(
            JSON.stringify({ error: 'Failed to save message' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ─── GET /api/registration/:ticketNumber ────────────────────
      if (path.startsWith('/api/registration/')) {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated || (auth.role !== 'admin' && auth.role !== 'checkin_agent')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: valid check-in station or administrator token required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const ticketNumber = sanitizeText(path.split('/').pop());

        let user = await env.DB.prepare(`
          SELECT u.*, GROUP_CONCAT(
            json_object('fullName', tm.fullName, 'email', tm.email, 'phoneNumber', tm.phoneNumber, 'roleType', tm.roleType, 'ticketNumber', tm.ticketNumber)
          ) as teamMembers
          FROM users u
          LEFT JOIN team_members tm ON u.id = tm.userId
          WHERE u.ticketNumber = ?
          GROUP BY u.id
        `).bind(ticketNumber).first();

        if (user) {
          try { user.teamMembers = user.teamMembers ? JSON.parse(`[${user.teamMembers}]`) : []; } catch { user.teamMembers = []; }
          return new Response(JSON.stringify(user), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const member = await env.DB.prepare(`
          SELECT tm.*, u.teamName, u.registrationType
          FROM team_members tm
          LEFT JOIN users u ON tm.userId = u.id
          WHERE tm.ticketNumber = ?
        `).bind(ticketNumber).first();

        if (member) {
          return new Response(JSON.stringify({ ...member, participantType: 'member', teamMembers: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ error: 'Registration not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── POST /api/checkin/:ticketNumber & /api/check-in/scan ───
      if (path.startsWith('/api/checkin/') || path === '/api/check-in/scan') {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated || (auth.role !== 'admin' && auth.role !== 'checkin_agent')) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: check-in station token required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let ticketNumber = '';
        if (path === '/api/check-in/scan') {
          const body = await request.json().catch(() => ({}));
          ticketNumber = sanitizeText(body.ticketNumber || body.code);
        } else {
          ticketNumber = sanitizeText(path.split('/').pop());
        }

        const attendee = await env.DB.prepare(`
          SELECT 'user' as source, id, fullName, email, checkInStatus, checkInTime FROM users WHERE ticketNumber = ?
          UNION ALL
          SELECT 'member' as source, id, fullName, email, checkInStatus, checkInTime FROM team_members WHERE ticketNumber = ?
        `).bind(ticketNumber, ticketNumber).first();

        if (!attendee) {
          return new Response(JSON.stringify({ error: 'Invalid ticket' }), {
            status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (attendee.checkInStatus === 1) {
          return new Response(JSON.stringify({ error: 'Already checked in', checkInTime: attendee.checkInTime }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const now = new Date().toISOString();
        let updateRes;
        if (attendee.source === 'user') {
          updateRes = await env.DB.prepare(`
            UPDATE users SET checkInStatus = 1, checkInTime = ?
            WHERE ticketNumber = ? AND (checkInStatus = 0 OR checkInStatus IS NULL)
          `).bind(now, ticketNumber).run();
        } else {
          updateRes = await env.DB.prepare(`
            UPDATE team_members SET checkInStatus = 1, checkInTime = ?
            WHERE ticketNumber = ? AND (checkInStatus = 0 OR checkInStatus IS NULL)
          `).bind(now, ticketNumber).run();
        }

        const changes = updateRes?.meta?.changes ?? updateRes?.changes ?? 0;
        if (changes === 0) {
          return new Response(JSON.stringify({ error: 'Already checked in', checkInTime: now }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Check-in successful',
          checkInTime: now,
          ticketNumber,
          fullName: attendee.fullName
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ─── PUT /api/admin/undo-checkin/:ticketNumber ───────────────
      if (request.method === 'PUT' && path.startsWith('/api/admin/undo-checkin/')) {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated || auth.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Unauthorized: administrator role required' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const ticketNumber = sanitizeText(path.split('/').pop());
        await env.DB.prepare("UPDATE users SET checkInStatus = 0, checkInTime = NULL WHERE ticketNumber = ?").bind(ticketNumber).run();
        await env.DB.prepare("UPDATE team_members SET checkInStatus = 0, checkInTime = NULL WHERE ticketNumber = ?").bind(ticketNumber).run();

        return new Response(JSON.stringify({ message: 'Check-in reversed', ticketNumber }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ═════════════════════════════════════════════════════════════
      // PROTECTED ADMIN ROUTES (REQUIRE ROLE 'admin')
      // ═════════════════════════════════════════════════════════════
      if (path.startsWith('/api/admin/')) {
        const auth = await authenticateRequest(request, env);
        if (!auth.authenticated || auth.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'Unauthorized: administrator role required' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ─── GET /api/admin/stats ───────────────────────────────────
        if (path === '/api/admin/stats' && request.method === 'GET') {
          const totalTeams = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE registrationType = 'team'").first();
          const totalIndividuals = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE registrationType = 'individual'").first();
          const totalUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
          const totalTeamMembers = await env.DB.prepare("SELECT COUNT(*) as count FROM team_members").first();
          const checkedInUsers = await env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE checkInStatus = 1").first();
          const checkedInMembers = await env.DB.prepare("SELECT COUNT(*) as count FROM team_members WHERE checkInStatus = 1").first();

          return new Response(JSON.stringify({
            totalTeams: totalTeams?.count || 0,
            totalIndividuals: totalIndividuals?.count || 0,
            totalRegistrations: totalUsers?.count || 0,
            totalTeamMembers: totalTeamMembers?.count || 0,
            totalParticipants: (totalUsers?.count || 0) + (totalTeamMembers?.count || 0),
            checkedInUsers: checkedInUsers?.count || 0,
            checkedInMembers: checkedInMembers?.count || 0,
            totalCheckedIn: (checkedInUsers?.count || 0) + (checkedInMembers?.count || 0),
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ─── GET /api/admin/registrations & /api/admin/attendees ─────
        if ((path === '/api/admin/registrations' || path === '/api/admin/attendees') && request.method === 'GET') {
          const users = await env.DB.prepare("SELECT * FROM users ORDER BY id DESC").all();
          const teamMembers = await env.DB.prepare("SELECT * FROM team_members ORDER BY userId, id").all();

          const userById = {};
          for (const u of (users?.results || [])) userById[u.id] = u;

          const flat = [];
          for (const u of (users?.results || [])) flat.push({ ...u, participantType: 'lead' });
          for (const m of (teamMembers?.results || [])) {
            const parent = userById[m.userId] || {};
            flat.push({
              ...m,
              participantType: 'member',
              teamName: parent.teamName || '',
              registrationType: 'team',
            });
          }

          return new Response(JSON.stringify(flat), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // ─── GET /api/admin/export/(registrations|attendees) ─────────
        if ((path === '/api/admin/export/registrations' || path === '/api/admin/export/attendees') && request.method === 'GET') {
          const users = await env.DB.prepare("SELECT * FROM users ORDER BY id").all();
          const teamMembers = await env.DB.prepare("SELECT * FROM team_members ORDER BY userId, id").all();

          let csv = 'Type,ID,FullName,Email,Phone,City,RegistrationType,TeamName,Role,Track,TicketNumber,CheckedIn,CheckInTime\n';
          for (const u of (users?.results || [])) {
            csv += [
              sanitizeCsvCell('Lead'),
              sanitizeCsvCell(u.id),
              sanitizeCsvCell(u.fullName),
              sanitizeCsvCell(u.email),
              sanitizeCsvCell(u.phoneNumber),
              sanitizeCsvCell(u.alxAffiliation),
              sanitizeCsvCell(u.registrationType),
              sanitizeCsvCell(u.teamName),
              sanitizeCsvCell(u.roleType),
              sanitizeCsvCell(u.strengths),
              sanitizeCsvCell(u.ticketNumber),
              sanitizeCsvCell(u.checkInStatus ? 'Yes' : 'No'),
              sanitizeCsvCell(u.checkInTime || '')
            ].join(',') + '\n';
          }
          for (const m of (teamMembers?.results || [])) {
            csv += [
              sanitizeCsvCell('Member'),
              sanitizeCsvCell(m.id),
              sanitizeCsvCell(m.fullName),
              sanitizeCsvCell(m.email),
              sanitizeCsvCell(m.phoneNumber),
              sanitizeCsvCell(m.alxAffiliation),
              sanitizeCsvCell('team'),
              sanitizeCsvCell(''),
              sanitizeCsvCell(m.roleType),
              sanitizeCsvCell(''),
              sanitizeCsvCell(m.ticketNumber),
              sanitizeCsvCell(m.checkInStatus ? 'Yes' : 'No'),
              sanitizeCsvCell(m.checkInTime || '')
            ].join(',') + '\n';
          }

          return new Response(csv, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="biruh_enat_registrations.csv"',
            },
          });
        }

        // ─── GET /api/admin/contacts ────────────────────────────────
        if (path === '/api/admin/contacts' && request.method === 'GET') {
          const contacts = await env.DB.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
          return new Response(JSON.stringify(contacts?.results || []), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Unhandled Biruh Enat worker exception:', error.message);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
