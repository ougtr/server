const { run, get, all } = require('../db');

const requireTenant = (tenantId) => {
  if (!tenantId) {
    throw new Error('Cabinet requis');
  }
};

const listGarages = (tenantId) => {
  requireTenant(tenantId);
  return all(
    `SELECT id, tenant_id AS tenantId, nom, adresse, contact, created_at AS createdAt
     FROM garages
     WHERE tenant_id = ?
     ORDER BY nom ASC`,
    [tenantId]
  );
};

const getGarageById = (id, tenantId) => {
  const conditions = ['id = ?'];
  const params = [id];
  if (tenantId) {
    conditions.push('tenant_id = ?');
    params.push(tenantId);
  }
  return get(
    `SELECT id, tenant_id AS tenantId, nom, adresse, contact, created_at AS createdAt
     FROM garages
     WHERE ${conditions.join(' AND ')}`,
    params
  );
};

const createGarage = async ({ nom, adresse, contact }, tenantId) => {
  requireTenant(tenantId);
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error('Le nom du garage est requis');
  }

  const result = await run(
    'INSERT INTO garages (tenant_id, nom, adresse, contact) VALUES (?, ?, ?, ?)',
    [tenantId, trimmedName, adresse ? adresse.trim() : null, contact ? contact.trim() : null]
  );

  return getGarageById(result.id, tenantId);
};

const updateGarage = async (id, { nom, adresse, contact }, tenantId) => {
  requireTenant(tenantId);
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
    return getGarageById(id, tenantId);
  }

  params.push(id, tenantId);
  await run(`UPDATE garages SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
  return getGarageById(id, tenantId);
};

const deleteGarage = async (id, tenantId) => {
  requireTenant(tenantId);
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE garage_id = ? AND tenant_id = ?', [id, tenantId]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer un garage rattache a des missions');
  }
  await run('DELETE FROM garages WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = {
  listGarages,
  getGarageById,
  createGarage,
  updateGarage,
  deleteGarage,
};
