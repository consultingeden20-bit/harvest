const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { query, get, run } = require('../db');
const { logAudit } = require('../services/audit');

function uuid() {
  return crypto.randomUUID();
}

router.use(authenticateToken);

// GET /api/harvest/config (All active campaign metadata, ordered with default session first)
router.get('/config', async (req, res) => {
  try {
    const harvestId = req.query.harvest_id || 'hrv-2026';
    const harvest = await get(`SELECT * FROM harvests WHERE id = ?`, [harvestId]);
    const harvestsList = await query(`SELECT * FROM harvests ORDER BY year DESC`);
    const sessions = await query(
      `SELECT * FROM harvest_sessions WHERE harvest_id = ? ORDER BY is_default DESC, display_order ASC`,
      [harvestId]
    );
    const categories = await query(`SELECT * FROM harvest_categories WHERE harvest_id = ? ORDER BY display_order ASC`, [harvestId]);
    const groups = await query(`SELECT * FROM groups ORDER BY is_active DESC, display_order ASC`);
    const incomeSources = await query(`SELECT * FROM income_sources ORDER BY is_active DESC, display_order ASC`);
    const paymentMethods = await query(`SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY display_order ASC`);
    const contributorTypes = await query(`SELECT * FROM contributor_types`);
    const roles = await query(`SELECT * FROM roles`);
    const terminals = await query(`SELECT * FROM terminals WHERE is_active = 1`);

    return res.json({
      harvest,
      harvestsList,
      sessions,
      categories,
      groups,
      incomeSources,
      paymentMethods,
      contributorTypes,
      roles,
      terminals
    });
  } catch (err) {
    console.error('Harvest config error:', err);
    return res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// PUT /api/harvest/target (Admin sets overall Season Target)
router.put('/target', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { harvest_id, target_amount } = req.body;
    const target = parseInt(target_amount, 10) || 0;
    const hId = harvest_id || 'hrv-2026';

    await run(`UPDATE harvests SET target_amount = ? WHERE id = ?`, [target, hId]);

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'SEASON_TARGET_UPDATED',
      entityType: 'harvests',
      recordId: hId,
      newValues: { target_amount: target },
      reason: `Updated overall season target to ₣${target.toLocaleString()} FCFA`
    });

    return res.json({ message: 'Season target updated', targetAmount: target });
  } catch (err) {
    console.error('Set season target error:', err);
    return res.status(500).json({ error: 'Failed to update season target' });
  }
});

// --- GROUPS CRUD ---
router.post('/groups', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { code, name_en, name_fr, description, display_order } = req.body;
    if (!code || !name_en || !name_fr) {
      return res.status(400).json({ error: 'Group code, English name, and French name are required' });
    }
    const id = `grp-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
    await run(
      `INSERT INTO groups (id, code, name_en, name_fr, description, display_order, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [id, code.toUpperCase(), name_en, name_fr, description || null, display_order || 0]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'GROUP_CREATED',
      entityType: 'groups',
      recordId: id,
      newValues: { code, name_en, name_fr },
      reason: `Admin created church group ${code}`
    });

    return res.status(201).json({ message: 'Group created', id });
  } catch (err) {
    console.error('Create group error:', err);
    return res.status(500).json({ error: 'Failed to create group' });
  }
});

router.put('/groups/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { code, name_en, name_fr, description, is_active, display_order } = req.body;
    await run(
      `UPDATE groups 
       SET code = COALESCE(?, code),
           name_en = COALESCE(?, name_en),
           name_fr = COALESCE(?, name_fr),
           description = COALESCE(?, description),
           is_active = COALESCE(?, is_active),
           display_order = COALESCE(?, display_order)
       WHERE id = ?`,
      [code, name_en, name_fr, description, is_active, display_order, req.params.id]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'GROUP_UPDATED',
      entityType: 'groups',
      recordId: req.params.id,
      newValues: req.body,
      reason: 'Admin updated church group'
    });

    return res.json({ message: 'Group updated' });
  } catch (err) {
    console.error('Update group error:', err);
    return res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/groups/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    await run(`UPDATE groups SET is_active = 0 WHERE id = ?`, [req.params.id]);
    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'GROUP_DEACTIVATED',
      entityType: 'groups',
      recordId: req.params.id,
      reason: 'Admin deactivated church group'
    });
    return res.json({ message: 'Group deactivated' });
  } catch (err) {
    console.error('Delete group error:', err);
    return res.status(500).json({ error: 'Failed to delete group' });
  }
});

