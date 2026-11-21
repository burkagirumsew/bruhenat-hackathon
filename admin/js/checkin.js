/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Check-In Desk Station Controller
 */

// Dedicated API Base URL (empty for same-origin DirectAdmin native backend)
const API_BASE = (typeof window !== 'undefined' && window.BIRUH_ENAT_API_URL) || '';
const _originalFetch = window.fetch;
window.fetch = function(input, init) {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    input = API_BASE + input;
  }
  return _originalFetch.call(this, input, init);
};

let html5QrScanner = null;
let isScannerRunning = false;
let isAudioMuted = localStorage.getItem('bruh_enat_checkin_muted') === 'true';
let activeSessionId = null;
let lastScannedCode = null;
let lastScannedTime = 0;
let pendingManualAttendee = null;

// Web Audio API Sound Synthesizer
const audioCtx = window.AudioContext || window.webkitAudioContext ? new (window.AudioContext || window.webkitAudioContext)() : null;

function playTone(freq, type, duration, delay = 0) {
  if (isAudioMuted || !audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

function playSuccessChime() {
  playTone(523.25, 'sine', 0.15, 0);     // C5
  playTone(659.25, 'sine', 0.25, 0.12);  // E5
}

function playWarningChime() {
  playTone(440, 'triangle', 0.12, 0);    // A4
  playTone(440, 'triangle', 0.18, 0.15); // A4
}

function playErrorBuzzer() {
  playTone(196, 'sawtooth', 0.35, 0);    // G3 low buzz
}

// Sound toggle
const muteBtn = document.getElementById('mute-sound-btn');
const soundIcon = document.getElementById('sound-icon');
const soundLabel = document.getElementById('sound-label');

function updateMuteButtonUI() {
  if (isAudioMuted) {
    soundIcon.textContent = '🔇';
    soundLabel.textContent = 'Audio Muted';
    muteBtn.classList.add('btn-secondary');
  } else {
    soundIcon.textContent = '🔔';
    soundLabel.textContent = 'Audio On';
    muteBtn.classList.remove('btn-secondary');
  }
}
updateMuteButtonUI();

muteBtn.addEventListener('click', () => {
  isAudioMuted = !isAudioMuted;
  localStorage.setItem('bruh_enat_checkin_muted', String(isAudioMuted));
  updateMuteButtonUI();
  if (!isAudioMuted) playSuccessChime();
});

// Toast notification helper for Check-In station
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };

  toast.innerHTML = `
    ${icons[type] || icons.info}
    <div class="toast-content">${escapeHtml(message)}</div>
    <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  let dismissTimer;

  function dismiss() {
    clearTimeout(dismissTimer);
    toast.classList.add('toast-hiding');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }

  closeBtn.addEventListener('click', dismiss);
  container.appendChild(toast);

  if (duration > 0) {
    dismissTimer = setTimeout(dismiss, duration);
  }
}

// Authentication & Profile Initialization (Strict Session Enforcement)
async function initAuth() {
  const sessionRaw = localStorage.getItem('bruh_enat_admin_session');
  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw);
      if (session && session.expiresAt && Date.now() < session.expiresAt) {
        document.getElementById('user-name').textContent = session.fullName || 'Admin Staff';
        const roleElem = document.getElementById('user-role');
        roleElem.textContent = (session.role || 'STAFF').replace('_', ' ');
        roleElem.className = `role-pill role-${session.role || 'STAFF'}`;
        if (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN') {
          document.getElementById('dashboard-link').style.display = 'inline-flex';
        }
        return;
      }
    } catch (e) {}
  }

  try {
    const res = await fetch('/api/admin/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.admin) {
        document.getElementById('user-name').textContent = data.admin.fullName;
        const roleElem = document.getElementById('user-role');
        roleElem.textContent = data.admin.role.replace('_', ' ');
        roleElem.className = `role-pill role-${data.admin.role}`;
        if (data.admin.role === 'SUPER_ADMIN' || data.admin.role === 'ADMIN') {
          document.getElementById('dashboard-link').style.display = 'inline-flex';
        }
        return;
      }
    }
  } catch (err) {}

  localStorage.removeItem('bruh_enat_admin_session');
  localStorage.removeItem('bruh_enat_admin_token');
  localStorage.removeItem('bruh_enat_admin_user');
  window.location.href = '/admin/login';
}

// Active Session Initialization
async function loadActiveSession() {
  try {
    const res = await fetch('/api/check-in/session/active', { credentials: 'include' });
    const data = await res.json();
    const sessionText = document.getElementById('active-session-text');
    if (data.success && data.session) {
      activeSessionId = data.session.id;
      sessionText.textContent = `📍 ${data.session.sessionName} (${data.session.eventDate}) — ${data.session.venueName}`;
    } else {
      sessionText.innerHTML = '<span style="color: var(--admin-warning);">⚠️ No active event session. Check-in requires an active session.</span>';
    }
  } catch (e) {
    document.getElementById('active-session-text').textContent = 'Could not load active session.';
  }
}

// Banner Display Helpers
const resultBanner = document.getElementById('result-banner');
const resultContent = document.getElementById('result-content');

function showSuccessBanner(data) {
  playSuccessChime();
  resultBanner.className = 'result-card success';
  const a = data.attendee;
  resultContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
      <div>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span class="badge badge-success" style="font-size: 0.85rem; padding: 0.3rem 0.7rem;">✓ CHECK-IN CONFIRMED</span>
          <span style="font-size: 0.85rem; color: var(--admin-text-secondary);">${new Date(data.checkedInAt).toLocaleTimeString()}</span>
        </div>
        <h2 style="font-size: 1.6rem; font-weight: 700; color: var(--admin-text-primary); margin: 0.25rem 0;">
          ${escapeHtml(a.fullName)}
        </h2>
        <p style="font-size: 1rem; color: var(--admin-text-secondary);">
          <strong>Track:</strong> <span style="color: var(--admin-teal);">${escapeHtml(a.track)}</span>
          ${a.teamName ? `&nbsp;|&nbsp; <strong>Team:</strong> ${escapeHtml(a.teamName)} ${a.isTeamLeader ? '(Leader)' : ''}` : '&nbsp;|&nbsp; <em>Individual Participant</em>'}
        </p>
      </div>
      <div style="text-align: right;">
        <span class="brand-badge" style="font-size: 1rem; font-family: monospace;">${escapeHtml(a.ticketCode || a.referenceCode)}</span>
      </div>
    </div>
  `;
  resultBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showDuplicateBanner(errData) {
  playWarningChime();
  resultBanner.className = 'result-card duplicate';
  const prev = errData.existingCheckIn || {};
  const prevTime = prev.checkedInAt ? new Date(prev.checkedInAt).toLocaleTimeString() : 'Earlier';
  const prevStaff = prev.staffName || 'Staff';
  const attendee = errData.attendee || {};

  resultContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
      <span class="badge badge-warning" style="font-size: 0.85rem; padding: 0.3rem 0.7rem;">⚠️ DUPLICATE CHECK-IN REJECTED</span>
    </div>
    <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--admin-warning); margin-bottom: 0.5rem;">
      ${escapeHtml(attendee.fullName || 'Attendee')} was ALREADY CHECKED IN
    </h3>
    <p style="font-size: 0.95rem; color: var(--admin-text-primary);">
      This attendee was previously scanned at <strong>${prevTime}</strong> by <strong>${escapeHtml(prevStaff)}</strong>.
    </p>
    <p style="font-size: 0.85rem; color: var(--admin-text-muted); margin-top: 0.5rem;">
      ${escapeHtml(errData.error || '')}
    </p>
  `;
  resultBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showErrorBanner(message) {
  playErrorBuzzer();
  resultBanner.className = 'result-card danger';
  resultContent.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
      <span class="badge badge-danger" style="font-size: 0.85rem; padding: 0.3rem 0.7rem;">✕ CHECK-IN REJECTED</span>
    </div>
    <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--admin-danger); margin-bottom: 0.5rem;">
      Access Denied / Verification Failed
    </h3>
    <p style="font-size: 0.95rem; color: var(--admin-text-primary);">
      ${escapeHtml(message)}
    </p>
  `;
  resultBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Processing Scan Submissions
async function processScan(payload) {
  try {
    const res = await fetch('/api/check-in/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...payload, sessionId: activeSessionId })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showSuccessBanner(data);
      loadRecentCheckIns();
    } else if (res.status === 409 || data.alreadyCheckedIn) {
      showDuplicateBanner(data);
    } else {
      showErrorBanner(data.error || 'Check-in validation failed.');
    }
  } catch (err) {
    console.warn('API endpoint offline, processing check-in directly via Supabase...', err.message);
    const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (client) {
      try {
        let code = payload.ticketCode || '';
        if (payload.qrData) {
          try {
            const parsed = JSON.parse(payload.qrData);
            code = parsed.code || parsed.ticketCode || code;
          } catch (e) {
            code = payload.qrData;
          }
        }
        code = (code || '').trim();

        // Find attendee by reference code or id
        const { data: attendees } = await client.from('attendees').select('*, registrations(*)').or(`email.eq.${code},id.eq.${code}`);
        let attendee = (attendees && attendees[0]) || null;

        if (!attendee) {
          const { data: byRef } = await client.from('registrations').select('*, attendees(*)').eq('reference_code', code);
          if (byRef && byRef[0] && byRef[0].attendees && byRef[0].attendees[0]) {
            attendee = byRef[0].attendees[0];
          }
        }

        if (attendee) {
          const { data: prevCheckIns } = await client.from('attendance').select('*').eq('attendee_id', attendee.id);
          if (prevCheckIns && prevCheckIns.length > 0) {
            showDuplicateBanner({
              alreadyCheckedIn: true,
              attendee: { fullName: attendee.full_name, track: attendee.preferred_track },
              existingCheckIn: { checkedInAt: prevCheckIns[0].checked_in_at, staffName: 'Staff' }
            });
            return;
          }

          const checkInId = 'chk_' + Math.random().toString(36).substring(2, 10);
          await client.from('attendance').insert({
            id: checkInId,
            attendee_id: attendee.id,
            check_in_method: 'QR_SCAN',
            checked_in_at: new Date().toISOString()
          });

          await client.from('attendees').update({ check_in_count: 1 }).eq('id', attendee.id);

          showSuccessBanner({
            attendee: {
              fullName: attendee.full_name,
              email: attendee.email,
              pathway: attendee.pathway || 'INDIVIDUAL',
              track: attendee.preferred_track
            },
            ticket: { ticketCode: code },
            session: { sessionName: 'Opening Ceremony & Hackathon Kickoff' },
            alreadyCheckedIn: false
          });
          return;
        }
      } catch (supaErr) {
        console.error('Supabase checkin error:', supaErr);
      }
    }
    showErrorBanner('Network or communication error during scan check-in.');
  }
}

// Camera Scanner Handling
const toggleScannerBtn = document.getElementById('toggle-scanner-btn');
const scannerPlaceholder = document.getElementById('scanner-placeholder');

async function startScanner() {
  if (!window.Html5Qrcode) {
    showToast('QR scanner library could not be loaded. Please check internet connection or enter ticket code manually.', 'error');
    return;
  }

  try {
    html5QrScanner = new Html5Qrcode("reader");
    scannerPlaceholder.style.display = 'none';

    await html5QrScanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      (decodedText) => {
        // Debounce scanner: ignore same code within 3 seconds
        const now = Date.now();
        if (decodedText === lastScannedCode && now - lastScannedTime < 3000) {
          return;
        }
        lastScannedCode = decodedText;
        lastScannedTime = now;
        processScan({ qrData: decodedText });
      },
      (errorMessage) => {
        // Frame did not find QR, ignore
      }
    );

    isScannerRunning = true;
    toggleScannerBtn.textContent = 'Stop Camera';
    toggleScannerBtn.classList.remove('btn-primary');
    toggleScannerBtn.classList.add('btn-secondary');
  } catch (err) {
    console.error('Camera start error:', err);
    scannerPlaceholder.style.display = 'block';
    showToast('Camera permission was denied or no camera device is available on this system.', 'warning');
  }
}

