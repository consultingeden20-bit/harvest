const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { listProducts, recordSale, listSales } = require('../services/garden');
const { query, get, run } = require('../db');
const { logAudit } = require('../services/audit');

function uuid() {
  return crypto.randomUUID();
}

router.use(authenticateToken);

// GET /api/garden/products
router.get('/products', async (req, res) => {
  try {
    const { harvest_id } = req.query;
    const products = await listProducts(harvest_id || 'hrv-2026');
    return res.json({ products });
  } catch (err) {
    console.error('List garden products error:', err);
    return res.status(500).json({ error: 'Failed to list products' });
  }
});

// POST /api/garden/products (Admin creates garden product)
router.post('/products', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { harvest_id, code, name_en, name_fr, unit_price } = req.body;
    if (!code || !name_en || !name_fr) {
      return res.status(400).json({ error: 'Code, English Name, and French Name are required' });
    }
    const id = `prod-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`;
    const price = parseInt(unit_price, 10) || 0;

    await run(
      `INSERT INTO garden_products (id, harvest_id, code, name_en, name_fr, unit_price, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [id, harvest_id || 'hrv-2026', code.toUpperCase(), name_en, name_fr, price]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'GARDEN_PRODUCT_CREATED',
      entityType: 'garden_products',
      recordId: id,
      newValues: { code, name_en, unit_price: price },
      reason: 'Admin added new garden product'
    });

    return res.status(201).json({ message: 'Product created', id });
  } catch (err) {
    console.error('Create garden product error:', err);
    return res.status(500).json({ error: 'Failed to create garden product' });
  }
});

// PUT /api/garden/products/:id (Admin updates garden product)
router.put('/products/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { code, name_en, name_fr, unit_price, is_active } = req.body;
    await run(
      `UPDATE garden_products
       SET code = COALESCE(?, code),
           name_en = COALESCE(?, name_en),
           name_fr = COALESCE(?, name_fr),
           unit_price = COALESCE(?, unit_price),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [code, name_en, name_fr, unit_price !== undefined ? parseInt(unit_price, 10) : undefined, is_active, req.params.id]
    );

    return res.json({ message: 'Product updated' });
  } catch (err) {
    console.error('Update garden product error:', err);
    return res.status(500).json({ error: 'Failed to update garden product' });
  }
});

// DELETE /api/garden/products/:id (Admin deactivates garden product)
router.delete('/products/:id', requireRoles('ADMIN'), async (req, res) => {
  try {
    await run(`UPDATE garden_products SET is_active = 0 WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'Product deactivated' });
  } catch (err) {
    console.error('Delete garden product error:', err);
    return res.status(500).json({ error: 'Failed to delete garden product' });
  }
});

// GET /api/garden/sales
router.get('/sales', async (req, res) => {
  try {
    const { harvest_id, session_id, limit, offset } = req.query;
    const result = await listSales({
      harvestId: harvest_id || 'hrv-2026',
      sessionId: session_id,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });
    return res.json(result);
  } catch (err) {
    console.error('List garden sales error:', err);
    return res.status(500).json({ error: 'Failed to list sales' });
  }
});

// POST /api/garden/sales
router.post('/sales', requireRoles('ADMIN', 'COLLECTOR'), async (req, res) => {
  try {
    const terminalId = req.headers['x-terminal-id'] || null;
    const result = await recordSale(req.body, req.user, terminalId);
    return res.status(201).json(result);
  } catch (err) {
    console.error('Record garden sale error:', err);
    return res.status(400).json({ error: err.message || 'Failed to record garden sale' });
  }
});

module.exports = router;
