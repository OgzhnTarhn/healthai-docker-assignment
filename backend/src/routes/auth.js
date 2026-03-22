const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, logAction, notifyUser } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res) => {
  const { name, email, password, role, city = '', institution = '' } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required.' });
  }

  const eduRegex = /@[^@\s]+\.edu(\.tr)?$/i;
  if (!eduRegex.test(email)) {
    return res.status(400).json({ message: 'Only institutional .edu or .edu.tr emails are allowed.' });
  }

  if (!['engineer', 'healthcare'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, city, institution, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING id, name, email, role, city, institution, is_verified, created_at`,
      [name, email.toLowerCase(), passwordHash, role, city, institution]
    );

    await logAction({
      userId: result.rows[0].id,
      role,
      actionType: 'register',
      targetEntity: 'user',
      resultStatus: 'success',
      details: email,
    });

    res.status(201).json({
      message: 'Registration successful. Please verify your email (mocked).',
      user: result.rows[0],
    });
  } catch (error) {
    const duplicate = error.code === '23505';
    await logAction({ actionType: 'register', targetEntity: 'user', resultStatus: 'failed', details: error.message });
    res.status(duplicate ? 409 : 500).json({ message: duplicate ? 'Email already registered.' : 'Registration failed.' });
  }
});

router.post('/verify-email', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  const result = await pool.query(
    `UPDATE users SET is_verified = TRUE WHERE email = $1 RETURNING id, name, email, role, city, institution, is_verified, created_at`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'User not found.' });
  }

  await logAction({ userId: result.rows[0].id, role: result.rows[0].role, actionType: 'verify_email', targetEntity: 'user', resultStatus: 'success', details: email });
  res.json({ message: 'Email verified (mock).', user: result.rows[0] });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  if (result.rows.length === 0) {
    await logAction({ actionType: 'login', targetEntity: 'user', resultStatus: 'failed', details: email });
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await logAction({ userId: user.id, role: user.role, actionType: 'login', targetEntity: 'user', resultStatus: 'failed', details: 'Wrong password' });
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ message: 'Please verify your email first (mock).'});
  }

  const token = createToken(user.id);
  await notifyUser(user.id, 'New login detected.');
  await logAction({ userId: user.id, role: user.role, actionType: 'login', targetEntity: 'user', resultStatus: 'success', details: email });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      city: user.city,
      institution: user.institution,
      is_verified: user.is_verified,
      created_at: user.created_at,
    },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
