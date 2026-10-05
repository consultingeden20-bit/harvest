const assert = require('assert');
const { seed } = require('../src/backend/seed');
const { getSessionSystemTotals, recordReconciliation, listReconciliations } = require('../src/backend/services/reconciliation');

async function runReconciliationTests() {
  console.log('\n--- [TEST SUITE 5: Cash Verification & Session Reconciliation] ---');

  await seed();

  const harvestId = 'hrv-2026';
  const sessionId = 'sess-1'; // Session 1 has transactions and garden sales in seed
  const user = { id: 'usr-verifier-1', fullName: 'Session Cash Verifier' };

  // 1. Calculate System Total
  const system = await getSessionSystemTotals(harvestId, sessionId);
  console.log(`System Totals for Session 1: Cash=₣${system.systemCash.toLocaleString()}, MoMo=₣${system.systemMomo.toLocaleString()}, Total=₣${system.systemTotal.toLocaleString()}`);

  assert.ok(system.systemTotal > 0, 'System total should be greater than 0');

  // 2. Perfect Reconciliation Test (Discrepancy = 0)
  const recReconciled = await recordReconciliation({
    harvestId,
    sessionId,
    physicalCash: system.systemCash,
    physicalCheque: system.systemCheque,
    physicalTransfer: system.systemTransfer,
    physicalMomo: system.systemMomo,
    notes: 'Physical count exactly matches system register'
  }, user, 'term-verify-1');

  assert.strictEqual(recReconciled.status, 'RECONCILED');
  assert.strictEqual(recReconciled.discrepancy, 0);
  console.log('✔ Test 1 Passed: Perfect count produces status=RECONCILED and discrepancy=0');

  // 3. Discrepancy Test (Physical cash is short by ₣50,000)
  const recDiscrepancy = await recordReconciliation({
    harvestId,
    sessionId,
    physicalCash: system.systemCash - 50000,
    physicalCheque: system.systemCheque,
    physicalTransfer: system.systemTransfer,
    physicalMomo: system.systemMomo,
    notes: 'Cash shortfall of 50,000 FCFA identified during envelope count'
  }, user, 'term-verify-1');

  assert.strictEqual(recDiscrepancy.status, 'DISCREPANCY');
  assert.strictEqual(recDiscrepancy.discrepancy, -50000);
  console.log('✔ Test 2 Passed: Cash shortfall accurately flagged with status=DISCREPANCY and discrepancy=-₣50,000');

  console.log('All reconciliation tests passed successfully!\n');
}

if (require.main === module) {
  runReconciliationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Reconciliation test failure:', err);
      process.exit(1);
    });
}

module.exports = { runReconciliationTests };
