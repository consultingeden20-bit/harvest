const { query, get } = require('../db');

async function getChurchSummary(harvestId = 'hrv-2026') {
  // 1. Total Church Income (COUNTED ONCE PER TRANSACTION)
  const churchTx = await get(
    `SELECT 
      COUNT(*) as total_transactions,
      COUNT(DISTINCT contributor_id) as total_contributors_paid,
      COALESCE(SUM(amount), 0) as total_income
     FROM transactions
     WHERE harvest_id = ? AND status = 'COMPLETED'`,
    [harvestId]
  );

  // 2. Anonymous Contributions
  const anonRow = await get(
    `SELECT 
      COUNT(*) as anon_count,
      COALESCE(SUM(amount), 0) as anon_total
     FROM transactions
     WHERE harvest_id = ? AND is_anonymous = 1 AND status = 'COMPLETED'`,
    [harvestId]
  );

  // 3. Garden Sales Total
  const gardenRow = await get(
    `SELECT 
      COUNT(*) as total_sales,
      COALESCE(SUM(total_amount), 0) as garden_total
     FROM garden_sales
     WHERE harvest_id = ?`,
    [harvestId]
  );

  // 4. Total Target across all registered contributors for this harvest
  const targetRow = await get(
    `SELECT 
      COUNT(*) as registered_contributors,
      COALESCE(SUM(target_amount), 0) as total_target
     FROM commitment_targets
     WHERE harvest_id = ?`,
    [harvestId]
  );

  // 5. Breakdown by Session
  const sessionBreakdown = await query(
    `SELECT 
      hs.id as session_id,
      hs.session_code,
      hs.name_en,
      hs.name_fr,
      hs.session_date,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(t.amount), 0) as session_amount
     FROM harvest_sessions hs
     LEFT JOIN transactions t ON hs.id = t.session_id AND t.status = 'COMPLETED' AND t.harvest_id = ?
     WHERE hs.harvest_id = ?
     GROUP BY hs.id
     ORDER BY hs.display_order ASC`,
    [harvestId, harvestId]
  );

  // 6. Category Performance
  const categoryPerformance = await query(
    `SELECT 
      hc.id as category_id,
      hc.code,
      hc.name_en,
      hc.name_fr,
      hc.min_target,
      COUNT(DISTINCT ct.contributor_id) as contributor_count,
      COALESCE(SUM(ct.target_amount), 0) as total_target,
      COALESCE(SUM(t.amount), 0) as total_collected
     FROM harvest_categories hc
     LEFT JOIN commitment_targets ct ON hc.id = ct.category_id AND ct.harvest_id = ?
     LEFT JOIN transactions t ON ct.contributor_id = t.contributor_id AND t.harvest_id = ? AND t.status = 'COMPLETED'
     WHERE hc.harvest_id = ?
     GROUP BY hc.id
     ORDER BY hc.display_order ASC`,
    [harvestId, harvestId, harvestId]
  );

  // 7. Payment Methods Breakdown
  const paymentMethodBreakdown = await query(
    `SELECT 
      pm.id,
      pm.code,
      pm.name_en,
      pm.name_fr,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(t.amount), 0) as total_amount
     FROM payment_methods pm
     LEFT JOIN transactions t ON pm.id = t.payment_method_id AND t.harvest_id = ? AND t.status = 'COMPLETED'
     GROUP BY pm.id
     ORDER BY pm.display_order ASC`,
    [harvestId]
  );

  // 8. Income Sources Breakdown
  const incomeSourceBreakdown = await query(
    `SELECT 
      inc.id,
      inc.code,
      inc.name_en,
      inc.name_fr,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(t.amount), 0) as total_amount
     FROM income_sources inc
     LEFT JOIN transactions t ON inc.id = t.income_source_id AND t.harvest_id = ? AND t.status = 'COMPLETED'
     GROUP BY inc.id
     ORDER BY inc.display_order ASC`,
    [harvestId]
  );

  const totalIncome = (Number(churchTx.total_income) || 0) + (Number(gardenRow.garden_total) || 0);
  const totalTarget = Number(targetRow.total_target) || 0;
  const globalCompletionRate = totalTarget > 0 ? Number(((totalIncome / totalTarget) * 100).toFixed(2)) : 0;
  const outstandingCommitment = Math.max(0, totalTarget - (Number(churchTx.total_income) || 0));

  return {
    churchTotalIncome: totalIncome,
    directContributions: Number(churchTx.total_income) || 0,
    gardenSalesTotal: Number(gardenRow.garden_total) || 0,
    anonymousTotal: Number(anonRow.anon_total) || 0,
    totalTarget,
    outstandingCommitment,
    globalCompletionRate,
    totalTransactions: Number(churchTx.total_transactions) || 0,
    registeredContributors: Number(targetRow.registered_contributors) || 0,
    contributorsPaid: Number(churchTx.total_contributors_paid) || 0,
    sessions: sessionBreakdown,
    categories: categoryPerformance,
    paymentMethods: paymentMethodBreakdown,
    incomeSources: incomeSourceBreakdown
  };
}

