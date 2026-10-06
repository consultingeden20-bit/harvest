const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { get, query, run } = require('../db');
const { logAudit } = require('./audit');

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'pc_bastos_harvest_production_secret_key_2026';
const TOKEN_EXPIRY = '12h';

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function authenticateUser(username, password, terminalId = null, ipAddress = null) {
  const user = await get(
    `SELECT u.*, r.code as role_code, r.name_en as role_name_en, r.name_fr as role_name_fr
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = ?`,
    [username]
  );

  if (!user) {
    await logAudit({
      userName: username,
      terminalId,
      action: 'LOGIN_FAILED_USER_NOT_FOUND',
      entityType: 'auth',
      reason: `Failed login attempt for username '${username}'`,
      ipAddress
    });
    return { error: 'Invalid username or password' };
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    await logAudit({
      userId: user.id,
      userName: user.full_name,
      terminalId,
      action: 'LOGIN_FAILED_BAD_PASSWORD',
      entityType: 'auth',
      reason: `Incorrect password for user '${user.username}'`,
      ipAddress
    });
    return { error: 'Invalid username or password' };
  }

  // Check if user is active
  if (!user.is_active) {
    await logAudit({
      userId: user.id,
      userName: user.full_name,
      terminalId,
      action: 'LOGIN_FAILED_ACCOUNT_INACTIVE',
      entityType: 'auth',
      reason: `Login attempt for inactive user '${user.username}'`,
      ipAddress
    });
    return { error: 'Account is deactivated. Please contact your system administrator.' };
  }

  // Fetch assigned group scopes
  const userGroups = await query(
    `SELECT g.id, g.code, g.name_en, g.name_fr 
     FROM user_group_assignments uga 
     JOIN groups g ON uga.group_id = g.id 
     WHERE uga.user_id = ?`,
    [user.id]
  );

  const assignedGroupIds = userGroups.map(g => g.id);
  const assignedGroupCodes = userGroups.map(g => g.code);

  const tokenPayload = {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    roleId: user.role_id,
    roleCode: user.role_code,
    roleNameEn: user.role_name_en,
    roleNameFr: user.role_name_fr,
    assignedGroupIds,
    assignedGroupCodes,
    forcePasswordChange: Boolean(user.force_password_change)
  };

  const token = generateToken(tokenPayload);

  await logAudit({
    userId: user.id,
    userName: user.full_name,
    terminalId,
    action: 'LOGIN_SUCCESS',
    entityType: 'auth',
    reason: `User logged in from ${ipAddress || 'unknown'}`,
    ipAddress
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      roleCode: user.role_code,
      roleNameEn: user.role_name_en,
      roleNameFr: user.role_name_fr,
      assignedGroups: userGroups,
      forcePasswordChange: Boolean(user.force_password_change)
    }
  };
}

async function changePassword(userId, currentPassword, newPassword, terminalId = null, ipAddress = null) {
  const user = await get(`SELECT * FROM users WHERE id = ?`, [userId]);
  if (!user) {
    return { error: 'User not found' };
  }

  const isCurrentValid = await verifyPassword(currentPassword, user.password_hash);
  if (!isCurrentValid) {
    return { error: 'Current password is incorrect' };
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters long' };
  }

  const newHash = await hashPassword(newPassword);
  await run(
    `UPDATE users SET password_hash = ?, force_password_change = 0, updated_at = datetime('now') WHERE id = ?`,
    [newHash, userId]
  );

  await logAudit({
    userId: user.id,
    userName: user.full_name,
    terminalId,
    action: 'PASSWORD_CHANGED',
    entityType: 'users',
    recordId: user.id,
    reason: 'User successfully changed password',
    ipAddress
  });

  return { success: true };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authenticateUser,
  changePassword
};
