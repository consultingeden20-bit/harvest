const { verifyToken } = require('../services/auth');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired session token. Please log in again.' });
  }

  // Check if user is active before proceeding
  const { get } = require('../db');
  try {
    const user = await get('SELECT id, username, is_active FROM users WHERE id = ?', [decoded.userId]);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Please contact your system administrator.' });
    }
  } catch (err) {
    console.error('Error checking user active status:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }

  req.user = decoded;
  next();
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (allowedRoles.includes(req.user.roleCode) || req.user.roleCode === 'ADMIN') {
      return next();
    }

    return res.status(403).json({
      error: `Access denied. Requires one of: ${allowedRoles.join(', ')}`
    });
  };
}

function requirePasswordChanged(req, res, next) {
  if (req.user && req.user.forcePasswordChange && req.path !== '/change-password') {
    return res.status(403).json({
      error: 'Password change required before accessing this resource',
      forcePasswordChange: true
    });
  }
  next();
}

module.exports = {
  authenticateToken,
  requireRoles,
  requirePasswordChanged
};
