const { run, get, all } = require('../db');

const requireTenant = (tenantId) => {
  if (!tenantId) {
    throw new Error('Cabinet requis');
  }
};

const listInsurers = (tenantId) => {
  requireTenant(tenantId);
  return all(
    `SELECT id, tenant_id AS tenantId, nom, contact, created_at AS createdAt
     FROM insurers
     WHERE tenant_id = ?
     ORDER BY nom ASC`,
    [tenantId]
  );
};

const getInsurerById = (id, tenantId) => {
  const conditions = ['id = ?'];
  const params = [id];
  if (tenantId) {
    conditions.push('tenant_id = ?');
    params.push(tenantId);
  }
  return get(
    `SELECT id, tenant_id AS tenantId, nom, contact, created_at AS createdAt
     FROM insurers
     WHERE ${conditions.join(' AND ')}`,
    params
  );
};

const createInsurer = async ({ nom, contact }, tenantId) => {
  requireTenant(tenantId);
  const trimmedName = (nom || '').trim();
  if (!trimmedName) {
    throw new Error("Le nom de l'assureur est requis");
  }

  const result = await run(
    'INSERT INTO insurers (tenant_id, nom, contact) VALUES (?, ?, ?)',
    [tenantId, trimmedName, contact ? contact.trim() : null]
  );

  return getInsurerById(result.id, tenantId);
};

const updateInsurer = async (id, { nom, contact }, tenantId) => {
  requireTenant(tenantId);
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
    return getInsurerById(id, tenantId);
  }

  params.push(id, tenantId);
  await run(`UPDATE insurers SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
  return getInsurerById(id, tenantId);
};

const deleteInsurer = async (id, tenantId) => {
  requireTenant(tenantId);
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE assureur_id = ? AND tenant_id = ?', [id, tenantId]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer un assureur rattache a des missions');
  }
  await run('DELETE FROM insurers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = {
  listInsurers,
  getInsurerById,
  createInsurer,
  updateInsurer,
  deleteInsurer,
};
