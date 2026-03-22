const express = require('express');
const { pool, logAction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { role = '' } = req.query;
  let result;
  if (role) {
    result = await pool.query(
      'SELECT id, name, email, role, city, institution, is_verified, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
      [role]
    );
  } else {
    result = await pool.query('SELECT id, name, email, role, city, institution, is_verified, created_at FROM users ORDER BY created_at DESC');
  }
  res.json(result.rows);
});

router.get('/posts', requireAuth, requireRole('admin'), async (req, res) => {
  const { status = '' } = req.query;
  let result;
  if (status) {
    result = await pool.query(
      `SELECT p.*, u.name AS owner_name FROM posts p JOIN users u ON u.id = p.user_id WHERE p.status = $1 ORDER BY p.created_at DESC`,
      [status]
    );
  } else {
    result = await pool.query(
      `SELECT p.*, u.name AS owner_name FROM posts p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`
    );
  }
  res.json(result.rows);
});

router.delete('/posts/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'admin_remove_post', targetEntity: 'post', resultStatus: 'success', details: `Post #${req.params.id}` });
  res.json({ message: 'Post removed.' });
});

router.get('/logs', requireAuth, requireRole('admin'), async (req, res) => {
  const { action = '', date = '' } = req.query;
  const clauses = [];
  const values = [];

  if (action) {
    values.push(`%${action}%`);
    clauses.push(`action_type ILIKE $${values.length}`);
  }
  if (date) {
    values.push(date);
    clauses.push(`DATE(created_at) = $${values.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT 100`,
    values
  );
  res.json(result.rows);
});

router.get('/logs/export', requireAuth, requireRole('admin'), async (req, res) => {
  const result = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 200');
  const header = 'id,user_id,role,action_type,target_entity,result_status,details,created_at';
  const rows = result.rows.map((row) => [
    row.id,
    row.user_id ?? '',
    row.role ?? '',
    row.action_type,
    row.target_entity,
    row.result_status,
    String(row.details || '').replaceAll(',', ';'),
    row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  ].join(','));

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'log_export', targetEntity: 'activity_logs', resultStatus: 'success', details: 'CSV export' });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="activity_logs.csv"');
  res.send([header, ...rows].join('\n'));
});

module.exports = router;
