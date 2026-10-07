const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const {
  getSessionSystemTotals,
  recordReconciliation,
  listReconciliations
} = require('../services/reconciliation');
const { query, get, run } = require('../db');
const { logAudit } = require('../services/audit');

function uuid() {
  return crypto.randomUUID();
}

router.use(authenticateToken);

// GET /api/reconciliation/system-totals
router.get('/system-totals', requireRoles('ADMIN', 'VERIFIER'), async (req, res) => {
  try {
    const { harvest_id, session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const totals = await getSessionSystemTotals(harvest_id || 'hrv-2026', session_id);
    return res.json({ totals });
  } catch (err) {
    console.error('System totals error:', err);
    return res.status(500).json({ error: 'Failed to compute session system totals' });
  }
});

// GET /api/reconciliation/collectors-summary (Desk-by-Desk Collector Totals for Verifier)
router.get('/collectors-summary', requireRoles('ADMIN', 'VERIFIER'), async (req, res) => {
  try {
    const { harvest_id, session_id } = req.query;
    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    const hId = harvest_id || 'hrv-2026';

    // Get all collectors who recorded transactions in this session
    const collectorTotals = await query(
      `SELECT 
        u.id as collector_id,
        u.username as collector_username,
        u.full_name as collector_name,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(CASE WHEN pm.code = 'CASH' THEN t.amount ELSE 0 END), 0) as cash_amount,
        COALESCE(SUM(CASE WHEN pm.code != 'CASH' THEN t.amount ELSE 0 END), 0) as other_amount,
        COALESCE(SUM(t.amount), 0) as total_amount
       FROM transactions t
       JOIN users u ON t.operator_id = u.id
       JOIN payment_methods pm ON t.payment_method_id = pm.id
       WHERE t.harvest_id = ? AND t.session_id = ? AND t.status = 'COMPLETED'
       GROUP BY u.id`,
      [hId, session_id]
    );

    // Fetch existing verification records for this session
    const verifications = await query(
      `SELECT cv.*, v.full_name as verifier_name
       FROM collector_verifications cv
       JOIN users v ON cv.verifier_id = v.id
       WHERE cv.harvest_id = ? AND cv.session_id = ?`,
      [hId, session_id]
    );

    const verificationMap = {};
    verifications.forEach(v => {
      verificationMap[v.collector_id] = v;
    });

    const enriched = collectorTotals.map(c => ({
      ...c,
      verification: verificationMap[c.collector_id] || null,
      status: verificationMap[c.collector_id] ? verificationMap[c.collector_id].status : 'PENDING_VERIFICATION'
    }));

    return res.json({ collectors: enriched });
  } catch (err) {
    console.error('Collector summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch collector breakdown' });
  }
});

// POST /api/reconciliation/verify-collector (Verifier inspects & signs off individual collector desk)
router.post('/verify-collector', requireRoles('ADMIN', 'VERIFIER'), async (req, res) => {
  try {
    const { harvest_id, session_id, collector_id, total_transactions, total_cash, total_other, total_amount, status, verifier_notes } = req.body;

    if (!session_id || !collector_id) {
      return res.status(400).json({ error: 'Session ID and Collector ID are required' });
    }

    const id = uuid();
    const hId = harvest_id || 'hrv-2026';

    await run(
      `INSERT INTO collector_verifications (
        id, harvest_id, session_id, collector_id, verifier_id,
        total_transactions, total_cash, total_other, total_amount,
        status, verifier_notes, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id, hId, session_id, collector_id, req.user.userId,
        parseInt(total_transactions, 10) || 0,
        parseInt(total_cash, 10) || 0,
        parseInt(total_other, 10) || 0,
        parseInt(total_amount, 10) || 0,
        status || 'APPROVED',
        verifier_notes || null
      ]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'COLLECTOR_DESK_VERIFIED',
      entityType: 'collector_verifications',
      recordId: id,
      newValues: { collector_id, total_amount, status },
      reason: `Verifier signed off collector desk: ${status || 'APPROVED'}`
    });

    return res.status(201).json({ message: 'Collector desk verified successfully', verificationId: id });
  } catch (err) {
    console.error('Verify collector error:', err);
    return res.status(500).json({ error: 'Failed to verify collector desk' });
  }
});

// POST /api/reconciliation (Session reconciliation)
router.post('/', requireRoles('ADMIN', 'VERIFIER'), async (req, res) => {
  try {
    const terminalId = req.headers['x-terminal-id'] || null;
    const { harvest_id, session_id, physical_cash, physical_cheque, physical_transfer, physical_momo, notes } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const rec = await recordReconciliation({
      harvestId: harvest_id || 'hrv-2026',
      sessionId: session_id,
      physicalCash: physical_cash,
      physicalCheque: physical_cheque,
      physicalTransfer: physical_transfer,
      physicalMomo: physical_momo,
      notes
    }, req.user, terminalId);

    return res.status(201).json({ reconciliation: rec });
  } catch (err) {
    console.error('Record reconciliation error:', err);
    return res.status(500).json({ error: 'Failed to record cash reconciliation' });
  }
});

// POST /api/reconciliation/:id/admin-approve (Admin Final Sign-Off)
router.post('/:id/admin-approve', requireRoles('ADMIN'), async (req, res) => {
  try {
    const { notes } = req.body;
    await run(
      `UPDATE reconciliations
       SET admin_approved = 1,
           admin_approved_by = ?,
           admin_approved_at = datetime('now'),
           notes = CASE WHEN ? IS NOT NULL THEN notes || ' | Admin Approval: ' || ? ELSE notes END
       WHERE id = ?`,
      [req.user.userId, notes, notes, req.params.id]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'RECONCILIATION_ADMIN_APPROVED',
      entityType: 'reconciliations',
      recordId: req.params.id,
      reason: 'Administrator performed final overarching session approval'
    });

    return res.json({ message: 'Session reconciliation approved by Administrator' });
  } catch (err) {
    console.error('Admin approve reconciliation error:', err);
    return res.status(500).json({ error: 'Failed to sign off reconciliation' });
  }
});

// GET /api/reconciliation & GET /api/reconciliation/history
const handleListReconciliations = async (req, res) => {
  try {
    const { harvest_id } = req.query;
    const history = await listReconciliations(harvest_id || 'hrv-2026');
    return res.json({ reconciliations: history });
  } catch (err) {
    console.error('List reconciliations error:', err);
    return res.status(500).json({ error: 'Failed to fetch reconciliation history' });
  }
};

router.get('/', requireRoles('ADMIN', 'VERIFIER'), handleListReconciliations);
router.get('/history', requireRoles('ADMIN', 'VERIFIER'), handleListReconciliations);

module.exports = router;
