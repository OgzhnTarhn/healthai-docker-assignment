const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function logAction({ userId = null, role = null, actionType, targetEntity, resultStatus = 'success', details = '' }) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, role, action_type, target_entity, result_status, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, role, actionType, targetEntity, resultStatus, details]
    );
  } catch (error) {
    console.error('Failed to write activity log:', error.message);
  }
}

async function notifyUser(userId, message) {
  await pool.query(
    `INSERT INTO notifications (user_id, message) VALUES ($1, $2)`,
    [userId, message]
  );
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(30) NOT NULL CHECK (role IN ('engineer', 'healthcare', 'admin')),
      city VARCHAR(120) DEFAULT '',
      institution VARCHAR(255) DEFAULT '',
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      domain VARCHAR(120) NOT NULL,
      required_expertise VARCHAR(255) NOT NULL,
      project_stage VARCHAR(80) NOT NULL,
      confidentiality_level VARCHAR(80) NOT NULL,
      city VARCHAR(120) NOT NULL,
      country VARCHAR(120) DEFAULT 'Türkiye',
      description TEXT NOT NULL,
      collaboration_type VARCHAR(120) DEFAULT '',
      commitment_level VARCHAR(120) DEFAULT '',
      expiry_date DATE,
      auto_close BOOLEAN DEFAULT FALSE,
      status VARCHAR(40) NOT NULL CHECK (status IN ('draft', 'active', 'meeting_scheduled', 'partner_found', 'expired')) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_requests (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT DEFAULT '',
      nda_accepted BOOLEAN DEFAULT FALSE,
      proposed_time_slot VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      role VARCHAR(30),
      action_type VARCHAR(100) NOT NULL,
      target_entity VARCHAR(120) NOT NULL,
      result_status VARCHAR(30) NOT NULL,
      details TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount.rows[0].count === 0) {
    const adminPass = await bcrypt.hash('123456', 10);
    const engPass = await bcrypt.hash('123456', 10);
    const docPass = await bcrypt.hash('123456', 10);

    const insertedUsers = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, city, institution, is_verified)
       VALUES
       ('Admin User', 'admin@health.edu', $1, 'admin', 'Ankara', 'Health AI Admin', TRUE),
       ('Engineer Demo', 'engineer@cankaya.edu.tr', $2, 'engineer', 'Ankara', 'Cankaya University', TRUE),
       ('Doctor Demo', 'doctor@hacettepe.edu.tr', $3, 'healthcare', 'Ankara', 'Hacettepe University', TRUE)
       RETURNING id, role`,
      [adminPass, engPass, docPass]
    );

    const engineer = insertedUsers.rows.find((u) => u.role === 'engineer');
    const doctor = insertedUsers.rows.find((u) => u.role === 'healthcare');

    const insertedPosts = await pool.query(
      `INSERT INTO posts
        (user_id, title, domain, required_expertise, project_stage, confidentiality_level, city, country, description, collaboration_type, commitment_level, expiry_date, auto_close, status)
       VALUES
        ($1, 'AI-Assisted Cardiology Diagnosis', 'Cardiology', 'Healthcare Professional', 'Prototype', 'Public short pitch', 'Ankara', 'Türkiye', 'Looking for a cardiologist to validate an ECG interpretation support tool.', 'Research partner', '4 hours/week', CURRENT_DATE + INTERVAL '30 days', FALSE, 'active'),
        ($1, 'Radiology Workflow Optimizer', 'Radiology', 'Healthcare Professional', 'Idea', 'Details discussed in meeting only', 'Istanbul', 'Türkiye', 'Seeking radiology feedback for prioritisation and workflow analysis.', 'Advisor', '2 hours/week', CURRENT_DATE + INTERVAL '20 days', FALSE, 'draft'),
        ($1, 'NDA-Protected Imaging Collaboration', 'Medical Imaging', 'Healthcare Professional', 'Concept Validation', 'Details discussed in meeting only', 'Ankara', 'Türkiye', 'This post is ideal for demonstrating NDA acceptance before scheduling a meeting.', 'Advisor', '2 hours/week', CURRENT_DATE + INTERVAL '15 days', FALSE, 'active'),
        ($2, 'Hospital Scheduling Improvement', 'Operations', 'Software Engineer', 'Research', 'Public short pitch', 'Ankara', 'Türkiye', 'Doctor-led idea for appointment queue optimisation and no-show reduction.', 'Co-founder', '3 hours/week', CURRENT_DATE + INTERVAL '25 days', FALSE, 'active')
       RETURNING id`,
      [engineer.id, doctor.id]
    );

    const postIdForMeeting = insertedPosts.rows[0].id;
    await pool.query(
      `INSERT INTO meeting_requests (post_id, requester_id, owner_id, message, nda_accepted, proposed_time_slot, status)
       VALUES ($1, $2, $3, 'I am a cardiologist and I am highly interested in testing your ECG tool.', TRUE, '2026-04-01 10:00', 'pending')`,
      [postIdForMeeting, doctor.id, engineer.id]
    );

    await pool.query(
      `INSERT INTO notifications (user_id, message) VALUES 
       ($1, 'Senkronizasyon Başarılı: Platforma hoş geldiniz! Eksik profil bilgilerinizi tamamlamayı unutmayın.'),
       ($2, 'Platforma Hoş Geldiniz! İlan bildirimleri sizin için otomatik ayrıştırılacaktır.')`,
      [engineer.id, doctor.id]
    );

    await logAction({ actionType: 'seed_data_created', targetEntity: 'system', resultStatus: 'success', details: 'Initial seed users, posts, meetings, and notifications configured.' });
  }
}

module.exports = {
  pool,
  initDb,
  logAction,
  notifyUser,
};
