const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../constants');
const garageService = require('../services/garageService');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.GESTIONNAIRE));

router.get('/', async (req, res) => {
  try {
    const garages = await garageService.listGarages();
    res.json(garages);
  } catch (error) {
    res.status(500).json({ message: 'Impossible de recuperer les garages' });
  }
});

router.post('/', async (req, res) => {
  try {
    const garage = await garageService.createGarage(req.body || {});
    res.status(201).json(garage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await garageService.getGarageById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Garage introuvable' });
    }
    const updated = await garageService.updateGarage(req.params.id, req.body || {});
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await garageService.deleteGarage(req.params.id);
    res.status(204).send();
  } catch (error) {
    const status = error.message.includes('Impossible de supprimer') ? 409 : 400;
    res.status(status).json({ message: error.message });
  }
});

module.exports = router;
