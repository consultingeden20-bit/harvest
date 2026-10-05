const express = require('express');
const router = express.Router();
const { authenticateUser, changePassword } = require('../services/auth');
const { authenticateToken } = require('../middleware/auth');
const { get, query } = require('../db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password, terminalId } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await authenticateUser(username, password, terminalId, ipAddress);

    if (result.error) {
      return res.status(401).json({ error: result.error });
    }

    return res.json(result);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, terminalId } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const result = await changePassword(req.user.userId, currentPassword, newPassword, terminalId, ipAddress);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await get(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role_id, u.force_password_change,
              r.code as role_code, r.name_en as role_name_en, r.name_fr as role_name_fr
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.is_active = 1`,
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userGroups = await query(
      `SELECT g.id, g.code, g.name_en, g.name_fr 
       FROM user_group_assignments uga 
       JOIN groups g ON uga.group_id = g.id 
       WHERE uga.user_id = ?`,
      [user.id]
    );

    return res.json({
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
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

module.exports = router;
