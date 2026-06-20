const bcrypt = require('bcryptjs');
const { run, get, all } = require('../db');
const { ROLES } = require('../constants');

const normalizeRole = (role) => {
  if (!role) {
    return null;
  }
  const normalized = role.toString().toUpperCase();
  return normalized === ROLES.SUPER_ADMIN ||
    normalized === ROLES.ADMIN_CABINET ||
    normalized === ROLES.GESTIONNAIRE ||
    normalized === ROLES.AGENT
    ? normalized
    : null;
};

const getUserByLogin = (login) =>
  get(
    `SELECT users.*, tenants.nom AS tenant_nom, tenants.actif AS tenant_actif
     FROM users
     LEFT JOIN tenants ON tenants.id = users.tenant_id
     WHERE users.login = ?`,
    [login]
  );

const getUserById = (id, tenantId) => {
  const conditions = ['users.id = ?'];
  const params = [id];
  if (tenantId !== undefined && tenantId !== null) {
    conditions.push('(users.tenant_id = ? OR users.role = ?)');
    params.push(tenantId, ROLES.SUPER_ADMIN);
  }
  return get(
    `SELECT users.id, users.tenant_id AS tenantId, users.login, users.role,
            users.created_at AS createdAt, tenants.nom AS tenantNom
     FROM users
     LEFT JOIN tenants ON tenants.id = users.tenant_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
};

const listUsers = (tenantId, requesterRole) => {
  if (requesterRole === ROLES.SUPER_ADMIN) {
    return all(`
      SELECT users.id, users.tenant_id AS tenantId, users.login, users.role,
             users.created_at AS createdAt, tenants.nom AS tenantNom
      FROM users
      LEFT JOIN tenants ON tenants.id = users.tenant_id
      ORDER BY users.login ASC
    `);
  }

  return all(
    `SELECT id, tenant_id AS tenantId, login, role, created_at AS createdAt
     FROM users
     WHERE tenant_id = ?
     ORDER BY login ASC`,
    [tenantId]
  );
};

const createUser = async ({ login, password, role, tenantId }) => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    throw new Error('Role invalide');
  }
  if (normalizedRole !== ROLES.SUPER_ADMIN && !tenantId) {
    throw new Error('Cabinet requis pour creer cet utilisateur');
  }
  if (!password || password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caracteres');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await run(
    'INSERT INTO users (tenant_id, login, password_hash, role) VALUES (?, ?, ?, ?)',
    [normalizedRole === ROLES.SUPER_ADMIN ? null : tenantId, login.trim(), passwordHash, normalizedRole]
  );
  return getUserByLogin(login.trim());
};

const updateUser = async (id, { password, role }, tenantId) => {
  const updates = [];
  const params = [];

  if (password) {
    if (password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caracteres');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (role) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      throw new Error('Role invalide');
    }
    updates.push('role = ?');
    params.push(normalizedRole);
  }

  if (updates.length === 0) {
    return getUserById(id, tenantId);
  }

  params.push(id);
  if (tenantId !== undefined && tenantId !== null) {
    params.push(tenantId);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
  } else {
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  return getUserById(id, tenantId);
};

const deleteUser = async (id, tenantId) => {
  if (tenantId !== undefined && tenantId !== null) {
    await run('DELETE FROM users WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    return;
  }
  await run('DELETE FROM users WHERE id = ?', [id]);
};

module.exports = {
  getUserByLogin,
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  normalizeRole,
};
