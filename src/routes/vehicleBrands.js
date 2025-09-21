const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES } = require('../constants');
const brandService = require('../services/vehicleBrandService');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.GESTIONNAIRE));

router.get('/', async (req, res) => {
  try {
    const brands = await brandService.listBrands();
    res.json(brands);
  } catch (error) {
    res.status(500).json({ message: 'Impossible de recuperer les marques' });
  }
});

router.post('/', async (req, res) => {
  try {
    const brand = await brandService.createBrand(req.body || {});
    res.status(201).json(brand);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const existing = await brandService.getBrandById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Marque introuvable' });
    }
    const updated = await brandService.updateBrand(req.params.id, req.body || {});
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await brandService.deleteBrand(req.params.id);
    res.status(204).send();
  } catch (error) {
    const status = error.message.includes('Impossible de supprimer') ? 409 : 400;
    res.status(status).json({ message: error.message });
  }
});

module.exports = router;