// --- HARVEST SESSIONS CRUD & DEFAULT SETTING ---
router.post('/sessions', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { harvest_id, session_code, name_en, name_fr, session_date, display_order, is_default } = req.body;
    if (!harvest_id || !session_code || !name_en || !session_date) {
      return res.status(400).json({ error: 'Harvest ID, Session Code, English Name, and Date are required' });
    }

    const id = uuid();
    if (is_default) {
      await run(`UPDATE harvest_sessions SET is_default = 0 WHERE harvest_id = ?`, [harvest_id]);
    }

    await run(
      `INSERT INTO harvest_sessions (id, harvest_id, session_code, name_en, name_fr, session_date, is_default, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, harvest_id, session_code, name_en, name_fr || name_en, session_date, is_default ? 1 : 0, display_order || 1]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'HARVEST_SESSION_CREATED',
      entityType: 'harvest_sessions',
      recordId: id,
      newValues: { session_code, name_en, session_date, is_default },
      reason: 'Admin configured new harvest session'
    });

    return res.status(201).json({ message: 'Session added', sessionId: id });
  } catch (err) {
    console.error('Create session error:', err);
    return res.status(500).json({ error: 'Failed to create session' });
  }
});

router.put('/sessions/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { session_code, name_en, name_fr, session_date, is_active, display_order, is_default } = req.body;
    const session = await get(`SELECT harvest_id FROM harvest_sessions WHERE id = ?`, [req.params.id]);

    if (is_default && session) {
      await run(`UPDATE harvest_sessions SET is_default = 0 WHERE harvest_id = ?`, [session.harvest_id]);
    }

    await run(
      `UPDATE harvest_sessions
       SET session_code = COALESCE(?, session_code),
           name_en = COALESCE(?, name_en),
           name_fr = COALESCE(?, name_fr),
           session_date = COALESCE(?, session_date),
           is_active = COALESCE(?, is_active),
           display_order = COALESCE(?, display_order),
           is_default = COALESCE(?, is_default)
       WHERE id = ?`,
      [session_code, name_en, name_fr, session_date, is_active, display_order, is_default, req.params.id]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'HARVEST_SESSION_UPDATED',
      entityType: 'harvest_sessions',
      recordId: req.params.id,
      newValues: req.body,
      reason: 'Admin updated harvest session'
    });

    return res.json({ message: 'Session updated' });
  } catch (err) {
    console.error('Update session error:', err);
    return res.status(500).json({ error: 'Failed to update session' });
  }
});

router.put('/sessions/:id/set-default', requireRoles('ADMIN'), async (req, res) => {
  try {
    const session = await get(`SELECT harvest_id FROM harvest_sessions WHERE id = ?`, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await run(`UPDATE harvest_sessions SET is_default = 0 WHERE harvest_id = ?`, [session.harvest_id]);
    await run(`UPDATE harvest_sessions SET is_default = 1 WHERE id = ?`, [req.params.id]);

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'HARVEST_DEFAULT_SESSION_SET',
      entityType: 'harvest_sessions',
      recordId: req.params.id,
      reason: 'Admin set default active session for collection desks'
    });

    return res.json({ message: 'Default active session updated' });
  } catch (err) {
    console.error('Set default session error:', err);
    return res.status(500).json({ error: 'Failed to set default session' });
  }
});

router.delete('/sessions/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    await run(`UPDATE harvest_sessions SET is_active = 0 WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'Session deactivated' });
  } catch (err) {
    console.error('Delete session error:', err);
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

// --- CATEGORIES CRUD ---
router.post('/categories', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { harvest_id, code, name_en, name_fr, min_target, display_order } = req.body;
    if (!code || !name_en || !name_fr) {
      return res.status(400).json({ error: 'Category code and names are required' });
    }
    const id = uuid();
    await run(
      `INSERT INTO harvest_categories (id, harvest_id, code, name_en, name_fr, min_target, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, harvest_id || 'hrv-2026', code.toUpperCase(), name_en, name_fr, parseInt(min_target, 10) || 0, display_order || 0]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'CATEGORY_CREATED',
      entityType: 'harvest_categories',
      recordId: id,
      newValues: { code, name_en, min_target },
      reason: 'Admin created harvest category'
    });

    return res.status(201).json({ message: 'Category created', id });
  } catch (err) {
    console.error('Create category error:', err);
    return res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/categories/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { code, name_en, name_fr, min_target, display_order } = req.body;
    await run(
      `UPDATE harvest_categories
       SET code = COALESCE(?, code),
           name_en = COALESCE(?, name_en),
           name_fr = COALESCE(?, name_fr),
           min_target = COALESCE(?, min_target),
           display_order = COALESCE(?, display_order)
       WHERE id = ?`,
      [code, name_en, name_fr, min_target !== undefined ? parseInt(min_target, 10) : undefined, display_order, req.params.id]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'CATEGORY_UPDATED',
      entityType: 'harvest_categories',
      recordId: req.params.id,
      newValues: req.body,
      reason: 'Admin updated harvest category'
    });

    return res.json({ message: 'Category updated' });
  } catch (err) {
    console.error('Update category error:', err);
    return res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    await run(`DELETE FROM harvest_categories WHERE id = ?`, [req.params.id]);
    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'CATEGORY_DELETED',
      entityType: 'harvest_categories',
      recordId: req.params.id,
      reason: 'Admin deleted harvest category'
    });
    return res.json({ message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    return res.status(500).json({ error: 'Failed to delete category' });
  }
});

// --- INCOME SOURCES CRUD ---
router.post('/income-sources', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { code, name_en, name_fr, display_order } = req.body;
    if (!code || !name_en || !name_fr) {
      return res.status(400).json({ error: 'Code and names are required' });
    }
    const id = `src-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
    await run(
      `INSERT INTO income_sources (id, code, name_en, name_fr, is_active, display_order)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [id, code.toUpperCase(), name_en, name_fr, display_order || 0]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'INCOME_SOURCE_CREATED',
      entityType: 'income_sources',
      recordId: id,
      newValues: { code, name_en },
      reason: 'Admin added new income source'
    });

    return res.status(201).json({ message: 'Income source added', id });
  } catch (err) {
    console.error('Create income source error:', err);
    return res.status(500).json({ error: 'Failed to create income source' });
  }
});

router.put('/income-sources/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { code, name_en, name_fr, is_active, display_order } = req.body;
    await run(
      `UPDATE income_sources
       SET code = COALESCE(?, code),
           name_en = COALESCE(?, name_en),
           name_fr = COALESCE(?, name_fr),
           is_active = COALESCE(?, is_active),
           display_order = COALESCE(?, display_order)
       WHERE id = ?`,
      [code, name_en, name_fr, is_active, display_order, req.params.id]
    );

    return res.json({ message: 'Income source updated' });
  } catch (err) {
    console.error('Update income source error:', err);
    return res.status(500).json({ error: 'Failed to update income source' });
  }
});

router.delete('/income-sources/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    await run(`UPDATE income_sources SET is_active = 0 WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'Income source deactivated' });
  } catch (err) {
    console.error('Delete income source error:', err);
    return res.status(500).json({ error: 'Failed to delete income source' });
  }
});

module.exports = router;
