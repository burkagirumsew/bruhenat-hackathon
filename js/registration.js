/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Registration Engine (Individual & Team Pathways)
 */

document.addEventListener('DOMContentLoaded', () => {
  initRegistrationTabs();
  initDynamicTeamRoster();
  initFormValidationAndSubmission();
  initDraftAutosave();
  initSavedTicketBadge();
});

/* --------------------------------------------------------------------------
   1. REGISTRATION PATHWAY TABS (Individual vs Existing Team)
   -------------------------------------------------------------------------- */
function initRegistrationTabs() {
  const tabs = document.querySelectorAll('.reg-tab-btn');
  const individualForm = document.getElementById('form-individual');
  const teamForm = document.getElementById('form-team');

  if (!tabs.length || !individualForm || !teamForm) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const pathway = tab.getAttribute('data-pathway');

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (pathway === 'individual') {
        individualForm.style.display = 'block';
        teamForm.style.display = 'none';
      } else {
        individualForm.style.display = 'none';
        teamForm.style.display = 'block';
      }
    });
  });
}

/* --------------------------------------------------------------------------
   2. DYNAMIC TEAM ROSTER (Enforce 3 to 5 Members)
   -------------------------------------------------------------------------- */
function initDynamicTeamRoster() {
  const container = document.getElementById('team-members-container');
  const addBtn = document.getElementById('btn-add-member');
  const countBadge = document.getElementById('team-count-display');

  if (!container || !addBtn) return;

  // Initial count includes Team Leader (1) + Members 2 and 3 = 3 members minimum
  function updateRosterControls() {
    const memberEntries = container.querySelectorAll('.team-member-entry');
    const totalTeamSize = memberEntries.length + 1; // +1 for team leader

    if (countBadge) {
      countBadge.textContent = `${totalTeamSize} of 5 Members`;
    }

    // Min 3, Max 5
    if (totalTeamSize >= 5) {
      addBtn.disabled = true;
      addBtn.textContent = 'Maximum Team Size Reached (5 Members)';
    } else {
      addBtn.disabled = false;
      addBtn.innerHTML = `
        <svg class="icon-svg" viewBox="0 0 24 24" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:4px;">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Add Another Team Member (${totalTeamSize}/5)
      `;
    }

    // Toggle remove button visibility: total must be >= 3, so memberEntries must be >= 2
    memberEntries.forEach((entry, idx) => {
      const removeBtn = entry.querySelector('.remove-member-btn');
      if (removeBtn) {
        removeBtn.style.display = memberEntries.length > 2 ? 'inline-flex' : 'none';
      }
      const numBadge = entry.querySelector('.member-num-badge');
      if (numBadge) {
        numBadge.textContent = `Member ${idx + 2}`;
      }
    });
  }

  addBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const currentEntries = container.querySelectorAll('.team-member-entry');
    const totalTeamSize = currentEntries.length + 1;

    if (totalTeamSize >= 5) return;

    const nextMemberIndex = totalTeamSize + 1;
    const newEntry = document.createElement('div');
    newEntry.className = 'team-member-entry';
    newEntry.innerHTML = `
      <div class="team-member-entry-header">
        <span class="member-num-badge">Member ${nextMemberIndex}</span>
        <button type="button" class="remove-member-btn" aria-label="Remove member">
          <svg class="icon-svg" viewBox="0 0 24 24" style="width:16px;height:16px;">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          Remove
        </button>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Full Name <span class="req-star">*</span></label>
          <input type="text" class="form-input member-name" placeholder="Member's full legal name" required>
        </div>
        <div class="form-group">
          <label class="form-label">Email Address <span class="req-star">*</span></label>
          <input type="email" class="form-input member-email" placeholder="member@domain.com" required>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Primary Discipline <span class="req-star">*</span></label>
          <select class="form-select member-role" required>
            <option value="">Select Primary Role</option>
            <option value="Software Engineer / Full Stack">Software Engineer / Full Stack</option>
            <option value="AI / Machine Learning Specialist">AI / Machine Learning Specialist</option>
            <option value="UI/UX & Product Designer">UI/UX & Product Designer</option>
            <option value="Data Analyst / Researcher">Data Analyst / Researcher</option>
            <option value="Social Impact & GBV Specialist">Social Impact & GBV Specialist</option>
            <option value="Business, Strategy & Pitch Lead">Business, Strategy & Pitch Lead</option>
            <option value="Student / Early Career">Student / Early Career</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number (Optional)</label>
          <input type="tel" class="form-input member-phone" placeholder="+251 9XX XXX XXX">
        </div>
      </div>
    `;

    container.appendChild(newEntry);
    updateRosterControls();

    // Attach remove event
    const removeBtn = newEntry.querySelector('.remove-member-btn');
    removeBtn.addEventListener('click', () => {
      newEntry.remove();
      updateRosterControls();
    });
  });

  // Attach remove handlers to existing member entries
  container.querySelectorAll('.remove-member-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.team-member-entry')?.remove();
      updateRosterControls();
    });
  });

  updateRosterControls();
}

