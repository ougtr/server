const { run, get, all } = require('../db');

const listBrands = () =>
  all(
    `SELECT id, nom, created_at AS createdAt
     FROM vehicle_brands
     ORDER BY nom ASC`
  );

const getBrandById = (id) =>
  get(
    `SELECT id, nom, created_at AS createdAt
     FROM vehicle_brands
     WHERE id = ?`,
    [id]
  );

const createBrand = async ({ nom }) => {
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error('Le nom de la marque est requis');
  }

  const result = await run('INSERT INTO vehicle_brands (nom) VALUES (?)', [trimmedName]);
  return getBrandById(result.id);
};

const updateBrand = async (id, { nom }) => {
  if (typeof nom === 'undefined') {
    return getBrandById(id);
  }
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error('Le nom de la marque est requis');
  }
  await run('UPDATE vehicle_brands SET nom = ? WHERE id = ?', [trimmedName, id]);
  return getBrandById(id);
};

const deleteBrand = async (id) => {
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE vehicule_marque_id = ?', [id]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer une marque rattachee a des missions');
  }
  await run('DELETE FROM vehicle_brands WHERE id = ?', [id]);
};

module.exports = {
  listBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};
