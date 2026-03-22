const express = require('express');
const { pool, logAction } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res) => {
  res.json(req.user);
});

router.put('/me', requireAuth, async (req, res) => {
  const { name, city, institution } = req.body;
  const result = await pool.query(
    `UPDATE users SET name = $1, city = $2, institution = $3 WHERE id = $4
     RETURNING id, name, email, role, city, institution, is_verified, created_at`,
    [name, city, institution, req.user.id]
  );

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'profile_update', targetEntity: 'user', resultStatus: 'success', details: req.user.email });
  res.json(result.rows[0]);
});

router.get('/export', requireAuth, async (req, res) => {
  const profile = await pool.query('SELECT id, name, email, role, city, institution, is_verified, created_at FROM users WHERE id = $1', [req.user.id]);
  const posts = await pool.query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  const meetings = await pool.query('SELECT * FROM meeting_requests WHERE requester_id = $1 OR owner_id = $1 ORDER BY created_at DESC', [req.user.id]);
  const notifications = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'data_export', targetEntity: 'user', resultStatus: 'success', details: req.user.email });
  res.json({
    profile: profile.rows[0],
    posts: posts.rows,
    meetings: meetings.rows,
    notifications: notifications.rows,
    exportedAt: new Date().toISOString(),
  });
});

module.exports = router;
