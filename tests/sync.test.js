const assert = require('assert');
const crypto = require('crypto');
const { seed } = require('../src/backend/seed');
const { processBatchPush, getSyncPull } = require('../src/backend/services/sync');
const { getContributorById } = require('../src/backend/services/contributors');
const { query } = require('../src/backend/db');

function uuid() {
  return crypto.randomUUID();
}

async function runSyncTests() {
  console.log('\n--- [TEST SUITE 4: Offline Synchronization & Idempotency] ---');

  await seed();

  const terminalA = 'term-cmf-1';
  const clientTx1 = uuid();
  const clientTx2 = uuid();
  const clientSale1 = uuid();
  const newOfflineContributorId = uuid();

  const pushPayload = {
    terminalId: terminalA,
    contributors: [
      {
        id: newOfflineContributorId,
        code: 'H26-888888',
        name: 'Offline Registered Member',
        phone: '+237 670 111 222',
        type_id: 'type-member',
        group_ids: ['grp-cmf'],
        target_amount: 500000
      }
    ],
    transactions: [
      {
        client_tx_id: clientTx1,
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        contributor_id: 'cnt-peter-n',
        amount: 400000,
        payment_method_id: 'pm-cash',
        income_source_id: 'src-commitment',
        notes: 'Offline cash collection at CMF desk'
      },
      {
        client_tx_id: clientTx2,
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        contributor_id: newOfflineContributorId,
        amount: 250000,
        payment_method_id: 'pm-cash',
        income_source_id: 'src-commitment',
        notes: 'First deposit offline'
      }
    ],
    gardenSales: [
      {
        client_sale_id: clientSale1,
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        product_id: 'prod-honey',
        product_name: 'Pure Organic Honey (1L)',
        quantity: 2,
        unit_price: 6000,
        payment_method_id: 'pm-cash',
        buyer_name: 'Offline Buyer'
      }
    ]
  };

  const user = { id: 'usr-collector-1', fullName: 'Desk Collector 1' };

  // 1. First Sync Push
  const pushRes1 = await processBatchPush(pushPayload, user);
  assert.strictEqual(pushRes1.status, 'SUCCESS');
  assert.strictEqual(pushRes1.uploadedCount, 4, 'Should upload 1 contributor, 2 transactions, 1 garden sale');
  assert.strictEqual(pushRes1.duplicatesCount, 0, 'No duplicates on initial upload');
  console.log('✔ Test 1 Passed: Offline batch push registers 4 new records');

  // Verify contributor and transaction in DB
  const offlineContributor = await getContributorById(newOfflineContributorId, 'hrv-2026', { roleCode: 'ADMIN' });
  assert.strictEqual(offlineContributor.name, 'Offline Registered Member');
  assert.strictEqual(offlineContributor.total_paid, 250000);
  assert.strictEqual(offlineContributor.balance, 250000);

  // 2. Repeat Synchronization (Idempotency Test - Prompt Requirement 16 & 39)
  const pushRes2 = await processBatchPush(pushPayload, user);
  assert.strictEqual(pushRes2.status, 'SUCCESS');
  assert.strictEqual(pushRes2.uploadedCount, 0, '0 new uploads on re-sync');
  assert.strictEqual(pushRes2.duplicatesCount, 4, 'All 4 records recognized as duplicates and safely ignored');
  console.log('✔ Test 2 Passed: Repeated sync is 100% idempotent (0 duplicates created, 4 acknowledged)');

  // 3. Master Pull Test
  const pullData = await getSyncPull('hrv-2026');
  assert.ok(pullData.contributors.length >= 7, 'Master pull returns all contributors');
  assert.ok(pullData.sessions.length === 5, 'Master pull returns all sessions');
  assert.ok(pullData.categories.length === 6, 'Master pull returns all categories');
  console.log('✔ Test 3 Passed: Master pull returns complete offline bundle');

  console.log('All sync & offline tests passed successfully!\n');
}

if (require.main === module) {
  runSyncTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Sync test failure:', err);
      process.exit(1);
    });
}

module.exports = { runSyncTests };
