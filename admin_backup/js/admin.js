/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Admin Command Center Controller
 */

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
    verified: '',
    ticketStatus: '',
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

// =============================================================================
// TAB 1: OVERVIEW & ANALYTICS
// =============================================================================
async function loadDashboardStats() {
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

    // Header active session text
    if (s.checkIns.activeSession) {
      state.activeSession = s.checkIns.activeSession;
      document.getElementById('header-active-session').textContent = `Active Session: ${s.checkIns.activeSession.sessionName} (${s.checkIns.activeSession.eventDate})`;
    } else {
      document.getElementById('header-active-session').innerHTML = '<span style="color: var(--admin-warning);">⚠️ No active event session</span>';
    }

    // Track Breakdown Grid
    const trackGrid = document.getElementById('tracks-breakdown-grid');
    const tracks = Object.entries(s.trackBreakdown || {});
    if (tracks.length === 0) {
      trackGrid.innerHTML = '<p style="color: var(--admin-text-muted);">No track data available yet.</p>';
    } else {
      trackGrid.innerHTML = tracks.map(([trackName, count]) => {
        const pct = s.attendees.total > 0 ? Math.round((count / s.attendees.total) * 100) : 0;
        return `
          <div style="background: var(--admin-card-hover); padding: 1rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
              <span style="font-weight: 600; font-size: 0.9rem; color: var(--admin-text-primary);">${escapeHtml(trackName)}</span>
              <span style="font-weight: 700; color: var(--admin-primary);">${count}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--admin-text-secondary); margin-bottom: 0.5rem;">${pct}% of participants</div>
            <div class="progress-bar-bg" style="height: 4px;">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// =============================================================================
// TAB 2: ATTENDEES DIRECTORY
// =============================================================================
let attendeeSearchTimeout = null;

async function loadAttendees() {
  const tbody = document.getElementById('attendees-table-body');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading participants directory...</td></tr>`;

  const queryParams = new URLSearchParams({
    page: state.attendees.page,
    limit: state.attendees.limit,
    search: state.attendees.search,
    pathway: state.attendees.pathway,
    verified: state.attendees.verified,
    ticketStatus: state.attendees.ticketStatus
  });

  try {
    const res = await fetch(`/api/admin/attendees?${queryParams.toString()}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();

    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">${escapeHtml(data.error || 'Failed to load attendees.')}</td></tr>`;
      return;
    }

    state.attendees.total = data.pagination.total;
    state.attendees.totalPages = data.pagination.totalPages;

    document.getElementById('attendees-total-badge').textContent = `${data.pagination.total} Participants`;
    document.getElementById('pagination-info').textContent = `Showing page ${data.pagination.page} of ${data.pagination.totalPages} (${data.pagination.total} total)`;
    document.getElementById('prev-page-btn').disabled = data.pagination.page <= 1;
    document.getElementById('next-page-btn').disabled = data.pagination.page >= data.pagination.totalPages;

    if (!data.attendees.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--admin-text-muted);">No matching attendees found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.attendees.map(a => {
      const isVerified = a.emailVerified;
      const t = a.ticket;
      let ticketBadge = '<span class="badge badge-neutral">No Pass</span>';
      if (t) {
        if (t.status === 'ACTIVE') {
          ticketBadge = `<span class="badge badge-primary" style="font-family: monospace;">${escapeHtml(t.ticketCode)}</span>`;
        } else if (t.status === 'REVOKED') {
          ticketBadge = `<span class="badge badge-danger">REVOKED</span>`;
        }
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--admin-text-primary); font-size: 0.95rem;">
              ${escapeHtml(a.fullName)}
              ${a.isTeamLeader ? '<span class="badge badge-teal" style="font-size: 0.65rem; margin-left: 0.35rem;">LEADER</span>' : ''}
            </div>
            <div style="font-size: 0.8rem; color: var(--admin-text-secondary);">${escapeHtml(a.email)}</div>
            ${a.phone ? `<div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(a.phone)}</div>` : ''}
          </td>
          <td>
            <span class="badge ${a.registration.pathway === 'INDIVIDUAL' ? 'badge-primary' : 'badge-teal'}">
              ${a.registration.pathway}
            </span>
            ${a.team ? `<div style="font-size: 0.825rem; font-weight: 600; color: var(--admin-text-primary); margin-top: 0.25rem;">${escapeHtml(a.team.teamName)}</div>` : ''}
          </td>
          <td>
            <div style="font-size: 0.85rem; color: var(--admin-text-primary); font-weight: 500;">${escapeHtml(a.track)}</div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(a.discipline || '')}</div>
          </td>
          <td>
            ${isVerified 
              ? '<span class="badge badge-success">✓ Verified</span>' 
              : '<span class="badge badge-warning">Pending</span>'
            }
          </td>
          <td>${ticketBadge}</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="openAttendeeModal('${a.id}')">
              View Details
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Network or server error.</td></tr>`;
  }
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

document.getElementById('filter-verified').addEventListener('change', (e) => {
  state.attendees.verified = e.target.value;
  state.attendees.page = 1;
  loadAttendees();
});

document.getElementById('filter-ticket-status').addEventListener('change', (e) => {
  state.attendees.ticketStatus = e.target.value;
  state.attendees.page = 1;
  loadAttendees();
});

document.getElementById('reset-filters-btn').addEventListener('click', () => {
  document.getElementById('attendees-search').value = '';
  document.getElementById('filter-pathway').value = '';
  document.getElementById('filter-verified').value = '';
  document.getElementById('filter-ticket-status').value = '';
  state.attendees.search = '';
  state.attendees.pathway = '';
  state.attendees.verified = '';
  state.attendees.ticketStatus = '';
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

// Attendee Detail Drawer / Modal
const attendeeModal = document.getElementById('attendee-modal');
const attendeeModalBody = document.getElementById('attendee-modal-body');
const attendeeModalFooter = document.getElementById('attendee-modal-footer');

window.openAttendeeModal = async function(id) {
  attendeeModal.classList.add('show');
  attendeeModalBody.innerHTML = '<p style="color: var(--admin-text-muted); text-align: center; padding: 2rem;">Loading participant details...</p>';

  try {
    const res = await fetch(`/api/admin/attendees/${id}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.attendee) {
      attendeeModalBody.innerHTML = `<p style="color: var(--admin-danger); text-align: center;">${escapeHtml(data.error || 'Failed to load attendee.')}</p>`;
      return;
    }

    const a = data.attendee;
    const t = a.ticket;

    let ticketHtml = '';
    if (t) {
      ticketHtml = `
        <div style="background: var(--admin-card-hover); padding: 1.25rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border); margin-top: 1rem; display: flex; gap: 1.25rem; align-items: center; flex-wrap: wrap;">
          ${t.qrData ? `<img src="${t.qrData}" alt="QR Ticket" style="width: 110px; height: 110px; border-radius: 6px; background: #fff; padding: 4px;">` : ''}
          <div>
            <div style="font-size: 0.8rem; color: var(--admin-text-secondary); text-transform: uppercase;">Official Ticket Pass</div>
            <div style="font-size: 1.3rem; font-weight: 700; color: var(--admin-primary); font-family: monospace;">${escapeHtml(t.ticketCode)}</div>
            <div style="margin-top: 0.25rem;">
              Status: <span class="badge ${t.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}">${t.status}</span>
            </div>
            ${t.status === 'REVOKED' ? `<div style="font-size: 0.8rem; color: var(--admin-danger); margin-top: 0.25rem;">Reason: ${escapeHtml(t.revokedReason || 'N/A')}</div>` : ''}
          </div>
        </div>
      `;
    } else {
      ticketHtml = `
        <div style="background: var(--admin-card-hover); padding: 1rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border); margin-top: 1rem; color: var(--admin-text-muted); font-size: 0.85rem;">
          No ticket issued yet. Ticket pass will be automatically generated upon email verification.
        </div>
      `;
    }

    let teamRosterHtml = '';
    if (a.team && a.team.members && a.team.members.length > 0) {
      teamRosterHtml = `
        <div style="margin-top: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: var(--admin-text-secondary); margin-bottom: 0.5rem;">
            Team Roster: ${escapeHtml(a.team.teamName)} (${a.team.members.length} members)
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${a.team.members.map(m => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: var(--admin-card-hover); padding: 0.5rem 0.75rem; border-radius: var(--admin-radius-sm); font-size: 0.85rem;">
                <div>
                  <strong>${escapeHtml(m.fullName)}</strong> ${m.isTeamLeader ? '<span class="badge badge-teal" style="font-size: 0.65rem;">LEADER</span>' : ''}
                  <span style="color: var(--admin-text-secondary); font-size: 0.75rem;">(${escapeHtml(m.discipline || 'Participant')})</span>
                </div>
                <span class="badge ${m.emailVerified ? 'badge-success' : 'badge-warning'}">
                  ${m.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let checkInsHtml = '';
    if (a.checkIns && a.checkIns.length > 0) {
      checkInsHtml = `
        <div style="margin-top: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; color: var(--admin-text-secondary); margin-bottom: 0.5rem;">
            Check-In History Across Sessions
          </h4>
          <div style="display: flex; flex-direction: column; gap: 0.35rem;">
            ${a.checkIns.map(c => `
              <div style="background: var(--admin-card-hover); padding: 0.5rem 0.75rem; border-radius: var(--admin-radius-sm); font-size: 0.85rem; display: flex; justify-content: space-between;">
                <div>
                  <strong>${escapeHtml(c.sessionName)}</strong>
                  <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${new Date(c.checkedInAt).toLocaleString()} via ${c.checkInMethod}</div>
                </div>
                <div style="font-size: 0.8rem; color: var(--admin-teal);">Staff: ${escapeHtml(c.staffName)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    attendeeModalBody.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h3 style="font-size: 1.4rem; font-weight: 700; color: var(--admin-text-primary);">${escapeHtml(a.fullName)}</h3>
          <p style="font-size: 0.9rem; color: var(--admin-text-secondary);">${escapeHtml(a.email)} &bull; ${escapeHtml(a.phone || 'No phone')}</p>
        </div>
        <div>
          <span class="brand-badge" style="font-family: monospace;">Ref: ${escapeHtml(a.registration.referenceCode)}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-top: 1.25rem; font-size: 0.85rem;">
        <div><strong style="color: var(--admin-text-secondary);">City:</strong> ${escapeHtml(a.city || 'Addis Ababa')}</div>
        <div><strong style="color: var(--admin-text-secondary);">Discipline:</strong> ${escapeHtml(a.discipline || 'N/A')}</div>
        <div><strong style="color: var(--admin-text-secondary);">Experience:</strong> ${escapeHtml(a.experienceLevel || 'N/A')}</div>
        <div><strong style="color: var(--admin-text-secondary);">Track:</strong> ${escapeHtml(a.preferredTrack || (a.team && a.team.track) || 'General')}</div>
      </div>

      ${ticketHtml}
      ${teamRosterHtml}
      ${checkInsHtml}
    `;

    // Dynamic Action Buttons in Modal Footer
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
    attendeeModalBody.innerHTML = `<p style="color: var(--admin-danger); text-align: center;">Error loading details.</p>`;
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
      alert(`Verification email resent to ${data.result.email}`);
    } else {
      alert(data.error || 'Failed to resend verification link.');
    }
  } catch (e) {
    alert('Network error while resending verification.');
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
      alert(`Ticket pass resent to ${data.result.email}`);
    } else {
      alert(data.error || 'Failed to resend ticket pass.');
    }
  } catch (e) {
    alert('Network error while resending ticket pass.');
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

confirmRevokeBtn.addEventListener('click', async () => {
  const reason = revokeReasonInput.value.trim();
  if (!reason) {
    alert('A reason is strictly required to revoke a ticket.');
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
      alert(data.message || 'Ticket revoked successfully.');
      closeRevokeModal();
      closeAttendeeModal();
      loadAttendees();
      loadDashboardStats();
    } else {
      alert(data.error || 'Failed to revoke ticket.');
    }
  } catch (err) {
    alert('Network error while revoking ticket.');
  } finally {
    confirmRevokeBtn.disabled = false;
  }
});

// =============================================================================
// TAB 3: EVENT SESSIONS MANAGEMENT
// =============================================================================
async function loadSessions() {
  const tbody = document.getElementById('sessions-table-body');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading event sessions...</td></tr>`;

  try {
    const res = await fetch('/api/admin/sessions', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.sessions) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-danger);">${escapeHtml(data.error || 'Failed to load sessions.')}</td></tr>`;
      return;
    }

    // Populate session dropdown in reports tab as well
    const exportSelect = document.getElementById('export-session-select');
    exportSelect.innerHTML = '<option value="">Active Session</option>' + 
      data.sessions.map(s => `<option value="${s.id}">${escapeHtml(s.sessionName)} (${s.eventDate})</option>`).join('');

    if (!data.sessions.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">No sessions created yet. Click "+ New Session" to add one.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.sessions.map(s => `
      <tr>
        <td><strong style="color: var(--admin-primary); font-family: monospace;">${escapeHtml(s.sessionCode)}</strong></td>
        <td><strong style="color: var(--admin-text-primary); font-size: 0.95rem;">${escapeHtml(s.sessionName)}</strong></td>
        <td>${escapeHtml(s.eventDate)}</td>
        <td style="font-size: 0.8rem; color: var(--admin-text-secondary);">${escapeHtml(s.startTime)} &ndash; ${escapeHtml(s.endTime)}</td>
        <td style="font-size: 0.8rem; color: var(--admin-text-secondary);">${escapeHtml(s.venueName)}</td>
        <td><span class="badge badge-teal">${s.checkedInCount} Scanned</span></td>
        <td>
          ${s.isActive 
            ? '<span class="badge badge-success">✓ Active at Desks</span>' 
            : '<span class="badge badge-neutral">Inactive</span>'
          }
        </td>
        <td style="text-align: right;">
          ${s.isActive 
            ? '<span style="font-size: 0.8rem; color: var(--admin-success); font-weight: 600;">Active</span>' 
            : `<button class="btn btn-secondary btn-sm" onclick="activateSession('${s.id}')">Activate</button>`
          }
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Failed to load sessions.</td></tr>`;
  }
}

window.activateSession = async function(id) {
  if (!confirm('Activate this session as the primary check-in target for on-site desks?')) return;
  try {
    const res = await fetch(`/api/admin/sessions/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(data.message || 'Session activated.');
      loadSessions();
      loadDashboardStats();
    } else {
      alert(data.error || 'Failed to activate session.');
    }
  } catch (e) {
    alert('Network error while activating session.');
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

saveSessionBtn.addEventListener('click', async () => {
  const sessionCode = document.getElementById('session-code-input').value.trim().toUpperCase();
  const sessionName = document.getElementById('session-name-input').value.trim();
  const eventDate = document.getElementById('session-date-input').value;
  const startTime = document.getElementById('session-start-input').value.trim();
  const endTime = document.getElementById('session-end-input').value.trim();
  const venueName = document.getElementById('session-venue-input').value.trim();

  if (!sessionCode || !sessionName || !eventDate) {
    alert('Session Code, Name, and Event Date are required.');
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
      alert('Event session created successfully.');
    } else {
      alert(data.error || 'Failed to create session.');
    }
  } catch (e) {
    alert('Network error while creating session.');
  } finally {
    saveSessionBtn.disabled = false;
  }
});

// =============================================================================
// TAB 4: REPORTS & EXPORTS
// =============================================================================
async function loadReportsTab() {
  try {
    const res = await fetch('/api/admin/reports/attendance', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.report) return;

    const r = data.report;
    const methodsDiv = document.getElementById('attendance-methods-summary');

    const qrCount = r.byMethod['QR_SCAN'] || 0;
    const manualCount = r.byMethod['MANUAL'] || 0;

    methodsDiv.innerHTML = `
      <div style="background: var(--admin-card-hover); padding: 1.25rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border); flex: 1 1 200px;">
        <div style="font-size: 0.8rem; color: var(--admin-text-secondary); text-transform: uppercase;">📷 QR Camera Scans</div>
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--admin-success);">${qrCount}</div>
        <div style="font-size: 0.8rem; color: var(--admin-text-muted);">${r.totalCheckedIn > 0 ? Math.round((qrCount / r.totalCheckedIn) * 100) : 0}% of total check-ins</div>
      </div>
      <div style="background: var(--admin-card-hover); padding: 1.25rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border); flex: 1 1 200px;">
        <div style="font-size: 0.8rem; color: var(--admin-text-secondary); text-transform: uppercase;">✍️ Manual Desk Check-Ins</div>
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--admin-teal);">${manualCount}</div>
        <div style="font-size: 0.8rem; color: var(--admin-text-muted);">${r.totalCheckedIn > 0 ? Math.round((manualCount / r.totalCheckedIn) * 100) : 0}% of total check-ins</div>
      </div>
      <div style="background: var(--admin-card-hover); padding: 1.25rem; border-radius: var(--admin-radius-sm); border: 1px solid var(--admin-border); flex: 1 1 200px;">
        <div style="font-size: 0.8rem; color: var(--admin-text-secondary); text-transform: uppercase;">🎟️ Overall Attendance</div>
        <div style="font-size: 1.8rem; font-weight: 700; color: var(--admin-primary);">${r.totalCheckedIn} / ${r.totalVerified}</div>
        <div style="font-size: 0.8rem; color: var(--admin-text-muted);">${r.checkInPercentage}% attendance rate</div>
      </div>
    `;
  } catch (err) {
    console.error('Failed to load reports summary:', err);
  }
}

// Download Attendees CSV
window.downloadAttendeesCsv = async function() {
  try {
    const res = await fetch('/api/admin/export/attendees', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!res.ok) {
      alert('Failed to generate attendees CSV export.');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bruh_enat_attendees_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (e) {
    alert('Network error while exporting attendees CSV.');
  }
};

// Download Attendance CSV
window.downloadAttendanceCsv = async function() {
  const sessionSelect = document.getElementById('export-session-select');
  const sessionId = sessionSelect ? sessionSelect.value : '';

  try {
    const res = await fetch(`/api/admin/export/attendance?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    if (!res.ok) {
      alert('Failed to generate attendance CSV export.');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bruh_enat_attendance_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (e) {
    alert('Network error while exporting attendance CSV.');
  }
};

// =============================================================================
// TAB 5: SECURITY AUDIT TRAIL
// =============================================================================
async function loadAuditLogs() {
  const tbody = document.getElementById('audit-table-body');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">Loading audit trail...</td></tr>`;

  try {
    const res = await fetch('/api/admin/audit-logs?limit=50', {
      headers: getAuthHeaders(),
      credentials: 'include'
    });
    const data = await res.json();
    if (!data.success || !data.logs) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">${escapeHtml(data.error || 'Failed to load logs.')}</td></tr>`;
      return;
    }

    document.getElementById('audit-count-badge').textContent = `${data.pagination.total} Log Entries`;

    if (!data.logs.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-text-muted);">No audit logs recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.logs.map(l => {
      let actionBadge = `<span class="badge badge-neutral">${escapeHtml(l.action)}</span>`;
      if (l.action.includes('SUCCESS') || l.action.includes('CREATED') || l.action.includes('ACTIVATED')) {
        actionBadge = `<span class="badge badge-success">${escapeHtml(l.action)}</span>`;
      } else if (l.action.includes('FAILED') || l.action.includes('REVOKED')) {
        actionBadge = `<span class="badge badge-danger">${escapeHtml(l.action)}</span>`;
      } else if (l.action.includes('RESENT') || l.action.includes('MANUAL')) {
        actionBadge = `<span class="badge badge-warning">${escapeHtml(l.action)}</span>`;
      }

      let detailsStr = '';
      if (l.details) {
        detailsStr = Object.entries(l.details)
          .map(([k, v]) => `<span style="color: var(--admin-text-secondary);">${k}:</span> ${escapeHtml(v)}`)
          .join(' • ');
      }

      return `
        <tr>
          <td style="font-size: 0.8rem; color: var(--admin-text-secondary); white-space: nowrap;">
            ${new Date(l.created_at).toLocaleString()}
          </td>
          <td>
            <div style="font-weight: 600; color: var(--admin-text-primary); font-size: 0.85rem;">
              ${escapeHtml(l.admin_name || 'System / Auto')}
            </div>
            ${l.admin_email ? `<div style="font-size: 0.75rem; color: var(--admin-text-muted);">${escapeHtml(l.admin_email)}</div>` : ''}
          </td>
          <td>${actionBadge}</td>
          <td style="font-size: 0.8rem; color: var(--admin-text-secondary);">${escapeHtml(l.target_type || '-')}</td>
          <td style="font-size: 0.8rem; color: var(--admin-text-primary);">${detailsStr || '-'}</td>
          <td style="font-size: 0.75rem; font-family: monospace; color: var(--admin-text-muted);">${escapeHtml(l.ip_address || '-')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--admin-danger);">Failed to load audit logs.</td></tr>`;
  }
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
          <td style="font-size: 0.75rem; color: var(--admin-danger); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(i.error || '')}">
            ${escapeHtml(i.error || '-')}
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
    alert(data.message || (data.success ? 'Queue processed.' : data.error));
    loadGoogleSheetsTab();
  } catch (e) {
    alert('Network error while processing queue.');
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
    alert(data.message || (data.success ? 'Failed records reset.' : data.error));
    loadGoogleSheetsTab();
  } catch (e) {
    alert('Network error while retrying failed records.');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Retry Failed Records';
  }
};

window.triggerBulkSync = async function() {
  if (!confirm('Start bulk synchronization of all existing registered participants and attendance records into Google Sheets?')) return;

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
      alert(`Bulk Sync Complete!\nAttendees Synced: ${r.attendees.synced} / ${r.attendees.total}\nAttendance Synced: ${r.attendance.synced} / ${r.attendance.total}`);
      loadGoogleSheetsTab();
    } else {
      alert(data.error || 'Bulk synchronization failed.');
    }
  } catch (e) {
    alert('Network error during bulk synchronization.');
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

// Bootstrap application on page load
(async () => {
  initTheme();
  initTabs();
  const authenticated = await checkAuth();
  if (authenticated) {
    loadDashboardStats();
  }
})();
