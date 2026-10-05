const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { getAuditLogs } = require('../services/audit');

router.use(authenticateToken);
router.use(requireRoles('ADMIN'));

// GET /api/audit (Admin audit explorer)
router.get('/', async (req, res) => {
  try {
    const { action, entity_type, user_id, search, limit, offset } = req.query;
    const logs = await getAuditLogs({
      action,
      entityType: entity_type,
      userId: user_id,
      search,
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0
    });
    return res.json({ logs });
  } catch (err) {
    console.error('Audit logs error:', err);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
