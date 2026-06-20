const express = require('express');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { ROLES, TENANT_ADMIN_ROLES } = require('../constants');
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserById,
} = require('../services/userService');

const router = express.Router();

router.use(authenticate, authorizeRoles(ROLES.SUPER_ADMIN, ...TENANT_ADMIN_ROLES));

const resolveTargetTenantId = (req) => {
  if (req.user.role === ROLES.SUPER_ADMIN) {
    return req.body?.tenantId || req.query?.tenantId || null;
  }
  return req.tenantId;
};

router.get('/', async (req, res) => {
  try {
    const users = await listUsers(req.tenantId, req.user.role);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Impossible de recuperer les utilisateurs' });
  }
});

router.post('/', async (req, res) => {
  const { login, password, role } = req.body;
  if (!login || !password || !role) {
    return res.status(400).json({ message: 'Login, mot de passe et role requis' });
  }
  if (req.user.role !== ROLES.SUPER_ADMIN && role === ROLES.SUPER_ADMIN) {
    return res.status(403).json({ message: 'Seul le super admin peut creer ce role' });
  }

  try {
    const tenantId = resolveTargetTenantId(req);
    const user = await createUser({ login, password, role, tenantId });
    res.status(201).json({
      id: user.id,
      tenantId: user.tenant_id || null,
      login: user.login,
      role: user.role,
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ message: 'Ce login est deja utilise' });
    }
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  if (req.user.role !== ROLES.SUPER_ADMIN && req.body?.role === ROLES.SUPER_ADMIN) {
    return res.status(403).json({ message: 'Seul le super admin peut attribuer ce role' });
  }

  try {
    const tenantId = req.user.role === ROLES.SUPER_ADMIN ? undefined : req.tenantId;
    const existing = await getUserById(id, tenantId);
    if (!existing) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const updated = await updateUser(id, req.body || {}, tenantId);
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
    const tenantId = req.user.role === ROLES.SUPER_ADMIN ? undefined : req.tenantId;
    await deleteUser(id, tenantId);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

module.exports = router;
