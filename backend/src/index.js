const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDb, logAction, notifyUser } = require('./db');
const { requireAuth, requireRole } = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

function createToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function normalizePost(row) {
  return {
    ...row,
    isOwner: Boolean(row.is_owner),
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HEALTH AI backend is running.',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/register', async (req, res) => {
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

app.post('/api/auth/verify-email', async (req, res) => {
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

app.post('/api/auth/login', async (req, res) => {
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

app.get('/api/auth/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/posts', async (req, res) => {
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

app.get('/api/posts/:id', async (req, res) => {
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

app.post('/api/posts', requireAuth, async (req, res) => {
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

app.put('/api/posts/:id', requireAuth, async (req, res) => {
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

app.patch('/api/posts/:id/status', requireAuth, async (req, res) => {
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

app.post('/api/meetings', requireAuth, async (req, res) => {
  const { postId, message = '', proposedTimeSlot, ndaAccepted = false } = req.body;
  if (!postId || !proposedTimeSlot) {
    return res.status(400).json({ message: 'Post and time slot are required.' });
  }

  const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [postId]);
  if (postResult.rows.length === 0) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  const post = postResult.rows[0];
  if (post.user_id === req.user.id) {
    return res.status(400).json({ message: 'You cannot request a meeting for your own post.' });
  }

  if (post.confidentiality_level.toLowerCase().includes('details') && !ndaAccepted) {
    return res.status(400).json({ message: 'NDA must be accepted for this post.' });
  }

  const result = await pool.query(
    `INSERT INTO meeting_requests (post_id, requester_id, owner_id, message, nda_accepted, proposed_time_slot, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING *`,
    [postId, req.user.id, post.user_id, message, Boolean(ndaAccepted), proposedTimeSlot]
  );

  await notifyUser(post.user_id, `${req.user.name} requested a meeting for your post "${post.title}".`);
  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'meeting_request_create', targetEntity: 'meeting_request', resultStatus: 'success', details: `Post #${postId}` });

  res.status(201).json(result.rows[0]);
});

app.get('/api/meetings/mine', requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT mr.*, p.title AS post_title, requester.name AS requester_name, owner.name AS owner_name
     FROM meeting_requests mr
     JOIN posts p ON p.id = mr.post_id
     JOIN users requester ON requester.id = mr.requester_id
     JOIN users owner ON owner.id = mr.owner_id
     WHERE mr.requester_id = $1 OR mr.owner_id = $1
     ORDER BY mr.created_at DESC`,
    [req.user.id]
  );

  res.json(result.rows);
});

app.patch('/api/meetings/:id/respond', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'declined', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid meeting status.' });
  }

  const result = await pool.query('SELECT * FROM meeting_requests WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Meeting request not found.' });
  }

  const meeting = result.rows[0];
  const isOwner = meeting.owner_id === req.user.id;
  const isRequester = meeting.requester_id === req.user.id;
  if (!isOwner && !isRequester && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not allowed.' });
  }

  const updated = await pool.query(
    `UPDATE meeting_requests SET status = $1 WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );

  if (status === 'accepted') {
    await pool.query(`UPDATE posts SET status = 'meeting_scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [meeting.post_id]);
    await notifyUser(meeting.requester_id, `Your meeting request for post #${meeting.post_id} was accepted.`);
    await notifyUser(meeting.owner_id, `Meeting scheduled for post #${meeting.post_id}.`);
  }

  if (status === 'declined') {
    await notifyUser(meeting.requester_id, `Your meeting request for post #${meeting.post_id} was declined.`);
  }

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'meeting_request_update', targetEntity: 'meeting_request', resultStatus: 'success', details: `Meeting #${req.params.id} -> ${status}` });
  res.json(updated.rows[0]);
});

app.get('/api/profile/me', requireAuth, async (req, res) => {
  res.json(req.user);
});

app.put('/api/profile/me', requireAuth, async (req, res) => {
  const { name, city, institution } = req.body;
  const result = await pool.query(
    `UPDATE users SET name = $1, city = $2, institution = $3 WHERE id = $4
     RETURNING id, name, email, role, city, institution, is_verified, created_at`,
    [name, city, institution, req.user.id]
  );

  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'profile_update', targetEntity: 'user', resultStatus: 'success', details: req.user.email });
  res.json(result.rows[0]);
});

app.get('/api/profile/export', requireAuth, async (req, res) => {
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

app.get('/api/notifications', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
    [req.user.id]
  );
  res.json(result.rows);
});

app.get('/api/admin/users', requireAuth, requireRole('admin'), async (req, res) => {
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

app.get('/api/admin/posts', requireAuth, requireRole('admin'), async (req, res) => {
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

app.delete('/api/admin/posts/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
  if (existing.rows.length === 0) {
    return res.status(404).json({ message: 'Post not found.' });
  }

  await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
  await logAction({ userId: req.user.id, role: req.user.role, actionType: 'admin_remove_post', targetEntity: 'post', resultStatus: 'success', details: `Post #${req.params.id}` });
  res.json({ message: 'Post removed.' });
});

app.get('/api/admin/logs', requireAuth, requireRole('admin'), async (req, res) => {
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

app.get('/api/admin/logs/export', requireAuth, requireRole('admin'), async (req, res) => {
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error.' });
});

(async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      await initDb();
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
      break;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      retries -= 1;
      if (retries === 0) process.exit(1);
      console.log(`Retrying in 5 seconds... (${retries} retries left)`);
      await new Promise(res => setTimeout(res, 5000));
    }
  }
})();
