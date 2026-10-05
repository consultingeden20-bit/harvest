const assert = require('assert');
const { seed } = require('../src/backend/seed');
const { authenticateUser, changePassword } = require('../src/backend/services/auth');
const { listContributors, getContributorById } = require('../src/backend/services/contributors');
const { listTransactions } = require('../src/backend/services/transactions');
const { getGroupAnalytics } = require('../src/backend/services/reports');

async function runSecurityTests() {
  console.log('\n--- [TEST SUITE 3: RBAC, Group Scoping & Password Security] ---');

  await seed();

  // Test 1: Authentication success & failure
  const badLogin = await authenticateUser('admin', 'WrongPass!');
  assert.ok(badLogin.error, 'Invalid credentials must return error');

  const goodAdmin = await authenticateUser('admin', 'Admin123!');
  assert.ok(goodAdmin.token, 'Admin login returns valid JWT token');
  assert.strictEqual(goodAdmin.user.roleCode, 'ADMIN');
  console.log('✔ Test 1 Passed: Authentication correctly verifies credentials and issues JWT');

  // Test 2: First-Login Temporary Password Force Change
  const tempUserLogin = await authenticateUser('temp_user', 'Temp1234!');
  assert.strictEqual(tempUserLogin.user.forcePasswordChange, true, 'Temporary user has forcePasswordChange = true');

  // Change password
  const changeRes = await changePassword(tempUserLogin.user.id, 'Temp1234!', 'NewSecurePass2026!');
  assert.strictEqual(changeRes.success, true, 'Password change successful');

  const reLogin = await authenticateUser('temp_user', 'NewSecurePass2026!');
  assert.strictEqual(reLogin.user.forcePasswordChange, false, 'forcePasswordChange flag cleared after change');
  console.log('✔ Test 2 Passed: Forced temporary password change on first login works');

  // Test 3: Group Financial Authority Scoped Isolation (CMF vs CYF vs CCI)
  const cmfUser = {
    userId: 'usr-cmf-sec',
    fullName: 'CMF Fin Sec',
    roleCode: 'GROUP_FIN_SEC',
    assignedGroupIds: ['grp-cmf']
  };

  // CMF Authority lists contributors
  const cmfContributors = await listContributors({
    harvestId: 'hrv-2026',
    user: cmfUser
  });

  // Check that all returned contributors belong to CMF
  for (const c of cmfContributors.contributors) {
    const hasCmf = c.groups.some(g => g.id === 'grp-cmf');
    assert.strictEqual(hasCmf, true, `Contributor ${c.name} must belong to CMF`);
  }
  console.log(`✔ Test 3 Passed: CMF Authority query automatically scoped to CMF members only (${cmfContributors.contributors.length} members)`);

  // Test 4: Scope IDOR Protection (CMF user trying to view a member only in CWF/Choir e.g. Marie T.)
  const forbiddenAccess = await getContributorById('cnt-marie-t', 'hrv-2026', cmfUser);
  assert.strictEqual(forbiddenAccess.forbidden, true, 'Accessing member outside assigned scope must return forbidden');
  console.log('✔ Test 4 Passed: IDOR protection blocks out-of-scope contributor access');

  // Test 5: Scoped Group Analytics
  const cmfAnalytics = await getGroupAnalytics('hrv-2026', cmfUser);
  assert.strictEqual(cmfAnalytics.length, 1, 'CMF Authority only receives analytics for CMF');
  assert.strictEqual(cmfAnalytics[0].groupCode, 'CMF');
  console.log('✔ Test 5 Passed: Group analytics API strictly enforces assigned group scope');

  console.log('All security & RBAC tests passed successfully!\n');
}

if (require.main === module) {
  runSecurityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Security test failure:', err);
      process.exit(1);
    });
}

module.exports = { runSecurityTests };
