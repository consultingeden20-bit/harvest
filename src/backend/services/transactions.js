const crypto = require('crypto');
const { query, get, run } = require('../db');
const { logAudit } = require('./audit');

function uuid() {
  return crypto.randomUUID();
}

async function generateNextTxCode(year = 2026) {
  const prefix = `TX-${year}-`;
  const allCodes = await query(
    `SELECT tx_code FROM transactions WHERE tx_code LIKE ?`,
    [`${prefix}%`]
  );

  let maxNum = 0;
  for (const row of allCodes) {
    if (row.tx_code) {
      const numPart = row.tx_code.replace(prefix, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

async function recordPayment({
  clientTxId = null,
  harvestId = 'hrv-2026',
  sessionId,
  contributorId = null,
  isAnonymous = 0,
  amount,
  paymentMethodId,
  incomeSourceId,
  notes = null,
  isOffline = 0,
  createdAt = null
}, user, terminalId = null) {
  const cleanAmount = parseInt(amount, 10);
  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    throw new Error('Payment amount must be a positive integer in FCFA');
  }

  if (clientTxId) {
    const existing = await get(`SELECT * FROM transactions WHERE client_tx_id = ?`, [clientTxId]);
    if (existing) {
      return { transaction: existing, isDuplicate: true };
    }
  }

  if (!isAnonymous && !contributorId) {
    throw new Error('Contributor ID is required for non-anonymous transactions');
  }

  const id = uuid();
  const txCode = await generateNextTxCode();
  const effectiveCreatedAt = createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19);
  const operatorId = user ? (user.id || user.userId || 'usr-admin') : 'usr-admin';

  await run(
    `INSERT INTO transactions (
      id, tx_code, client_tx_id, harvest_id, session_id, contributor_id,
      is_anonymous, amount, payment_method_id, income_source_id, notes,
      status, operator_id, terminal_id, is_offline, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 'SYNCED', ?, ?)`,
    [
      id, txCode, clientTxId || uuid(), harvestId, sessionId,
      isAnonymous ? null : contributorId,
      isAnonymous ? 1 : 0, cleanAmount, paymentMethodId, incomeSourceId, notes,
      operatorId, terminalId, isOffline ? 1 : 0,
      effectiveCreatedAt, effectiveCreatedAt
    ]
  );

  await logAudit({
    userId: operatorId,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: isAnonymous ? 'ANONYMOUS_PAYMENT_RECORDED' : 'PAYMENT_RECORDED',
    entityType: 'transactions',
    recordId: id,
    newValues: { txCode, amount: cleanAmount, session: sessionId, contributor: contributorId, isAnonymous },
    reason: `Harvest payment recorded: ${cleanAmount} FCFA`
  });

  const tx = await get(
    `SELECT 
      t.*, 
      hs.name_en as session_name_en, hs.name_fr as session_name_fr,
      pm.name_en as payment_method_en, pm.name_fr as payment_method_fr,
      inc.name_en as income_source_en, inc.name_fr as income_source_fr,
      c.name as contributor_name, c.code as contributor_code,
      u.full_name as operator_name,
      term.name as terminal_name
     FROM transactions t
     JOIN harvest_sessions hs ON t.session_id = hs.id
     JOIN payment_methods pm ON t.payment_method_id = pm.id
     JOIN income_sources inc ON t.income_source_id = inc.id
     LEFT JOIN contributors c ON t.contributor_id = c.id
     LEFT JOIN users u ON t.operator_id = u.id
     LEFT JOIN terminals term ON t.terminal_id = term.id
     WHERE t.id = ?`,
    [id]
  );

  return { transaction: tx, isDuplicate: false };
}

async function editPayment(txId, {
  amount,
  paymentMethodId,
  incomeSourceId,
  sessionId,
  notes,
  reason
}, user, terminalId = null) {
  const existing = await get(`SELECT * FROM transactions WHERE id = ?`, [txId]);
  if (!existing) {
    throw new Error('Transaction not found');
  }

  if (existing.status === 'REVERSED') {
    throw new Error('Cannot edit a reversed transaction');
  }

  const newAmount = amount !== undefined ? parseInt(amount, 10) : existing.amount;
  if (isNaN(newAmount) || newAmount <= 0) {
    throw new Error('Amount must be a positive integer in FCFA');
  }

  const operatorId = user ? (user.id || user.userId || 'usr-admin') : 'usr-admin';
  const originalAmount = existing.original_amount || existing.amount;

  await run(
    `UPDATE transactions 
     SET amount = ?,
         original_amount = ?,
         edit_reason = ?,
         payment_method_id = COALESCE(?, payment_method_id),
         income_source_id = COALESCE(?, income_source_id),
         session_id = COALESCE(?, session_id),
         notes = COALESCE(?, notes),
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      newAmount,
      originalAmount,
      reason || 'Payment amount correction',
      paymentMethodId,
      incomeSourceId,
      sessionId,
      notes,
      txId
    ]
  );

  await logAudit({
    userId: operatorId,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: 'PAYMENT_EDITED',
    entityType: 'transactions',
    recordId: txId,
    oldValues: {
      amount: existing.amount,
      paymentMethodId: existing.payment_method_id,
      sessionId: existing.session_id,
      notes: existing.notes
    },
    newValues: {
      amount: newAmount,
      originalAmount,
      paymentMethodId: paymentMethodId || existing.payment_method_id,
      sessionId: sessionId || existing.session_id,
      reason: reason || 'Correction'
    },
    reason: `Payment corrected from ₣${existing.amount.toLocaleString()} to ₣${newAmount.toLocaleString()}: ${reason || 'Correction'}`
  });

  const updatedTx = await get(`SELECT * FROM transactions WHERE id = ?`, [txId]);
  return { transaction: updatedTx, success: true };
}

async function reversePayment(txId, reason, user, terminalId = null) {
  const existing = await get(`SELECT * FROM transactions WHERE id = ?`, [txId]);
  if (!existing) {
    throw new Error('Transaction not found');
  }

  if (existing.status === 'REVERSED') {
    throw new Error('Transaction is already reversed');
  }

  const operatorId = user ? (user.id || user.userId || 'usr-admin') : 'usr-admin';

  await run(
    `UPDATE transactions SET status = 'REVERSED', reversal_reason = ?, updated_at = datetime('now') WHERE id = ?`,
    [reason, txId]
  );

  await logAudit({
    userId: operatorId,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: 'PAYMENT_REVERSED',
    entityType: 'transactions',
    recordId: txId,
    oldValues: { status: existing.status, amount: existing.amount },
    newValues: { status: 'REVERSED', reversalReason: reason },
    reason: reason || 'Manual financial transaction reversal'
  });

  return { success: true };
}

async function listTransactions({
  harvestId = 'hrv-2026',
  sessionId = null,
  contributorId = null,
  groupId = null,
  operatorId = null,
  status = 'COMPLETED',
  limit = 50,
  offset = 0,
  user = null
}) {
  let whereClauses = ['t.harvest_id = ?'];
  const params = [harvestId];

  if (sessionId) {
    whereClauses.push('t.session_id = ?');
    params.push(sessionId);
  }

  if (contributorId) {
    whereClauses.push('t.contributor_id = ?');
    params.push(contributorId);
  }

  if (operatorId) {
    whereClauses.push('t.operator_id = ?');
    params.push(operatorId);
  }

  if (status) {
    whereClauses.push('t.status = ?');
    params.push(status);
  }

  // Scoped User Check (Group Fin Sec & Scoped Collector)
  const isScoped = user && (user.roleCode === 'GROUP_FIN_SEC' || (user.roleCode === 'COLLECTOR' && user.assignedGroupIds && user.assignedGroupIds.length > 0));
  if (isScoped) {
    if (!user.assignedGroupIds || user.assignedGroupIds.length === 0) {
      return { transactions: [], total: 0, totalAmount: 0 };
    }
    const placeholders = user.assignedGroupIds.map(() => '?').join(',');
    whereClauses.push(`t.contributor_id IN (SELECT contributor_id FROM group_memberships WHERE group_id IN (${placeholders}))`);
    params.push(...user.assignedGroupIds);
  } else if (groupId) {
    whereClauses.push(`t.contributor_id IN (SELECT contributor_id FROM group_memberships WHERE group_id = ?)`);
    params.push(groupId);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const stats = await get(
    `SELECT COUNT(*) as total, COALESCE(SUM(t.amount), 0) as total_amount FROM transactions t ${whereSql}`,
    params
  );

  const listSql = `
    SELECT 
      t.*,
      hs.name_en as session_name_en, hs.name_fr as session_name_fr,
      pm.code as payment_method_code, pm.name_en as payment_method_en, pm.name_fr as payment_method_fr,
      inc.code as income_source_code, inc.name_en as income_source_en, inc.name_fr as income_source_fr,
      c.name as contributor_name, c.code as contributor_code,
      u.full_name as operator_name,
      term.name as terminal_name
    FROM transactions t
    JOIN harvest_sessions hs ON t.session_id = hs.id
    JOIN payment_methods pm ON t.payment_method_id = pm.id
    JOIN income_sources inc ON t.income_source_id = inc.id
    LEFT JOIN contributors c ON t.contributor_id = c.id
    LEFT JOIN users u ON t.operator_id = u.id
    LEFT JOIN terminals term ON t.terminal_id = term.id
    ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await query(listSql, [...params, limit, offset]);
  const isVerifier = user && user.roleCode === 'VERIFIER';

  const processedRows = rows.map(r => ({
    ...r,
    contributor_name: isVerifier && !r.is_anonymous ? `[CONFIDENTIAL - ${r.contributor_code}]` : r.contributor_name
  }));

  return {
    transactions: processedRows,
    total: stats ? stats.total : 0,
    totalAmount: stats ? stats.total_amount : 0
  };
}

module.exports = {
  generateNextTxCode,
  recordPayment,
  editPayment,
  reversePayment,
  listTransactions
};
