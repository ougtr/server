const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../constants');
const tenantService = require('../services/tenantService');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.SUPER_ADMIN));

router.get('/', async (req, res) => {
  try {
    const tenants = await tenantService.listTenants();
    res.json(tenants);
  } catch (error) {
    res.status(500).json({ message: 'Impossible de recuperer les cabinets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const tenant = await tenantService.createTenant(req.body || {});
    res.status(201).json(tenant);
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ message: 'Ce cabinet existe deja' });
    }
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await tenantService.getTenantById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Cabinet introuvable' });
    }
    const tenant = await tenantService.updateTenant(req.params.id, req.body || {});
    res.json(tenant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
