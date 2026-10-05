const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/auth');
const {
  recordPayment,
  editPayment,
  reversePayment,
  listTransactions
} = require('../services/transactions');
const { get } = require('../db');

router.use(authenticateToken);

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { harvest_id, session_id, contributor_id, group_id, operator_id, status, limit, offset } = req.query;
    const result = await listTransactions({
      harvestId: harvest_id || 'hrv-2026',
      sessionId: session_id,
      contributorId: contributor_id,
      groupId: group_id,
      operatorId: operator_id,
      status: status || 'COMPLETED',
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      user: req.user
    });

    return res.json(result);
  } catch (err) {
    console.error('List transactions error:', err);
    return res.status(500).json({ error: 'Failed to list transactions' });
  }
});

// POST /api/transactions (Record payment)
router.post('/', requireRoles('ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'), async (req, res) => {
  try {
    const terminalId = req.headers['x-terminal-id'] || null;
    const {
      client_tx_id,
      harvest_id,
      session_id,
      contributor_id,
      is_anonymous,
      amount,
      payment_method_id,
      income_source_id,
      notes
    } = req.body;

    if (!session_id || !payment_method_id || !income_source_id) {
      return res.status(400).json({ error: 'Session, Payment Method, and Income Source are required' });
    }

    const result = await recordPayment({
      clientTxId: client_tx_id,
      harvestId: harvest_id || 'hrv-2026',
      sessionId: session_id,
      contributorId: contributor_id,
      isAnonymous: is_anonymous,
      amount,
      paymentMethodId: payment_method_id,
      incomeSourceId: income_source_id,
      notes
    }, req.user, terminalId);

    return res.status(201).json(result);
  } catch (err) {
    console.error('Record payment error:', err);
    return res.status(400).json({ error: err.message || 'Failed to record transaction' });
  }
});

// PUT /api/transactions/:id (Edit / correct payment)
router.put('/:id', requireRoles('ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'), async (req, res) => {
  try {
    const terminalId = req.headers['x-terminal-id'] || null;
    const { amount, payment_method_id, income_source_id, session_id, notes, reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A justification reason is required to edit payment details' });
    }

    const result = await editPayment(req.params.id, {
      amount,
      paymentMethodId: payment_method_id,
      incomeSourceId: income_source_id,
      sessionId: session_id,
      notes,
      reason
    }, req.user, terminalId);

    return res.json(result);
  } catch (err) {
    console.error('Edit payment error:', err);
    return res.status(400).json({ error: err.message || 'Failed to edit payment' });
  }
});

// POST /api/transactions/:id/reverse (Reverse payment with reason)
router.post('/:id/reverse', requireRoles('ADMIN', 'VERIFIER'), async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'A justification reason is required for payment reversals' });
    }

    const terminalId = req.headers['x-terminal-id'] || null;
    await reversePayment(req.params.id, reason, req.user, terminalId);

    return res.json({ message: 'Transaction reversed successfully' });
  } catch (err) {
    console.error('Reverse payment error:', err);
    return res.status(400).json({ error: err.message || 'Failed to reverse transaction' });
  }
});

// GET /api/transactions/:id/receipt (Receipt data)
router.get('/:id/receipt', async (req, res) => {
  try {
    const tx = await get(
      `SELECT 
        t.*,
        hs.name_en as session_name_en, hs.name_fr as session_name_fr,
        pm.name_en as payment_method_en, pm.name_fr as payment_method_fr,
        inc.name_en as income_source_en, inc.name_fr as income_source_fr,
        c.name as contributor_name, c.code as contributor_code,
        u.full_name as operator_name,
        term.name as terminal_name,
        h.name_en as harvest_name_en, h.name_fr as harvest_name_fr
       FROM transactions t
       JOIN harvest_sessions hs ON t.session_id = hs.id
       JOIN harvests h ON t.harvest_id = h.id
       JOIN payment_methods pm ON t.payment_method_id = pm.id
       JOIN income_sources inc ON t.income_source_id = inc.id
       LEFT JOIN contributors c ON t.contributor_id = c.id
       LEFT JOIN users u ON t.operator_id = u.id
       LEFT JOIN terminals term ON t.terminal_id = term.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.json({ receipt: tx });
  } catch (err) {
    console.error('Get receipt error:', err);
    return res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

module.exports = router;
