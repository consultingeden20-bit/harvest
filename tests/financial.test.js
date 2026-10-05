const assert = require('assert');
const { getDb } = require('../src/backend/db');
const { seed } = require('../src/backend/seed');
const { getContributorById, createContributor } = require('../src/backend/services/contributors');
const { recordPayment, reversePayment, listTransactions } = require('../src/backend/services/transactions');

async function runFinancialTests() {
  console.log('\n--- [TEST SUITE 1: Financial Integrity & Calculations] ---');

  // Seed clean DB
  await seed();

  // Test 1: Peter N. initial state (Seeded: Target ₣3,000,000, Payments: ₣200,000 + ₣500,000 + ₣300,000 = ₣1,000,000)
  const peter = await getContributorById('cnt-peter-n', 'hrv-2026', { roleCode: 'ADMIN' });
  assert.strictEqual(peter.target_amount, 3000000, 'Target should be exactly 3,000,000 FCFA');
  assert.strictEqual(peter.total_paid, 1000000, 'Total paid should be exactly 1,000,000 FCFA');
  assert.strictEqual(peter.balance, 2000000, 'Balance should be exactly 2,000,000 FCFA');
  assert.strictEqual(peter.completion_percentage, 33.33, 'Completion should be exactly 33.33%');
  console.log('✔ Test 1 Passed: Peter N. initial payments calculate Target=₣3M, Paid=₣1M, Balance=₣2M, Completion=33.33%');

  // Test 2: Add 4th payment of ₣1,500,000
  const pay4 = await recordPayment({
    harvestId: 'hrv-2026',
    sessionId: 'sess-main',
    contributorId: 'cnt-peter-n',
    amount: 1500000,
    paymentMethodId: 'pm-cash',
    incomeSourceId: 'src-commitment'
  }, { id: 'usr-admin', fullName: 'Admin' }, 'term-central-1');

  const peterAfterPay4 = await getContributorById('cnt-peter-n', 'hrv-2026', { roleCode: 'ADMIN' });
  assert.strictEqual(peterAfterPay4.total_paid, 2500000, 'Total paid should now be 2,500,000 FCFA');
  assert.strictEqual(peterAfterPay4.balance, 500000, 'Balance should now be 500,000 FCFA');
  assert.strictEqual(peterAfterPay4.completion_percentage, 83.33, 'Completion should now be 83.33%');
  console.log('✔ Test 2 Passed: 4th payment of ₣1.5M updates Paid=₣2.5M, Balance=₣500K, Completion=83.33%');

  // Test 3: Overpayment Test (Add ₣1,000,000 when balance was ₣500,000)
  const pay5 = await recordPayment({
    harvestId: 'hrv-2026',
    sessionId: 'sess-thanksgiving',
    contributorId: 'cnt-peter-n',
    amount: 1000000,
    paymentMethodId: 'pm-transfer',
    incomeSourceId: 'src-commitment'
  }, { id: 'usr-admin', fullName: 'Admin' }, 'term-central-1');

  const peterOverpaid = await getContributorById('cnt-peter-n', 'hrv-2026', { roleCode: 'ADMIN' });
  assert.strictEqual(peterOverpaid.total_paid, 3500000, 'Total paid should now be 3,500,000 FCFA');
  assert.strictEqual(peterOverpaid.balance, 0, 'Balance cannot be negative in UI balance property');
  assert.strictEqual(peterOverpaid.completion_percentage, 116.67, 'Completion should be 116.67%');
  console.log('✔ Test 3 Passed: Overpayment correctly handled (Paid=₣3.5M, Balance=0, Completion=116.67%)');

  // Test 4: Payment Reversal Test
  await reversePayment(pay5.transaction.id, 'Duplicate entry correction', { id: 'usr-admin', fullName: 'Admin' }, 'term-central-1');
  const peterAfterReversal = await getContributorById('cnt-peter-n', 'hrv-2026', { roleCode: 'ADMIN' });
  assert.strictEqual(peterAfterReversal.total_paid, 2500000, 'Total paid should revert to 2,500,000 FCFA');
  assert.strictEqual(peterAfterReversal.balance, 500000, 'Balance should revert to 500,000 FCFA');
  console.log('✔ Test 4 Passed: Payment reversal restores previous balances and logs justification');

  console.log('All financial tests passed successfully!\n');
}

if (require.main === module) {
  runFinancialTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Financial test failure:', err);
      process.exit(1);
    });
}

module.exports = { runFinancialTests };
