const { run, get, all } = require('../db');

const requireTenant = (tenantId) => {
  if (!tenantId) {
    throw new Error('Cabinet requis');
  }
};

const listAgencies = (insurerId, tenantId) => {
  requireTenant(tenantId);
  const conditions = ['tenant_id = ?'];
  const params = [tenantId];
  if (insurerId) {
    conditions.push('insurer_id = ?');
    params.push(insurerId);
  }
  return all(
    `SELECT id, tenant_id AS tenantId, insurer_id AS insurerId, nom, adresse, telephone, created_at AS createdAt
     FROM insurer_agencies
     WHERE ${conditions.join(' AND ')}
     ORDER BY nom ASC`,
    params
  );
};

const getAgencyById = (id, tenantId) => {
  const conditions = ['id = ?'];
  const params = [id];
  if (tenantId) {
    conditions.push('tenant_id = ?');
    params.push(tenantId);
  }
  return get(
    `SELECT id, tenant_id AS tenantId, insurer_id AS insurerId, nom, adresse, telephone, created_at AS createdAt
     FROM insurer_agencies
     WHERE ${conditions.join(' AND ')}`,
    params
  );
};

const createAgency = async ({ insurerId, nom, adresse, telephone }, tenantId) => {
  requireTenant(tenantId);
  const sanitizedName = (nom || '').trim();
  if (!sanitizedName) {
    throw new Error("Le nom de l'agence est requis");
  }
  if (!insurerId) {
    throw new Error('Assureur requis');
  }

  const result = await run(
    `INSERT INTO insurer_agencies (tenant_id, insurer_id, nom, adresse, telephone)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, Number(insurerId), sanitizedName, adresse ? adresse.trim() : null, telephone ? telephone.trim() : null]
  );
  return getAgencyById(result.id, tenantId);
};

const updateAgency = async (id, { insurerId, nom, adresse, telephone }, tenantId) => {
  requireTenant(tenantId);
  const updates = [];
  const params = [];

  if (typeof insurerId !== 'undefined') {
    updates.push('insurer_id = ?');
    params.push(Number(insurerId));
  }

  if (typeof nom !== 'undefined') {
    const sanitizedName = (nom || '').trim();
    if (!sanitizedName) {
      throw new Error("Le nom de l'agence est requis");
    }
    updates.push('nom = ?');
    params.push(sanitizedName);
  }

  if (typeof adresse !== 'undefined') {
    updates.push('adresse = ?');
    params.push(adresse ? adresse.trim() : null);
  }

  if (typeof telephone !== 'undefined') {
    updates.push('telephone = ?');
    params.push(telephone ? telephone.trim() : null);
  }

  if (!updates.length) {
    return getAgencyById(id, tenantId);
  }

  params.push(id, tenantId);
  await run(`UPDATE insurer_agencies SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
  return getAgencyById(id, tenantId);
};

const deleteAgency = async (id, tenantId) => {
  requireTenant(tenantId);
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE assureur_agence_id = ? AND tenant_id = ?', [id, tenantId]);
  if (usage && usage.total > 0) {
    throw new Error('Impossible de supprimer une agence rattachee a des missions');
  }
  await run('DELETE FROM insurer_agencies WHERE id = ? AND tenant_id = ?', [id, tenantId]);
};

module.exports = {
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  deleteAgency,
};
