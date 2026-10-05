const express = require('express');
const path = require('path');
const { getDb } = require('./db');
const { runMigrations } = require('./migrations/migrate');

// Route imports
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const contributorsRoutes = require('./routes/contributors.routes');
const transactionsRoutes = require('./routes/transactions.routes');
const gardenRoutes = require('./routes/garden.routes');
const reconciliationRoutes = require('./routes/reconciliation.routes');
const reportsRoutes = require('./routes/reports.routes');
const harvestRoutes = require('./routes/harvest.routes');
const syncRoutes = require('./routes/sync.routes');
const auditRoutes = require('./routes/audit.routes');
const backupRoutes = require('./routes/backup.routes');

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CORS & Headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Terminal-ID, X-Terminal-Code');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'PC Bastos Harvest Management System',
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/contributors', contributorsRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/garden', gardenRoutes);
app.use('/api/reconciliation', reconciliationRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/harvest', harvestRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);

// Static frontend assets
const frontendPath = path.join(__dirname, '../frontend/src');
app.use(express.static(frontendPath));

// Fallback to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

module.exports = app;
