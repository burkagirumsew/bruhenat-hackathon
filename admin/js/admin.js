/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Command Center Controller
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

// Application State
const state = {
  admin: null,
  activeTab: 'tab-overview',
  activeSession: null,
  attendees: {
    page: 1,
    limit: 20,
    search: '',
    pathway: '',
    track: '',
    verified: '',
    ticketStatus: '',
    status: '',
    sortBy: 'created_at',
    sortOrder: 'DESC',
    total: 0,
    totalPages: 1
  },
  audit: {
    page: 1,
    limit: 20,
    search: '',
    action: '',
    total: 0,
    totalPages: 1
  },
  pendingRevokeTicketId: null
};

// Authentication Headers Helper
function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem('bruh_enat_admin_token');
  const headers = { ...extraHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Authentication Verification & Guard
async function checkAuth() {
  try {
    const res = await fetch('/api/admin/me', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    if (!res.ok) {
      window.location.href = '/admin/login';
      return false;
    }

    const data = await res.json();
    if (data.success && data.admin) {
      state.admin = data.admin;

      // If check-in desk staff, route to check-in station
      if (data.admin.role === 'CHECKIN_STAFF') {
        window.location.href = '/admin/check-in';
        return false;
      }

      document.getElementById('admin-user-name').textContent = data.admin.fullName;
      const roleElem = document.getElementById('admin-user-role');
      roleElem.textContent = data.admin.role.replace('_', ' ');
      roleElem.className = `role-pill role-${data.admin.role}`;

      const initialsElem = document.getElementById('admin-avatar-initials');
      if (initialsElem && data.admin.fullName) {
        const parts = data.admin.fullName.trim().split(/\s+/);
        const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : parts[0].slice(0, 2);
        initialsElem.textContent = initials.toUpperCase();
      }
      return true;
    }
  } catch (err) {
    window.location.href = '/admin/login';
    return false;
  }
}

// Theme Handling
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');

function initTheme() {
  const savedTheme = localStorage.getItem('bruh_enat_admin_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeIcon.textContent = savedTheme === 'light' ? '🌙' : '☀️';
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const target = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', target);
  localStorage.setItem('bruh_enat_admin_theme', target);
  themeIcon.textContent = target === 'light' ? '🌙' : '☀️';
});

// Tab Switching
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
      state.activeTab = targetId;

      // Update Topbar View Title
      const tabTitles = {
        'tab-overview': 'Overview',
        'tab-attendees': 'Participants',
        'tab-sessions': 'Event Sessions',
        'tab-reports': 'Reports',
        'tab-sheets': 'Integrations',
        'tab-audit': 'Audit Logs'
      };
      const titleElem = document.getElementById('current-view-title');
      if (titleElem && tabTitles[targetId]) {
        titleElem.textContent = tabTitles[targetId];
      }

      // Close mobile sidebar if open
      if (window.closeMobileSidebar) {
        window.closeMobileSidebar();
      }

      // Load specific tab data
      if (targetId === 'tab-overview') loadDashboardStats();
      if (targetId === 'tab-attendees') loadAttendees();
      if (targetId === 'tab-sessions') loadSessions();
      if (targetId === 'tab-reports') loadReportsTab();
      if (targetId === 'tab-sheets') loadGoogleSheetsTab();
      if (targetId === 'tab-audit') loadAuditLogs();
    });
  });
}

// HTML Escaping Helper
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

// Canonical Innovation Track Formatter
function canonicalTrackName(rawTrack) {
  if (!rawTrack) return 'General';
  const str = String(rawTrack).trim();
  const lower = str.toLowerCase();
  if (lower.includes('safe reporting') || lower === 'track 1' || lower === 'track 01') {
    return 'Track 1 \u2013 Safe Reporting & Digital Protection';
  }
  if (lower.includes('information & support') || lower.includes('information and support') || lower.includes('ai-powered') || lower === 'track 2' || lower === 'track 02') {
    return 'Track 2 \u2013 AI-Powered Information & Support';
  }
  if (lower.includes('service coordination') || lower.includes('access to support') || lower === 'track 3' || lower === 'track 03') {
    return 'Track 3 \u2013 Access to Support & Service Coordination';
  }
  if (lower.includes('prevention, awareness') || lower.includes('online safety') || lower === 'track 4' || lower === 'track 04') {
    return 'Track 4 \u2013 Prevention, Awareness & Online Safety';
  }
  return str;
}

// Reusable Toast Notification System
window.showToast = function(message, type = 'info', duration = 3500) {
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
};

// =============================================================================
// TAB 1: OVERVIEW & ANALYTICS
// =============================================================================
function resetDashboardStats() {
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setTxt('stat-total-registrations', '0');
  setTxt('stat-individual-regs', '0 Individual');
  setTxt('stat-team-regs', '0 Teams');
  setTxt('stat-total-attendees', '0');
  setTxt('stat-verified-count', '0 Verified');
  setTxt('stat-pending-count', '0 Pending');
  setTxt('stat-verification-rate', '0%');
  const progV = document.getElementById('stat-verification-progress');
  if (progV) progV.style.width = '0%';
  setTxt('stat-checkin-rate', '0%');
  const progC = document.getElementById('stat-checkin-progress');
  if (progC) progC.style.width = '0%';
  setTxt('stat-checkin-meta', '0 checked in • 0 remaining');
  setTxt('overview-pathway-ratio', '0 Ind / 0 Teams');
  setTxt('overview-pathway-detail', '0 total registrations');
  setTxt('overview-verified-ratio', '0%');
  setTxt('overview-active-tickets', '0 Active');
  setTxt('overview-revoked-tickets', '0 revoked passes');
  setTxt('overview-checkin-status', 'Ready');
  setTxt('attendees-total-badge', '0 Participants');
  const sidebarPill = document.getElementById('sidebar-attendees-pill');
  if (sidebarPill) sidebarPill.textContent = '0';
  const trackGrid = document.getElementById('tracks-breakdown-grid');
  if (trackGrid) trackGrid.innerHTML = '<p style="color: var(--admin-text-muted); font-size: 0.85rem;">No registration data recorded yet.</p>';
}

