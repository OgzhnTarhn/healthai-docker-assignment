const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { initDb, pool } = require('./db');

// Import modular routes
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const meetingsRoutes = require('./routes/meetings');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HEALTH AI backend is running.',
    timestamp: new Date().toISOString(),
  });
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

// Leftover notifications route (too small for its own file, but perfectly handles real-time needs)
app.get('/api/notifications', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
    [req.user.id]
  );
  res.json(result.rows);
});

// Global error handler
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
