const crypto = require('crypto');
const { query, get, run } = require('../db');
const { logAudit } = require('./audit');

function uuid() {
  return crypto.randomUUID();
}

async function getSessionSystemTotals(harvestId, sessionId) {
  // Aggregate transactions by payment method
  const txTotals = await query(
    `SELECT 
      pm.code as method_code,
      COALESCE(SUM(t.amount), 0) as amount
     FROM transactions t
     JOIN payment_methods pm ON t.payment_method_id = pm.id
     WHERE t.harvest_id = ? AND t.session_id = ? AND t.status = 'COMPLETED'
     GROUP BY pm.code`,
    [harvestId, sessionId]
  );

  // Aggregate garden sales by payment method
  const gardenTotals = await query(
    `SELECT 
      pm.code as method_code,
      COALESCE(SUM(gs.total_amount), 0) as amount
     FROM garden_sales gs
     JOIN payment_methods pm ON gs.payment_method_id = pm.id
     WHERE gs.harvest_id = ? AND gs.session_id = ?
     GROUP BY pm.code`,
    [harvestId, sessionId]
  );

  let systemCash = 0;
  let systemCheque = 0;
  let systemTransfer = 0;
  let systemMomo = 0;

  for (const row of [...txTotals, ...gardenTotals]) {
    const amt = Number(row.amount) || 0;
    if (row.method_code === 'CASH') systemCash += amt;
    else if (row.method_code === 'CHEQUE') systemCheque += amt;
    else if (row.method_code === 'BANK_TRANSFER') systemTransfer += amt;
    else if (row.method_code === 'MTN_MOMO' || row.method_code === 'ORANGE_MONEY') systemMomo += amt;
  }

  const systemTotal = systemCash + systemCheque + systemTransfer + systemMomo;

  return {
    systemCash,
    systemCheque,
    systemTransfer,
    systemMomo,
    systemTotal
  };
}

async function recordReconciliation(payload, user, terminalId = null) {
  const harvestId = payload.harvest_id || payload.harvestId || 'hrv-2026';
  const sessionId = payload.session_id || payload.sessionId;
  const physicalCash = payload.physical_cash !== undefined ? payload.physical_cash : payload.physicalCash;
  const physicalCheque = payload.physical_cheque !== undefined ? payload.physical_cheque : payload.physicalCheque;
  const physicalTransfer = payload.physical_transfer !== undefined ? payload.physical_transfer : payload.physicalTransfer;
  const physicalMomo = payload.physical_momo !== undefined ? payload.physical_momo : payload.physicalMomo;
  const notes = payload.notes || null;

  const pCash = parseInt(physicalCash, 10) || 0;
  const pCheque = parseInt(physicalCheque, 10) || 0;
  const pTransfer = parseInt(physicalTransfer, 10) || 0;
  const pMomo = parseInt(physicalMomo, 10) || 0;
  const physicalTotal = pCash + pCheque + pTransfer + pMomo;

  const system = await getSessionSystemTotals(harvestId, sessionId);
  const discrepancy = physicalTotal - system.systemTotal;
  const status = discrepancy === 0 ? 'RECONCILED' : 'DISCREPANCY';

  const id = uuid();
  const verifierId = user ? (user.id || user.userId || 'usr-admin') : 'usr-admin';

  await run(
    `INSERT INTO reconciliations (
      id, harvest_id, session_id, verified_by_user_id,
      physical_cash, physical_cheque, physical_transfer, physical_momo, physical_total,
      system_cash, system_cheque, system_transfer, system_momo, system_total,
      discrepancy, status, notes, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id, harvestId, sessionId, verifierId,
      pCash, pCheque, pTransfer, pMomo, physicalTotal,
      system.systemCash, system.systemCheque, system.systemTransfer, system.systemMomo, system.systemTotal,
      discrepancy, status, notes
    ]
  );

  await logAudit({
    userId: verifierId,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: 'RECONCILIATION_PERFORMED',
    entityType: 'reconciliations',
    recordId: id,
    newValues: {
      sessionId,
      physicalTotal,
      systemTotal: system.systemTotal,
      discrepancy,
      status
    },
    reason: `Cash verification performed: Status=${status}, Discrepancy=${discrepancy} FCFA`
  });

  const rec = await get(
    `SELECT r.*, hs.name_en as session_name_en, hs.name_fr as session_name_fr, u.full_name as verifier_name
     FROM reconciliations r
     JOIN harvest_sessions hs ON r.session_id = hs.id
     JOIN users u ON r.verified_by_user_id = u.id
     WHERE r.id = ?`,
    [id]
  );

  return rec;
}

async function listReconciliations(harvestId = 'hrv-2026') {
  return await query(
    `SELECT r.*, hs.name_en as session_name_en, hs.name_fr as session_name_fr, u.full_name as verifier_name
     FROM reconciliations r
     JOIN harvest_sessions hs ON r.session_id = hs.id
     JOIN users u ON r.verified_by_user_id = u.id
     WHERE r.harvest_id = ?
     ORDER BY r.verified_at DESC`,
    [harvestId]
  );
}

module.exports = {
  getSessionSystemTotals,
  recordReconciliation,
  listReconciliations
};