async function loadDashboardStats() {
  resetDashboardStats();
  try {
    const res = await fetch('/api/admin/stats', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.stats) return;

    const s = data.stats;

    // Registrations Card
    document.getElementById('stat-total-registrations').textContent = s.registrations.total;
    document.getElementById('stat-individual-regs').textContent = `${s.registrations.individual} Individual`;
    document.getElementById('stat-team-regs').textContent = `${s.registrations.team} Teams`;

    // Attendees Card
    document.getElementById('stat-total-attendees').textContent = s.attendees.total;
    document.getElementById('stat-verified-count').textContent = `${s.attendees.verified} Verified`;
    document.getElementById('stat-pending-count').textContent = `${s.attendees.pending} Pending`;

    // Verification Rate
    document.getElementById('stat-verification-rate').textContent = `${s.attendees.verificationRate}%`;
    document.getElementById('stat-verification-progress').style.width = `${s.attendees.verificationRate}%`;

    // Active Check-in Rate
    document.getElementById('stat-checkin-rate').textContent = `${s.checkIns.checkInRate}%`;
    document.getElementById('stat-checkin-progress').style.width = `${s.checkIns.checkInRate}%`;
    document.getElementById('stat-checkin-meta').textContent = `${s.checkIns.checkedIn} checked in • ${s.checkIns.remaining} remaining`;

    // Registration and Attendance Snapshot
    const pathwayRatioEl = document.getElementById('overview-pathway-ratio');
    if (pathwayRatioEl && s.registrations) {
      pathwayRatioEl.textContent = `${s.registrations.individual} Ind / ${s.registrations.team} Teams`;
    }
    const pathwayDetailEl = document.getElementById('overview-pathway-detail');
    if (pathwayDetailEl && s.registrations) {
      pathwayDetailEl.textContent = `${s.registrations.total} total registrations`;
    }

    const verifiedRatioEl = document.getElementById('overview-verified-ratio');
    if (verifiedRatioEl && s.attendees) {
      verifiedRatioEl.textContent = `${s.attendees.verificationRate}%`;
    }

    const activeTicketsEl = document.getElementById('overview-active-tickets');
    if (activeTicketsEl && s.tickets) {
      activeTicketsEl.textContent = `${s.tickets.active} Active`;
    }
    const revokedTicketsEl = document.getElementById('overview-revoked-tickets');
    if (revokedTicketsEl && s.tickets) {
      revokedTicketsEl.textContent = `${s.tickets.revoked} revoked passes`;
    }

    const checkinStatusEl = document.getElementById('overview-checkin-status');
    if (checkinStatusEl && s.checkIns) {
      checkinStatusEl.textContent = `${s.checkIns.checkInRate}% Checked In`;
    }
    const sessionNameEl = document.getElementById('overview-session-name');
    if (sessionNameEl) {
      sessionNameEl.textContent = s.checkIns && s.checkIns.activeSession ? s.checkIns.activeSession.sessionName : 'No active session target';
    }

    // Header active session text
    if (s.checkIns.activeSession) {
      state.activeSession = s.checkIns.activeSession;
      const sessionLabel = `${s.checkIns.activeSession.sessionName} (${s.checkIns.activeSession.eventDate})`;
      document.getElementById('header-active-session').textContent = sessionLabel;
      const pillElem = document.querySelector('.topbar-session-pill');
      if (pillElem) pillElem.title = `Active Target Session: ${sessionLabel}`;
    } else {
      document.getElementById('header-active-session').innerHTML = '<span style="color: var(--admin-warning);">⚠️ No active event session</span>';
    }

    // Sidebar attendees count badge
    const sidebarPill = document.getElementById('sidebar-attendees-pill');
    if (sidebarPill && s.attendees.total !== undefined) {
      sidebarPill.textContent = `${s.attendees.total}`;
    }

    // Track Breakdown Grid
    const trackGrid = document.getElementById('tracks-breakdown-grid');
    const tracks = Object.entries(s.trackBreakdown || {});
    const tracksBadge = document.getElementById('tracks-total-badge');
    if (tracksBadge && tracks.length > 0) {
      tracksBadge.textContent = `${tracks.length} Innovation Tracks`;
    }

    if (tracks.length === 0) {
      trackGrid.innerHTML = '<p style="color: var(--admin-text-muted);">No track data available yet.</p>';
    } else {
      trackGrid.innerHTML = tracks.map(([trackName, count]) => {
        const pct = s.attendees.total > 0 ? Math.round((count / s.attendees.total) * 100) : 0;
        return `
          <div class="track-progress-row">
            <div class="track-info-header">
              <span class="track-name-label">${escapeHtml(trackName)}</span>
              <span class="track-count-badge">${count} <small style="font-weight: 500; color: var(--admin-text-muted);">(${pct}%)</small></span>
            </div>
            <div class="progress-bar-bg" style="height: 6px;">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.warn('API endpoint unreachable, fetching stats directly from Supabase...', err.message);
    const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (client) {
      try {
        const { count: totalReg } = await client.from('registrations').select('*', { count: 'exact', head: true });
        const { count: indReg } = await client.from('registrations').select('*', { count: 'exact', head: true }).eq('pathway', 'INDIVIDUAL');
        const { count: teamReg } = await client.from('registrations').select('*', { count: 'exact', head: true }).eq('pathway', 'TEAM');
        const { count: totalAtt } = await client.from('attendees').select('*', { count: 'exact', head: true });
        const { count: checkedIn } = await client.from('attendance').select('*', { count: 'exact', head: true });

        const totalR = totalReg || 0;
        const totalA = totalAtt || 0;
        const checkCount = checkedIn || 0;

        document.getElementById('stat-total-registrations').textContent = totalR;
        document.getElementById('stat-individual-regs').textContent = `${indReg || 0} Individual`;
        document.getElementById('stat-team-regs').textContent = `${teamReg || 0} Teams`;

        document.getElementById('stat-total-attendees').textContent = totalA;
        document.getElementById('stat-verified-count').textContent = `${totalA} Verified`;
        document.getElementById('stat-pending-count').textContent = `0 Pending`;

        const checkInRate = totalA > 0 ? Math.round((checkCount / totalA) * 100) : 0;
        document.getElementById('stat-checkin-rate').textContent = `${checkInRate}%`;
        document.getElementById('stat-checkin-progress').style.width = `${checkInRate}%`;
        document.getElementById('stat-checkin-meta').textContent = `${checkCount} checked in`;

        const sidebarPill = document.getElementById('sidebar-attendees-pill');
        if (sidebarPill) sidebarPill.textContent = `${totalA}`;
        return;
      } catch (supaErr) {
        console.error('Supabase stats error:', supaErr);
      }
    }
    resetDashboardStats();
  }
}

// =============================================================================
// TAB 2: ATTENDEES DIRECTORY (PHASE 2 PREMIUM WORKSPACE)
// =============================================================================
let attendeeSearchTimeout = null;

function getInitials(name) {
  if (!name) return 'P';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function renderPagination(currentPage, totalPages) {
  const container = document.getElementById('pagination-pages');
  if (!container) return;
  container.innerHTML = '';

  if (totalPages <= 1) return;

  const createPageBtn = (pageNum, text = null, isActive = false) => {
    const btn = document.createElement('button');
    btn.className = `page-btn ${isActive ? 'active' : ''}`;
    btn.textContent = text || pageNum;
    btn.type = 'button';
    if (!isActive) {
      btn.addEventListener('click', () => {
        state.attendees.page = pageNum;
        loadAttendees();
      });
    }
    return btn;
  };

  const createEllipsis = () => {
    const span = document.createElement('span');
    span.style.color = 'var(--admin-text-muted)';
    span.style.padding = '0 0.25rem';
    span.textContent = '…';
    return span;
  };

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      container.appendChild(createPageBtn(i, null, i === currentPage));
    }
  } else {
    container.appendChild(createPageBtn(1, null, 1 === currentPage));

    if (currentPage > 3) {
      container.appendChild(createEllipsis());
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      container.appendChild(createPageBtn(i, null, i === currentPage));
    }

    if (currentPage < totalPages - 2) {
      container.appendChild(createEllipsis());
    }

    container.appendChild(createPageBtn(totalPages, null, totalPages === currentPage));
  }
}

async function loadAttendees() {
  const tbody = document.getElementById('attendees-table-body');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--admin-text-muted);">Loading participants directory...</td></tr>`;

  const queryParams = new URLSearchParams({
    page: state.attendees.page,
    limit: state.attendees.limit,
    search: state.attendees.search,
    pathway: state.attendees.pathway,
    track: state.attendees.track,
    verified: state.attendees.verified,
    ticketStatus: state.attendees.ticketStatus,
    status: state.attendees.status,
    sortBy: state.attendees.sortBy,
    sortOrder: state.attendees.sortOrder
  });

  try {
    const res = await fetch(`/api/admin/attendees?${queryParams.toString()}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();

    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--admin-danger);">${escapeHtml(data.error || 'Failed to load attendees.')}</td></tr>`;
      return;
    }

    state.attendees.total = data.pagination.total;
    state.attendees.totalPages = data.pagination.totalPages;

    document.getElementById('attendees-total-badge').textContent = `${data.pagination.total} Participants`;
    const sidebarPill = document.getElementById('sidebar-attendees-pill');
    if (sidebarPill) sidebarPill.textContent = `${data.pagination.total}`;

    const startIdx = data.pagination.total > 0 ? (data.pagination.page - 1) * state.attendees.limit + 1 : 0;
    const endIdx = Math.min(data.pagination.page * state.attendees.limit, data.pagination.total);
    document.getElementById('pagination-info').textContent = `Showing ${startIdx}–${endIdx} of ${data.pagination.total} participants (Page ${data.pagination.page} of ${data.pagination.totalPages})`;
    
    document.getElementById('prev-page-btn').disabled = data.pagination.page <= 1;
    document.getElementById('next-page-btn').disabled = data.pagination.page >= data.pagination.totalPages;

    renderPagination(data.pagination.page, data.pagination.totalPages);

    if (!data.attendees.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--admin-text-muted);">
        <div style="font-size: 1.1rem; font-weight: 600; color: var(--admin-text-secondary); margin-bottom: 0.35rem;">No matching participants found</div>
        <div style="font-size: 0.85rem;">Try adjusting or clearing your search keywords and filter criteria.</div>
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.attendees.map(a => {
      const isVerified = a.emailVerified;
      const t = a.ticket;

      // Participant Attendance Status Calculation
      let statusBadge = '';
      if (a.checkInCount > 0) {
        statusBadge = `
          <div>
            <span class="badge badge-success" title="Participant has successfully checked in (${a.checkInCount} check-in event(s))">
              ✓ Checked In
            </span>
            ${a.checkInCount > 1 ? `<div style="font-size: 0.72rem; color: var(--admin-text-muted); margin-top: 0.15rem;">${a.checkInCount} check-ins</div>` : ''}
          </div>
        `;
      } else {
        statusBadge = `
          <div>
            <span class="badge badge-warning" style="background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25);" title="Participant has registered but has not checked in">
              Not Checked In
            </span>
            <div style="font-size: 0.7rem; color: #2563eb; font-weight: 500; margin-top: 0.15rem;">● Registered</div>
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <div class="participant-cell">
              <div class="participant-avatar">${escapeHtml(getInitials(a.fullName))}</div>
              <div class="participant-info">
                <div class="participant-name">
                  <span>${escapeHtml(a.fullName)}</span>
                  ${a.isTeamLeader ? '<span class="badge badge-teal" style="font-size: 0.65rem; margin-left: 0.25rem;">LEADER</span>' : ''}
                </div>
                <div class="participant-email" title="${escapeHtml(a.email)}">${escapeHtml(a.email)}</div>
                ${a.phone ? `<div class="participant-phone">${escapeHtml(a.phone)}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="ref-code-chip">${escapeHtml(a.registration.referenceCode)}</span>
          </td>
          <td>
            <span class="badge ${a.registration.pathway === 'INDIVIDUAL' ? 'badge-primary' : 'badge-teal'}">
              ${a.registration.pathway}
            </span>
            ${a.team ? `<div style="font-size: 0.825rem; font-weight: 600; color: var(--admin-text-primary); margin-top: 0.25rem;">${escapeHtml(a.team.teamName)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 0.85rem; color: var(--admin-text-primary); font-weight: 500;">${escapeHtml(canonicalTrackName(a.track))}</div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 0.15rem;">${escapeHtml(a.discipline || 'General Participant')}</div>
          </td>
          <td>
            ${isVerified 
              ? '<span class="badge badge-success">✓ Verified</span>' 
              : '<span class="badge badge-warning">⏳ Pending</span>'
            }
          </td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">
            <div class="action-dropdown">
              <button type="button" class="action-dropdown-btn" onclick="toggleRowMenu(event, '${a.id}')" title="Actions menu" aria-label="Participant actions">
                •••
              </button>
              <div class="action-dropdown-menu" id="menu-${a.id}">
                <button type="button" class="action-dropdown-item" onclick="openAttendeeModal('${a.id}')">
                  <span>👁️ View Details</span>
                </button>
                ${!isVerified ? `
                  <button type="button" class="action-dropdown-item" onclick="resendVerificationLink('${a.id}')">
                    <span>✉️ Resend Verification</span>
                  </button>` : ''}
                ${t && t.status === 'ACTIVE' ? `
                  <button type="button" class="action-dropdown-item" onclick="resendTicketPass('${a.id}')">
                    <span>🎟️ Resend Ticket</span>
                  </button>
                  <button type="button" class="action-dropdown-item" style="color: var(--admin-danger);" onclick="openRevokeModal('${t.id}')">
                    <span>⚠️ Revoke Ticket</span>
                  </button>` : ''}
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    updateFilterChips();
  } catch (err) {
    console.warn('API endpoint unreachable, loading attendees directly from Supabase...', err.message);
    const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (client) {
      try {
        let query = client.from('attendees').select('*, registrations(*), teams(*)');
        if (state.attendees.search) {
          query = query.ilike('full_name', `%${state.attendees.search}%`);
        }
        if (state.attendees.pathway) {
          query = query.eq('pathway', state.attendees.pathway.toUpperCase());
        }
        const { data: attendees, error } = await query;
        if (!error && attendees) {
          state.attendees.total = attendees.length;
          state.attendees.totalPages = Math.ceil(attendees.length / state.attendees.limit) || 1;
          document.getElementById('attendees-total-badge').textContent = `${attendees.length} Participants`;
          const sidebarPill = document.getElementById('sidebar-attendees-pill');
          if (sidebarPill) sidebarPill.textContent = `${attendees.length}`;

          if (!attendees.length) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--admin-text-muted);">
              <div style="font-size: 1.1rem; font-weight: 600; color: var(--admin-text-secondary); margin-bottom: 0.35rem;">No matching participants found</div>
              <div style="font-size: 0.85rem;">Try adjusting your search criteria.</div>
            </td></tr>`;
            return;
          }

          tbody.innerHTML = attendees.map(a => {
            const refCode = a.registrations?.reference_code || a.ticket_code || 'BE-2026';
            const teamName = a.teams?.team_name || '';
            const pathway = a.pathway || (teamName ? 'TEAM' : 'INDIVIDUAL');
            return `
              <tr>
                <td>
                  <div class="participant-name-group">
                    <div class="participant-avatar">${escapeHtml(a.full_name ? a.full_name.charAt(0).toUpperCase() : 'P')}</div>
                    <div>
                      <div class="participant-name">${escapeHtml(a.full_name || 'Participant')}</div>
                      <div class="participant-email">${escapeHtml(a.email || '')}</div>
                      ${a.phone ? `<div class="participant-phone">${escapeHtml(a.phone)}</div>` : ''}
                    </div>
                  </div>
                </td>
                <td><span class="ref-code-chip">${escapeHtml(refCode)}</span></td>
                <td>
                  <span class="badge ${pathway === 'INDIVIDUAL' ? 'badge-primary' : 'badge-teal'}">${pathway}</span>
                  ${teamName ? `<div style="font-size:0.8rem;font-weight:600;margin-top:0.25rem;">${escapeHtml(teamName)}</div>` : ''}
                </td>
                <td>
                  <div style="font-size:0.85rem;font-weight:500;">${escapeHtml(a.preferred_track || 'Confidential Reporting')}</div>
                  <div style="font-size:0.75rem;color:var(--admin-text-muted);">${escapeHtml(a.discipline || 'Developer')}</div>
                </td>
                <td><span class="badge badge-success">✓ Verified</span></td>
                <td><span class="badge badge-info">Active</span></td>
                <td style="text-align:right;">
                  <button type="button" class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${refCode}')">Copy Ref</button>
                </td>
              </tr>
            `;
          }).join('');
          return;
        }
      } catch (supaErr) {
        console.error('Supabase attendee fetch error:', supaErr);
      }
    }
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--admin-danger);">Network or server error while loading directory.</td></tr>`;
  }
}

// Row Actions Dropdown Toggle & Click-Outside Handler
window.toggleRowMenu = function(e, id) {
  e.stopPropagation();
  const menu = document.getElementById(`menu-${id}`);
  const wasShown = menu && menu.classList.contains('show');
  document.querySelectorAll('.action-dropdown-menu.show').forEach(m => m.classList.remove('show'));
  if (!wasShown && menu) {
    menu.classList.add('show');
  }
};

document.addEventListener('click', (e) => {
  if (!e.target.closest('.action-dropdown')) {
    document.querySelectorAll('.action-dropdown-menu.show').forEach(m => m.classList.remove('show'));
  }
});

// Active Filter Chips Manager
function updateFilterChips() {
  const chipsContainer = document.getElementById('filter-chips-bar');
  const countBadge = document.getElementById('active-filter-count');
  if (!chipsContainer) return;

  const chips = [];

  if (state.attendees.search) {
    chips.push({
      key: 'search',
      label: `Search: "${state.attendees.search}"`,
      clear: () => {
        state.attendees.search = '';
        const searchInput = document.getElementById('attendees-search');
        if (searchInput) searchInput.value = '';
      }
    });
  }
  if (state.attendees.pathway) {
    chips.push({
      key: 'pathway',
      label: `Pathway: ${state.attendees.pathway === 'INDIVIDUAL' ? 'Individual' : 'Team'}`,
      clear: () => {
        state.attendees.pathway = '';
        const el = document.getElementById('filter-pathway');
        if (el) el.value = '';
      }
    });
  }
  if (state.attendees.track) {
    chips.push({
      key: 'track',
      label: `Track: ${state.attendees.track}`,
      clear: () => {
        state.attendees.track = '';
        const el = document.getElementById('filter-track');
        if (el) el.value = '';
      }
    });
  }
  if (state.attendees.verified) {
    chips.push({
      key: 'verified',
      label: state.attendees.verified === 'true' ? 'Verified' : 'Pending',
      clear: () => {
        state.attendees.verified = '';
        const el = document.getElementById('filter-verified');
        if (el) el.value = '';
      }
    });
  }
  if (state.attendees.status) {
    chips.push({
      key: 'status',
      label: `Status: ${state.attendees.status === 'CHECKED_IN' ? 'Checked In' : 'Not Checked In'}`,
      clear: () => {
        state.attendees.status = '';
        const el = document.getElementById('filter-participant-status');
        if (el) el.value = '';
        state.attendees.page = 1;
        loadAttendees();
      }
    });
  }
  if (state.attendees.ticketStatus) {
    chips.push({
      key: 'ticketStatus',
      label: `Ticket: ${state.attendees.ticketStatus === 'ACTIVE' ? 'Active' : 'Revoked'}`,
      clear: () => {
        state.attendees.ticketStatus = '';
        const el = document.getElementById('filter-ticket-status');
        if (el) el.value = '';
        state.attendees.page = 1;
        loadAttendees();
      }
    });
  }

  const filterCount = chips.length;
  if (countBadge) {
    if (filterCount > 0) {
      countBadge.textContent = filterCount;
      countBadge.style.display = 'inline-flex';
    } else {
      countBadge.style.display = 'none';
    }
  }

  if (chips.length === 0) {
    chipsContainer.innerHTML = '';
    return;
  }

  chipsContainer.innerHTML = chips.map((chip, idx) => `
    <span class="filter-chip">
      <span>${escapeHtml(chip.label)}</span>
      <button type="button" class="filter-chip-remove" data-chip-idx="${idx}" aria-label="Remove filter">&times;</button>
    </span>
  `).join('') + `<button type="button" class="filter-clear-all" id="clear-all-chips-btn">Clear all</button>`;

  chipsContainer.querySelectorAll('.filter-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-chip-idx'), 10);
      chips[idx].clear();
      state.attendees.page = 1;
      updateFilterChips();
      loadAttendees();
    });
  });

  const clearAllBtn = document.getElementById('clear-all-chips-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      document.getElementById('reset-filters-btn').click();
    });
  }
}

