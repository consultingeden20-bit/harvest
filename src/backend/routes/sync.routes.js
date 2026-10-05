const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { processBatchPush, getSyncPull } = require('../services/sync');
const { query, get, run } = require('../db');
const { recordPayment } = require('../services/transactions');
const { logAudit } = require('../services/audit');

function uuid() {
  return crypto.randomUUID();
}

router.use(authenticateToken);

// POST /api/sync/push (Batch upload of offline mutations)
router.post('/push', async (req, res) => {
  try {
    const terminalId = req.headers['x-terminal-id'] || req.body.terminalId;
    const terminalCode = req.headers['x-terminal-code'] || req.body.terminalCode;
    const { transactions, gardenSales, contributors } = req.body;

    const result = await processBatchPush({
      terminalId,
      terminalCode,
      transactions: transactions || [],
      gardenSales: gardenSales || [],
      contributors: contributors || []
    }, req.user);

    return res.json(result);
  } catch (err) {
    console.error('Sync push error:', err);
    return res.status(500).json({ error: err.message || 'Sync push failed' });
  }
});

// GET /api/sync/pull (Download latest master dataset for offline caching)
router.get('/pull', async (req, res) => {
  try {
    const { harvest_id, since } = req.query;
    const result = await getSyncPull(harvest_id || 'hrv-2026', since);
    return res.json(result);
  } catch (err) {
    console.error('Sync pull error:', err);
    return res.status(500).json({ error: 'Sync pull failed' });
  }
});

// GET /api/sync/csv-template (Download standard CSV payment entry & backup template)
router.get('/csv-template', async (req, res) => {
  try {
    const contributors = await query(`SELECT code, name FROM contributors WHERE is_active = 1 ORDER BY code ASC LIMIT 50`);
    const sessions = await query(`SELECT session_code, name_en FROM harvest_sessions WHERE harvest_id = 'hrv-2026' ORDER BY display_order ASC`);
    const paymentMethods = await query(`SELECT code, name_en FROM payment_methods WHERE is_active = 1`);
    const incomeSources = await query(`SELECT code, name_en FROM income_sources WHERE is_active = 1`);

    let csvContent = `Contributor_ID,Contributor_Name_Ref,Amount_FCFA,Session_Code,Payment_Method_Code,Income_Source_Code,Notes\r\n`;

    // Add sample guidance row
    csvContent += `# EXAMPLES / INSTRUCTIONS: Payment_Method_Code options: [CASH, MTN_MOMO, ORANGE_MONEY, CHEQUE, BANK_TRANSFER]\r\n`;
    csvContent += `# Session_Code options: [${sessions.map(s => s.session_code).join(', ')}]\r\n`;

    // Pre-populate with registered contributors as guidance template
    for (const c of contributors) {
      csvContent += `${c.code},"${c.name.replace(/"/g, '""')}",,LAUNCH_SUNDAY,CASH,HARVEST_COMMITMENT,\r\n`;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="harvest_collection_template_${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err) {
    console.error('CSV template error:', err);
    return res.status(500).json({ error: 'Failed to generate CSV template' });
  }
});

// POST /api/sync/csv-upload (Batch import CSV payment records with verification & audit)
router.post('/csv-upload', requireRoles('ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'), async (req, res) => {
  try {
    const { csvData, session_id } = req.body;
    if (!csvData || !csvData.trim()) {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    const lines = csvData.split(/\r?\n/);
    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const errors = [];

    // Master lookups
    const sessionRows = await query(`SELECT id, session_code FROM harvest_sessions WHERE harvest_id = 'hrv-2026'`);
    const sessionMap = {};
    sessionRows.forEach(s => { sessionMap[s.session_code] = s.id; sessionMap[s.id] = s.id; });

    const pmRows = await query(`SELECT id, code FROM payment_methods`);
    const pmMap = {};
    pmRows.forEach(p => { pmMap[p.code] = p.id; pmMap[p.id] = p.id; });

    const incRows = await query(`SELECT id, code FROM income_sources`);
    const incMap = {};
    incRows.forEach(i => { incMap[i.code] = i.id; incMap[i.id] = i.id; });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.toLowerCase().startsWith('contributor_id')) {
        continue;
      }

      // Simple CSV line parser supporting quoted strings
      const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const cleanParts = parts.map(p => p.replace(/^"|"$/g, '').trim());

      const contribCode = cleanParts[0];
      const amountStr = cleanParts[2];
      const sessCode = cleanParts[3];
      const pmCode = cleanParts[4];
      const incCode = cleanParts[5];
      const notes = cleanParts[6] || 'Batch CSV import';

      if (!contribCode || !amountStr) {
        continue;
      }

      const amount = parseInt(amountStr.replace(/\D/g, ''), 10);
      if (isNaN(amount) || amount <= 0) {
        continue;
      }

      // Lookup contributor
      const contributor = await get(`SELECT id FROM contributors WHERE code = ? OR id = ?`, [contribCode, contribCode]);
      if (!contributor) {
        errors.push(`Line ${i + 1}: Contributor ID '${contribCode}' not found`);
        errorCount++;
        continue;
      }

      const effectiveSessionId = (sessCode && sessionMap[sessCode]) || session_id || sessionRows[0].id;
      const effectivePmId = (pmCode && pmMap[pmCode]) || pmRows[0].id;
      const effectiveIncId = (incCode && incMap[incCode]) || incRows[0].id;

      // Unique hash for CSV idempotency
      const clientTxId = `csv-${contribCode}-${effectiveSessionId}-${amount}-${i}`;

      try {
        const result = await recordPayment({
          clientTxId,
          harvestId: 'hrv-2026',
          sessionId: effectiveSessionId,
          contributorId: contributor.id,
          isAnonymous: 0,
          amount,
          paymentMethodId: effectivePmId,
          incomeSourceId: effectiveIncId,
          notes
        }, req.user, req.headers['x-terminal-id']);

        if (result.isDuplicate) {
          duplicateCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        errors.push(`Line ${i + 1}: ${err.message}`);
        errorCount++;
      }
    }

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'CSV_BATCH_PAYMENT_UPLOAD',
      entityType: 'transactions',
      reason: `CSV batch upload: ${successCount} imported, ${duplicateCount} duplicates, ${errorCount} errors`
    });

    return res.json({
      message: 'CSV processing complete',
      successCount,
      duplicateCount,
      errorCount,
      errors
    });
  } catch (err) {
    console.error('CSV upload error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process CSV file' });
  }
});

// GET /api/sync/history
router.get('/history', async (req, res) => {
  try {
    const records = await query(`
      SELECT sr.*, u.full_name as operator_name 
      FROM sync_records sr 
      LEFT JOIN users u ON sr.operator_id = u.id 
      ORDER BY sr.synced_at DESC 
      LIMIT 50
    `);
    return res.json({ history: records });
  } catch (err) {
    console.error('Sync history error:', err);
    return res.status(500).json({ error: 'Failed to fetch sync history' });
  }
});

module.exports = router;
