/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Registration Input Validators
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s\-()]{7,25}$/;

/**
 * Validate individual registration submission payload
 * Supports both flat format and nested { applicant: { ... } } format
 * Eligibility and safety pledge confirmations MUST be explicitly true.
 */
function validateIndividualRegistration(body) {
  const errors = [];
  const source = body.applicant || body;

  const fullName = (source.fullName || source.name || '').trim();
  const email = (source.email || '').trim().toLowerCase();
  const phone = (source.phone || '').trim();
  const discipline = (source.discipline || '').trim();
  const preferredTrack = (source.preferredTrack || source.track || '').trim();

  // Strict check: must be explicitly true. Never default missing or false values to true!
  const eligibilityConfirmed = source.eligibilityConfirmed === true || body.isWoman === true || body.eligibilityConfirmed === true;
  const safetyPledgeConfirmed = source.safetyPledgeConfirmed === true || body.safetyCheck === true || body.safetyPledgeConfirmed === true;

  if (!fullName || fullName.length < 2) {
    errors.push({ field: 'fullName', message: 'Full Name is required (minimum 2 characters).' });
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'A valid email address is required.' });
  }

  if (!phone || !PHONE_REGEX.test(phone)) {
    errors.push({ field: 'phone', message: 'A valid phone number is required.' });
  }

  if (!discipline) {
    errors.push({ field: 'discipline', message: 'Primary Discipline is required.' });
  }

  if (!preferredTrack) {
    errors.push({ field: 'preferredTrack', message: 'Preferred Innovation Track is required.' });
  }

  if (eligibilityConfirmed !== true) {
    errors.push({ field: 'eligibilityConfirmed', message: 'You must confirm eligibility (Women participants only).' });
  }

  if (safetyPledgeConfirmed !== true) {
    errors.push({ field: 'safetyPledgeConfirmed', message: 'You must agree to the Synthetic Data and Survivor Privacy Pledge.' });
  }

  const sanitized = {
    fullName,
    email,
    phone,
    city: (source.city || 'Addis Ababa').trim(),
    discipline,
    experienceLevel: (source.experienceLevel || 'Not specified').trim(),
    preferredTrack,
    skills: (source.skillsSummary || source.skills || 'None specified').trim(),
    matchingConsent: Boolean(source.consentTeamMatching || source.matchingConsent),
    eligibilityConfirmed: eligibilityConfirmed === true,
    safetyPledgeConfirmed: safetyPledgeConfirmed === true
  };

  return { isValid: errors.length === 0, errors, sanitized };
}

/**
 * Validate team registration submission payload
 * Supports both flat format and nested { team: { ... } } format
 * Enforces strictly 3 to 5 members (including team leader)
 * Eligibility and safety pledge confirmations MUST be explicitly true.
 */
function validateTeamRegistration(body) {
  const errors = [];
  const teamData = body.team || body;

  const teamName = (teamData.teamName || teamData.name || '').trim();
  const selectedTrack = (teamData.track || teamData.selectedTrack || '').trim();
  const solutionConcept = (teamData.solutionConcept || teamData.teamIdea || teamData.idea || '').trim();

  // Strict check: must be explicitly true. Never default missing or false values to true!
  const eligibilityConfirmed = teamData.eligibilityConfirmed === true || body.isWomenTeam === true || body.eligibilityConfirmed === true;
  const safetyPledgeConfirmed = teamData.safetyPledgeConfirmed === true || body.safetyCheck === true || body.safetyPledgeConfirmed === true;

  if (!teamName || teamName.length < 2) {
    errors.push({ field: 'teamName', message: 'Team Name is required (minimum 2 characters).' });
  }

  if (!selectedTrack) {
    errors.push({ field: 'track', message: 'Innovation Track is required.' });
  }

  if (eligibilityConfirmed !== true) {
    errors.push({ field: 'eligibilityConfirmed', message: 'You must confirm that all team members identify as women.' });
  }

  if (safetyPledgeConfirmed !== true) {
    errors.push({ field: 'safetyPledgeConfirmed', message: 'You must agree to the Synthetic Data and Survivor Privacy Pledge.' });
  }

  // Team Leader
  const leaderData = teamData.leader || {};
  const leaderName = (leaderData.fullName || leaderData.name || '').trim();
  const leaderEmail = (leaderData.email || '').trim().toLowerCase();
  const leaderPhone = (leaderData.phone || '').trim();
  const leaderRole = (leaderData.role || leaderData.discipline || '').trim();

  if (!leaderName || leaderName.length < 2) {
    errors.push({ field: 'leader.fullName', message: 'Team Leader Full Name is required.' });
  }

  if (!leaderEmail || !EMAIL_REGEX.test(leaderEmail)) {
    errors.push({ field: 'leader.email', message: 'Valid Team Leader Email is required.' });
  }

  if (!leaderPhone || !PHONE_REGEX.test(leaderPhone)) {
    errors.push({ field: 'leader.phone', message: 'Valid Team Leader Phone Number is required.' });
  }

  if (!leaderRole) {
    errors.push({ field: 'leader.role', message: 'Team Leader Primary Discipline / Role is required.' });
  }

  // Additional Members
  const rawMembers = Array.isArray(teamData.members) ? teamData.members : [];
  const totalTeamSize = 1 + rawMembers.length; // 1 leader + rawMembers

  if (totalTeamSize < 3 || totalTeamSize > 5) {
    errors.push({
      field: 'members',
      message: `A team must have between 3 and 5 members including the team leader (currently provided: ${totalTeamSize}).`
    });
  }

  const validatedMembers = [];
  const seenEmails = new Set();
  if (leaderEmail) {
    seenEmails.add(leaderEmail);
  }

  rawMembers.forEach((m, idx) => {
    const memberNum = idx + 2;
    const mName = (m.fullName || m.name || '').trim();
    const mEmail = (m.email || '').trim().toLowerCase();
    const mRole = (m.role || m.discipline || '').trim();
    const mPhone = (m.phone || '').trim();

    if (!mName || mName.length < 2) {
      errors.push({ field: `members[${idx}].fullName`, message: `Member ${memberNum}: Full Name is required.` });
    }

    if (!mEmail || !EMAIL_REGEX.test(mEmail)) {
      errors.push({ field: `members[${idx}].email`, message: `Member ${memberNum}: Valid Email is required.` });
    } else if (seenEmails.has(mEmail)) {
      errors.push({ field: `members[${idx}].email`, message: `Member ${memberNum}: Email "${mEmail}" is already used by another team member.` });
    } else {
      seenEmails.add(mEmail);
    }

    if (!mRole) {
      errors.push({ field: `members[${idx}].role`, message: `Member ${memberNum}: Primary Discipline is required.` });
    }

    validatedMembers.push({
      memberIndex: memberNum,
      fullName: mName,
      email: mEmail,
      phone: mPhone,
      role: mRole
    });
  });

  const sanitized = {
    teamName,
    selectedTrack,
    solutionConcept: solutionConcept || 'General exploration',
    leader: {
      fullName: leaderName,
      email: leaderEmail,
      phone: leaderPhone,
      role: leaderRole
    },
    members: validatedMembers,
    totalTeamSize,
    eligibilityConfirmed: eligibilityConfirmed === true,
    safetyPledgeConfirmed: safetyPledgeConfirmed === true
  };

  return { isValid: errors.length === 0, errors, sanitized };
}

module.exports = {
  validateIndividualRegistration,
  validateTeamRegistration
};
