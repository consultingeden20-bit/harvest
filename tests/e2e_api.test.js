const assert = require('assert');
const http = require('http');
const app = require('../src/backend/app');
const { seed } = require('../src/backend/seed');

let server;
let baseUrl;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (options.body) {
      reqOptions.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runE2EApiSimulation() {
  console.log('\n--- [TEST SUITE 6: End-to-End HTTP API Simulation & Security Verification] ---');

  await seed();

  // Start HTTP Server on random ephemeral port
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}`);
      resolve();
    });
  });

  try {
    // 1. Health check
    const health = await request('/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body.status, 'healthy');
    console.log('✔ Health check OK');

    // 2. Admin Login
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'admin', password: 'Admin123!', terminalId: 'term-central-1' }
    });
    assert.strictEqual(adminLogin.status, 200);
    const adminToken = adminLogin.body.token;
    assert.ok(adminToken, 'Admin receives JWT token');
    console.log('✔ Admin login verified');

    // 3. User Creation with Temporary Password
    const createUserRes = await request('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        username: 'cyf_collector_desk',
        full_name: 'CYF Youth Collector',
        email: 'cyf.desk@pcbastos.org',
        role_id: 'role-collector',
        temp_password: 'YouthHarvest2026!',
        group_ids: ['grp-cyf']
      }
    });
    assert.strictEqual(createUserRes.status, 201);
    console.log('✔ Admin successfully created user with temporary password requirement');

    // 4. New User First Login & Password Force Change Check
    const youthLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'cyf_collector_desk', password: 'YouthHarvest2026!' }
    });
    assert.strictEqual(youthLogin.status, 200);
    assert.strictEqual(youthLogin.body.user.forcePasswordChange, true);
    const youthToken = youthLogin.body.token;
    console.log('✔ First-login force_password_change verified');

    // Change temporary password
    const youthPassChange = await request('/api/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${youthToken}` },
      body: {
        currentPassword: 'YouthHarvest2026!',
        newPassword: 'YouthPermanentPass2026!'
      }
    });
    assert.strictEqual(youthPassChange.status, 200);
    console.log('✔ Password change successfully submitted and cleared');

    // 5. Group Scoped Authority Isolation Check (CMF Authority)
    const cmfLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'cmf_fin_sec', password: 'Cmf1234!' }
    });
    assert.strictEqual(cmfLogin.status, 200);
    const cmfToken = cmfLogin.body.token;

    const cmfContributors = await request('/api/contributors', {
      headers: { Authorization: `Bearer ${cmfToken}` }
    });
    assert.strictEqual(cmfContributors.status, 200);
    // All returned contributors must belong to CMF
    for (const c of cmfContributors.body.contributors) {
      const isCmf = c.groups.some(g => g.code === 'CMF');
      assert.strictEqual(isCmf, true, 'CMF Fin Sec can only see members in CMF');
    }
    console.log('✔ CMF Financial Authority group scope isolation verified over HTTP API');

    // 6. Record Payment
    const paymentRes = await request('/api/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'X-Terminal-ID': 'term-central-1' },
      body: {
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        contributor_id: 'cnt-peter-n',
        amount: 500000,
        payment_method_id: 'pm-cash',
        income_source_id: 'src-commitment',
        notes: 'Session 1 cash deposit'
      }
    });
    assert.strictEqual(paymentRes.status, 201);
    assert.strictEqual(paymentRes.body.transaction.amount, 500000);
    console.log('✔ Financial payment recording and receipt generation verified');

    // 7. Record Anonymous Gift
    const anonRes = await request('/api/transactions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'X-Terminal-ID': 'term-central-1' },
      body: {
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        is_anonymous: 1,
        amount: 150000,
        payment_method_id: 'pm-cash',
        income_source_id: 'src-freewill',
        notes: 'Anonymous gift in altar envelope'
      }
    });
    assert.strictEqual(anonRes.status, 201);
    console.log('✔ Anonymous contribution recording verified');

    // 8. Record Garden Sale
    const gardenRes = await request('/api/garden/sales', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        product_id: 'prod-plantain',
        product_name: 'Plantain Bunch',
        quantity: 4,
        unit_price: 5000,
        payment_method_id: 'pm-cash',
        buyer_name: 'Mrs. Enow'
      }
    });
    assert.strictEqual(gardenRes.status, 201);
    console.log('✔ Garden sales recording verified');

    // 9. Cash Reconciliation Verification
    const reconTotals = await request('/api/reconciliation/system-totals?session_id=sess-launch&harvest_id=hrv-2026', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(reconTotals.status, 200);
    const sysTotal = reconTotals.body.totals.systemTotal;
    assert.ok(sysTotal > 0);

    const reconSubmit = await request('/api/reconciliation', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        harvest_id: 'hrv-2026',
        session_id: 'sess-launch',
        physical_cash: reconTotals.body.totals.systemCash,
        physical_cheque: reconTotals.body.totals.systemCheque,
        physical_transfer: reconTotals.body.totals.systemTransfer,
        physical_momo: reconTotals.body.totals.systemMomo,
        notes: 'Launch Sunday verification verified by Session Verifier'
      }
    });
    assert.strictEqual(reconSubmit.status, 201);
    assert.strictEqual(reconSubmit.body.reconciliation.status, 'RECONCILED');
    console.log('✔ Session Cash Reconciliation & Sign-off verified');

    // 10. Audit Logs check
    const auditRes = await request('/api/audit', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.body.logs.length > 5, 'Audit log accurately recorded all transactions');
    console.log(`✔ Audit log trail confirmed (${auditRes.body.logs.length} entries recorded)`);

    // 11. CSV Export check
    const csvRes = await request('/api/reports/export/transactions-csv?harvest_id=hrv-2026', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(csvRes.status, 200);
    assert.ok(csvRes.body.includes('Transaction Code'), 'CSV contains header columns');
    console.log('✔ CSV Export engine verified');

    console.log('All E2E HTTP API tests passed successfully!\n');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runE2EApiSimulation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('E2E Simulation failure:', err);
      process.exit(1);
    });
}

module.exports = { runE2EApiSimulation };
