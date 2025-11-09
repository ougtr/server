const { run, get, all } = require('../db');
const { MISSION_STATUSES, ASSIGNABLE_ROLES } = require('../constants');
const { getUserById } = require('./userService');
const { getInsurerById } = require('./insurerService');
const { getAgencyById } = require('./insurerAgencyService');
const { getBrandById } = require('./vehicleBrandService');
const { getGarageById } = require('./garageService');

const statusOrder = MISSION_STATUSES.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

const mapMission = (mission) => {
  if (!mission) {
    return null;
  }

  const assureurNom = mission.insurer_nom ?? mission.assureur_nom;
  const assureurContact = mission.insurer_contact ?? mission.assureur_contact;
  const vehiculeMarque = mission.brand_nom ?? mission.vehicule_marque;
  const garageNom = mission.garage_nom_ref ?? mission.garage_nom;
  const garageAdresse = mission.garage_adresse_ref ?? mission.garage_adresse;
  const garageContact = mission.garage_contact_ref ?? mission.garage_contact;

  return {
    id: mission.id,
    assureurId: mission.assureur_id !== null ? Number(mission.assureur_id) : null,
    assureurNom,
    assureurContact,
    assureurAgenceId: mission.assureur_agence_id !== null ? Number(mission.assureur_agence_id) : null,
    assureurAgenceNom: mission.assureur_agence_nom,
    assureurAgenceAdresse: mission.assureur_agence_adresse,
    assureurAgenceContact: mission.assureur_agence_contact,
    assureNom: mission.assure_nom,
    assureTelephone: mission.assure_telephone,
    assureEmail: mission.assure_email,
    vehiculeMarqueId: mission.vehicule_marque_id !== null ? Number(mission.vehicule_marque_id) : null,
    vehiculeMarque,
    vehiculeModele: mission.vehicule_modele,
    vehiculeImmatriculation: mission.vehicule_immatriculation,
    vehiculeAnnee: mission.vehicule_annee !== null ? Number(mission.vehicule_annee) : null,
    sinistreType: mission.sinistre_type,
    sinistreCirconstances: mission.sinistre_circonstances,
    sinistreDate: mission.sinistre_date,
    sinistrePolice: mission.sinistre_police,
    garageId: mission.garage_id !== null ? Number(mission.garage_id) : null,
    garageNom,
    garageAdresse,
    garageContact,
    agentId: mission.agent_id !== null ? Number(mission.agent_id) : null,
    agentLogin: mission.agent_login,
    statut: mission.statut,
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
  };
};

const ensureValidAssignee = async (assigneeId) => {
  if (assigneeId === undefined) {
    return undefined;
  }
  if (assigneeId === null || assigneeId === '') {
    return null;
  }
  const assignee = await getUserById(assigneeId);
  if (!assignee) {
    throw new Error('Utilisateur cible introuvable');
  }
  if (!ASSIGNABLE_ROLES.includes(assignee.role)) {
    throw new Error('Le compte cible doit avoir le role AGENT ou GESTIONNAIRE');
  }
  return Number(assignee.id);
};

const ensureValidInsurer = async (insurerId) => {
  if (insurerId === undefined) {
    return undefined;
  }
  if (insurerId === null || insurerId === '') {
    return null;
  }
  const insurer = await getInsurerById(insurerId);
  if (!insurer) {
    throw new Error('Assureur introuvable');
  }
  return insurer;
};

const ensureValidBrand = async (brandId) => {
  if (brandId === undefined) {
    return undefined;
  }
  if (brandId === null || brandId === '') {
    return null;
  }
  const brand = await getBrandById(brandId);
  if (!brand) {
    throw new Error('Marque introuvable');
  }
  return brand;
};

const ensureValidGarage = async (garageId) => {
  if (garageId === undefined) {
    return undefined;
  }
  if (garageId === null || garageId === '') {
    return null;
  }
  const garage = await getGarageById(garageId);
  if (!garage) {
    throw new Error('Garage introuvable');
  }
  return {
    id: Number(garage.id),
    nom: garage.nom,
    adresse: garage.adresse || null,
    contact: garage.contact || null,
  };
};