// Filter Panel Expand/Collapse Toggle
const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
const filtersPanel = document.getElementById('filters-panel');
if (toggleFiltersBtn && filtersPanel) {
  toggleFiltersBtn.addEventListener('click', () => {
    filtersPanel.classList.toggle('is-open');
    toggleFiltersBtn.classList.toggle('active', filtersPanel.classList.contains('is-open'));
  });
}

// Attendee directory filter & search listeners
document.getElementById('attendees-search').addEventListener('input', (e) => {
  clearTimeout(attendeeSearchTimeout);
  attendeeSearchTimeout = setTimeout(() => {
    state.attendees.search = e.target.value.trim();
    state.attendees.page = 1;
    loadAttendees();
  }, 250);
});

document.getElementById('filter-pathway').addEventListener('change', (e) => {
  state.attendees.pathway = e.target.value;
  state.attendees.page = 1;
  loadAttendees();
});

const filterTrackEl = document.getElementById('filter-track');
if (filterTrackEl) {
  filterTrackEl.addEventListener('change', (e) => {
    state.attendees.track = e.target.value;
    state.attendees.page = 1;
    loadAttendees();
  });
}

document.getElementById('filter-verified').addEventListener('change', (e) => {
  state.attendees.verified = e.target.value;
  state.attendees.page = 1;
  loadAttendees();
});

const filterParticipantStatusEl = document.getElementById('filter-participant-status');
if (filterParticipantStatusEl) {
  filterParticipantStatusEl.addEventListener('change', (e) => {
    state.attendees.status = e.target.value;
    state.attendees.page = 1;
    loadAttendees();
  });
}

const filterTicketStatusEl = document.getElementById('filter-ticket-status');
if (filterTicketStatusEl) {
  filterTicketStatusEl.addEventListener('change', (e) => {
    state.attendees.ticketStatus = e.target.value;
    state.attendees.page = 1;
    loadAttendees();
  });
}

const filterSortEl = document.getElementById('filter-sort');
if (filterSortEl) {
  filterSortEl.addEventListener('change', (e) => {
    const [sortBy, sortOrder] = e.target.value.split(':');
    state.attendees.sortBy = sortBy || 'created_at';
    state.attendees.sortOrder = sortOrder || 'DESC';
    state.attendees.page = 1;
    loadAttendees();
  });
}

const filterLimitEl = document.getElementById('filter-limit');
if (filterLimitEl) {
  filterLimitEl.addEventListener('change', (e) => {
    state.attendees.limit = parseInt(e.target.value, 10) || 20;
    state.attendees.page = 1;
    loadAttendees();
  });
}

document.getElementById('reset-filters-btn').addEventListener('click', () => {
  document.getElementById('attendees-search').value = '';
  document.getElementById('filter-pathway').value = '';
  if (filterTrackEl) filterTrackEl.value = '';
  document.getElementById('filter-verified').value = '';
  if (filterTicketStatusEl) filterTicketStatusEl.value = '';
  if (filterParticipantStatusEl) filterParticipantStatusEl.value = '';
  if (filterSortEl) filterSortEl.value = 'created_at:DESC';
  if (filterLimitEl) filterLimitEl.value = '20';

  state.attendees.search = '';
  state.attendees.pathway = '';
  state.attendees.track = '';
  state.attendees.verified = '';
  state.attendees.ticketStatus = '';
  state.attendees.status = '';
  state.attendees.sortBy = 'created_at';
  state.attendees.sortOrder = 'DESC';
  state.attendees.limit = 20;
  state.attendees.page = 1;
  loadAttendees();
});

document.getElementById('prev-page-btn').addEventListener('click', () => {
  if (state.attendees.page > 1) {
    state.attendees.page--;
    loadAttendees();
  }
});

document.getElementById('next-page-btn').addEventListener('click', () => {
  if (state.attendees.page < state.attendees.totalPages) {
    state.attendees.page++;
    loadAttendees();
  }
});

// Attendee Slide-Over Drawer Modal
const attendeeModal = document.getElementById('attendee-modal');
const attendeeModalBody = document.getElementById('attendee-modal-body');
const attendeeModalFooter = document.getElementById('attendee-modal-footer');

