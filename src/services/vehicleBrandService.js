const { run, get, all } = require('../db');

const requireTenant = (tenantId) => {
  if (!tenantId) {
    throw new Error('Cabinet requis');
  }
};

const listBrands = (tenantId) => {
  requireTenant(tenantId);
  return all(
    `SELECT id, tenant_id AS tenantId, nom, created_at AS createdAt
     FROM vehicle_brands
     WHERE tenant_id = ?
     ORDER BY nom ASC`,
    [tenantId]
  );
};

const getBrandById = (id, tenantId) => {
  const conditions = ['id = ?'];
  const params = [id];
  if (tenantId) {
    conditions.push('tenant_id = ?');
    params.push(tenantId);
  }
  return get(
    `SELECT id, tenant_id AS tenantId, nom, created_at AS createdAt
     FROM vehicle_brands
     WHERE ${conditions.join(' AND ')}`,
    params
  );
};

const createBrand = async ({ nom }, tenantId) => {
  requireTenant(tenantId);
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error('Le nom de la marque est requis');
  }

  const result = await run('INSERT INTO vehicle_brands (tenant_id, nom) VALUES (?, ?)', [tenantId, trimmedName]);
  return getBrandById(result.id, tenantId);
};

const updateBrand = async (id, { nom }, tenantId) => {
  requireTenant(tenantId);
  if (typeof nom === 'undefined') {
    return getBrandById(id, tenantId);
  }
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error('Le nom de la marque est requis');
  }
  await run('UPDATE vehicle_brands SET nom = ? WHERE id = ? AND tenant_id = ?', [trimmedName, id, tenantId]);
  return getBrandById(id, tenantId);
};

const deleteBrand = async (id, tenantId) => {
  requireTenant(tenantId);
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE vehicule_marque_id = ? AND tenant_id = ?', [id, tenantId]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer une marque rattachee a des missions');
  }
  await run('DELETE FROM vehicle_brands WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = {
  listBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};
