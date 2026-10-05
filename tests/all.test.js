const { runFinancialTests } = require('./financial.test');
const { runMultiGroupTests } = require('./multigroup.test');
const { runSecurityTests } = require('./security.test');
const { runSyncTests } = require('./sync.test');
const { runReconciliationTests } = require('./reconciliation.test');
const { runE2EApiSimulation } = require('./e2e_api.test');

async function runAllTests() {
  console.log('===============================================================');
  console.log('  PC BASTOS HARVEST MANAGEMENT SYSTEM - FULL TEST SUITE');
  console.log('===============================================================');

  const startTime = Date.now();

  try {
    await runFinancialTests();
    await runMultiGroupTests();
    await runSecurityTests();
    await runSyncTests();
    await runReconciliationTests();
    await runE2EApiSimulation();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('===============================================================');
    console.log(`  ALL 6 TEST SUITES PASSED 100% SUCCESSFULLY! (${elapsed}s)`);
    console.log('===============================================================');
  } catch (err) {
    console.error('\n❌ CRITICAL TEST FAILURE:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