if (attendeeModal) {
  attendeeModal.addEventListener('click', (e) => {
    if (e.target === attendeeModal) {
      closeAttendeeModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (attendeeModal && attendeeModal.classList.contains('show')) closeAttendeeModal();
    if (revokeModal && revokeModal.classList.contains('show')) closeRevokeModal();
    if (typeof createSessionModal !== 'undefined' && createSessionModal.classList.contains('show')) closeCreateSessionModal();
    if (typeof closeEditSessionModal === 'function') closeEditSessionModal();
    if (typeof closeSessionAttendanceModal === 'function') closeSessionAttendanceModal();
  }
});

window.copyTicketCode = function(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => {
      showToast(`Ticket pass code ${code} copied to clipboard!`, 'success');
    }).catch(() => {
      prompt('Copy ticket code:', code);
    });
  } else {
    prompt('Copy ticket code:', code);
  }
};

window.openAttendeeModal = async function(id) {
  attendeeModal.classList.add('show');
  attendeeModalBody.innerHTML = `
    <div style="text-align: center; padding: 4rem 1rem; color: var(--admin-text-muted);">
      <div style="font-size: 2rem; margin-bottom: 0.75rem;">⏳</div>
      <div style="font-weight: 600; color: var(--admin-text-primary);">Loading participant profile & ticket credentials...</div>
      <div style="font-size: 0.8rem; margin-top: 0.25rem;">Fetching Supabase records and check-in audit logs</div>
    </div>
  `;

  try {
    const res = await fetch(`/api/admin/attendees/${id}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.attendee) {
      attendeeModalBody.innerHTML = `<div style="color: var(--admin-danger); text-align: center; padding: 2rem;">${escapeHtml(data.error || 'Failed to load attendee.')}</div>`;
      return;
    }

    const a = data.attendee;
    const t = a.ticket;

    // 1. Digital Ticket Pass Card
    let ticketHtml = '';
    if (t) {
      ticketHtml = `
        <div class="drawer-section">
          <div class="drawer-section-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"></rect>
              <line x1="7" y1="8" x2="17" y2="8"></line>
              <line x1="7" y1="12" x2="17" y2="12"></line>
              <line x1="7" y1="16" x2="12" y2="16"></line>
            </svg>
            <span>Official Event Ticket Pass</span>
          </div>
          <div class="drawer-pass-card">
            ${t.qrData 
              ? `<div class="drawer-qr-container">
                   <img src="${t.qrData}" alt="QR Ticket Pass" class="drawer-qr-img">
                 </div>` 
              : ''
            }
            <div style="flex: 1; min-width: 180px;">
              <div style="font-size: 0.75rem; color: var(--admin-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Ticket Code & Credential</div>
              <div style="font-size: 1.35rem; font-weight: 800; color: var(--admin-primary); font-family: var(--admin-font-mono); margin: 0.15rem 0 0.5rem 0; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span>${escapeHtml(t.ticketCode)}</span>
                <button type="button" class="btn btn-secondary btn-sm" onclick="copyTicketCode('${t.ticketCode}')" title="Copy ticket code" style="padding: 0.15rem 0.45rem; font-size: 0.72rem;">
                  Copy
                </button>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem; font-size: 0.8rem; margin-top: 0.4rem;">
                <span class="badge ${t.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${t.status}</span>
                <span style="color: var(--admin-text-muted); font-size: 0.75rem;">Issued: ${t.generatedAt ? new Date(t.generatedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
              ${t.status === 'REVOKED' ? `
                <div style="margin-top: 0.75rem; background: var(--admin-danger-light); border: 1px solid var(--admin-danger-border); padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.8rem; color: var(--admin-danger);">
                  <strong>Revocation Reason:</strong> ${escapeHtml(t.revokedReason || 'N/A')}
                  ${t.revokedAt ? `<div style="font-size: 0.72rem; margin-top: 0.2rem; opacity: 0.85;">Revoked on ${new Date(t.revokedAt).toLocaleString()}</div>` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    } else {
      ticketHtml = `
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Official Event Ticket Pass</span>
          </div>
          <div style="background: var(--admin-card); padding: 1.1rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border); color: var(--admin-text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
            <div style="font-size: 1.5rem;">ℹ️</div>
            <div>
              <strong style="color: var(--admin-text-secondary); display: block; margin-bottom: 0.2rem;">No Ticket Issued Yet</strong>
              Ticket passes with QR credentials are automatically generated once the attendee verifies their email address.
            </div>
          </div>
        </div>
      `;
    }

    // 2. Team Roster Section (if applicable)
    let teamRosterHtml = '';
    if (a.team && a.team.members && a.team.members.length > 0) {
      teamRosterHtml = `
        <div class="drawer-section">
          <div class="drawer-section-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Team Roster: ${escapeHtml(a.team.teamName)} (${a.team.members.length} members)</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${a.team.members.map(m => `
              <div class="member-item">
                <div>
                  <strong style="color: var(--admin-text-primary); font-size: 0.875rem;">${escapeHtml(m.fullName)}</strong>
                  ${m.isTeamLeader ? '<span class="badge badge-teal" style="font-size: 0.65rem; margin-left: 0.35rem;">LEADER</span>' : ''}
                  <div style="color: var(--admin-text-secondary); font-size: 0.75rem; margin-top: 0.15rem;">
                    ${escapeHtml(m.email)} &bull; ${escapeHtml(m.discipline || 'Member')}
                  </div>
                </div>
                <span class="badge ${m.emailVerified ? 'badge-success' : 'badge-warning'}">
                  ${m.emailVerified ? '✓ Verified' : 'Pending'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 3. Physical Event Check-In History
    let checkInsHtml = '';
    if (a.checkIns && a.checkIns.length > 0) {
      checkInsHtml = `
        <div class="drawer-section">
          <div class="drawer-section-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
            <span>Event Check-In History (${a.checkIns.length} Session${a.checkIns.length > 1 ? 's' : ''})</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${a.checkIns.map(c => `
              <div class="timeline-item">
                <div>
                  <strong style="color: var(--admin-text-primary); font-size: 0.875rem;">${escapeHtml(c.sessionName)}</strong>
                  <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 0.15rem;">
                    ${new Date(c.checkedInAt).toLocaleString()} &bull; Method: <strong>${c.checkInMethod === 'QR_SCAN' ? '📷 QR Scan' : '✍️ Manual Desk Check-In'}</strong>
                  </div>
                </div>
                <div style="font-size: 0.78rem; color: var(--admin-teal); text-align: right;">
                  <div>Verified By</div>
                  <strong>${escapeHtml(c.staffName || 'Check-in Desk')}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      checkInsHtml = `
        <div class="drawer-section">
          <div class="drawer-section-title">
            <span>Event Check-In History</span>
          </div>
          <p style="color: var(--admin-text-muted); font-size: 0.85rem; margin: 0;">
            No check-in records found for this participant across any event sessions.
          </p>
        </div>
      `;
    }

    // 4. Transactional Email Delivery Logs
    let emailLogsHtml = '';
    if (a.emailLogs && a.emailLogs.length > 0) {
      emailLogsHtml = `
        <div class="drawer-section">
          <div class="drawer-section-title">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            <span>Transactional Email Audit Trail (${a.emailLogs.length})</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${a.emailLogs.map(log => `
              <div class="timeline-item">
                <div>
                  <div style="font-weight: 600; color: var(--admin-text-primary); font-size: 0.85rem;">
                    ${escapeHtml(log.subject || log.emailType)}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--admin-text-muted); margin-top: 0.15rem;">
                    ${log.sentAt ? new Date(log.sentAt).toLocaleString() : 'N/A'}
                  </div>
                </div>
                <span class="badge ${log.deliveryStatus === 'SENT' ? 'badge-success' : log.deliveryStatus === 'FAILED' ? 'badge-danger' : 'badge-warning'}">
                  ${log.deliveryStatus}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Skills breakdown
    let skillsList = [];
    if (a.skills) {
      if (Array.isArray(a.skills)) {
        skillsList = a.skills;
      } else if (typeof a.skills === 'string') {
        try {
          const parsed = JSON.parse(a.skills);
          skillsList = Array.isArray(parsed) ? parsed : a.skills.split(',').map(s => s.trim());
        } catch {
          skillsList = a.skills.split(',').map(s => s.trim());
        }
      }
    }

    attendeeModalBody.innerHTML = `
      <!-- Profile Header -->
      <div class="drawer-profile-header">
        <div class="drawer-avatar">${escapeHtml(getInitials(a.fullName))}</div>
        <div class="drawer-profile-info">
          <div class="drawer-profile-name">${escapeHtml(a.fullName)}</div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.35rem; flex-wrap: wrap;">
            <span class="ref-code-chip">Ref: ${escapeHtml(a.registration.referenceCode)}</span>
            <span class="badge ${a.emailVerified ? 'badge-success' : 'badge-warning'}">
              ${a.emailVerified ? '✓ Verified' : 'Pending Verification'}
            </span>
            <span class="badge ${a.checkInCount > 0 ? 'badge-success' : 'badge-warning'}" style="${a.checkInCount > 0 ? '' : 'background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25);'}">
              ${a.checkInCount > 0 ? '✓ Checked In' : 'Not Checked In'}
            </span>
            <span class="badge badge-neutral" style="color: #2563eb; background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.2);">
              Registered
            </span>
            ${a.isTeamLeader ? '<span class="badge badge-teal">Team Leader</span>' : ''}
          </div>
          <div class="drawer-profile-contacts">
            <span>📧 ${escapeHtml(a.email)}</span>
            ${a.phone ? `<span>📱 ${escapeHtml(a.phone)}</span>` : ''}
            <span>📍 ${escapeHtml(a.city || 'Addis Ababa')}</span>
            <span>📅 Submitted: ${new Date(a.registration.submittedAt || a.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <!-- Ticket Pass Card -->
      ${ticketHtml}

      <!-- Registration & Innovation Profile -->
      <div class="drawer-section">
        <div class="drawer-section-title">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Registration Profile & Innovation Track</span>
        </div>
        <div class="drawer-meta-grid">
          <div class="drawer-meta-item">
            <strong>Participant Status</strong>
            <span class="badge ${a.checkInCount > 0 ? 'badge-success' : 'badge-warning'}" style="${a.checkInCount > 0 ? '' : 'background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25);'}">
              ${a.checkInCount > 0 ? '✓ Checked In (' + a.checkInCount + ' event' + (a.checkInCount > 1 ? 's' : '') + ')' : 'Not Checked In (Registered)'}
            </span>
          </div>
          <div class="drawer-meta-item">
            <strong>Registration Pathway</strong>
            <span class="badge ${a.registration.pathway === 'INDIVIDUAL' ? 'badge-primary' : 'badge-teal'}">${a.registration.pathway}</span>
          </div>
          <div class="drawer-meta-item">
            <strong>Innovation Track</strong>
            <span>${escapeHtml(canonicalTrackName(a.preferredTrack || (a.team && a.team.track) || 'General'))}</span>
          </div>
          <div class="drawer-meta-item">
            <strong>Discipline / Role</strong>
            <span>${escapeHtml(a.discipline || 'General Participant')}</span>
          </div>
          <div class="drawer-meta-item">
            <strong>Experience Level</strong>
            <span>${escapeHtml(a.experienceLevel || 'N/A')}</span>
          </div>
          <div class="drawer-meta-item">
            <strong>City / Location</strong>
            <span>${escapeHtml(a.city || 'Addis Ababa')}</span>
          </div>
          <div class="drawer-meta-item">
            <strong>Registered At</strong>
            <span>${new Date(a.createdAt).toLocaleString()}</span>
          </div>
        </div>

        ${skillsList.length > 0 ? `
          <div style="margin-top: 1rem;">
            <div style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 0.35rem;"><strong>Skills & Competencies</strong></div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">
              ${skillsList.map(s => `<span class="badge badge-neutral" style="font-size: 0.72rem;">${escapeHtml(s)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${a.registration.teamIdea ? `
          <div style="margin-top: 1rem; background: var(--admin-card); padding: 0.85rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border);">
            <div style="font-size: 0.72rem; color: var(--admin-text-muted); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 0.25rem;"><strong>Innovation Idea / Project Proposal</strong></div>
            <div style="font-size: 0.85rem; color: var(--admin-text-primary); line-height: 1.5;">${escapeHtml(a.registration.teamIdea)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Team Roster -->
      ${teamRosterHtml}

      <!-- Event Check-Ins -->
      ${checkInsHtml}

      <!-- Email Audit Logs -->
      ${emailLogsHtml}
    `;

    // Dynamic Action Buttons in Drawer Footer
    let footerBtns = `<button type="button" class="btn btn-secondary" onclick="closeAttendeeModal()">Close</button>`;

    if (!a.emailVerified) {
      footerBtns = `
        <button type="button" class="btn btn-secondary btn-sm" onclick="resendVerificationLink('${a.id}')">
          ✉️ Resend Verification Link
        </button>
        ` + footerBtns;
    } else if (t && t.status === 'ACTIVE') {
      footerBtns = `
        <button type="button" class="btn btn-secondary btn-sm" onclick="resendTicketPass('${a.id}')">
          🎟️ Resend Ticket Pass
        </button>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="openRevokeModal('${t.id}')">
          ⚠️ Revoke Ticket
        </button>
        ` + footerBtns;
    }

    attendeeModalFooter.innerHTML = footerBtns;
  } catch (err) {
    attendeeModalBody.innerHTML = `<div style="color: var(--admin-danger); text-align: center; padding: 2rem;">Error loading attendee profile details.</div>`;
  }
};

window.closeAttendeeModal = function() {
  attendeeModal.classList.remove('show');
};

// Resend Verification Link Action
window.resendVerificationLink = async function(id) {
  if (!confirm('Resend the email verification link to this attendee?')) return;
  try {
    const res = await fetch(`/api/admin/attendees/${id}/resend-verification`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Verification email resent to ${data.result.email}`, 'success');
    } else {
      showToast(data.error || 'Failed to resend verification link.', 'error');
    }
  } catch (e) {
    showToast('Network error while resending verification.', 'error');
  }
};

// Resend Ticket Pass Action
window.resendTicketPass = async function(id) {
  if (!confirm('Resend the official QR ticket pass email to this verified attendee?')) return;
  try {
    const res = await fetch(`/api/admin/attendees/${id}/resend-ticket`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Ticket pass resent to ${data.result.email}`, 'success');
    } else {
      showToast(data.error || 'Failed to resend ticket pass.', 'error');
    }
  } catch (e) {
    showToast('Network error while resending ticket pass.', 'error');
  }
};

// Revoke Ticket Modal
const revokeModal = document.getElementById('revoke-modal');
const revokeReasonInput = document.getElementById('revoke-reason-input');
const confirmRevokeBtn = document.getElementById('confirm-revoke-btn');

window.openRevokeModal = function(ticketId) {
  state.pendingRevokeTicketId = ticketId;
  revokeReasonInput.value = '';
  revokeModal.classList.add('show');
};

window.closeRevokeModal = function() {
  revokeModal.classList.remove('show');
  state.pendingRevokeTicketId = null;
};

if (revokeModal) {
  revokeModal.addEventListener('click', (e) => {
    if (e.target === revokeModal) {
      closeRevokeModal();
    }
  });
}

confirmRevokeBtn.addEventListener('click', async () => {
  const reason = revokeReasonInput.value.trim();
  if (!reason) {
    showToast('A reason is strictly required to revoke a ticket.', 'warning');
    return;
  }

  confirmRevokeBtn.disabled = true;
  try {
    const res = await fetch(`/api/admin/tickets/${state.pendingRevokeTicketId}/revoke`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Ticket revoked successfully.', 'success');
      closeRevokeModal();
      closeAttendeeModal();
      loadAttendees();
      loadDashboardStats();
    } else {
      showToast(data.error || 'Failed to revoke ticket.', 'error');
    }
  } catch (err) {
    showToast('Network error while revoking ticket.', 'error');
  } finally {
    confirmRevokeBtn.disabled = false;
  }
});

// =============================================================================
// TAB 3: EVENT SESSIONS MANAGEMENT
// =============================================================================
async function loadSessions() {
  const tbody = document.getElementById('sessions-table-body');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading event sessions...</td></tr>';

  try {
    const res = await fetch('/api/admin/sessions', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.sessions) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-danger);">' + escapeHtml(data.error || 'Failed to load sessions.') + '</td></tr>';
      return;
    }

    // Populate session dropdown in reports tab as well
    const exportSelect = document.getElementById('export-session-select');
    if (exportSelect) {
      const currentSelected = exportSelect.value;
      exportSelect.innerHTML = '<option value="">Active Session</option>' + 
        data.sessions.map(s => '<option value="' + s.id + '">' + escapeHtml(s.sessionName) + ' (' + escapeHtml(s.eventDate) + ')</option>').join('');
      if (currentSelected) exportSelect.value = currentSelected;

      // Wire change listener once
      if (!exportSelect.dataset.boundChange) {
        exportSelect.dataset.boundChange = 'true';
        exportSelect.addEventListener('change', () => {
          if (typeof loadAttendanceDistribution === 'function') {
            loadAttendanceDistribution(exportSelect.value);
          }
        });
      }
    }

    if (!data.sessions.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">No sessions created yet. Click "+ New Session" to add one.</td></tr>';
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    tbody.innerHTML = data.sessions.map(s => {
      let statusBadge = '';
      if (s.isActive) {
        statusBadge = '<span class="badge badge-success">✓ Active at Desks</span>';
      } else if (s.eventDate < todayStr) {
        statusBadge = '<span class="badge badge-neutral">Completed</span>';
      } else {
        statusBadge = '<span class="badge badge-teal">Upcoming</span>';
      }

      const escapedName = escapeHtml(s.sessionName).replace(/'/g, "\\'");
      const escapedCode = escapeHtml(s.sessionCode);

      return '<tr>' +
        '<td><strong style="color: var(--admin-primary); font-family: monospace;">' + escapedCode + '</strong></td>' +
        '<td><strong style="color: var(--admin-text-primary); font-size: 0.95rem;">' + escapeHtml(s.sessionName) + '</strong></td>' +
        '<td>' + escapeHtml(s.eventDate) + '</td>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-secondary);">' + escapeHtml(s.startTime) + ' &ndash; ' + escapeHtml(s.endTime) + '</td>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-secondary);">' + escapeHtml(s.venueName) + '</td>' +
        '<td><button type="button" class="badge badge-teal" style="cursor: pointer; border: none; font-size: 0.78rem;" onclick="openSessionAttendanceModal(\'' + s.id + '\', \'' + escapedName + '\', \'' + escapedCode + '\')" title="Click to view attending participants">' + s.checkedInCount + ' Scanned &rarr;</button></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="text-align: right;">' +
          '<div class="session-actions-group">' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="openSessionAttendanceModal(\'' + s.id + '\', \'' + escapedName + '\', \'' + escapedCode + '\')" title="View attendees roster">Attendees</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="openEditSessionModal(\'' + s.id + '\', \'' + escapedCode + '\', \'' + escapedName + '\', \'' + escapeHtml(s.eventDate) + '\', \'' + escapeHtml(s.startTime || '') + '\', \'' + escapeHtml(s.endTime || '') + '\', \'' + escapeHtml(s.venueName || '').replace(/'/g, "\\'") + '\')" title="Edit session">Edit</button>' +
            (s.isActive 
              ? '<span style="font-size: 0.8rem; color: var(--admin-success); font-weight: 600; padding: 0.25rem 0.5rem;">Active</span>' 
              : '<button type="button" class="btn btn-secondary btn-sm" onclick="activateSession(\'' + s.id + '\')">Activate</button>'
            ) +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Failed to load sessions.</td></tr>';
  }
}

window.activateSession = async function(id) {
  if (!confirm('Activate this session as the primary check-in target for on-site desks?')) return;
  try {
    const res = await fetch('/api/admin/sessions/' + id + '/activate', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Session activated.', 'success');
      loadSessions();
      loadDashboardStats();
    } else {
      showToast(data.error || 'Failed to activate session.', 'error');
    }
  } catch (e) {
    showToast('Network error while activating session.', 'error');
  }
};

// Create Session Modal
const createSessionModal = document.getElementById('create-session-modal');
const saveSessionBtn = document.getElementById('save-session-btn');

window.openCreateSessionModal = function() {
  document.getElementById('create-session-form').reset();
  createSessionModal.classList.add('show');
};

window.closeCreateSessionModal = function() {
  createSessionModal.classList.remove('show');
};

if (createSessionModal) {
  createSessionModal.addEventListener('click', (e) => {
    if (e.target === createSessionModal) {
      closeCreateSessionModal();
    }
  });
}

if (saveSessionBtn) {
  saveSessionBtn.addEventListener('click', async () => {
    const sessionCode = document.getElementById('session-code-input').value.trim().toUpperCase();
    const sessionName = document.getElementById('session-name-input').value.trim();
    const eventDate = document.getElementById('session-date-input').value;
    const startTime = document.getElementById('session-start-input').value.trim();
    const endTime = document.getElementById('session-end-input').value.trim();
    const venueName = document.getElementById('session-venue-input').value.trim();

    if (!sessionCode || !sessionName || !eventDate) {
      showToast('Session Code, Name, and Event Date are required.', 'warning');
      return;
    }

    saveSessionBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          sessionCode,
          sessionName,
          eventDate,
          startTime,
          endTime,
          venueName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        closeCreateSessionModal();
        loadSessions();
        showToast('Event session created successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to create session.', 'error');
      }
    } catch (e) {
      showToast('Network error while creating session.', 'error');
    } finally {
      saveSessionBtn.disabled = false;
    }
  });
}

// Edit Session Modal
const editSessionModal = document.getElementById('edit-session-modal');
const saveEditSessionBtn = document.getElementById('save-edit-session-btn');

window.openEditSessionModal = function(id, code, name, date, start, end, venue) {
  document.getElementById('edit-session-id-input').value = id;
  document.getElementById('edit-session-code-display').value = code;
  document.getElementById('edit-session-name-input').value = name;
  document.getElementById('edit-session-date-input').value = date;
  document.getElementById('edit-session-start-input').value = start || '08:00 AM';
  document.getElementById('edit-session-end-input').value = end || '06:00 PM';
  document.getElementById('edit-session-venue-input').value = venue || 'Capstone ALX Tech Hub, Lideta';

  if (editSessionModal) editSessionModal.classList.add('show');
};

window.closeEditSessionModal = function() {
  if (editSessionModal) editSessionModal.classList.remove('show');
};

if (editSessionModal) {
  editSessionModal.addEventListener('click', (e) => {
    if (e.target === editSessionModal) {
      closeEditSessionModal();
    }
  });
}

if (saveEditSessionBtn) {
  saveEditSessionBtn.addEventListener('click', async () => {
    const id = document.getElementById('edit-session-id-input').value;
    const sessionName = document.getElementById('edit-session-name-input').value.trim();
    const eventDate = document.getElementById('edit-session-date-input').value;
    const startTime = document.getElementById('edit-session-start-input').value.trim();
    const endTime = document.getElementById('edit-session-end-input').value.trim();
    const venueName = document.getElementById('edit-session-venue-input').value.trim();

    if (!sessionName || !eventDate) {
      showToast('Session Name and Event Date are required.', 'warning');
      return;
    }

    saveEditSessionBtn.disabled = true;
    try {
      const res = await fetch('/api/admin/sessions/' + id, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          sessionName,
          eventDate,
          startTime,
          endTime,
          venueName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        closeEditSessionModal();
        loadSessions();
        showToast('Session updated successfully.', 'success');
      } else {
        showToast(data.error || 'Failed to update session.', 'error');
      }
    } catch (e) {
      showToast('Network error while updating session.', 'error');
    } finally {
      saveEditSessionBtn.disabled = false;
    }
  });
}

// Session Attendance Drilldown Modal
let currentDrilldownSessionId = null;
let currentDrilldownSearch = '';
const sessionAttModal = document.getElementById('session-attendance-modal');
const sessionAttSearchInput = document.getElementById('session-att-search-input');
const sessionAttExportBtn = document.getElementById('session-att-export-btn');

window.openSessionAttendanceModal = async function(sessionId, sessionName, sessionCode) {
  currentDrilldownSessionId = sessionId;
  currentDrilldownSearch = '';
  const titleEl = document.getElementById('session-att-modal-title');
  const subtitleEl = document.getElementById('session-att-modal-subtitle');
  if (sessionAttSearchInput) sessionAttSearchInput.value = '';

  if (titleEl) titleEl.textContent = sessionName + ' (' + sessionCode + ') — Attendance Roster';
  if (subtitleEl) subtitleEl.textContent = 'Viewing verified check-in records for session: ' + sessionName;
  if (sessionAttModal) sessionAttModal.classList.add('show');

  await loadSessionAttendance();
};

window.closeSessionAttendanceModal = function() {
  if (sessionAttModal) sessionAttModal.classList.remove('show');
  currentDrilldownSessionId = null;
};

if (sessionAttModal) {
  sessionAttModal.addEventListener('click', (e) => {
    if (e.target === sessionAttModal) {
      closeSessionAttendanceModal();
    }
  });
}

async function loadSessionAttendance() {
  if (!currentDrilldownSessionId) return;
  const tbody = document.getElementById('session-att-table-body');
  const countBadge = document.getElementById('session-att-modal-count');

  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading attendance records...</td></tr>';

  try {
    const url = '/api/admin/sessions/' + currentDrilldownSessionId + '/attendance?limit=250' + (currentDrilldownSearch ? '&search=' + encodeURIComponent(currentDrilldownSearch) : '');
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.attendees) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">' + escapeHtml(data.error || 'Failed to load attendance records.') + '</td></tr>';
      return;
    }

    if (countBadge) countBadge.textContent = data.pagination.total + ' Scanned';

    if (data.attendees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--admin-text-muted);">' + 
        (currentDrilldownSearch ? 'No attendees match your search in this session.' : 'No attendees have been checked into this session yet.') + 
        '</td></tr>';
      return;
    }

    tbody.innerHTML = data.attendees.map(a => {
      const isQr = a.checkInMethod === 'QR_SCAN';
      const methodBadge = isQr 
        ? '<span class="badge badge-success">📷 QR Scan</span>' 
        : '<span class="badge badge-warning">✍️ Manual Desk</span>';

      return '<tr>' +
        '<td>' +
          '<div style="font-weight: 600; color: var(--admin-text-primary); font-size: 0.88rem;">' + escapeHtml(a.fullName) + '</div>' +
          '<div style="font-size: 0.76rem; color: var(--admin-text-muted);">' + escapeHtml(a.email) + '</div>' +
        '</td>' +
        '<td><span style="font-family: monospace; font-size: 0.8rem; background: var(--admin-card-inner); padding: 0.2rem 0.4rem; border-radius: 4px; border: 1px solid var(--admin-border);">' + escapeHtml(a.referenceId || '-') + '</span></td>' +
        '<td><strong style="font-family: monospace; font-size: 0.82rem; color: var(--admin-primary);">' + escapeHtml(a.ticketCode || '-') + '</strong></td>' +
        '<td>' + methodBadge + '</td>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-secondary); white-space: nowrap;">' + new Date(a.checkedInAt).toLocaleString() + '</td>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-secondary);">' + escapeHtml(a.staffName || 'Check-in Desk') + '</td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Network error while loading session attendance.</td></tr>';
  }
}

// Drilldown Search with Debounce
let drilldownSearchTimer = null;
if (sessionAttSearchInput) {
  sessionAttSearchInput.addEventListener('input', (e) => {
    clearTimeout(drilldownSearchTimer);
    drilldownSearchTimer = setTimeout(() => {
      currentDrilldownSearch = e.target.value.trim();
      loadSessionAttendance();
    }, 280);
  });
}

// Drilldown CSV Export Button
if (sessionAttExportBtn) {
  sessionAttExportBtn.addEventListener('click', async () => {
    if (!currentDrilldownSessionId) return;
    try {
      const res = await fetch('/api/admin/export/attendance?sessionId=' + encodeURIComponent(currentDrilldownSessionId), {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!res.ok) {
        showToast('Failed to export session attendance CSV.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'session_attendance_' + currentDrilldownSessionId + '_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('Session attendance CSV downloaded.', 'success');
    } catch (e) {
      showToast('Network error while exporting CSV.', 'error');
    }
  });
}

// =============================================================================
// TAB 4: REPORTS & EXPORTS
// =============================================================================
async function loadReportsTab() {
  const sessionSelect = document.getElementById('export-session-select');
  const sessionId = sessionSelect ? sessionSelect.value : '';
  await loadAttendanceDistribution(sessionId);
}

// Attendance Method Distribution Loader
window.loadAttendanceDistribution = async function(sessionId = null) {
  const container = document.getElementById('attendance-methods-summary');
  if (!container) return;

  const sessionSelect = document.getElementById('export-session-select');
  const targetId = sessionId !== null ? sessionId : (sessionSelect ? sessionSelect.value : '');

  // Update session label in panel header
  const nameLabel = document.getElementById('attendance-dist-session-name');
  if (nameLabel) {
    if (sessionSelect && sessionSelect.selectedIndex > 0) {
      nameLabel.textContent = sessionSelect.options[sessionSelect.selectedIndex].text;
    } else {
      nameLabel.textContent = 'Active Session';
    }
  }

  container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--admin-text-muted); font-size: 0.85rem;">Loading attendance distribution...</div>';

  try {
    const url = targetId 
      ? '/api/admin/reports/attendance?sessionId=' + encodeURIComponent(targetId) 
      : '/api/admin/reports/attendance';
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.report) {
      container.innerHTML = '<div style="padding: 1.25rem; text-align: center; color: var(--admin-danger); background: var(--admin-card-inner); border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border);">' +
        '<p style="margin-bottom: 0.5rem; font-weight: 500;">Failed to load attendance distribution.</p>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="loadAttendanceDistribution(\'' + escapeHtml(targetId) + '\')">Retry</button>' +
      '</div>';
      return;
    }

    const r = data.report;
    const total = r.totalCheckedIn || 0;
    const qrCount = (r.byMethod && r.byMethod['QR_SCAN']) || 0;
    const manualCount = (r.byMethod && r.byMethod['MANUAL']) || 0;
    const qrPct = total > 0 ? Math.round((qrCount / total) * 100) : 0;
    const manualPct = total > 0 ? Math.round((manualCount / total) * 100) : 0;

    if (total === 0) {
      container.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--admin-text-secondary); background: var(--admin-card-inner); border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border);">' +
        '<p style="font-size: 0.9rem; font-weight: 600; color: var(--admin-text-primary); margin-bottom: 0.25rem;">No Check-In Records Yet</p>' +
        '<p style="font-size: 0.8rem; color: var(--admin-text-muted);">No participants have been checked into this session through camera scanning or manual desk verification.</p>' +
      '</div>';
      return;
    }

    container.innerHTML = '<div class="method-dist-grid">' +
      '<div class="method-dist-card">' +
        '<span class="method-dist-label">Total Successful Check-Ins</span>' +
        '<span class="method-dist-val" style="color: var(--admin-primary);">' + total + '</span>' +
        '<span class="method-dist-sub">' + (r.totalVerified > 0 ? r.checkInPercentage : 0) + '% of all verified attendees</span>' +
      '</div>' +
      '<div class="method-dist-card">' +
        '<span class="method-dist-label">Camera QR Check-Ins</span>' +
        '<span class="method-dist-val" style="color: var(--admin-success);">' + qrCount + '</span>' +
        '<span class="method-dist-sub">' + qrPct + '% of session check-ins</span>' +
      '</div>' +
      '<div class="method-dist-card">' +
        '<span class="method-dist-label">Manual Desk Check-Ins</span>' +
        '<span class="method-dist-val" style="color: var(--admin-warning);">' + manualCount + '</span>' +
        '<span class="method-dist-sub">' + manualPct + '% of session check-ins</span>' +
      '</div>' +
    '</div>' +
    '<div>' +
      '<div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--admin-text-secondary); margin-bottom: 0.35rem;">' +
        '<span><strong>QR Scan:</strong> ' + qrCount + ' (' + qrPct + '%)</span>' +
        '<span><strong>Manual Desk:</strong> ' + manualCount + ' (' + manualPct + '%)</span>' +
      '</div>' +
      '<div class="method-dist-bar-wrap">' +
        '<div class="method-dist-bar-qr" style="width: ' + qrPct + '%;" title="QR Scan: ' + qrPct + '%"></div>' +
        '<div class="method-dist-bar-manual" style="width: ' + manualPct + '%;" title="Manual Desk: ' + manualPct + '%"></div>' +
      '</div>' +
    '</div>';
  } catch (err) {
    container.innerHTML = '<div style="padding: 1.25rem; text-align: center; color: var(--admin-danger); background: var(--admin-card-inner); border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border);">' +
      '<p style="margin-bottom: 0.5rem; font-weight: 500;">Network error loading attendance distribution.</p>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="loadAttendanceDistribution(\'' + escapeHtml(targetId) + '\')">Retry</button>' +
    '</div>';
  }
};

// Download Attendees CSV (Filter-Aware Export)
window.downloadAttendeesCsv = async function() {
  const hasFilters = Boolean(
    state.attendees.search || 
    state.attendees.pathway || 
    state.attendees.track || 
    state.attendees.verified || 
    state.attendees.ticketStatus ||
    state.attendees.status
  );

  if (!hasFilters) {
    try {
      const res = await fetch('/api/admin/export/attendees', {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!res.ok) {
        showToast('Failed to generate attendees CSV export.', 'error');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'bruh_enat_attendees_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      showToast('Full attendees CSV downloaded.', 'success');
    } catch (e) {
      showToast('Network error while exporting attendees CSV.', 'error');
    }
  } else {
    try {
      const queryParams = new URLSearchParams({
        page: 1,
        limit: 1000,
        search: state.attendees.search,
        pathway: state.attendees.pathway,
        track: state.attendees.track,
        verified: state.attendees.verified,
        ticketStatus: state.attendees.ticketStatus,
        status: state.attendees.status,
        sortBy: state.attendees.sortBy,
        sortOrder: state.attendees.sortOrder
      });

      const res = await fetch('/api/admin/attendees?' + queryParams.toString(), {
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast('Failed to export filtered attendees.', 'error');
        return;
      }

      // Canonical 17-column header matching backend reportService
      const headers = [
        'Reference Code',
        'Pathway',
        'Full Name',
        'Email',
        'Phone',
        'City',
        'Discipline',
        'Experience Level',
        'Track',
        'Team Name',
        'Team Leader',
        'Email Verified',
        'Verified At',
        'Ticket Code',
        'Ticket Status',
        'Check-In Count',
        'Registered At'
      ];

      function escapeCsvCell(val) {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return '"' + str + '"';
      }

      const lines = [headers.map(escapeCsvCell).join(',')];
      for (const a of data.attendees) {
        lines.push([
          escapeCsvCell(a.registration ? a.registration.referenceCode : ''),
          escapeCsvCell(a.registration ? a.registration.pathway : ''),
          escapeCsvCell(a.fullName),
          escapeCsvCell(a.email),
          escapeCsvCell(a.phone || ''),
          escapeCsvCell(a.city || ''),
          escapeCsvCell(a.discipline || ''),
          escapeCsvCell(a.experienceLevel || ''),
          escapeCsvCell(a.track || ''),
          escapeCsvCell(a.team ? a.team.teamName : ''),
          escapeCsvCell(a.isTeamLeader ? 'YES' : 'NO'),
          escapeCsvCell(a.emailVerified ? 'VERIFIED' : 'PENDING'),
          escapeCsvCell(a.emailVerifiedAt || ''),
          escapeCsvCell(a.ticket ? a.ticket.ticketCode : ''),
          escapeCsvCell(a.ticket ? a.ticket.status : 'NOT_ISSUED'),
          escapeCsvCell(a.checkInCount || 0),
          escapeCsvCell(a.createdAt || '')
        ].join(','));
      }

      const csvBlob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bruh_enat_attendees_filtered_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
      showToast('Filtered attendees CSV downloaded.', 'success');
    } catch (e) {
      showToast('Network error while exporting filtered attendees CSV.', 'error');
    }
  }
};

// Download Attendance CSV
window.downloadAttendanceCsv = async function() {
  const sessionSelect = document.getElementById('export-session-select');
  const sessionId = sessionSelect ? sessionSelect.value : '';

  try {
    const res = await fetch('/api/admin/export/attendance?sessionId=' + encodeURIComponent(sessionId), {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!res.ok) {
      showToast('Failed to generate attendance CSV export.', 'error');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bruh_enat_attendance_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    showToast('Session attendance CSV downloaded.', 'success');
  } catch (e) {
    showToast('Network error while exporting attendance CSV.', 'error');
  }
};

// =============================================================================
// TAB 5: SECURITY AUDIT TRAIL
// =============================================================================
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading security audit trail...</td></tr>';

  try {
    const queryParams = new URLSearchParams({
      page: state.audit.page,
      limit: state.audit.limit
    });
    if (state.audit.action) queryParams.set('action', state.audit.action);
    if (state.audit.search) queryParams.set('search', state.audit.search);

    const res = await fetch('/api/admin/audit-logs?' + queryParams.toString(), {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.logs) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">' + escapeHtml(data.error || 'Failed to load logs.') + '</td></tr>';
      return;
    }

    state.audit.total = data.pagination.total;
    state.audit.totalPages = data.pagination.totalPages;

    const countBadge = document.getElementById('audit-count-badge');
    if (countBadge) countBadge.textContent = data.pagination.total + ' Log Entries';

    const pageEl = document.getElementById('audit-current-page');
    if (pageEl) pageEl.textContent = data.pagination.page;

    const totalPagesEl = document.getElementById('audit-total-pages');
    if (totalPagesEl) totalPagesEl.textContent = data.pagination.totalPages;

    const totalRecordsEl = document.getElementById('audit-total-records');
    if (totalRecordsEl) totalRecordsEl.textContent = data.pagination.total;

    const prevBtn = document.getElementById('audit-prev-btn');
    if (prevBtn) prevBtn.disabled = data.pagination.page <= 1;

    const nextBtn = document.getElementById('audit-next-btn');
    if (nextBtn) nextBtn.disabled = data.pagination.page >= data.pagination.totalPages;

    if (!data.logs.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--admin-text-muted);">' +
        (state.audit.search || state.audit.action ? 'No audit logs match the selected filter criteria.' : 'No audit logs recorded yet.') +
        '</td></tr>';
      return;
    }

    tbody.innerHTML = data.logs.map(l => {
      let actionBadge = '<span class="badge badge-neutral">' + escapeHtml(l.action) + '</span>';
      if (l.action.includes('SUCCESS') || l.action.includes('CREATED') || l.action.includes('ACTIVATED') || l.action.includes('UPDATED')) {
        actionBadge = '<span class="badge badge-success">' + escapeHtml(l.action) + '</span>';
      } else if (l.action.includes('FAILED') || l.action.includes('REVOKED')) {
        actionBadge = '<span class="badge badge-danger">' + escapeHtml(l.action) + '</span>';
      } else if (l.action.includes('RESENT') || l.action.includes('MANUAL')) {
        actionBadge = '<span class="badge badge-warning">' + escapeHtml(l.action) + '</span>';
      }

      let detailsHtml = '-';
      if (l.details) {
        const entries = Object.entries(l.details);
        if (entries.length > 0) {
          const detailsStr = entries
            .map(([k, v]) => '<span style="color: var(--admin-text-secondary);">' + escapeHtml(k) + ':</span> ' + escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v))
            .join(' • ');

          if (detailsStr.length > 55 || entries.length > 2) {
            detailsHtml = '<details style="cursor: pointer;">' +
              '<summary style="font-size: 0.78rem; color: var(--admin-primary); font-weight: 500;">View details (' + entries.length + ')</summary>' +
              '<div style="font-size: 0.75rem; color: var(--admin-text-secondary); margin-top: 0.35rem; padding: 0.35rem 0.5rem; background: var(--admin-card-inner); border: 1px solid var(--admin-border); border-radius: var(--admin-radius-xs); line-height: 1.4;">' +
                detailsStr +
              '</div>' +
            '</details>';
          } else {
            detailsHtml = detailsStr;
          }
        }
      }

      return '<tr>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-secondary); white-space: nowrap;">' +
          new Date(l.created_at).toLocaleString() +
        '</td>' +
        '<td>' +
          '<div style="font-weight: 600; color: var(--admin-text-primary); font-size: 0.85rem;">' +
            escapeHtml(l.admin_name || 'System / Auto') +
          '</div>' +
          (l.admin_email ? '<div style="font-size: 0.75rem; color: var(--admin-text-muted);">' + escapeHtml(l.admin_email) + '</div>' : '') +
        '</td>' +
        '<td>' + actionBadge + '</td>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-secondary);">' + escapeHtml(l.target_type || '-') + '</td>' +
        '<td style="font-size: 0.8rem; color: var(--admin-text-primary);">' + detailsHtml + '</td>' +
        '<td style="font-size: 0.75rem; font-family: monospace; color: var(--admin-text-muted);">' + escapeHtml(l.ip_address || '-') + '</td>' +
      '</tr>';
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Failed to load audit logs.</td></tr>';
  }
}

// Audit Toolbar and Pagination Wiring
let auditSearchTimer = null;
const auditSearchInput = document.getElementById('audit-search-input');
const auditActionFilter = document.getElementById('audit-action-filter');
const auditClearBtn = document.getElementById('audit-clear-btn');
const auditPrevBtn = document.getElementById('audit-prev-btn');
const auditNextBtn = document.getElementById('audit-next-btn');
const auditLimitSelect = document.getElementById('audit-limit-select');

if (auditSearchInput) {
  auditSearchInput.addEventListener('input', (e) => {
    clearTimeout(auditSearchTimer);
    auditSearchTimer = setTimeout(() => {
      state.audit.search = e.target.value.trim();
      state.audit.page = 1;
      loadAuditLogs();
    }, 300);
  });
}

if (auditActionFilter) {
  auditActionFilter.addEventListener('change', (e) => {
    state.audit.action = e.target.value;
    state.audit.page = 1;
    loadAuditLogs();
  });
}

if (auditClearBtn) {
  auditClearBtn.addEventListener('click', () => {
    state.audit.search = '';
    state.audit.action = '';
    state.audit.page = 1;
    if (auditSearchInput) auditSearchInput.value = '';
    if (auditActionFilter) auditActionFilter.value = '';
    loadAuditLogs();
  });
}

if (auditPrevBtn) {
  auditPrevBtn.addEventListener('click', () => {
    if (state.audit.page > 1) {
      state.audit.page--;
      loadAuditLogs();
    }
  });
}

if (auditNextBtn) {
  auditNextBtn.addEventListener('click', () => {
    if (state.audit.page < state.audit.totalPages) {
      state.audit.page++;
      loadAuditLogs();
    }
  });
}

if (auditLimitSelect) {
  auditLimitSelect.addEventListener('change', (e) => {
    state.audit.limit = parseInt(e.target.value, 10) || 20;
    state.audit.page = 1;
    loadAuditLogs();
  });
}

// =============================================================================
// TAB 6: GOOGLE SHEETS INTEGRATION
// =============================================================================
async function loadGoogleSheetsTab() {
  const tbody = document.getElementById('sheets-queue-table-body');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading synchronization queue...</td></tr>`;

  try {
    const res = await fetch('/api/admin/google-sheets/status', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success) {
      const conn = data.connection || {};
      const badge = document.getElementById('sheets-connection-badge');
      const openBtn = document.getElementById('open-spreadsheet-btn');
      const diagMsg = document.getElementById('sheets-diag-msg');

      if (!data.enabled) {
        badge.className = 'badge badge-neutral';
        badge.textContent = 'DISABLED';
        diagMsg.innerHTML = '<span style="color: var(--admin-text-muted);">Integration disabled in configuration (GOOGLE_SHEETS_ENABLED=false).</span>';
      } else if (conn.connected) {
        badge.className = 'badge badge-success';
        badge.textContent = '✓ CONNECTED';
        diagMsg.innerHTML = `<span style="color: var(--admin-success);">Connected to "${escapeHtml(conn.spreadsheetTitle)}" (${conn.sheets ? conn.sheets.length : 0} tabs)</span>`;
      } else {
        badge.className = 'badge badge-danger';
        badge.textContent = 'CONNECTION FAILED';
        diagMsg.innerHTML = `<span style="color: var(--admin-danger);">${escapeHtml(conn.message || 'Connection test failed.')}</span>`;
      }

      // Spreadsheet name & ID
      document.getElementById('sheets-title').textContent = conn.spreadsheetTitle || (data.enabled ? 'Google Spreadsheet' : 'Disabled');
      document.getElementById('sheets-id-text').textContent = data.spreadsheetId ? `ID: ${data.spreadsheetId}` : 'ID: Not configured';

      if (data.spreadsheetUrl) {
        openBtn.href = data.spreadsheetUrl;
        openBtn.style.display = 'inline-flex';
      } else {
        openBtn.style.display = 'none';
      }

      // Queue Stats Cards
      const q = data.queue || {};
      document.getElementById('sheets-stat-total').textContent = q.total || 0;
      document.getElementById('sheets-stat-synced').textContent = q.synced || 0;
      document.getElementById('sheets-stat-pending').textContent = q.pending || 0;
      document.getElementById('sheets-stat-processing').textContent = `${q.processing || 0} processing`;
      document.getElementById('sheets-stat-failed').textContent = q.failed || 0;
      document.getElementById('sheets-stat-awaiting-retry').textContent = `${q.awaitingRetry || 0} awaiting retry`;

      document.getElementById('sheets-last-success').textContent = q.lastSuccessfulSync ? new Date(q.lastSuccessfulSync).toLocaleTimeString() : 'Never';
      document.getElementById('sheets-last-attempt').textContent = `Last attempt: ${q.lastAttempt ? new Date(q.lastAttempt).toLocaleTimeString() : 'Never'}`;
    }

    // Load Queue Table
    const queueRes = await fetch('/api/admin/google-sheets/queue?limit=25', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const queueData = await queueRes.json();

    if (!queueData.success || !queueData.items || queueData.items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Queue is currently empty.</td></tr>`;
      return;
    }

    tbody.innerHTML = queueData.items.map(i => {
      let statusBadge = `<span class="badge badge-neutral">${escapeHtml(i.status)}</span>`;
      if (i.status === 'SYNCED') statusBadge = `<span class="badge badge-success">✓ SYNCED</span>`;
      if (i.status === 'PENDING') statusBadge = `<span class="badge badge-warning">PENDING</span>`;
      if (i.status === 'PROCESSING') statusBadge = `<span class="badge badge-teal">PROCESSING</span>`;
      if (i.status === 'FAILED') statusBadge = `<span class="badge badge-danger">FAILED</span>`;

      return `
        <tr>
          <td style="font-size: 0.8rem; color: var(--admin-text-secondary); white-space: nowrap;">
            ${new Date(i.createdAt).toLocaleString()}
          </td>
          <td><span class="badge badge-neutral">${escapeHtml(i.entityType)}</span></td>
          <td style="font-family: monospace; font-size: 0.8rem;">${escapeHtml(i.entityId)}</td>
          <td style="font-size: 0.8rem; color: var(--admin-text-secondary);">${escapeHtml(i.targetSheet)}</td>
          <td>${statusBadge}</td>
          <td style="font-size: 0.85rem; text-align: center;">${i.retryCount}</td>
          <td style="font-size: 0.75rem; color: var(--admin-text-muted);">
            ${i.lastAttemptAt ? new Date(i.lastAttemptAt).toLocaleTimeString() : '-'}
          </td>
          <td style="font-size: 0.75rem;">
            ${i.error ? `
              <details style="cursor: pointer;">
                <summary style="color: var(--admin-danger); font-weight: 500;">View Error</summary>
                <div style="margin-top: 0.25rem; color: var(--admin-danger); font-family: monospace; font-size: 0.72rem; word-break: break-all; background: var(--admin-danger-light); padding: 0.35rem 0.5rem; border-radius: 4px; border: 1px solid var(--admin-danger-border);">
                  ${escapeHtml(i.error)}
                </div>
              </details>
            ` : '<span style="color: var(--admin-text-muted);">-</span>'}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Failed to load Google Sheets integration status.</td></tr>`;
  }
}

window.triggerProcessQueue = async function() {
  const btn = document.getElementById('trigger-sync-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const res = await fetch('/api/admin/google-sheets/sync', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ batchSize: 25 })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Synchronization queue processed.', 'success');
    } else {
      showToast(data.error || 'Failed to process sync queue.', 'error');
    }
    loadGoogleSheetsTab();
  } catch (e) {
    showToast('Network error while processing queue.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Process Queue Now';
  }
};

window.retryFailedRecords = async function() {
  const btn = document.getElementById('retry-failed-btn');
  btn.disabled = true;
  btn.textContent = 'Resetting...';

  try {
    const res = await fetch('/api/admin/google-sheets/retry-failed', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Failed records reset for retry.', 'success');
    } else {
      showToast(data.error || 'Failed to reset failed records.', 'error');
    }
    loadGoogleSheetsTab();
  } catch (e) {
    showToast('Network error while retrying failed records.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Retry Failed Records';
  }
};

window.triggerBulkSync = async function() {
  if (!confirm('⚠️ CAUTION: Start bulk synchronization of all existing registered participants and attendance records into Google Sheets? This may queue a large batch of operations.')) return;

  const btn = document.getElementById('bulk-sync-btn');
  btn.disabled = true;
  btn.textContent = 'Synchronizing...';

  try {
    const res = await fetch('/api/admin/google-sheets/sync/bulk', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const r = data.result;
      showToast(`Bulk Sync Complete! Attendees: ${r.attendees.synced}/${r.attendees.total}, Attendance: ${r.attendance.synced}/${r.attendance.total}`, 'success');
      loadGoogleSheetsTab();
    } else {
      showToast(data.error || 'Bulk synchronization failed.', 'error');
    }
  } catch (e) {
    showToast('Network error during bulk synchronization.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📦 Bulk Sync All Existing DB Records';
  }
};

// Logout Handler
document.getElementById('admin-logout-btn').addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
  } finally {
    localStorage.removeItem('bruh_enat_admin_token');
    localStorage.removeItem('bruh_enat_admin_user');
    window.location.href = '/admin/login';
  }
});

// Mobile Sidebar Navigation Controller
function initMobileSidebar() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const backdrop = document.getElementById('sidebar-backdrop');
  const sidebar = document.querySelector('.admin-sidebar');

  if (!sidebar) return;

  function openSidebar() {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (mobileBtn) mobileBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  window.closeMobileSidebar = closeSidebar;
}

// Bootstrap application on page load
(async () => {
  initTheme();
  initTabs();
  initMobileSidebar();
  const authenticated = await checkAuth();
  if (authenticated) {
    loadDashboardStats();
  }
})();
