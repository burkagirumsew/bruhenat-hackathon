/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Registration Service (Individual & Team Registration Persistence)
 * Integrates email verification token generation and transactional email dispatch.
 */

const crypto = require('crypto');
const db = require('../config/database');
const verificationTokenService = require('./verificationTokenService');
const emailService = require('./emailService');
const logger = require('../utils/logger');

function generateId(prefix = '') {
  const hex = crypto.randomBytes(16).toString('hex');
  return prefix ? `${prefix}_${hex}` : hex;
}

async function generateReferenceCode(tx, pathway) {
  const prefix = pathway === 'INDIVIDUAL' ? 'BE-2026-IND' : 'BE-2026-TEAM';
  let isUnique = false;
  let code = '';
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}-${randomSuffix}`;
    const existing = await tx.getOne('SELECT id FROM registrations WHERE reference_code = ?', [code]);
    if (!existing) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    code = `${prefix}-${Date.now().toString().slice(-4)}`;
  }
  return code;
}

/**
 * Register an Individual Applicant
 * All database operations (registration, attendee, token, sync item) are executed in an ACID transaction.
 */
async function registerIndividual(data) {
  logger.info(`Processing individual registration for: ${data.email}`);

  let tokenData = null;

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Check for duplicate email inside transaction
      const existingAttendee = await tx.getOne(
        'SELECT id, email FROM attendees WHERE LOWER(email) = LOWER(?)',
        [data.email]
      );

      if (existingAttendee) {
        const error = new Error(`An attendee with the email "${data.email}" is already registered.`);
        error.statusCode = 409;
        throw error;
      }

      const registrationId = generateId('reg');
      const attendeeId = generateId('att');
      const syncId = generateId('sync');

      // 2. Generate authoritative reference code
      const referenceCode = await generateReferenceCode(tx, 'INDIVIDUAL');

      // 3. Insert into registrations table
      await tx.execute(
        `INSERT INTO registrations (id, reference_code, pathway, status, team_idea, submitted_at, updated_at)
         VALUES (?, ?, 'INDIVIDUAL', 'PENDING_EMAIL_VERIFICATION', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [registrationId, referenceCode]
      );

      // 4. Insert into attendees table with explicit confirmation values
      await tx.execute(
        `INSERT INTO attendees (
          id, registration_id, team_id, full_name, email, phone, city,
          discipline, experience_level, preferred_track, skills,
          is_team_leader, matching_consent, eligibility_confirmed, safety_pledge_confirmed,
          email_verified, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          attendeeId,
          registrationId,
          data.fullName,
          data.email,
          data.phone,
          data.city,
          data.discipline,
          data.experienceLevel,
          data.preferredTrack,
          data.skills,
          Boolean(data.matchingConsent),
          Boolean(data.eligibilityConfirmed),
          Boolean(data.safetyPledgeConfirmed)
        ]
      );

      // 5. Generate secure verification token in transaction
      tokenData = await verificationTokenService.createTokenForAttendee(attendeeId, tx);

      // 6. Queue for Google Sheets synchronization
      await tx.execute(
        `INSERT INTO google_sheets_sync (id, entity_type, entity_id, target_sheet, sync_status, retry_count, created_at, updated_at)
         VALUES (?, 'INDIVIDUAL', ?, 'Individual Registrations', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [syncId, attendeeId]
      );

      return {
        registrationId,
        referenceCode,
        pathway: 'INDIVIDUAL',
        status: 'PENDING_EMAIL_VERIFICATION',
        submittedAt: new Date().toISOString(),
        attendee: {
          id: attendeeId,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          city: data.city,
          discipline: data.discipline,
          preferredTrack: data.preferredTrack,
          isTeamLeader: false,
          eligibilityConfirmed: Boolean(data.eligibilityConfirmed),
          safetyPledgeConfirmed: Boolean(data.safetyPledgeConfirmed),
          emailVerified: false
        }
      };
    });

    logger.info(`Successfully stored individual registration: ${result.referenceCode} (${result.attendee.email})`);

    // Dispatch verification email in background
    if (tokenData && tokenData.rawToken) {
      try {
        await emailService.sendIndividualVerificationEmail(
          result.attendee,
          result.referenceCode,
          tokenData.rawToken
        );
      } catch (mailErr) {
        logger.warn('Could not dispatch individual verification email:', mailErr.message);
      }
    }

    return result;
  } catch (err) {
    if (err.code === '23505' || (err.message && err.message.includes('unique constraint'))) {
      const conflictErr = new Error(`An attendee with the email "${data.email}" is already registered.`);
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
    throw err;
  }
}

/**
 * Register a Formed Team (3 to 5 Members)
 * All records (registration, team, leader, members, tokens, sync items) are committed atomically.
 */
