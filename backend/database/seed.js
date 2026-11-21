/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Database Seeder Script (Event Sessions)
 * Usage: node database/seed.js
 */

const db = require('../src/config/database');
const logger = require('../src/utils/logger');

const SESSIONS = [
  {
    id: 'sess_day1_kickoff',
    session_code: 'DAY1-KICKOFF',
    session_name: 'Opening Ceremony & Hackathon Kickoff',
    event_date: 'Saturday, December 5, 2026',
    start_time: '08:30 AM',
    end_time: '10:00 AM',
    venue_name: 'Capstone ALX Tech Hub, Lideta, Addis Ababa',
    is_active: true
  },
  {
    id: 'sess_day1_mentor',
    session_code: 'DAY1-MENTOR',
    session_name: 'Ideation & Technical Mentorship Clinic',
    event_date: 'Saturday, December 5, 2026',
    start_time: '02:00 PM',
    end_time: '04:00 PM',
    venue_name: 'Capstone ALX Tech Hub, Lideta, Addis Ababa',
    is_active: false
  },
  {
    id: 'sess_day2_pitch',
    session_code: 'DAY2-PITCH',
    session_name: 'Final Pitch Presentations & Awards Gala',
    event_date: 'Sunday, December 6, 2026',
    start_time: '03:00 PM',
    end_time: '06:00 PM',
    venue_name: 'Capstone ALX Tech Hub, Lideta, Addis Ababa',
    is_active: false
  }
];

async function seed() {
  logger.info('Seeding event sessions into Supabase...');
  const health = await db.checkConnection();
  if (!health.connected) {
    logger.error('Cannot seed. Database is not connected:', health.error);
    process.exit(1);
  }

  for (const sess of SESSIONS) {
    await db.execute(
      `INSERT INTO event_sessions (id, session_code, session_name, event_date, start_time, end_time, venue_name, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_code) DO UPDATE
       SET session_name = EXCLUDED.session_name,
           event_date = EXCLUDED.event_date,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           venue_name = EXCLUDED.venue_name,
           is_active = EXCLUDED.is_active`,
      [
        sess.id,
        sess.session_code,
        sess.session_name,
        sess.event_date,
        sess.start_time,
        sess.end_time,
        sess.venue_name,
        sess.is_active
      ]
    );
    logger.info(`Seeded session: ${sess.session_code} - ${sess.session_name}`);
  }

  logger.info('Database seeding completed successfully.');
  await db.closePool();
  process.exit(0);
}

seed().catch(err => {
  logger.error('Seeding failed:', err.message);
  process.exit(1);
});
