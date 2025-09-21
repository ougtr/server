const { run, get, all } = require('../db');

const listInsurers = () =>
  all(
    `SELECT id, nom, contact, created_at AS createdAt
     FROM insurers
     ORDER BY nom ASC`
  );

const getInsurerById = (id) =>
  get(
    `SELECT id, nom, contact, created_at AS createdAt
     FROM insurers
     WHERE id = ?`,
    [id]
  );

const createInsurer = async ({ nom, contact }) => {
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error("Le nom de l'assureur est requis");
  }

  const result = await run(
    'INSERT INTO insurers (nom, contact) VALUES (?, ?)',
    [trimmedName, contact ? contact.trim() : null]
  );

  return getInsurerById(result.id);
};

const updateInsurer = async (id, { nom, contact }) => {
  const updates = [];
  const params = [];

  if (typeof nom !== 'undefined') {
    const trimmed = (nom || '').trim();
    if (!trimmed) {
      throw new Error("Le nom de l'assureur est requis");
    }
    updates.push('nom = ?');
    params.push(trimmed);
  }

  if (typeof contact !== 'undefined') {
    updates.push('contact = ?');
    params.push(contact ? contact.trim() : null);
  }

  if (!updates.length) {
    return getInsurerById(id);
  }

  params.push(id);
  await run(`UPDATE insurers SET ${updates.join(', ')} WHERE id = ?`, params);
  return getInsurerById(id);
};

const deleteInsurer = async (id) => {
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE assureur_id = ?', [id]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer un assureur rattache a des missions');
  }
  await run('DELETE FROM insurers WHERE id = ?', [id]);
};

module.exports = {
  listInsurers,
  getInsurerById,
  createInsurer,
  updateInsurer,
  deleteInsurer,
};
