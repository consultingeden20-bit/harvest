const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/auth');
const {
  listContributors,
  getContributorById,
  createContributor,
  updateContributor,
  checkDuplicateName
} = require('../services/contributors');

router.use(authenticateToken);

// GET /api/contributors/check-duplicate (Case-insensitive duplicate warning check)
router.get('/check-duplicate', async (req, res) => {
  try {
    const { name, exclude_id } = req.query;
    if (!name || !name.trim()) {
      return res.json({ duplicates: [] });
    }
    const duplicates = await checkDuplicateName(name, exclude_id);
    return res.json({ duplicates });
  } catch (err) {
    console.error('Check duplicate name error:', err);
    return res.status(500).json({ error: 'Failed to verify duplicate names' });
  }
});

// GET /api/contributors (Search & list with scope security)
router.get('/', async (req, res) => {
  try {
    const { search, group_id, harvest_id, limit, offset } = req.query;
    const result = await listContributors({
      search,
      groupId: group_id,
      harvestId: harvest_id || 'hrv-2026',
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0,
      user: req.user
    });

    return res.json(result);
  } catch (err) {
    console.error('List contributors error:', err);
    return res.status(500).json({ error: 'Failed to list contributors' });
  }
});

// GET /api/contributors/:id
router.get('/:id', async (req, res) => {
  try {
    const { harvest_id } = req.query;
    const result = await getContributorById(req.params.id, harvest_id || 'hrv-2026', req.user);

    if (!result) {
      return res.status(404).json({ error: 'Contributor not found' });
    }

    if (result.forbidden) {
      return res.status(403).json({ error: 'Access denied: Contributor does not belong to your authorized group scope.' });
    }

    return res.json({ contributor: result });
  } catch (err) {
    console.error('Get contributor error:', err);
    return res.status(500).json({ error: 'Failed to fetch contributor details' });
  }
});

// POST /api/contributors (Create contributor)
router.post('/', requireRoles('ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'), async (req, res) => {
  try {
    const contributor = await createContributor(req.body, req.user, req.headers['x-terminal-id']);
    return res.status(201).json({ contributor });
  } catch (err) {
    console.error('Create contributor error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create contributor' });
  }
});

// PUT /api/contributors/:id (Update contributor)
router.put('/:id', requireRoles('ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'), async (req, res) => {
  try {
    const contributor = await updateContributor(req.params.id, req.body, req.user, req.headers['x-terminal-id']);
    if (!contributor) {
      return res.status(404).json({ error: 'Contributor not found' });
    }
    return res.json({ contributor });
  } catch (err) {
    console.error('Update contributor error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update contributor' });
  }
});

module.exports = router;