const ensureValidAgency = async (agencyId, insurerId) => {
  if (agencyId === undefined) {
    return undefined;
  }
  if (agencyId === null || agencyId === '') {
    return null;
  }
  const agency = await getAgencyById(agencyId);
  if (!agency) {
    throw new Error("Agence d'assurance introuvable");
  }
  if (insurerId && Number(agency.insurerId) !== Number(insurerId)) {
    throw new Error("Cette agence n'appartient pas a l'assureur selectionne");
  }
  return {
    id: Number(agency.id),
    nom: agency.nom,
    adresse: agency.adresse || null,
    contact: agency.telephone || null,
    insurerId: agency.insurerId,
  };
};

const listMissions = async ({ role, userId, filters = {} }) => {
  const conditions = [];
  const params = [];

  const keyword = typeof filters.keyword === 'string' ? filters.keyword.trim().toLowerCase() : '';

  if (role === 'AGENT') {
    conditions.push('missions.agent_id = ?');
    params.push(userId);
  }

  if (keyword) {
    const keywordColumns = [
      'missions.assureur_nom',
      'missions.assureur_contact',
      'missions.assureur_agence_nom',
      'missions.assureur_agence_contact',
      'missions.assureur_agence_adresse',
      'missions.assure_nom',
      'missions.assure_telephone',
      'missions.assure_email',
      'missions.vehicule_marque',
      'missions.vehicule_modele',
      'missions.vehicule_immatriculation',
      'missions.sinistre_type',
      'missions.sinistre_circonstances',
      'missions.sinistre_police',
      'missions.garage_nom',
      'missions.garage_adresse',
      'missions.garage_contact',
      'insurers.nom',
      'insurers.contact',
      'vehicle_brands.nom',
      'garages.nom',
      'garages.adresse',
      'garages.contact',
      'users.login'
    ];
    const keywordClause = '(' + keywordColumns
      .map((column) => `LOWER(COALESCE(${column}, '')) LIKE ?`)
      .join(' OR ') + ')';
    const likeValue = '%' + keyword + '%';
    conditions.push(keywordClause);
    keywordColumns.forEach(() => params.push(likeValue));
  }

  if (filters.statut) {
    conditions.push('missions.statut = ?');
    params.push(filters.statut);
  }

  if (filters.agentId && role !== 'AGENT') {
    conditions.push('missions.agent_id = ?');
    params.push(filters.agentId);
  }

  if (filters.fromDate) {
    conditions.push('missions.sinistre_date >= ?');
    params.push(filters.fromDate);
  }

  if (filters.toDate) {
    conditions.push('missions.sinistre_date <= ?');
    params.push(filters.toDate);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await all(
    `SELECT missions.*, users.login AS agent_login, insurers.nom AS insurer_nom, insurers.contact AS insurer_contact,
            vehicle_brands.nom AS brand_nom,
            garages.nom AS garage_nom_ref,
            garages.adresse AS garage_adresse_ref,
            garages.contact AS garage_contact_ref
     FROM missions
     LEFT JOIN users ON users.id = missions.agent_id
     LEFT JOIN insurers ON insurers.id = missions.assureur_id
     LEFT JOIN vehicle_brands ON vehicle_brands.id = missions.vehicule_marque_id
     LEFT JOIN garages ON garages.id = missions.garage_id
     ${whereClause}
     ORDER BY missions.created_at DESC`,
    params
  );

  return rows.map(mapMission);
};

const getMissionById = async (id) => {
  const mission = await get(
    `SELECT missions.*, users.login AS agent_login, insurers.nom AS insurer_nom, insurers.contact AS insurer_contact,
            vehicle_brands.nom AS brand_nom,
            garages.nom AS garage_nom_ref,
            garages.adresse AS garage_adresse_ref,
            garages.contact AS garage_contact_ref
     FROM missions
     LEFT JOIN users ON users.id = missions.agent_id
     LEFT JOIN insurers ON insurers.id = missions.assureur_id
     LEFT JOIN vehicle_brands ON vehicle_brands.id = missions.vehicule_marque_id
     LEFT JOIN garages ON garages.id = missions.garage_id
     WHERE missions.id = ?`,
    [id]
  );
  return mapMission(mission);
};

const createMission = async (payload, currentUserId) => {
  const {
    assureurId,
    assureurAgenceId,
    assureNom,
    assureTelephone,
    assureEmail,
    vehiculeMarqueId,
    vehiculeModele,
    vehiculeImmatriculation,
    vehiculeAnnee,
    sinistreType,
    sinistreCirconstances,
    sinistreDate,
    sinistrePolice,

    garageId,
    agentId,
    statut = 'cree',
  } = payload;

  const insurer = await ensureValidInsurer(assureurId);
  if (!insurer) {
    throw new Error('Assureur requis');
  }

  const agency = await ensureValidAgency(assureurAgenceId, insurer.id);

  const brand = await ensureValidBrand(vehiculeMarqueId);
  if (!brand) {
    throw new Error('Marque du vehicule requise');
  }

  if (!assureNom) {
    throw new Error("Le nom de l'assure est requis");
  }

  if (garageId === undefined || garageId === null || garageId === '') {
    throw new Error('Garage requis');
  }
  const garage = await ensureValidGarage(garageId);

  if (!MISSION_STATUSES.includes(statut)) {
    throw new Error('Statut invalide');
  }

  const validAssigneeId = await ensureValidAssignee(agentId);
  const baseStatus = statut;
  const initialStatus = validAssigneeId !== null && validAssigneeId !== undefined ? 'affectee' : baseStatus;

  const normalizedPolice = typeof sinistrePolice === 'string' ? sinistrePolice.trim() : sinistrePolice;
  const policeValue = normalizedPolice && normalizedPolice !== '' ? normalizedPolice : null;

  const result = await run(
    `INSERT INTO missions (
      assureur_nom,
      assureur_contact,
      assureur_agence_id,
      assureur_agence_nom,
      assureur_agence_adresse,
      assureur_agence_contact,
      assure_nom,
      assure_telephone,
      assure_email,
      vehicule_marque,
      vehicule_modele,
      vehicule_immatriculation,
      vehicule_annee,
      sinistre_type,
      sinistre_circonstances,
      sinistre_date,
      sinistre_police,
      garage_nom,
      garage_adresse,
      garage_contact,
      agent_id,
      assureur_id,
      vehicule_marque_id,
      garage_id,
      statut,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      insurer.nom,
      insurer.contact || null,
      agency ? agency.id : null,
      agency ? agency.nom : null,
      agency ? agency.adresse : null,
      agency ? agency.contact : null,
      assureNom,
      assureTelephone,
      assureEmail,
      brand.nom,
      vehiculeModele,
      vehiculeImmatriculation,
      vehiculeAnnee ? Number(vehiculeAnnee) : null,
      sinistreType,
      sinistreCirconstances,
      sinistreDate,
      policeValue,
      garage.nom,
      garage.adresse,
      garage.contact,
      validAssigneeId ?? null,
      insurer.id,
      brand.id,
      garage.id,
      initialStatus,
      currentUserId,
    ]
  );

  return getMissionById(result.id);
};

const updateMissionStatus = async (id, newStatus) => {
  if (!MISSION_STATUSES.includes(newStatus)) {
    throw new Error('Statut invalide');
  }

  const mission = await get('SELECT statut FROM missions WHERE id = ?', [id]);
  if (!mission) {
    throw new Error('Mission introuvable');
  }

  if (statusOrder[newStatus] < statusOrder[mission.statut]) {
    throw new Error('Transition de statut invalide');
  }

  await run(
    'UPDATE missions SET statut = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newStatus, id]
  );

  return getMissionById(id);
};

const updateMission = async (id, payload) => {
  const current = await getMissionById(id);
  if (!current) {
    throw new Error('Mission introuvable');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'statut')) {
    if (!payload.statut || !MISSION_STATUSES.includes(payload.statut)) {
      throw new Error('Statut invalide');
    }
  }

  let assigneeIdValue;
  let willAssign = false;

  if (Object.prototype.hasOwnProperty.call(payload, 'agentId')) {
    assigneeIdValue = await ensureValidAssignee(payload.agentId);
    const becameAssigned = assigneeIdValue !== null && assigneeIdValue !== undefined;
    const wasAssigned = current.agentId !== null && current.agentId !== undefined;
    if (becameAssigned && (!wasAssigned || assigneeIdValue !== current.agentId)) {
      willAssign = true;
    }
  }

  let insurerInfo;
  if (Object.prototype.hasOwnProperty.call(payload, 'assureurId')) {
    insurerInfo = await ensureValidInsurer(payload.assureurId);
  }

  const futureInsurerId = insurerInfo ? insurerInfo.id : current.assureurId;

  let agencyInfo;
  if (Object.prototype.hasOwnProperty.call(payload, 'assureurAgenceId')) {
    agencyInfo = await ensureValidAgency(payload.assureurAgenceId, futureInsurerId);
  } else if (insurerInfo !== undefined) {
    agencyInfo = null;
  }

  let brandInfo;
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeMarqueId')) {
    brandInfo = await ensureValidBrand(payload.vehiculeMarqueId);
  }

  let garageInfo;
  if (Object.prototype.hasOwnProperty.call(payload, 'garageId')) {
    if (payload.garageId === null || payload.garageId === '') {
      throw new Error('Garage requis');
    }
    garageInfo = await ensureValidGarage(payload.garageId);
  }

  const updates = [];
  const params = [];

  const pushUpdate = (column, value) => {
    updates.push(`${column} = ?`);
    const sanitizedValue = typeof value === 'string' ? value.trim() : value;
    params.push(sanitizedValue === '' ? null : sanitizedValue);
  };

  if (insurerInfo !== undefined) {
    pushUpdate('assureur_id', insurerInfo.id);
    pushUpdate('assureur_nom', insurerInfo.nom);
    pushUpdate('assureur_contact', insurerInfo.contact || null);
  }

  if (agencyInfo !== undefined) {
    pushUpdate('assureur_agence_id', agencyInfo ? agencyInfo.id : null);
    pushUpdate('assureur_agence_nom', agencyInfo ? agencyInfo.nom : null);
    pushUpdate('assureur_agence_adresse', agencyInfo ? agencyInfo.adresse : null);
    pushUpdate('assureur_agence_contact', agencyInfo ? agencyInfo.contact : null);
  }

  if (brandInfo !== undefined) {
    pushUpdate('vehicule_marque_id', brandInfo.id);
    pushUpdate('vehicule_marque', brandInfo.nom);
  }

  if (garageInfo !== undefined) {
    pushUpdate('garage_id', garageInfo.id);
    pushUpdate('garage_nom', garageInfo.nom);
    pushUpdate('garage_adresse', garageInfo.adresse);
    pushUpdate('garage_contact', garageInfo.contact);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'assureNom')) pushUpdate('assure_nom', payload.assureNom);
  if (Object.prototype.hasOwnProperty.call(payload, 'assureTelephone')) pushUpdate('assure_telephone', payload.assureTelephone);
  if (Object.prototype.hasOwnProperty.call(payload, 'assureEmail')) pushUpdate('assure_email', payload.assureEmail);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeModele')) pushUpdate('vehicule_modele', payload.vehiculeModele);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeImmatriculation')) pushUpdate('vehicule_immatriculation', payload.vehiculeImmatriculation);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeAnnee')) pushUpdate('vehicule_annee', payload.vehiculeAnnee ? Number(payload.vehiculeAnnee) : null);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreType')) pushUpdate('sinistre_type', payload.sinistreType);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreCirconstances')) pushUpdate('sinistre_circonstances', payload.sinistreCirconstances);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreDate')) pushUpdate('sinistre_date', payload.sinistreDate);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistrePolice')) pushUpdate('sinistre_police', payload.sinistrePolice);
  if (assigneeIdValue !== undefined) pushUpdate('agent_id', assigneeIdValue);
  if (Object.prototype.hasOwnProperty.call(payload, 'statut')) pushUpdate('statut', payload.statut);

  if (!updates.length) {
    return getMissionById(id);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  await run(`UPDATE missions SET ${updates.join(', ')} WHERE id = ?`, params);

  let updated = await getMissionById(id);

  if (willAssign && statusOrder[updated.statut] < statusOrder.affectee) {
    updated = await updateMissionStatus(id, 'affectee');
  }

  return updated;
};

const deleteMission = async (id) => {
  const mission = await getMissionById(id);
  if (!mission) {
    throw new Error('Mission introuvable');
  }
  await run('DELETE FROM missions WHERE id = ?', [id]);
};

module.exports = {
  listMissions,
  getMissionById,
  createMission,
  updateMission,
  updateMissionStatus,
  deleteMission,
};



















