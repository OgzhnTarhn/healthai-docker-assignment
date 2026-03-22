const express = require('express');
const { pool, logAction } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function normalizePost(row) {
  return {
    ...row,
    isOwner: Boolean(row.is_owner),
  };
}

router.get('/', async (req, res) => {
  const { domain = '', city = '', status = '', expertise = '', userId = '' } = req.query;
  const filters = [];
  const values = [];

  if (domain) {
    values.push(`%${domain}%`);
    filters.push(`p.domain ILIKE $${values.length}`);
  }
  if (city) {
    values.push(`%${city}%`);
    filters.push(`p.city ILIKE $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`p.status = $${values.length}`);
  }
  if (expertise) {
    values.push(`%${expertise}%`);
    filters.push(`p.required_expertise ILIKE $${values.length}`);
  }

  values.push(userId ? Number(userId) : null);
  const viewerParam = `$${values.length}`;
  const visibility = `(p.status <> 'draft' OR p.user_id = COALESCE(${viewerParam}::int, -1))`;
  const where = [visibility, ...filters].join(' AND ');

  const result = await pool.query(
    `SELECT p.*, u.name AS owner_name,
            CASE WHEN ${viewerParam}::int IS NOT NULL AND p.user_id = ${viewerParam}::int THEN TRUE ELSE FALSE END AS is_owner
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE ${where}
     ORDER BY p.created_at DESC`,
    values
  );

  res.json(result.rows.map(normalizePost));
});

router.get('/:id', async (req, res) => {
  const { viewerId = null } = req.query;
  const result = await pool.query(
    `SELECT p.*, u.name AS owner_name,
            CASE WHEN $2::int IS NOT NULL AND p.user_id = $2::int THEN TRUE ELSE FALSE END AS is_owner
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1`,
    [req.params.id, viewerId ? Number(viewerId) : null]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  res.json(normalizePost(result.rows[0]));
});

router.post('/', requireAuth, async (req, res) => {
  const {
    title,
    domain,
    required_expertise,
    project_stage,
    confidentiality_level,
    city,
    country = 'Türkiye',
    description,
    collaboration_type = '',
    commitment_level = '',
    expiry_date = null,
    auto_close = false,
    status = 'draft',
  } = req.body;

  if (!title || !domain || !required_expertise || !project_stage || !confidentiality_level || !city || !description) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }

  const result = await pool.query(
    `INSERT INTO posts
      (user_id, title, domain, required_expertise, project_stage, confidentiality_level, city, country, description, collaboration_type, commitment_level, expiry_date, auto_close, status)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [req.user.id, title, domain, required_expertise, project_stage, confidentiality_level, city, country, description, collaboration_type, commitment_level, expiry_date || null, Boolean(auto_close), status]
  );

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'post_create', targetEntity: 'post', resultStatus: 'success', details: title });
  res.status(201).json(result.rows[0]);
});

router.put('/:id', requireAuth, async (req, res) => {
  const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (postCheck.rows.length === 0) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  const post = postCheck.rows[0];
  if (post.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only the owner can edit this post.' });
  }

  const {
    title,
    domain,
    required_expertise,
    project_stage,
    confidentiality_level,
    city,
    country,
    description,
    collaboration_type,
    commitment_level,
    expiry_date,
    auto_close,
    status,
  } = req.body;

  const result = await pool.query(
    `UPDATE posts SET
      title = $1,
      domain = $2,
      required_expertise = $3,
      project_stage = $4,
      confidentiality_level = $5,
      city = $6,
      country = $7,
      description = $8,
      collaboration_type = $9,
      commitment_level = $10,
      expiry_date = $11,
      auto_close = $12,
      status = $13,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $14
     RETURNING *`,
    [title, domain, required_expertise, project_stage, confidentiality_level, city, country, description, collaboration_type, commitment_level, expiry_date || null, Boolean(auto_close), status, req.params.id]
  );

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'post_edit', targetEntity: 'post', resultStatus: 'success', details: `Post #${req.params.id}` });
  res.json(result.rows[0]);
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const allowed = ['draft', 'active', 'meeting_scheduled', 'partner_found', 'expired'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  const postCheck = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (postCheck.rows.length === 0) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  const post = postCheck.rows[0];
  if (post.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only the owner can change post status.' });
  }

  const result = await pool.query(
    `UPDATE posts SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'post_status_change', targetEntity: 'post', resultStatus: 'success', details: `Post #${req.params.id} -> ${status}` });
  res.json(result.rows[0]);
});

module.exports = router;
