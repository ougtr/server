const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../constants');
const agencyService = require('../services/insurerAgencyService');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.GESTIONNAIRE));

router.get('/', async (req, res) => {
  try {
    const agencies = await agencyService.listAgencies(req.query.insurerId);
    res.json(agencies);
  } catch (error) {
    res.status(500).json({ message: 'Impossible de recuperer les agences' });
  }
});

router.post('/', async (req, res) => {
  try {
    const agency = await agencyService.createAgency(req.body || {});
    res.status(201).json(agency);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await agencyService.getAgencyById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Agence introuvable' });
    }
    const updated = await agencyService.updateAgency(req.params.id, req.body || {});
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await agencyService.deleteAgency(req.params.id);
    res.status(204).send();
  } catch (error) {
    const status = error.message.includes('Impossible de supprimer') ? 409 : 400;
    res.status(status).json({ message: error.message });
  }
});

module.exports = router;