/* --------------------------------------------------------------------------
   3. VALIDATION & SUBMISSION HANDLING
   -------------------------------------------------------------------------- */
function initFormValidationAndSubmission() {
  const individualForm = document.getElementById('form-individual');
  const teamForm = document.getElementById('form-team');

  if (individualForm) {
    individualForm.addEventListener('submit', (e) => handleSubmission(e, 'individual'));
  }

  if (teamForm) {
    teamForm.addEventListener('submit', (e) => handleSubmission(e, 'team'));
  }
}

function handleSubmission(e, pathway) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorBox = form.querySelector('.form-error-summary');

  // Prevent duplicate submissions if already processing
  if (form.dataset.submitting === 'true') {
    return;
  }

  // Clear previous errors
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.innerHTML = '';
  }

  const errors = validateForm(form, pathway);

  if (errors.length > 0) {
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.innerHTML = `
        <strong>Please correct the following before submitting:</strong>
        <ul style="margin-top:0.5rem;padding-left:1.25rem;">
          ${errors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}
        </ul>
      `;
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }

  // Set duplicate submission protection and loading state
  form.dataset.submitting = 'true';
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <svg class="icon-svg" viewBox="0 0 24 24" style="width:20px;height:20px;animation:spin 1s linear infinite;margin-right:8px;display:inline-block;vertical-align:middle;">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="32" stroke-linecap="round"/>
    </svg>
    Submitting Application...
  `;

  // Compile Submission Payload
  const payload = compileFormData(form, pathway);

  // Perform submission directly to Supabase backend
  const performSubmission = async () => {
    if (typeof window.BRUH_ENAT_SUPABASE !== 'undefined') {
      if (pathway === 'individual') {
        return await window.BRUH_ENAT_SUPABASE.submitIndividualRegistration(payload.applicant);
      } else {
        return await window.BRUH_ENAT_SUPABASE.submitTeamRegistration(payload.team);
      }
    }
    throw new Error('Database service is not initialized. Please refresh and try again.');
  };

  performSubmission()
    .then((data) => {
      // Backend confirmation received!
      if (data && data.referenceCode) {
        payload.referenceCode = data.referenceCode;
      } else if (data && data.data && data.data.referenceCode) {
        payload.referenceCode = data.data.referenceCode;
      }

      // Hide error box
      if (errorBox) {
        errorBox.style.display = 'none';
        errorBox.innerHTML = '';
      }

      // Clear draft storage
      clearDraft(pathway);

      // Reset form fields
      try {
        form.reset();
      } catch (resetErr) {}

      // Automatically close the application portal modal pop-up so user sees main website again
      const appPortalModal = document.getElementById('application-portal-modal');
      if (appPortalModal) {
        appPortalModal.classList.remove('open');
        document.body.style.overflow = '';
      }

      // Save confirmed registration details to persistent storage so pass is never lost
      const ticketInfo = {
        referenceCode: payload.referenceCode,
        pathway: payload.pathway,
        submittedAt: payload.submittedAt || new Date().toISOString(),
        fullName: payload.pathway === 'individual' ? payload.applicant.fullName : (payload.team.leader.fullName || payload.team.teamName),
        email: payload.pathway === 'individual' ? payload.applicant.email : payload.team.leader.email,
        track: payload.pathway === 'individual' ? payload.applicant.preferredTrack : payload.team.track,
        ticketId: (data && data.data && (data.data.ticketId || data.data.referenceCode)) || payload.referenceCode,
        teamName: payload.pathway === 'team' ? payload.team.teamName : null
      };

      try {
        localStorage.setItem('bruh_last_ticket', JSON.stringify(ticketInfo));
        sessionStorage.setItem('bruh_last_ticket', JSON.stringify(ticketInfo));
        localStorage.setItem(`bruh_ticket_${payload.referenceCode}`, JSON.stringify(ticketInfo));
      } catch (storageErr) {}

      // Display success confirmation modal and show floating ticket recovery pill
      try {
        completeSubmissionSuccess(payload, false, data);
        showPersistentTicketBar(ticketInfo);
      } catch (modalErr) {
        console.error('Error rendering confirmation modal:', modalErr);
        alert('Application Submitted Successfully! Your Reference Code is: ' + payload.referenceCode);
      }
    })
    .catch((err) => {
      console.error('Registration submission failed:', err);
      // Keep registration pop-up OPEN and display a clear error message
      if (errorBox) {
        errorBox.style.display = 'block';
        errorBox.innerHTML = `
          <strong>Application Submission Failed:</strong>
          <p style="margin-top:0.4rem;font-size:0.875rem;">
            ${escapeHtml(err.message || 'Unable to store registration in the database. Please check your internet connection and try again.')}
          </p>
        `;
        errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    })
    .finally(() => {
      // Re-enable submit button and remove submitting lock
      form.dataset.submitting = 'false';
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHtml;
    });
}

function validateForm(form, pathway) {
  const errors = [];

  if (pathway === 'individual') {
    const name = form.querySelector('#ind-name')?.value.trim();
    const email = form.querySelector('#ind-email')?.value.trim();
    const phone = form.querySelector('#ind-phone')?.value.trim();
    const discipline = form.querySelector('#ind-discipline')?.value;
    const track = form.querySelector('#ind-track')?.value;
    const isWoman = form.querySelector('#ind-check-eligibility')?.checked;
    const safetyCheck = form.querySelector('#ind-check-safety')?.checked;

    if (!name) errors.push("Full Name is required.");
    if (!email || !isValidEmail(email)) errors.push("A valid Email Address is required.");
    if (!phone) errors.push("Phone Number is required.");
    if (!discipline) errors.push("Please select your Primary Discipline.");
    if (!track) errors.push("Please select your Preferred Innovation Track.");
    if (!isWoman) errors.push("You must confirm eligibility (Women participants only).");
    if (!safetyCheck) errors.push("You must agree to the Synthetic Data and Survivor Privacy Pledge.");
  } else {
    const teamName = form.querySelector('#team-name')?.value.trim();
    const track = form.querySelector('#team-track')?.value;
    const leaderName = form.querySelector('#leader-name')?.value.trim();
    const leaderEmail = form.querySelector('#leader-email')?.value.trim();
    const leaderPhone = form.querySelector('#leader-phone')?.value.trim();
    const leaderRole = form.querySelector('#leader-role')?.value;
    const isWomenTeam = form.querySelector('#team-check-eligibility')?.checked;
    const safetyCheck = form.querySelector('#team-check-safety')?.checked;

    if (!teamName) errors.push("Team Name is required.");
    if (!track) errors.push("Please select your Innovation Track.");
    if (!leaderName) errors.push("Team Leader Full Name is required.");
    if (!leaderEmail || !isValidEmail(leaderEmail)) errors.push("Valid Team Leader Email is required.");
    if (!leaderPhone) errors.push("Team Leader Phone is required.");
    if (!leaderRole) errors.push("Team Leader Role is required.");

    // Validate additional team members (minimum 2 additional members required to make 3)
    const memberEntries = form.querySelectorAll('.team-member-entry');
    if (memberEntries.length < 2) {
      errors.push("A team must have at least 3 members (Leader + 2 Members).");
    }

    memberEntries.forEach((entry, idx) => {
      const mName = entry.querySelector('.member-name')?.value.trim();
      const mEmail = entry.querySelector('.member-email')?.value.trim();
      const mRole = entry.querySelector('.member-role')?.value;

      if (!mName) errors.push(`Member ${idx + 2}: Full Name is required.`);
      if (!mEmail || !isValidEmail(mEmail)) errors.push(`Member ${idx + 2}: Valid Email is required.`);
      if (!mRole) errors.push(`Member ${idx + 2}: Primary Discipline is required.`);
    });

    if (!isWomenTeam) errors.push("You must confirm that all team members identify as women.");
    if (!safetyCheck) errors.push("You must agree to the Synthetic Data and Survivor Privacy Pledge.");
  }

  return errors;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function compileFormData(form, pathway) {
  const refCode = generateReferenceCode(pathway);
  const timestamp = new Date().toISOString();

  if (pathway === 'individual') {
    return {
      referenceCode: refCode,
      pathway: 'individual',
      submittedAt: timestamp,
      applicant: {
        fullName: form.querySelector('#ind-name')?.value.trim(),
        email: form.querySelector('#ind-email')?.value.trim(),
        phone: form.querySelector('#ind-phone')?.value.trim(),
        city: form.querySelector('#ind-city')?.value.trim() || 'Addis Ababa',
        discipline: form.querySelector('#ind-discipline')?.value,
        experienceLevel: form.querySelector('#ind-experience')?.value,
        preferredTrack: form.querySelector('#ind-track')?.value,
        skillsSummary: form.querySelector('#ind-skills')?.value.trim() || 'None specified',
        consentTeamMatching: form.querySelector('#ind-check-matching')?.checked || false,
        eligibilityConfirmed: Boolean(form.querySelector('#ind-check-eligibility')?.checked),
        safetyPledgeConfirmed: Boolean(form.querySelector('#ind-check-safety')?.checked)
      }
    };
  } else {
    const memberEntries = form.querySelectorAll('.team-member-entry');
    const membersList = [];

    memberEntries.forEach((entry, idx) => {
      membersList.push({
        memberIndex: idx + 2,
        fullName: entry.querySelector('.member-name')?.value.trim(),
        email: entry.querySelector('.member-email')?.value.trim(),
        role: entry.querySelector('.member-role')?.value,
        phone: entry.querySelector('.member-phone')?.value.trim() || ''
      });
    });

    return {
      referenceCode: refCode,
      pathway: 'team',
      submittedAt: timestamp,
      team: {
        teamName: form.querySelector('#team-name')?.value.trim(),
        track: form.querySelector('#team-track')?.value,
        solutionConcept: form.querySelector('#team-idea')?.value.trim() || 'General exploration',
        leader: {
          fullName: form.querySelector('#leader-name')?.value.trim(),
          email: form.querySelector('#leader-email')?.value.trim(),
          phone: form.querySelector('#leader-phone')?.value.trim(),
          role: form.querySelector('#leader-role')?.value
        },
        members: membersList,
        totalTeamSize: membersList.length + 1,
        eligibilityConfirmed: Boolean(form.querySelector('#team-check-eligibility')?.checked),
        safetyPledgeConfirmed: Boolean(form.querySelector('#team-check-safety')?.checked)
      }
    };
  }
}

function generateReferenceCode(pathway) {
  const prefix = pathway === 'individual' ? 'BE-2026-IND' : 'BE-2026-TEAM';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${randomSuffix}`;
}

