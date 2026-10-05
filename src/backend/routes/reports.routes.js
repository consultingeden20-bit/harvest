const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/auth');
const {
  getChurchSummary,
  getGroupAnalytics,
  generateCSV
} = require('../services/reports');
const { listTransactions } = require('../services/transactions');
const { listContributors } = require('../services/contributors');
const { logAudit } = require('../services/audit');

router.use(authenticateToken);

// GET /api/reports/church-summary (Admin, Verifier, Leadership only)
router.get('/church-summary', requireRoles('ADMIN', 'VERIFIER', 'VIEWER'), async (req, res) => {
  try {
    const { harvest_id } = req.query;
    const summary = await getChurchSummary(harvest_id || 'hrv-2026');
    return res.json({ summary });
  } catch (err) {
    console.error('Church summary error:', err);
    return res.status(500).json({ error: 'Failed to generate church summary' });
  }
});

// GET /api/reports/group-analytics (Strictly scoped for Group Authorities)
router.get('/group-analytics', async (req, res) => {
  try {
    const { harvest_id } = req.query;
    const analytics = await getGroupAnalytics(harvest_id || 'hrv-2026', req.user);
    return res.json({ groupAnalytics: analytics });
  } catch (err) {
    console.error('Group analytics error:', err);
    return res.status(500).json({ error: 'Failed to generate group analytics' });
  }
});

// GET /api/reports/export/transactions-csv
router.get('/export/transactions-csv', async (req, res) => {
  try {
    const { harvest_id, session_id, group_id } = req.query;

    // Fetch transactions scoped to user permissions
    const { transactions } = await listTransactions({
      harvestId: harvest_id || 'hrv-2026',
      sessionId: session_id,
      groupId: group_id,
      limit: 10000,
      offset: 0,
      user: req.user
    });

    const csvData = generateCSV(transactions, {
      tx_code: 'Transaction Code',
      contributor_code: 'Contributor ID',
      contributor_name: 'Contributor Name',
      amount: 'Amount (FCFA)',
      session_name_en: 'Session',
      payment_method_en: 'Payment Method',
      income_source_en: 'Income Source',
      operator_name: 'Operator',
      terminal_name: 'Terminal',
      created_at: 'Date & Time',
      status: 'Status'
    });

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'TRANSACTIONS_EXPORT_CSV',
      entityType: 'reports',
      reason: `Exported ${transactions.length} transactions as CSV`
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="harvest_transactions_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (err) {
    console.error('CSV export error:', err);
    return res.status(500).json({ error: 'Failed to export CSV report' });
  }
});

// GET /api/reports/export/contributors-csv
router.get('/export/contributors-csv', async (req, res) => {
  try {
    const { harvest_id, group_id } = req.query;

    const { contributors } = await listContributors({
      groupId: group_id,
      harvestId: harvest_id || 'hrv-2026',
      limit: 10000,
      offset: 0,
      user: req.user
    });

    const flatContributors = contributors.map(c => ({
      ...c,
      groups_list: c.groups.map(g => g.code).join(' • ')
    }));

    const csvData = generateCSV(flatContributors, {
      code: 'Contributor ID',
      name: 'Full Name',
      phone: 'Phone Number',
      type_name_en: 'Category Type',
      groups_list: 'Groups',
      target_amount: 'Target Amount (FCFA)',
      total_paid: 'Total Paid (FCFA)',
      balance: 'Outstanding Balance (FCFA)',
      completion_percentage: 'Completion Rate (%)'
    });

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'CONTRIBUTORS_EXPORT_CSV',
      entityType: 'reports',
      reason: `Exported ${contributors.length} contributors as CSV`
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="harvest_contributors_${Date.now()}.csv"`);
    return res.send(csvData);
  } catch (err) {
    console.error('Contributor CSV export error:', err);
    return res.status(500).json({ error: 'Failed to export contributor CSV' });
  }
});

module.exports = router;
