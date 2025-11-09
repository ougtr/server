const { run, get, all } = require('../db');

const listAgencies = (insurerId) => {
  const whereClause = insurerId ? 'WHERE insurer_id = ?' : '';
  const params = insurerId ? [insurerId] : [];
  return all(
    `SELECT id, insurer_id AS insurerId, nom, adresse, telephone, created_at AS createdAt
     FROM insurer_agencies
     ${whereClause}
     ORDER BY nom ASC`,
    params
  );
};

const getAgencyById = (id) =>
  get(
    `SELECT id, insurer_id AS insurerId, nom, adresse, telephone, created_at AS createdAt
     FROM insurer_agencies
     WHERE id = ?`,
    [id]
  );

const createAgency = async ({ insurerId, nom, adresse, telephone }) => {
  const sanitizedName = (nom || '').trim();
  if (!sanitizedName) {
    throw new Error("Le nom de l'agence est requis");
  }
  if (!insurerId) {
    throw new Error('Assureur requis');
  }

  const result = await run(
    `INSERT INTO insurer_agencies (insurer_id, nom, adresse, telephone)
     VALUES (?, ?, ?, ?)`,
    [Number(insurerId), sanitizedName, adresse ? adresse.trim() : null, telephone ? telephone.trim() : null]
  );
  return getAgencyById(result.id);
};

const updateAgency = async (id, { insurerId, nom, adresse, telephone }) => {
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
    return getAgencyById(id);
  }

  params.push(id);
  await run(`UPDATE insurer_agencies SET ${updates.join(', ')} WHERE id = ?`, params);
  return getAgencyById(id);
};

const deleteAgency = async (id) => {
  const usage = await get('SELECT COUNT(1) AS total FROM missions WHERE assureur_agence_id = ?', [id]);
  if (usage && usage.total > 0) {
    throw new Error("Impossible de supprimer une agence rattachee a des missions");
  }
  await run('DELETE FROM insurer_agencies WHERE id = ?', [id]);
};

module.exports = {
  listAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  deleteAgency,
};