async function registerTeam(data) {
  logger.info(`Processing team registration: "${data.teamName}" with ${data.totalTeamSize} members`);

  const allEmails = [data.leader.email, ...data.members.map(m => m.email)];
  let leaderTokenData = null;
  const memberTokens = [];

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Verify inside transaction that none of the emails are already registered
      for (const email of allEmails) {
        const existing = await tx.getOne(
          'SELECT id, email FROM attendees WHERE LOWER(email) = LOWER(?)',
          [email]
        );
        if (existing) {
          const error = new Error(`An attendee with the email "${email}" is already registered.`);
          error.statusCode = 409;
          throw error;
        }
      }

      const registrationId = generateId('reg');
      const teamId = generateId('team');
      const leaderId = generateId('att');

      // 2. Generate authoritative reference code
      const referenceCode = await generateReferenceCode(tx, 'TEAM');

      // 3. Insert into registrations
      await tx.execute(
        `INSERT INTO registrations (id, reference_code, pathway, status, team_idea, submitted_at, updated_at)
         VALUES (?, ?, 'TEAM', 'PENDING_EMAIL_VERIFICATION', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [registrationId, referenceCode, data.solutionConcept]
      );

      // 4. Insert into teams table
      await tx.execute(
        `INSERT INTO teams (id, registration_id, team_name, selected_track, team_leader_id, member_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [teamId, registrationId, data.teamName, data.selectedTrack, leaderId, data.totalTeamSize]
      );

      // 5. Insert Team Leader into attendees
      await tx.execute(
        `INSERT INTO attendees (
          id, registration_id, team_id, full_name, email, phone, city,
          discipline, experience_level, preferred_track, skills,
          is_team_leader, matching_consent, eligibility_confirmed, safety_pledge_confirmed,
          email_verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'Addis Ababa', ?, 'Leader', ?, NULL, true, false, ?, ?, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          leaderId,
          registrationId,
          teamId,
          data.leader.fullName,
          data.leader.email,
          data.leader.phone,
          data.leader.role,
          data.selectedTrack,
          Boolean(data.eligibilityConfirmed),
          Boolean(data.safetyPledgeConfirmed)
        ]
      );

      // Generate leader verification token
      leaderTokenData = await verificationTokenService.createTokenForAttendee(leaderId, tx);

      // Queue leader sync
      await tx.execute(
        `INSERT INTO google_sheets_sync (id, entity_type, entity_id, target_sheet, sync_status, retry_count, created_at, updated_at)
         VALUES (?, 'ATTENDEE', ?, 'All Attendees', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [generateId('sync'), leaderId]
      );

      // 6. Insert each additional member into attendees
      const memberResults = [];
      for (const member of data.members) {
        const memberId = generateId('att');
        await tx.execute(
          `INSERT INTO attendees (
            id, registration_id, team_id, full_name, email, phone, city,
            discipline, experience_level, preferred_track, skills,
            is_team_leader, matching_consent, eligibility_confirmed, safety_pledge_confirmed,
            email_verified, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'Addis Ababa', ?, 'Member', ?, NULL, false, false, ?, ?, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            memberId,
            registrationId,
            teamId,
            member.fullName,
            member.email,
            member.phone || null,
            member.role,
            data.selectedTrack,
            Boolean(data.eligibilityConfirmed),
            Boolean(data.safetyPledgeConfirmed)
          ]
        );

        // Generate member verification token
        const mToken = await verificationTokenService.createTokenForAttendee(memberId, tx);
        memberTokens.push({
          member: {
            id: memberId,
            fullName: member.fullName,
            email: member.email,
            role: member.role,
            preferredTrack: data.selectedTrack
          },
          rawToken: mToken.rawToken
        });

        // Queue member sync
        await tx.execute(
          `INSERT INTO google_sheets_sync (id, entity_type, entity_id, target_sheet, sync_status, retry_count, created_at, updated_at)
           VALUES (?, 'ATTENDEE', ?, 'All Attendees', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [generateId('sync'), memberId]
        );

        memberResults.push({
          id: memberId,
          fullName: member.fullName,
          email: member.email,
          role: member.role,
          isTeamLeader: false,
          emailVerified: false
        });
      }

      // Queue team sync
      await tx.execute(
        `INSERT INTO google_sheets_sync (id, entity_type, entity_id, target_sheet, sync_status, retry_count, created_at, updated_at)
         VALUES (?, 'TEAM', ?, 'Team Registrations', 'PENDING', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [generateId('sync'), teamId]
      );

      return {
        registrationId,
        referenceCode,
        pathway: 'TEAM',
        status: 'PENDING_EMAIL_VERIFICATION',
        submittedAt: new Date().toISOString(),
        team: {
          id: teamId,
          teamName: data.teamName,
          track: data.selectedTrack,
          solutionConcept: data.solutionConcept,
          totalMembers: data.totalTeamSize
        },
        leader: {
          id: leaderId,
          fullName: data.leader.fullName,
          email: data.leader.email,
          role: data.leader.role,
          isTeamLeader: true,
          emailVerified: false
        },
        members: memberResults
      };
    });

    logger.info(`Successfully stored team registration: ${result.referenceCode} ("${data.teamName}", ${data.totalTeamSize} members)`);

    // Dispatch verification emails to leader and members
    if (leaderTokenData && leaderTokenData.rawToken) {
      try {
        await emailService.sendTeamMemberVerificationEmail(
          result.leader,
          data.teamName,
          data.leader.fullName,
          result.referenceCode,
          leaderTokenData.rawToken
        );
      } catch (err) {
        logger.warn('Could not dispatch leader verification email:', err.message);
      }
    }

    for (const mt of memberTokens) {
      try {
        await emailService.sendTeamMemberVerificationEmail(
          mt.member,
          data.teamName,
          data.leader.fullName,
          result.referenceCode,
          mt.rawToken
        );
      } catch (err) {
        logger.warn(`Could not dispatch member verification email to ${mt.member.email}:`, err.message);
      }
    }

    return result;
  } catch (err) {
    if (err.code === '23505' || (err.message && err.message.includes('unique constraint'))) {
      const conflictErr = new Error('An attendee in this team registration has an email that is already registered.');
      conflictErr.statusCode = 409;
      throw conflictErr;
    }
    throw err;
  }
}

module.exports = {
  registerIndividual,
  registerTeam
};
