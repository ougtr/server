const { run, get, all } = require('../db');

const listGarages = () =>
  all(
    `SELECT id, nom, adresse, contact, created_at AS createdAt
     FROM garages
     ORDER BY nom ASC`
  );

const getGarageById = (id) =>
  get(
    `SELECT id, nom, adresse, contact, created_at AS createdAt
     FROM garages
     WHERE id = ?`,
    [id]
  );

const createGarage = async ({ nom, adresse, contact }) => {
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error('Le nom du garage est requis');
  }

  const result = await run(
    'INSERT INTO garages (nom, adresse, contact) VALUES (?, ?, ?)',
    [trimmedName, adresse ? adresse.trim() : null, contact ? contact.trim() : null]
  );

  return getGarageById(result.id);
};

const updateGarage = async (id, { nom, adresse, contact }) => {
  const updates = [];
  const params = [];

  if (typeof nom !== 'undefined') {
    const trimmed = (nom || '').trim();
    if (!trimmed) {
      throw new Error('Le nom du garage est requis');
    }
    updates.push('nom = ?');
    params.push(trimmed);
  }

  if (typeof adresse !== 'undefined') {
    updates.push('adresse = ?');
    params.push(adresse ? adresse.trim() : null);
  }

  if (typeof contact !== 'undefined') {
    updates.push('contact = ?');
    params.push(contact ? contact.trim() : null);
  }

  if (!updates.length) {
    return getGarageById(id);
  }

  params.push(id);
  await run(`UPDATE garages SET ${updates.join(', ')} WHERE id = ?`, params);
  return getGarageById(id);
};

const deleteGarage = async (id) => {
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE garage_id = ?', [id]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer un garage rattache a des missions');
  }
  await run('DELETE FROM garages WHERE id = ?', [id]);
};

module.exports = {
  listGarages,
  getGarageById,
  createGarage,
  updateGarage,
  deleteGarage,
};
