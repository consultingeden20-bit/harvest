const crypto = require('crypto');
const { query, get, run } = require('../db');
const { recordPayment } = require('./transactions');
const { recordSale } = require('./garden');
const { createContributor } = require('./contributors');
const { logAudit } = require('./audit');

function uuid() {
  return crypto.randomUUID();
}

async function processBatchPush({
  terminalId,
  terminalCode,
  transactions = [],
  gardenSales = [],
  contributors = []
}, user) {
  let uploadedCount = 0;
  let duplicatesCount = 0;
  let conflictsCount = 0;
  const errors = [];
  const processedTxIds = [];

  // 1. Process new offline contributors first
  for (const c of contributors) {
    try {
      // Check if contributor already exists by code or ID
      const existing = await get(
        `SELECT id FROM contributors WHERE id = ? OR code = ?`,
        [c.id, c.code]
      );
      if (!existing) {
        await createContributor(c, user, terminalId);
        uploadedCount++;
      } else {
        duplicatesCount++;
      }
    } catch (err) {
      console.error('Error syncing contributor:', err);
      errors.push({ type: 'contributor', id: c.id, error: err.message });
      conflictsCount++;
    }
  }

  // 2. Process offline financial transactions
  for (const tx of transactions) {
    try {
      const result = await recordPayment({
        clientTxId: tx.client_tx_id || tx.id,
        harvestId: tx.harvest_id || 'hrv-2026',
        sessionId: tx.session_id,
        contributorId: tx.contributor_id,
        isAnonymous: tx.is_anonymous ? 1 : 0,
        amount: tx.amount,
        paymentMethodId: tx.payment_method_id,
        incomeSourceId: tx.income_source_id,
        notes: tx.notes,
        isOffline: 1,
        createdAt: tx.created_at
      }, user, terminalId);

      if (result.isDuplicate) {
        duplicatesCount++;
      } else {
        uploadedCount++;
      }
      processedTxIds.push(result.transaction.client_tx_id || result.transaction.id);
    } catch (err) {
      console.error('Error syncing transaction:', err);
      errors.push({ type: 'transaction', clientTxId: tx.client_tx_id, error: err.message });
      conflictsCount++;
    }
  }

  // 3. Process offline garden sales
  for (const gs of gardenSales) {
    try {
      const result = await recordSale({
        harvestId: gs.harvest_id || 'hrv-2026',
        sessionId: gs.session_id,
        productId: gs.product_id,
        productName: gs.product_name,
        quantity: gs.quantity,
        unitPrice: gs.unit_price,
        paymentMethodId: gs.payment_method_id,
        buyerName: gs.buyer_name,
        clientSaleId: gs.client_sale_id || gs.id,
        notes: gs.notes
      }, user, terminalId);

      if (result.isDuplicate) {
        duplicatesCount++;
      } else {
        uploadedCount++;
      }
    } catch (err) {
      console.error('Error syncing garden sale:', err);
      errors.push({ type: 'garden_sale', clientSaleId: gs.client_sale_id, error: err.message });
      conflictsCount++;
    }
  }

  // Update terminal last seen
  if (terminalId || terminalCode) {
    await run(
      `UPDATE terminals SET last_seen_at = datetime('now') WHERE id = ? OR terminal_code = ?`,
      [terminalId, terminalCode]
    );
  }

  // Record sync log
  const syncRecordId = uuid();
  const status = errors.length === 0 ? 'SUCCESS' : (uploadedCount > 0 ? 'PARTIAL' : 'FAILED');

  await run(
    `INSERT INTO sync_records (
      id, terminal_id, operator_id, sync_type, batch_size,
      uploaded_count, downloaded_count, conflicts_count, status, error_details, synced_at
    ) VALUES (?, ?, ?, 'PUSH', ?, ?, 0, ?, ?, ?, datetime('now'))`,
    [
      syncRecordId, terminalId || terminalCode, user ? user.id : 'usr-admin',
      transactions.length + gardenSales.length + contributors.length,
      uploadedCount, conflictsCount, status, errors.length > 0 ? JSON.stringify(errors) : null
    ]
  );

  await logAudit({
    userId: user ? user.id : null,
    userName: user ? user.fullName : 'System',
    terminalId,
    action: 'SYNC_PUSH_EXECUTED',
    entityType: 'sync',
    recordId: syncRecordId,
    newValues: { uploadedCount, duplicatesCount, conflictsCount, status },
    reason: `Offline terminal batch sync: ${uploadedCount} uploaded, ${duplicatesCount} duplicates, ${conflictsCount} conflicts`
  });

  return {
    syncRecordId,
    status,
    uploadedCount,
    duplicatesCount,
    conflictsCount,
    processedTxIds,
    errors,
    syncedAt: new Date().toISOString()
  };
}

async function getSyncPull(harvestId = 'hrv-2026', since = null) {
  // Fetch master data needed by offline terminals
  const harvest = await get(`SELECT * FROM harvests WHERE id = ?`, [harvestId]);
  const sessions = await query(`SELECT * FROM harvest_sessions WHERE harvest_id = ? ORDER BY display_order ASC`, [harvestId]);
  const categories = await query(`SELECT * FROM harvest_categories WHERE harvest_id = ? ORDER BY display_order ASC`, [harvestId]);
  const groups = await query(`SELECT * FROM groups WHERE is_active = 1 ORDER BY display_order ASC`);
  const incomeSources = await query(`SELECT * FROM income_sources WHERE is_active = 1 ORDER BY display_order ASC`);
  const paymentMethods = await query(`SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY display_order ASC`);
  const gardenProducts = await query(`SELECT * FROM garden_products WHERE harvest_id = ? AND is_active = 1`, [harvestId]);
  const contributorTypes = await query(`SELECT * FROM contributor_types`);

  // Fetch all contributors and memberships
  const contributors = await query(
    `SELECT 
      c.id, c.code, c.name, c.phone, c.email, c.type_id,
      COALESCE(ctarget.target_amount, 0) as target_amount,
      ctarget.category_id,
      COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN t.amount ELSE 0 END), 0) as total_paid
     FROM contributors c
     LEFT JOIN commitment_targets ctarget ON c.id = ctarget.contributor_id AND ctarget.harvest_id = ?
     LEFT JOIN transactions t ON c.id = t.contributor_id AND t.harvest_id = ?
     WHERE c.is_active = 1
     GROUP BY c.id`,
    [harvestId, harvestId]
  );

  const memberships = await query(`SELECT * FROM group_memberships`);

  // Map groups to contributors
  const groupMap = {};
  for (const m of memberships) {
    if (!groupMap[m.contributor_id]) groupMap[m.contributor_id] = [];
    groupMap[m.contributor_id].push(m.group_id);
  }

  const enrichedContributors = contributors.map(c => ({
    ...c,
    target_amount: Number(c.target_amount) || 0,
    total_paid: Number(c.total_paid) || 0,
    balance: Math.max(0, (Number(c.target_amount) || 0) - (Number(c.total_paid) || 0)),
    group_ids: groupMap[c.id] || []
  }));

  return {
    harvest,
    sessions,
    categories,
    groups,
    incomeSources,
    paymentMethods,
    gardenProducts,
    contributorTypes,
    contributors: enrichedContributors,
    pulledAt: new Date().toISOString()
  };
}

module.exports = {
  processBatchPush,
  getSyncPull
};