async function getGroupAnalytics(harvestId = 'hrv-2026', user = null) {
  let groupWhere = 'g.is_active = 1';
  const groupParams = [];

  // Enforce Scope for Group Financial Authority
  if (user && user.roleCode === 'GROUP_FIN_SEC') {
    if (!user.assignedGroupIds || user.assignedGroupIds.length === 0) {
      return [];
    }
    const placeholders = user.assignedGroupIds.map(() => '?').join(',');
    groupWhere += ` AND g.id IN (${placeholders})`;
    groupParams.push(...user.assignedGroupIds);
  }

  const groups = await query(
    `SELECT g.id, g.code, g.name_en, g.name_fr, g.display_order 
     FROM groups g 
     WHERE ${groupWhere} 
     ORDER BY g.display_order ASC`,
    groupParams
  );

  const results = [];

  for (const grp of groups) {
    // Total members in group
    const memberRow = await get(
      `SELECT COUNT(DISTINCT contributor_id) as member_count 
       FROM group_memberships 
       WHERE group_id = ?`,
      [grp.id]
    );

    // Total target pledged by members of this group for this harvest
    const targetRow = await get(
      `SELECT COALESCE(SUM(ct.target_amount), 0) as group_target
       FROM commitment_targets ct
       JOIN group_memberships gm ON ct.contributor_id = gm.contributor_id
       WHERE ct.harvest_id = ? AND gm.group_id = ?`,
      [harvestId, grp.id]
    );

    // Total collected from members of this group (counted analytically for this group)
    const paidRow = await get(
      `SELECT 
        COUNT(t.id) as transaction_count,
        COUNT(DISTINCT t.contributor_id) as active_contributors,
        COALESCE(SUM(t.amount), 0) as group_collected
       FROM transactions t
       JOIN group_memberships gm ON t.contributor_id = gm.contributor_id
       WHERE t.harvest_id = ? AND gm.group_id = ? AND t.status = 'COMPLETED'`,
      [harvestId, grp.id]
    );

    const target = Number(targetRow.group_target) || 0;
    const collected = Number(paidRow.group_collected) || 0;
    const balance = Math.max(0, target - collected);
    const rate = target > 0 ? Number(((collected / target) * 100).toFixed(2)) : 100;

    results.push({
      groupId: grp.id,
      groupCode: grp.code,
      nameEn: grp.name_en,
      nameFr: grp.name_fr,
      memberCount: Number(memberRow.member_count) || 0,
      activeContributors: Number(paidRow.active_contributors) || 0,
      transactionCount: Number(paidRow.transaction_count) || 0,
      targetAmount: target,
      collectedAmount: collected,
      balanceAmount: balance,
      completionRate: rate
    });
  }

  return results;
}

function generateCSV(rows, headers) {
  if (!rows || rows.length === 0) return '';
  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [headerLabels.map(escapeCSV).join(',')];

  for (const row of rows) {
    const values = headerKeys.map(k => escapeCSV(row[k]));
    csvRows.push(values.join(','));
  }

  return csvRows.join('\r\n');
}

module.exports = {
  getChurchSummary,
  getGroupAnalytics,
  generateCSV
};
