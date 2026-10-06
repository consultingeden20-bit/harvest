const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { query, get, run } = require('../db');
const { logAudit } = require('../services/audit');

const SALT_ROUNDS = 12;

function uuid() {
  return crypto.randomUUID();
}

// All user management routes require ADMIN role
router.use(authenticateToken);
router.use(requireRoles('ADMIN'));

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await query(`
      SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role_id,
             u.is_active, u.force_password_change, u.created_at,
             r.code as role_code, r.name_en as role_name_en, r.name_fr as role_name_fr
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at ASC
    `);

    // Attach assigned groups
    for (const u of users) {
      const groups = await query(
        `SELECT g.id, g.code, g.name_en, g.name_fr 
         FROM user_group_assignments uga 
         JOIN groups g ON uga.group_id = g.id 
         WHERE uga.user_id = ?`,
        [u.id]
      );
      u.assignedGroups = groups;
    }

    return res.json({ users });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users (Create user with temporary password)
router.post('/', async (req, res) => {
  try {
    const { username, full_name, email, phone, role_id, temp_password, group_ids } = req.body;

    if (!username || !full_name || !role_id || !temp_password) {
      return res.status(400).json({ error: 'Username, Full Name, Role, and Temporary Password are required' });
    }

    const existing = await get(`SELECT id FROM users WHERE username = ?`, [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const id = uuid();
    const hash = await bcrypt.hash(temp_password, SALT_ROUNDS);

    await run(
      `INSERT INTO users (id, username, full_name, email, phone, password_hash, role_id, is_active, force_password_change, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, datetime('now'), datetime('now'))`,
      [id, username, full_name, email || null, phone || null, hash, role_id]
    );

    // Assign group scopes if provided
    if (Array.isArray(group_ids)) {
      for (const gid of group_ids) {
        await run(`INSERT INTO user_group_assignments (user_id, group_id) VALUES (?, ?)`, [id, gid]);
      }
    }

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'USER_CREATED',
      entityType: 'users',
      recordId: id,
      newValues: { username, full_name, role_id, group_ids, force_password_change: 1 },
      reason: 'Administrator created new user with temporary password'
    });

    return res.status(201).json({ message: 'User created successfully with temporary password requirement', userId: id });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id/reset-password (Admin sets new temporary password)
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { temp_password } = req.body;
    const userId = req.params.id;

    if (!temp_password || temp_password.length < 6) {
      return res.status(400).json({ error: 'Temporary password must be at least 6 characters' });
    }

    const hash = await bcrypt.hash(temp_password, SALT_ROUNDS);
    await run(
      `UPDATE users SET password_hash = ?, force_password_change = 1, updated_at = datetime('now') WHERE id = ?`,
      [hash, userId]
    );

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'USER_PASSWORD_RESET',
      entityType: 'users',
      recordId: userId,
      reason: 'Administrator reset user password with forced change on login'
    });

    return res.json({ message: 'User password reset. User will be prompted to change password upon next login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset user password' });
  }
});

// PUT /api/users/:id (Edit user details)
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, full_name, email, phone, role_id, group_ids } = req.body;

    const existing = await get(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check username uniqueness (exclude self)
    if (username && username !== existing.username) {
      const dup = await get(`SELECT id FROM users WHERE username = ? AND id != ?`, [username, userId]);
      if (dup) return res.status(400).json({ error: 'Username already exists' });
    }

    // Check email uniqueness (exclude self)
    if (email && email !== existing.email) {
      const dup = await get(`SELECT id FROM users WHERE email = ? AND id != ?`, [email, userId]);
      if (dup) return res.status(400).json({ error: 'Email already exists' });
    }

    await run(
      `UPDATE users SET username = ?, full_name = ?, email = ?, phone = ?, role_id = ?, updated_at = datetime('now') WHERE id = ?`,
      [username || existing.username, full_name || existing.full_name, email || null, phone || null, role_id || existing.role_id, userId]
    );

    // Reassign groups if provided
    if (Array.isArray(group_ids)) {
      await run(`DELETE FROM user_group_assignments WHERE user_id = ?`, [userId]);
      for (const gid of group_ids) {
        await run(`INSERT INTO user_group_assignments (user_id, group_id) VALUES (?, ?)`, [userId, gid]);
      }
    }

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'USER_UPDATED',
      entityType: 'users',
      recordId: userId,
      oldValues: { username: existing.username, full_name: existing.full_name, email: existing.email, role_id: existing.role_id },
      newValues: { username, full_name, email, role_id, group_ids },
      reason: 'Administrator updated user details'
    });

    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id (Delete user)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await get(`SELECT u.*, r.code as role_code FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`, [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting last admin
    if (user.role_code === 'ADMIN') {
      const adminCount = await get(`SELECT COUNT(*) as cnt FROM users u JOIN roles r ON u.role_id = r.id WHERE r.code = 'ADMIN' AND u.is_active = 1`);
      if (adminCount.cnt <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last active administrator' });
      }
    }

    await run(`DELETE FROM user_group_assignments WHERE user_id = ?`, [userId]);
    await run(`DELETE FROM users WHERE id = ?`, [userId]);

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: 'USER_DELETED',
      entityType: 'users',
      recordId: userId,
      oldValues: { username: user.username, full_name: user.full_name },
      reason: `Administrator deleted user ${user.username}`
    });

    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PUT /api/users/:id/status (Activate/Deactivate user)
router.put('/:id/status', async (req, res) => {
  try {
    const { is_active } = req.body;
    const userId = req.params.id;

    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot deactivate your own administrator account' });
    }

    await run(`UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?`, [is_active ? 1 : 0, userId]);

    await logAudit({
      userId: req.user.userId,
      userName: req.user.fullName,
      action: is_active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'users',
      recordId: userId,
      reason: `Admin changed user status to ${is_active ? 'Active' : 'Inactive'}`
    });

    return res.json({ message: 'User status updated' });
  } catch (err) {
    console.error('Update user status error:', err);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
});

module.exports = router;
