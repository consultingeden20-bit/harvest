const crypto = require('crypto');
const { query, get, run } = require('../db');
const { logAudit } = require('./audit');

function uuid() {
  return crypto.randomUUID();
}

async function generateNextContributorCode(harvestYear = 2026) {
  const prefix = `H${String(harvestYear).slice(-2)}-`;
  const allCodes = await query(
    `SELECT code FROM contributors WHERE code LIKE ?`,
    [`${prefix}%`]
  );

  let maxNum = 0;
  for (const row of allCodes) {
    if (row.code) {
      const numPart = row.code.replace(prefix, '');
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

async function checkDuplicateName(name, excludeId = null) {
  if (!name || !name.trim()) return [];
  const cleanName = name.trim().toLowerCase();

  let sql = `
    SELECT c.id, c.code, c.name, c.phone, ct.name_en as type_name_en, ct.name_fr as type_name_fr
    FROM contributors c
    LEFT JOIN contributor_types ct ON c.type_id = ct.id
    WHERE LOWER(TRIM(c.name)) = ? AND c.is_active = 1
  `;
  const params = [cleanName];

  if (excludeId) {
    sql += ` AND c.id != ?`;
    params.push(excludeId);
  }

  return await query(sql, params);
}

async function listContributors({
  search = null,
  groupId = null,
  harvestId = 'hrv-2026',
  limit = 100,
  offset = 0,
  user = null
}) {
  let whereClauses = ['c.is_active = 1'];
  const params = [];

  // Group Financial Authority and Scoped Collector scope restriction
  const isScoped = user && (user.roleCode === 'GROUP_FIN_SEC' || (user.roleCode === 'COLLECTOR' && user.assignedGroupIds && user.assignedGroupIds.length > 0));
  if (isScoped) {
    if (!user.assignedGroupIds || user.assignedGroupIds.length === 0) {
      return { contributors: [], total: 0 };
    }
    const placeholders = user.assignedGroupIds.map(() => '?').join(',');
    whereClauses.push(`c.id IN (SELECT contributor_id FROM group_memberships WHERE group_id IN (${placeholders}))`);
    params.push(...user.assignedGroupIds);
  }

  // Specific Group Filter
  if (groupId) {
    whereClauses.push(`c.id IN (SELECT contributor_id FROM group_memberships WHERE group_id = ?)`);
    params.push(groupId);
  }

  // Search filter
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    whereClauses.push(`(c.code LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)`);
    params.push(s, s, s, s);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count
  const countRow = await get(`SELECT COUNT(*) as total FROM contributors c ${whereSql}`, params);
  const total = countRow ? countRow.total : 0;

  // Get records with targets and total paid
  const listParams = [harvestId, harvestId, ...params, limit, offset];
  const listSql = `
    SELECT 
      c.id,
      c.code,
      c.name,
      c.phone,
      c.email,
      c.type_id,
      ct.name_en as type_name_en,
      ct.name_fr as type_name_fr,
      COALESCE(ctarget.target_amount, 0) as target_amount,
      ctarget.category_id,
      hcat.code as category_code,
      hcat.name_en as category_name_en,
      hcat.name_fr as category_name_fr,
      COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN t.amount ELSE 0 END), 0) as total_paid,
      c.created_at
    FROM contributors c
    LEFT JOIN contributor_types ct ON c.type_id = ct.id
    LEFT JOIN commitment_targets ctarget ON c.id = ctarget.contributor_id AND ctarget.harvest_id = ?
    LEFT JOIN harvest_categories hcat ON ctarget.category_id = hcat.id
    LEFT JOIN transactions t ON c.id = t.contributor_id AND t.harvest_id = ?
    ${whereSql}
    GROUP BY c.id
    ORDER BY c.name ASC
    LIMIT ? OFFSET ?
  `;

  const rows = await query(listSql, listParams);

  // Fetch groups for each contributor
  const contributorIds = rows.map(r => r.id);
  let groupMap = {};
  if (contributorIds.length > 0) {
    const inPlaceholders = contributorIds.map(() => '?').join(',');
    const groupRows = await query(
      `SELECT gm.contributor_id, g.id, g.code, g.name_en, g.name_fr 
       FROM group_memberships gm 
       JOIN groups g ON gm.group_id = g.id 
       WHERE gm.contributor_id IN (${inPlaceholders})
       ORDER BY g.display_order ASC`,
      contributorIds
    );

    for (const gr of groupRows) {
      if (!groupMap[gr.contributor_id]) {
        groupMap[gr.contributor_id] = [];
      }
      groupMap[gr.contributor_id].push({
        id: gr.id,
        code: gr.code,
        name_en: gr.name_en,
        name_fr: gr.name_fr
      });
    }
  }

  // Calculate balance & percentage + Privacy Anonymization for Finance Verifier
  const isVerifier = user && user.roleCode === 'VERIFIER';

  const contributors = rows.map(r => {
    const target = Number(r.target_amount) || 0;
    const paid = Number(r.total_paid) || 0;
    const balance = Math.max(0, target - paid);
    const completionPct = target > 0 ? Number(((paid / target) * 100).toFixed(2)) : 100;

    return {
      ...r,
      name: isVerifier ? `[CONFIDENTIAL DONOR - ${r.code}]` : r.name,
      phone: isVerifier ? '[HIDDEN]' : r.phone,
      email: isVerifier ? '[HIDDEN]' : r.email,
      target_amount: target,
      total_paid: paid,
      balance,
      completion_percentage: completionPct,
      groups: groupMap[r.id] || []
    };
  });

  return { contributors, total };
}

async function getContributorById(id, harvestId = 'hrv-2026', user = null) {
  const c = await get(
    `SELECT 
      c.id, c.code, c.name, c.phone, c.email, c.type_id, c.notes,
      ct.name_en as type_name_en, ct.name_fr as type_name_fr,
      COALESCE(ctarget.target_amount, 0) as target_amount,
      ctarget.category_id,
      hcat.code as category_code,
      hcat.name_en as category_name_en,
      hcat.name_fr as category_name_fr,
      c.created_at
     FROM contributors c
     LEFT JOIN contributor_types ct ON c.type_id = ct.id
     LEFT JOIN commitment_targets ctarget ON c.id = ctarget.contributor_id AND ctarget.harvest_id = ?
     LEFT JOIN harvest_categories hcat ON ctarget.category_id = hcat.id
     WHERE c.id = ? AND c.is_active = 1`,
    [harvestId, id]
  );

  if (!c) return null;

  // Fetch groups
  const groups = await query(
    `SELECT g.id, g.code, g.name_en, g.name_fr 
     FROM group_memberships gm 
     JOIN groups g ON gm.group_id = g.id 
     WHERE gm.contributor_id = ?
     ORDER BY g.display_order ASC`,
    [id]
  );

  // Group Scope Security Check (Group Fin Sec & Scoped Collector)
  const isScoped = user && (user.roleCode === 'GROUP_FIN_SEC' || (user.roleCode === 'COLLECTOR' && user.assignedGroupIds && user.assignedGroupIds.length > 0));
  if (isScoped) {
    const memberGroupIds = groups.map(g => g.id);
    const hasAccess = memberGroupIds.some(gid => user.assignedGroupIds.includes(gid));
    if (!hasAccess) {
      return { forbidden: true };
    }
  }

  // Fetch payments
  const payments = await query(
    `SELECT 
      t.id, t.tx_code, t.amount, t.original_amount, t.edit_reason, t.status, t.created_at, t.updated_at, t.notes,
      hs.session_code, hs.name_en as session_name_en, hs.name_fr as session_name_fr,
      pm.code as payment_method_code, pm.name_en as payment_method_en, pm.name_fr as payment_method_fr,
      inc.code as income_source_code, inc.name_en as income_source_en, inc.name_fr as income_source_fr,
      u.full_name as operator_name,
      term.name as terminal_name
     FROM transactions t
     JOIN harvest_sessions hs ON t.session_id = hs.id
     JOIN payment_methods pm ON t.payment_method_id = pm.id
     JOIN income_sources inc ON t.income_source_id = inc.id
     LEFT JOIN users u ON t.operator_id = u.id
     LEFT JOIN terminals term ON t.terminal_id = term.id
     WHERE t.contributor_id = ? AND t.harvest_id = ?
     ORDER BY t.created_at ASC`,
    [id, harvestId]
  );

  const target = Number(c.target_amount) || 0;
  let totalPaid = 0;
  let runningBalance = target;

  const paymentHistory = payments.map(p => {
    const isCompleted = p.status === 'COMPLETED';
    if (isCompleted) {
      totalPaid += Number(p.amount);
      runningBalance = Math.max(0, target - totalPaid);
    }
    return {
      ...p,
      amount: Number(p.amount),
      running_total: totalPaid,
      running_balance: runningBalance
    };
  });

  const balance = Math.max(0, target - totalPaid);
  const completionPct = target > 0 ? Number(((totalPaid / target) * 100).toFixed(2)) : 100;

  const isVerifier = user && user.roleCode === 'VERIFIER';

  return {
    ...c,
    name: isVerifier ? `[CONFIDENTIAL DONOR - ${c.code}]` : c.name,
    phone: isVerifier ? '[HIDDEN]' : c.phone,
    email: isVerifier ? '[HIDDEN]' : c.email,
    target_amount: target,
    total_paid: totalPaid,
    balance,
    completion_percentage: completionPct,
    groups,
    payments: paymentHistory
  };
}

async function createContributor(data, user, terminalId = null) {
  const id = data.id || uuid();
  const code = data.code || await generateNextContributorCode();
  const harvestId = data.harvest_id || 'hrv-2026';

  await run(
    `INSERT INTO contributors (id, code, name, phone, email, type_id, notes, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, code, data.name.trim(), data.phone ? data.phone.trim() : null, data.email ? data.email.trim() : null, data.type_id || 'type-member', data.notes || null]
  );

  // Group memberships
  if (Array.isArray(data.group_ids)) {
    for (const gid of data.group_ids) {
      await run(
        `INSERT OR IGNORE INTO group_memberships (contributor_id, group_id) VALUES (?, ?)`,
        [id, gid]
      );
    }
  }

  // Target
  if (data.target_amount !== undefined || data.category_id) {
    const targetId = uuid();
    await run(
      `INSERT INTO commitment_targets (id, harvest_id, contributor_id, category_id, target_amount, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetId, harvestId, id, data.category_id || null, data.target_amount || 0, data.target_notes || null]
    );
  }

  await logAudit({
    userId: user ? (user.id || user.userId) : null,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: 'CONTRIBUTOR_CREATED',
    entityType: 'contributors',
    recordId: id,
    newValues: { code, name: data.name, phone: data.phone, groups: data.group_ids, target: data.target_amount },
    reason: 'New contributor registration'
  });

  return await getContributorById(id, harvestId, user);
}

async function updateContributor(id, data, user, terminalId = null) {
  const existing = await get(`SELECT * FROM contributors WHERE id = ?`, [id]);
  if (!existing) return null;

  await run(
    `UPDATE contributors 
     SET name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         email = COALESCE(?, email),
         type_id = COALESCE(?, type_id),
         notes = COALESCE(?, notes),
         updated_at = datetime('now')
     WHERE id = ?`,
    [data.name ? data.name.trim() : null, data.phone ? data.phone.trim() : null, data.email ? data.email.trim() : null, data.type_id, data.notes, id]
  );

  // Update Groups if provided
  if (Array.isArray(data.group_ids)) {
    await run(`DELETE FROM group_memberships WHERE contributor_id = ?`, [id]);
    for (const gid of data.group_ids) {
      await run(`INSERT INTO group_memberships (contributor_id, group_id) VALUES (?, ?)`, [id, gid]);
    }
  }

  // Update Target if provided
  const harvestId = data.harvest_id || 'hrv-2026';
  if (data.target_amount !== undefined || data.category_id) {
    const existingTarget = await get(
      `SELECT id FROM commitment_targets WHERE harvest_id = ? AND contributor_id = ?`,
      [harvestId, id]
    );

    if (existingTarget) {
      await run(
        `UPDATE commitment_targets 
         SET target_amount = COALESCE(?, target_amount),
             category_id = COALESCE(?, category_id),
             notes = COALESCE(?, notes),
             updated_at = datetime('now')
         WHERE id = ?`,
        [data.target_amount, data.category_id, data.target_notes, existingTarget.id]
      );
    } else {
      await run(
        `INSERT INTO commitment_targets (id, harvest_id, contributor_id, category_id, target_amount, notes) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuid(), harvestId, id, data.category_id || null, data.target_amount || 0, data.target_notes || null]
      );
    }
  }

  await logAudit({
    userId: user ? (user.id || user.userId) : null,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: 'CONTRIBUTOR_UPDATED',
    entityType: 'contributors',
    recordId: id,
    oldValues: existing,
    newValues: data,
    reason: 'Contributor details updated'
  });

  return await getContributorById(id, harvestId, user);
}

module.exports = {
  listContributors,
  getContributorById,
  createContributor,
  updateContributor,
  generateNextContributorCode,
  checkDuplicateName
};
