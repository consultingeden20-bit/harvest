const crypto = require('crypto');
const { run, query } = require('../db');

function uuid() {
  return crypto.randomUUID();
}

async function logAudit({
  userId = null,
  userName = 'System',
  terminalId = null,
  action,
  entityType,
  recordId = null,
  oldValues = null,
  newValues = null,
  reason = null,
  ipAddress = null
}) {
  try {
    const id = uuid();
    const oldValStr = oldValues ? (typeof oldValues === 'string' ? oldValues : JSON.stringify(oldValues)) : null;
    const newValStr = newValues ? (typeof newValues === 'string' ? newValues : JSON.stringify(newValues)) : null;

    await run(
      `INSERT INTO audit_logs (
        id, user_id, user_name, terminal_id, action, entity_type, 
        record_id, old_values, new_values, reason, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, userId, userName, terminalId, action, entityType, recordId, oldValStr, newValStr, reason, ipAddress]
    );
    return id;
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

async function getAuditLogs({ limit = 100, offset = 0, action = null, entityType = null, userId = null, search = null }) {
  let sql = `
    SELECT al.*, u.username as actor_username, u.full_name as actor_name
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (action) {
    sql += ` AND al.action = ?`;
    params.push(action);
  }
  if (entityType) {
    sql += ` AND al.entity_type = ?`;
    params.push(entityType);
  }
  if (userId) {
    sql += ` AND al.user_id = ?`;
    params.push(userId);
  }
  if (search) {
    sql += ` AND (al.action LIKE ? OR al.user_name LIKE ? OR al.entity_type LIKE ? OR al.reason LIKE ? OR al.record_id LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }

  sql += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return await query(sql, params);
}

module.exports = {
  logAudit,
  getAuditLogs
};
