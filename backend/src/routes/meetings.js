const express = require('express');
const { pool, logAction, notifyUser } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
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

router.get('/mine', requireAuth, async (req, res) => {
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

router.patch('/:id/respond', requireAuth, async (req, res) => {
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

module.exports = router;
