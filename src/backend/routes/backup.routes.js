const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { query, exec, run } = require('../db');
const { logAudit } = require('../services/audit');

router.use(authenticateToken);
router.use(requireRoles('ADMIN'));

// GET /api/backup/export (Complete system snapshot export)
router.get('/export', async (req, res) => {
  try {
    const backup = {
      system: 'PC Bastos Harvest Management System',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user.username,
      tables: {
        roles: await query(`SELECT * FROM roles`),
        permissions: await query(`SELECT * FROM permissions`),
        role_permissions: await query(`SELECT * FROM role_permissions`),
        users: await query(`SELECT id, username, full_name, email, phone, password_hash, role_id, is_active, force_password_change, created_at, updated_at FROM users`),
        user_group_assignments: await query(`SELECT * FROM user_group_assignments`),
        groups: await query(`SELECT * FROM groups`),
        contributor_types: await query(`SELECT * FROM contributor_types`),
        contributors: await query(`SELECT * FROM contributors`),
        group_memberships: await query(`SELECT * FROM group_memberships`),
        harvests: await query(`SELECT * FROM harvests`),
        harvest_categories: await query(`SELECT * FROM harvest_categories`),
        harvest_sessions: await query(`SELECT * FROM harvest_sessions`),
        commitment_targets: await query(`SELECT * FROM commitment_targets`),
        income_sources: await query(`SELECT * FROM income_sources`),
        payment_methods: await query(`SELECT * FROM payment_methods`),
        transactions: await query(`SELECT * FROM transactions`),
        garden_products: await query(`SELECT * FROM garden_products`),
        garden_sales: await query(`SELECT * FROM garden_sales`),
        reconciliations: await query(`SELECT * FROM reconciliations`),
        collector_verifications: await query(`SELECT * FROM collector_verifications`),
        terminals: await query(`SELECT * FROM terminals`),
        audit_logs: await query(`SELECT * FROM audit_logs LIMIT 500`)
      }
    };

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'SYSTEM_BACKUP_EXPORTED',
      entityType: 'backup',
      reason: 'Administrator exported complete database snapshot'
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="harvest_backup_${Date.now()}.json"`);
    return res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error('Export backup error:', err);
    return res.status(500).json({ error: 'Failed to export system backup' });
  }
});

// POST /api/backup/restore (Emergency system restore)
router.post('/restore', async (req, res) => {
  try {
    const { backupData } = req.body;
    if (!backupData || !backupData.tables) {
      return res.status(400).json({ error: 'Invalid backup data format' });
    }

    const { tables } = backupData;

    // Restore tables
    if (tables.contributors) {
      for (const c of tables.contributors) {
        await run(`INSERT OR REPLACE INTO contributors (id, code, name, phone, email, type_id, notes, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.id, c.code, c.name, c.phone, c.email, c.type_id, c.notes, c.is_active, c.created_at, c.updated_at]);
      }
    }

    if (tables.group_memberships) {
      for (const gm of tables.group_memberships) {
        await run(`INSERT OR IGNORE INTO group_memberships (contributor_id, group_id, created_at) VALUES (?, ?, ?)`,
          [gm.contributor_id, gm.group_id, gm.created_at]);
      }
    }

    if (tables.commitment_targets) {
      for (const ct of tables.commitment_targets) {
        await run(`INSERT OR REPLACE INTO commitment_targets (id, harvest_id, contributor_id, category_id, target_amount, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [ct.id, ct.harvest_id, ct.contributor_id, ct.category_id, ct.target_amount, ct.notes, ct.created_at, ct.updated_at]);
      }
    }

    if (tables.transactions) {
      for (const t of tables.transactions) {
        await run(`INSERT OR REPLACE INTO transactions (id, tx_code, client_tx_id, harvest_id, session_id, contributor_id, is_anonymous, amount, original_amount, edit_reason, payment_method_id, income_source_id, notes, status, reversal_reason, operator_id, terminal_id, is_offline, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.tx_code, t.client_tx_id, t.harvest_id, t.session_id, t.contributor_id, t.is_anonymous, t.amount, t.original_amount, t.edit_reason, t.payment_method_id, t.income_source_id, t.notes, t.status, t.reversal_reason, t.operator_id, t.terminal_id, t.is_offline, t.sync_status, t.created_at, t.updated_at]);
      }
    }

    if (tables.garden_sales) {
      for (const gs of tables.garden_sales) {
        await run(`INSERT OR REPLACE INTO garden_sales (id, harvest_id, session_id, product_id, product_name, quantity, unit_price, total_amount, payment_method_id, operator_id, terminal_id, buyer_name, client_sale_id, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [gs.id, gs.harvest_id, gs.session_id, gs.product_id, gs.product_name, gs.quantity, gs.unit_price, gs.total_amount, gs.payment_method_id, gs.operator_id, gs.terminal_id, gs.buyer_name, gs.client_sale_id, gs.notes, gs.created_at]);
      }
    }

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'SYSTEM_BACKUP_RESTORED',
      entityType: 'backup',
      reason: 'Administrator restored system state from backup archive'
    });

    return res.json({ message: 'System state restored successfully from backup archive' });
  } catch (err) {
    console.error('Restore backup error:', err);
    return res.status(500).json({ error: err.message || 'Failed to restore system backup' });
  }
});

module.exports = router;
