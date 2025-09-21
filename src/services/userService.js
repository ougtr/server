const bcrypt = require('bcryptjs');
const { run, get, all } = require('../db');
const { ROLES } = require('../constants');

const normalizeRole = (role) => {
  if (!role) {
    return null;
  }
  const normalized = role.toString().toUpperCase();
  return normalized === ROLES.GESTIONNAIRE || normalized === ROLES.AGENT
    ? normalized
    : null;
};

const getUserByLogin = (login) =>
  get('SELECT * FROM users WHERE login = ?', [login]);

const getUserById = (id) =>
  get('SELECT id, login, role, created_at FROM users WHERE id = ?', [id]);

const listUsers = () =>
  all('SELECT id, login, role, created_at FROM users ORDER BY login ASC');

const createUser = async ({ login, password, role }) => {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) {
    throw new Error('Rôle invalide');
  }
  if (!password || password.length < 6) {
    throw new Error('Le mot de passe doit contenir au moins 6 caractères');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await run(
    'INSERT INTO users (login, password_hash, role) VALUES (?, ?, ?)',
    [login.trim(), passwordHash, normalizedRole]
  );
  return getUserByLogin(login.trim());
};

const updateUser = async (id, { password, role }) => {
  const updates = [];
  const params = [];

  if (password) {
    if (password.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    updates.push('password_hash = ?');
    params.push(passwordHash);
  }

  if (role) {
    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      throw new Error('Rôle invalide');
    }
    updates.push('role = ?');
    params.push(normalizedRole);
  }

  if (updates.length === 0) {
    return getUserById(id);
  }

  params.push(id);
  await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  return getUserById(id);
};

const deleteUser = async (id) => {
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
