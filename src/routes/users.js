const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
} = require('../services/userService');

const router = express.Router();

router.use(authenticate, authorizeRoles('GESTIONNAIRE'));

router.get('/', async (req, res) => {
  try {
    const users = await listUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Impossible de recuperer les utilisateurs" });
  }
});

router.post('/', async (req, res) => {
  const { login, password, role } = req.body;
  if (!login || !password || !role) {
    return res.status(400).json({ message: 'Login, mot de passe et rôle requis' });
  }

  try {
    const user = await createUser({ login, password, role });
    res.status(201).json({ id: user.id, login: user.login, role: user.role });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ message: 'Ce login est deja utilisé' });
    }
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await getUserById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const updated = await updateUser(id, req.body || {});
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  if (parseInt(id, 10) === req.user.id) {
    return res.status(400).json({ message: 'Vous ne pouvez pas supprimer votre propre compte' });
  }

  try {
    await deleteUser(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la suppression" });
  }
});

module.exports = router;