async function stopScanner() {
  if (html5QrScanner && isScannerRunning) {
    await html5QrScanner.stop();
    html5QrScanner.clear();
    isScannerRunning = false;
    scannerPlaceholder.style.display = 'block';
    toggleScannerBtn.textContent = 'Start Camera';
    toggleScannerBtn.classList.add('btn-primary');
    toggleScannerBtn.classList.remove('btn-secondary');
  }
}

toggleScannerBtn.addEventListener('click', () => {
  if (isScannerRunning) {
    stopScanner();
  } else {
    startScanner();
  }
});

// Direct Manual Ticket Code Form
document.getElementById('manual-code-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('manual-code-input');
  const code = input.value.trim().toUpperCase();
  if (!code) return;
  input.value = '';
  processScan({ ticketCode: code });
});

// Attendee Quick Search & Lookup
const lookupInput = document.getElementById('lookup-input');
const lookupResults = document.getElementById('lookup-results');
let searchTimeout = null;

lookupInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = lookupInput.value.trim();
  if (!q) {
    lookupResults.innerHTML = '<p style="font-size: 0.85rem; color: var(--admin-text-muted); text-align: center; padding: 1rem;">Type a name or email to look up an attendee for manual check-in.</p>';
    return;
  }

  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`/api/check-in/search?q=${encodeURIComponent(q)}&sessionId=${activeSessionId || ''}`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success && data.results) {
        renderLookupResults(data.results);
      }
    } catch (e) {
      // search error
    }
  }, 250);
});