function completeSubmissionSuccess(payload, isClientSideOnly, serverResponse) {
  const modal = document.getElementById('confirmation-modal');
  if (!modal) return;

  const refCodeEl = modal.querySelector('#confirm-ref-code');
  const detailsEl = modal.querySelector('#confirm-details-summary');
  const statusEl = modal.querySelector('#confirm-status-notice');

  if (refCodeEl) refCodeEl.textContent = payload.referenceCode;

  if (detailsEl) {
    if (payload.pathway === 'individual') {
      detailsEl.innerHTML = `
        <div style="text-align:left;background:rgba(255,255,255,0.03);padding:1.25rem;border-radius:12px;margin-bottom:1rem;">
          <p style="margin-bottom:0.4rem;"><strong>Applicant Name:</strong> ${escapeHtml(payload.applicant.fullName)}</p>
          <p style="margin-bottom:0.4rem;"><strong>Email:</strong> ${escapeHtml(payload.applicant.email)}</p>
          <p style="margin-bottom:0.4rem;"><strong>Discipline:</strong> ${escapeHtml(payload.applicant.discipline)}</p>
          <p style="margin-bottom:0.4rem;"><strong>Track:</strong> ${escapeHtml(payload.applicant.preferredTrack)}</p>
          <p style="margin-bottom:0.4rem;"><strong>Team Matching:</strong> ${payload.applicant.consentTeamMatching ? 'Opted-in for Dec 3 Zoom Matching' : 'Self-forming'}</p>
        </div>
      `;
    } else {
      detailsEl.innerHTML = `
        <div style="text-align:left;background:rgba(255,255,255,0.03);padding:1.25rem;border-radius:12px;margin-bottom:1rem;">
          <p style="margin-bottom:0.4rem;"><strong>Team Name:</strong> ${escapeHtml(payload.team.teamName)}</p>
          <p style="margin-bottom:0.4rem;"><strong>Team Leader:</strong> ${escapeHtml(payload.team.leader.fullName)} (${escapeHtml(payload.team.leader.email)})</p>
          <p style="margin-bottom:0.4rem;"><strong>Track:</strong> ${escapeHtml(payload.team.track)}</p>
          <p style="margin-bottom:0.4rem;"><strong>Total Members:</strong> ${payload.team.totalTeamSize} Women Innovators</p>
        </div>
      `;
    }
  }

  if (statusEl) {
    statusEl.innerHTML = `
      <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);padding:0.75rem 1rem;border-radius:8px;font-size:0.82rem;color:#34D399;">
        <strong>Registration Received & Stored:</strong> Your application has been received and securely stored in the database. Initial status: <strong>Pending Email Verification</strong>. Official email verification and QR ticketing will be activated in Round 2.
      </div>
    `;
  }

  // Bind Download Receipt Button
  const downloadBtn = modal.querySelector('#btn-download-receipt');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const receiptText = `
============================================================
BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
OFFICIAL APPLICATION CONFIRMATION RECEIPT
============================================================
Reference Code : ${payload.referenceCode}
Pathway        : ${payload.pathway.toUpperCase()}
Submitted At   : ${payload.submittedAt}

Theme: Her Safety, Our Innovation: Building Safer Futures.
Sprint Date: Saturday, December 5, 2026
Venue: Capstone ALX Tech Hub, Lideta, Addis Ababa, Ethiopia

Organizers:
- ALX Ethiopia
- UN Women
- Enat Bank
- MiNT (Ministry of Innovation and Technology)

Next Steps:
1. Attend Online Zoom Prep Masterclasses (Nov 30 - Dec 4, 2026 @ 7:00 PM EAT)
2. Finalist shortlisting announced December 5, 2026.
3. Bring valid ID and your confirmation code to Capstone ALX Tech Hub.

Safety Reminder:
All prototype demonstrations must use fictional or anonymised data.
============================================================
      `.trim();

      const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bruh-Enat-${payload.referenceCode}-Receipt.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  // Bind Add to Calendar (.ics) Button
  const calBtn = modal.querySelector('#btn-add-calendar');
  if (calBtn) {
    calBtn.onclick = () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Bruh-Enat Hackathon 2026//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
SUMMARY:BRUH-Enat Women's Tech Innovation Hackathon 2026
DESCRIPTION:Innovation sprint addressing gender-based violence in Ethiopia through survivor-centred AI and tech solutions.
LOCATION:Capstone ALX Tech Hub, Lideta, Addis Ababa, Ethiopia
DTSTART:20261205T053000Z
DTEND:20261205T150000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`.trim();

      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Bruh-Enat-Hackathon-2026.ics';
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  // Open confirmation modal
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Ensure View Pass button exists in modal actions
  let passBtn = modal.querySelector('#btn-modal-view-pass');
  if (!passBtn) {
    const actionsContainer = modal.querySelector('.modal-actions');
    if (actionsContainer) {
      passBtn = document.createElement('a');
      passBtn.id = 'btn-modal-view-pass';
      passBtn.className = 'btn btn-primary btn-sm';
      passBtn.target = '_blank';
      passBtn.innerHTML = `
        <svg class="icon-svg" viewBox="0 0 24 24" style="width:16px;height:16px;"><path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a2 2 0 0 0 0 4v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-2a2 2 0 0 0 0-4V9z"/></svg>
        View Digital Pass
      `;
      actionsContainer.insertBefore(passBtn, actionsContainer.firstChild);
    }
  }
  if (passBtn) {
    passBtn.href = `/ticket.html?ref=${encodeURIComponent(payload.referenceCode)}&code=${encodeURIComponent(payload.referenceCode)}`;
  }

  // Close bindings - return to main website
  const closeBtn = modal.querySelector('.modal-close-btn');
  const doneBtn = modal.querySelector('#btn-modal-done');
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
  if (closeBtn) closeBtn.onclick = closeModal;
  if (doneBtn) doneBtn.onclick = closeModal;
}

/* --------------------------------------------------------------------------
   3B. PERSISTENT TICKET RECOVERY BAR (Main Website Access)
   -------------------------------------------------------------------------- */
function showPersistentTicketBar(ticketInfo) {
  if (!ticketInfo || !ticketInfo.referenceCode) return;
  let bar = document.getElementById('floating-ticket-toast');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'floating-ticket-toast';
    bar.className = 'floating-ticket-toast';
    document.body.appendChild(bar);
  }

  const passUrl = `/ticket.html?ref=${encodeURIComponent(ticketInfo.referenceCode)}&code=${encodeURIComponent(ticketInfo.ticketId || ticketInfo.referenceCode)}`;
  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;justify-content:space-between;width:100%;">
      <div style="display:flex;align-items:center;gap:0.6rem;">
        <span style="font-size:1.35rem;line-height:1;">🎉</span>
        <div>
          <div style="font-weight:700;font-size:0.875rem;color:#ffffff;line-height:1.2;">
            Registration Confirmed!
          </div>
          <div style="font-size:0.75rem;color:#fed7aa;font-family:'JetBrains Mono',monospace;">
            Ref: ${escapeHtml(ticketInfo.referenceCode)}
          </div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <a href="${passUrl}" target="_blank" class="btn btn-gold btn-sm" style="font-size:0.775rem;padding:0.35rem 0.85rem;text-decoration:none;">
          View Pass
        </a>
        <button type="button" id="close-ticket-toast" aria-label="Dismiss" style="background:none;border:none;color:#94a3b8;font-size:1.25rem;cursor:pointer;padding:0 0.25rem;line-height:1;">
          &times;
        </button>
      </div>
    </div>
  `;
  bar.style.display = 'block';

  const closeToastBtn = bar.querySelector('#close-ticket-toast');
  if (closeToastBtn) {
    closeToastBtn.onclick = () => {
      bar.style.display = 'none';
    };
  }
}

function initSavedTicketBadge() {
  try {
    const raw = localStorage.getItem('bruh_last_ticket') || sessionStorage.getItem('bruh_last_ticket');
    if (raw) {
      const ticket = JSON.parse(raw);
      if (ticket && ticket.referenceCode) {
        showPersistentTicketBar(ticket);
      }
    }
  } catch (e) {}
}

/* --------------------------------------------------------------------------
   4. DRAFT AUTOSAVE IN SESSION STORAGE
   -------------------------------------------------------------------------- */
function initDraftAutosave() {
  const inputs = document.querySelectorAll('#form-individual input, #form-individual select, #form-team input, #form-team select');
  
  inputs.forEach(input => {
    // Restore saved value
    const saved = sessionStorage.getItem(`draft_${input.id || input.name}`);
    if (saved && input.type !== 'checkbox') {
      input.value = saved;
    }

    input.addEventListener('input', () => {
      if (input.type !== 'checkbox' && (input.id || input.name)) {
        sessionStorage.setItem(`draft_${input.id || input.name}`, input.value);
      }
    });
  });
}

function clearDraft(pathway) {
  const formId = pathway === 'individual' ? '#form-individual' : '#form-team';
  const form = document.querySelector(formId);
  if (!form) return;
  const inputs = form.querySelectorAll('input, select');
  inputs.forEach(input => {
    if (input.id || input.name) {
      sessionStorage.removeItem(`draft_${input.id || input.name}`);
    }
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
