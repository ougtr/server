const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../constants');
const insurerService = require('../services/insurerService');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN_CABINET, ROLES.GESTIONNAIRE));

router.get('/', async (req, res) => {
  try {
    const insurers = await insurerService.listInsurers(req.tenantId);
    res.json(insurers);
  } catch (error) {
    res.status(500).json({ message: "Impossible de recuperer les assureurs" });
  }
});

router.post('/', async (req, res) => {
  try {
    const insurer = await insurerService.createInsurer(req.body || {}, req.tenantId);
    res.status(201).json(insurer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await insurerService.getInsurerById(req.params.id, req.tenantId);
    if (!existing) {
      return res.status(404).json({ message: 'Assureur introuvable' });
    }
    const updated = await insurerService.updateInsurer(req.params.id, req.body || {}, req.tenantId);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await insurerService.deleteInsurer(req.params.id, req.tenantId);
    res.status(204).send();
  } catch (error) {
    const status = error.message.includes('Impossible de supprimer') ? 409 : 400;
    res.status(status).json({ message: error.message });
  }
});

module.exports = router;