function renderLookupResults(list) {
  if (!list.length) {
    lookupResults.innerHTML = '<p style="font-size: 0.85rem; color: var(--admin-text-muted); text-align: center; padding: 1rem;">No matching attendees found.</p>';
    return;
  }

  let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
  for (const a of list) {
    const isChecked = a.isCheckedIn;
    html += `
      <div style="background: var(--admin-card-hover); border: 1px solid var(--admin-border); border-radius: var(--admin-radius-sm); padding: 0.75rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
        <div>
          <div style="font-weight: 600; color: var(--admin-text-primary); font-size: 0.9rem;">
            ${escapeHtml(a.fullName)}
            ${a.isTeamLeader ? '<span class="badge badge-primary" style="font-size: 0.65rem;">LEADER</span>' : ''}
          </div>
          <div style="font-size: 0.8rem; color: var(--admin-text-secondary);">
            ${escapeHtml(a.email)} &bull; ${escapeHtml(a.track)}
            ${a.teamName ? `&bull; Team: <strong>${escapeHtml(a.teamName)}</strong>` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--admin-text-muted); font-family: monospace; margin-top: 0.2rem;">
            Ref: ${escapeHtml(a.referenceCode)} | Pass: ${escapeHtml(a.ticketCode || 'No ticket')}
          </div>
        </div>
        <div>
          ${isChecked 
            ? `<span class="badge badge-success">✓ Checked In</span>` 
            : `<button class="btn btn-sm btn-primary" onclick="openManualModal('${a.id}', '${escapeHtml(a.fullName).replace(/'/g, "\\'")}', '${escapeHtml(a.email)}')">Check In</button>`
          }
        </div>
      </div>
    `;
  }
  html += '</div>';
  lookupResults.innerHTML = html;
}

// Manual Check-In Modal
const manualModal = document.getElementById('manual-checkin-modal');
const manualSummary = document.getElementById('manual-attendee-summary');
const manualReasonSelect = document.getElementById('manual-reason-select');
const manualReasonOther = document.getElementById('manual-reason-other');
const confirmManualBtn = document.getElementById('confirm-manual-btn');

manualReasonSelect.addEventListener('change', () => {
  manualReasonOther.style.display = manualReasonSelect.value === 'Other' ? 'block' : 'none';
});

window.openManualModal = function(id, name, email) {
  pendingManualAttendee = { id, name, email };
  manualSummary.innerHTML = `
    <div style="background: var(--admin-card-hover); padding: 0.75rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border);">
      <div style="font-weight: 700; font-size: 1.1rem; color: var(--admin-text-primary);">${escapeHtml(name)}</div>
      <div style="font-size: 0.85rem; color: var(--admin-text-secondary);">${escapeHtml(email)}</div>
    </div>
  `;
  manualReasonSelect.selectedIndex = 0;
  manualReasonOther.value = '';
  manualReasonOther.style.display = 'none';
  manualModal.classList.add('show');
};

window.closeManualModal = function() {
  manualModal.classList.remove('show');
  pendingManualAttendee = null;
};

confirmManualBtn.addEventListener('click', async () => {
  if (!pendingManualAttendee) return;
  const reason = manualReasonSelect.value === 'Other' ? manualReasonOther.value.trim() : manualReasonSelect.value;
  if (!reason) {
    showToast('Please specify a reason for manual check-in.', 'warning');
    return;
  }

  confirmManualBtn.disabled = true;
  try {
    const res = await fetch('/api/check-in/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        attendeeId: pendingManualAttendee.id,
        sessionId: activeSessionId,
        reason
      })
    });

    const data = await res.json();
    closeManualModal();

    if (res.ok && data.success) {
      showSuccessBanner(data);
      loadRecentCheckIns();
      // Refresh lookup if active
      if (lookupInput.value.trim()) {
        lookupInput.dispatchEvent(new Event('input'));
      }
    } else if (res.status === 409 || data.alreadyCheckedIn) {
      showDuplicateBanner(data);
    } else {
      showErrorBanner(data.error || 'Manual check-in failed.');
    }
  } catch (err) {
    showErrorBanner('Network error during manual check-in.');
  } finally {
    confirmManualBtn.disabled = false;
  }
});

// Recent Desk Scans Feed
async function loadRecentCheckIns() {
  try {
    const res = await fetch(`/api/check-in/recent?sessionId=${activeSessionId || ''}&limit=10`, {
      credentials: 'include'
    });
    const data = await res.json();
    const feed = document.getElementById('recent-feed');
    if (data.success && data.recent && data.recent.length > 0) {
      feed.innerHTML = data.recent.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--admin-border); font-size: 0.85rem;">
          <div>
            <span style="font-weight: 600; color: var(--admin-text-primary);">${escapeHtml(r.fullName)}</span>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">
              ${escapeHtml(r.track)} ${r.teamName ? `&bull; ${escapeHtml(r.teamName)}` : ''} &bull; ${r.method === 'QR_SCAN' ? '📷 QR' : '✍️ Manual'}
            </div>
          </div>
          <div style="font-size: 0.75rem; color: var(--admin-text-secondary); text-align: right;">
            ${new Date(r.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      `).join('');
    }
  } catch (e) {
    // feed fetch error
  }
}

// Logout handler
document.getElementById('logout-btn').addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } finally {
    localStorage.removeItem('bruh_enat_admin_token');
    localStorage.removeItem('bruh_enat_admin_user');
    window.location.href = '/admin/login';
  }
});

// Run initializers
(async () => {
  await initAuth();
  await loadActiveSession();
  await loadRecentCheckIns();
})();
