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
    vehiculeAnnee: mission.vehicule_annee !== null ? String(mission.vehicule_annee) : null,
    vehiculeVin: mission.vehicule_vin || null,
    vehiculeKilometrage:
      mission.vehicule_kilometrage !== null && mission.vehicule_kilometrage !== undefined
        ? Number(mission.vehicule_kilometrage)
        : null,
    vehiculePuissanceFiscale: mission.vehicule_puissance_fiscale || null,
    vehiculeEnergie: mission.vehicule_energie || null,
    sinistreType: mission.sinistre_type,
    sinistreCirconstances: mission.sinistre_circonstances,
    sinistreDate: mission.sinistre_date,
    sinistrePolice: mission.sinistre_police,
    sinistrePoliceAdverse: mission.sinistre_police_adverse,
    sinistreNomAdverse: mission.sinistre_nom_adverse || null,
    sinistreImmatriculationAdverse: mission.sinistre_immatriculation_adverse || null,
    garageId: mission.garage_id !== null ? Number(mission.garage_id) : null,
    garageNom,
    garageAdresse,
    garageContact,
    assureurAdverseId: mission.assureur_adverse_id !== null ? Number(mission.assureur_adverse_id) : null,
    assureurAdverseNom: mission.assureur_adverse_nom || null,
    garantieType: mission.garantie_type || null,
    garantieFranchiseTaux:
      mission.garantie_franchise_taux !== null && mission.garantie_franchise_taux !== undefined
        ? Number(mission.garantie_franchise_taux)
        : null,
    garantieFranchiseMontant:
      mission.garantie_franchise_montant !== null && mission.garantie_franchise_montant !== undefined
        ? Number(mission.garantie_franchise_montant)
        : null,
    responsabilite: mission.responsabilite || null,
    reformeType: mission.reforme_type || null,
    valeurAssuree:
      mission.valeur_assuree !== null && mission.valeur_assuree !== undefined ? Number(mission.valeur_assuree) : null,
    valeurVenale:
      mission.valeur_venale !== null && mission.valeur_venale !== undefined ? Number(mission.valeur_venale) : null,
    valeurEpaves:
      mission.valeur_epaves !== null && mission.valeur_epaves !== undefined ? Number(mission.valeur_epaves) : null,
    indemnisationFinale:
      mission.indemnisation_finale !== null && mission.indemnisation_finale !== undefined
        ? Number(mission.indemnisation_finale)
        : null,
    synthese: mission.synthese || null,
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

const normalizeCirculationDate = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return trimmed;
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

const listMissions = async ({ role, userId, filters = {}, pagination = {} }) => {
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
      'missions.vehicule_vin',
      'missions.vehicule_kilometrage',
      'missions.vehicule_puissance_fiscale',
      'missions.vehicule_energie',
      'missions.sinistre_type',
      'missions.sinistre_circonstances',
      'missions.sinistre_police',
      'missions.sinistre_police_adverse',
      'missions.sinistre_nom_adverse',
      'missions.sinistre_immatriculation_adverse',
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

  const baseFromClause = `FROM missions
     LEFT JOIN users ON users.id = missions.agent_id
     LEFT JOIN insurers ON insurers.id = missions.assureur_id
     LEFT JOIN vehicle_brands ON vehicle_brands.id = missions.vehicule_marque_id
     LEFT JOIN garages ON garages.id = missions.garage_id
     ${whereClause}`;

  const aggregateRow = await get(
    `SELECT COUNT(*) AS total, MAX(missions.updated_at) AS latestUpdate
     ${baseFromClause}`,
    params
  );

  const total = aggregateRow ? Number(aggregateRow.total) : 0;
  const normalizedPageSize = Math.min(Math.max(parseInt(pagination.pageSize, 10) || 10, 1), 100);
  const requestedPage = Math.max(parseInt(pagination.page, 10) || 1, 1);
  const totalPages = total ? Math.max(1, Math.ceil(total / normalizedPageSize)) : 1;
  const safePage = total ? Math.min(requestedPage, totalPages) : 1;
  const offset = (safePage - 1) * normalizedPageSize;

  const rows = await all(
    `SELECT missions.*, users.login AS agent_login, insurers.nom AS insurer_nom, insurers.contact AS insurer_contact,
            vehicle_brands.nom AS brand_nom,
            garages.nom AS garage_nom_ref,
            garages.adresse AS garage_adresse_ref,
            garages.contact AS garage_contact_ref
     ${baseFromClause}
     ORDER BY missions.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, normalizedPageSize, offset]
  );

  return {
    missions: rows.map(mapMission),
    total,
    page: safePage,
    pageSize: normalizedPageSize,
    latestUpdate: aggregateRow?.latestUpdate || null,
  };
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
    assureurAdverseId,
    assureNom,
    assureTelephone,
    assureEmail,
    vehiculeMarqueId,
    vehiculeModele,
    vehiculeImmatriculation,
    vehiculeAnnee,
    vehiculeVin,
    vehiculeKilometrage,
    vehiculePuissanceFiscale,
    vehiculeEnergie,
    sinistreType,
    sinistreCirconstances,
    sinistreDate,
    sinistrePolice,
    sinistrePoliceAdverse,
    sinistreNomAdverse,
    sinistreImmatriculationAdverse,
    garantieType,
    garantieFranchiseTaux,
    garantieFranchiseMontant,
    responsabilite,
    reformeType,
    valeurAssuree,
    valeurVenale,
    valeurEpaves,
    indemnisationFinale,
    synthese,

    garageId,
    agentId,
    statut = 'cree',
  } = payload;

  const insurer = await ensureValidInsurer(assureurId);
  if (!insurer) {
    throw new Error('Assureur requis');
  }

  const agency = await ensureValidAgency(assureurAgenceId, insurer.id);

  const adverseInsurer = await ensureValidInsurer(assureurAdverseId);

  const brand = await ensureValidBrand(vehiculeMarqueId);
  if (!brand) {
    throw new Error('Marque du vehicule requise');
  }

  if (!assureNom) {
    throw new Error("Le nom de l'assure est requis");
  }

  let garage = null;
  if (garageId !== undefined && garageId !== null && garageId !== '') {
    garage = await ensureValidGarage(garageId);
  }

  if (!MISSION_STATUSES.includes(statut)) {
    throw new Error('Statut invalide');
  }

  const validAssigneeId = await ensureValidAssignee(agentId);
  const baseStatus = statut;
  const initialStatus = validAssigneeId !== null && validAssigneeId !== undefined ? 'affectee' : baseStatus;

  const normalizedPolice = typeof sinistrePolice === 'string' ? sinistrePolice.trim() : sinistrePolice;
  const policeValue = normalizedPolice && normalizedPolice !== '' ? normalizedPolice : null;
  const normalizedAdversePolice =
    typeof sinistrePoliceAdverse === 'string' ? sinistrePoliceAdverse.trim() : sinistrePoliceAdverse;
  const adversePoliceValue =
    normalizedAdversePolice && normalizedAdversePolice !== '' ? normalizedAdversePolice : null;
  const normalizedAdverseName = typeof sinistreNomAdverse === 'string' ? sinistreNomAdverse.trim() : sinistreNomAdverse;
  const adverseNameValue =
    normalizedAdverseName && normalizedAdverseName !== '' ? normalizedAdverseName : null;
  const normalizedAdversePlate =
    typeof sinistreImmatriculationAdverse === 'string' ? sinistreImmatriculationAdverse.trim() : sinistreImmatriculationAdverse;
  const adversePlateValue =
    normalizedAdversePlate && normalizedAdversePlate !== '' ? normalizedAdversePlate : null;
  const circulationDate = normalizeCirculationDate(vehiculeAnnee);
  const vinValue =
    typeof vehiculeVin === 'string'
      ? vehiculeVin.trim() || null
      : vehiculeVin !== undefined && vehiculeVin !== null
      ? String(vehiculeVin)
      : null;
  let kilometrageValue =
    vehiculeKilometrage === undefined || vehiculeKilometrage === null || vehiculeKilometrage === ''
      ? null
      : Number(vehiculeKilometrage);
  if (kilometrageValue !== null && Number.isNaN(kilometrageValue)) {
    kilometrageValue = null;
  }
  const puissanceValue =
    typeof vehiculePuissanceFiscale === 'string'
      ? vehiculePuissanceFiscale.trim() || null
      : vehiculePuissanceFiscale !== undefined && vehiculePuissanceFiscale !== null
      ? String(vehiculePuissanceFiscale)
      : null;
  const energieValue =
    typeof vehiculeEnergie === 'string'
      ? vehiculeEnergie.trim() || null
      : vehiculeEnergie !== undefined && vehiculeEnergie !== null
      ? String(vehiculeEnergie)
      : null;
  const garantieTypeValue =
    typeof garantieType === 'string'
      ? garantieType.trim() || null
      : garantieType !== undefined && garantieType !== null
      ? String(garantieType)
      : null;
  let franchiseTauxValue =
    garantieFranchiseTaux === undefined || garantieFranchiseTaux === null || garantieFranchiseTaux === ''
      ? null
      : Number(garantieFranchiseTaux);
  if (franchiseTauxValue !== null && Number.isNaN(franchiseTauxValue)) {
    franchiseTauxValue = null;
  }
  let franchiseMontantValue =
    garantieFranchiseMontant === undefined ||
    garantieFranchiseMontant === null ||
    garantieFranchiseMontant === ''
      ? null
      : Number(garantieFranchiseMontant);
  if (franchiseMontantValue !== null && Number.isNaN(franchiseMontantValue)) {
    franchiseMontantValue = null;
  }
  const guaranteeRequiresFranchise =
    garantieTypeValue && ['dommage collision', 'tierce'].includes(garantieTypeValue.toLowerCase());
  if (!guaranteeRequiresFranchise) {
    franchiseTauxValue = null;
    franchiseMontantValue = null;
  }
  const responsabiliteValue =
    typeof responsabilite === 'string'
      ? responsabilite.trim() || null
      : responsabilite !== undefined && responsabilite !== null
      ? String(responsabilite)
      : null;
  const reformeTypeValue =
    typeof reformeType === 'string'
      ? reformeType.trim() || null
      : reformeType !== undefined && reformeType !== null
      ? String(reformeType)
      : null;
  const normalizeAmount = (value) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  };
  const valeurAssureeValue = normalizeAmount(valeurAssuree);
  const valeurVenaleValue = normalizeAmount(valeurVenale);
  const valeurEpavesValue = normalizeAmount(valeurEpaves);
  const syntheseValue =
    typeof synthese === 'string'
      ? synthese.trim() || null
      : synthese !== undefined && synthese !== null
      ? String(synthese)
      : null;
  const indemnisationValue = normalizeAmount(indemnisationFinale);

  const result = await run(
    `INSERT INTO missions (
      assureur_nom,
      assureur_contact,
      assureur_agence_id,
      assureur_agence_nom,
      assureur_agence_adresse,
      assureur_agence_contact,
      assureur_adverse_id,
      assureur_adverse_nom,
      assure_nom,
      assure_telephone,
      assure_email,
      vehicule_marque,
      vehicule_modele,
      vehicule_immatriculation,
      vehicule_annee,
      vehicule_vin,
      vehicule_kilometrage,
      vehicule_puissance_fiscale,
      vehicule_energie,
      sinistre_type,
      sinistre_circonstances,
      sinistre_date,
      sinistre_police,
      sinistre_police_adverse,
      sinistre_nom_adverse,
      sinistre_immatriculation_adverse,
      garage_nom,
      garage_adresse,
      garage_contact,
      agent_id,
      assureur_id,
      vehicule_marque_id,
      garage_id,
      labor_supplies_ht,
      garantie_type,
      garantie_franchise_taux,
      garantie_franchise_montant,
      responsabilite,
      reforme_type,
      valeur_assuree,
      valeur_venale,
      valeur_epaves,
      indemnisation_finale,
      synthese,
      statut,
      created_by
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )`,
    [
      insurer.nom,
      insurer.contact || null,
      agency ? agency.id : null,
      agency ? agency.nom : null,
      agency ? agency.adresse : null,
      agency ? agency.contact : null,
      adverseInsurer ? adverseInsurer.id : null,
      adverseInsurer ? adverseInsurer.nom : null,
      assureNom,
      assureTelephone,
      assureEmail,
      brand.nom,
      vehiculeModele,
      vehiculeImmatriculation,
      circulationDate,
      vinValue,
      kilometrageValue,
      puissanceValue,
      energieValue,
      sinistreType,
      sinistreCirconstances,
      sinistreDate,
      policeValue,
      adversePoliceValue,
      adverseNameValue,
      adversePlateValue,
      garage ? garage.nom : null,
      garage ? garage.adresse : null,
      garage ? garage.contact : null,
      validAssigneeId ?? null,
      insurer.id,
      brand.id,
      garage ? garage.id : null,
      0,
      garantieTypeValue,
      franchiseTauxValue,
      franchiseMontantValue,
      responsabiliteValue,
      reformeTypeValue,
      valeurAssureeValue,
      valeurVenaleValue,
      valeurEpavesValue,
      indemnisationValue,
      syntheseValue,
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

  let adverseInsurerInfo;
  if (Object.prototype.hasOwnProperty.call(payload, 'assureurAdverseId')) {
    adverseInsurerInfo = await ensureValidInsurer(payload.assureurAdverseId);
  }

  let garageInfo;
  if (Object.prototype.hasOwnProperty.call(payload, 'garageId')) {
    if (payload.garageId === null || payload.garageId === '') {
      garageInfo = null;
    } else {
      garageInfo = await ensureValidGarage(payload.garageId);
    }
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

  if (adverseInsurerInfo !== undefined) {
    pushUpdate('assureur_adverse_id', adverseInsurerInfo ? adverseInsurerInfo.id : null);
    pushUpdate('assureur_adverse_nom', adverseInsurerInfo ? adverseInsurerInfo.nom : null);
  }

  if (brandInfo !== undefined) {
    pushUpdate('vehicule_marque_id', brandInfo.id);
    pushUpdate('vehicule_marque', brandInfo.nom);
  }

  if (garageInfo !== undefined) {
    pushUpdate('garage_id', garageInfo ? garageInfo.id : null);
    pushUpdate('garage_nom', garageInfo ? garageInfo.nom : null);
    pushUpdate('garage_adresse', garageInfo ? garageInfo.adresse : null);
    pushUpdate('garage_contact', garageInfo ? garageInfo.contact : null);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'assureNom')) pushUpdate('assure_nom', payload.assureNom);
  if (Object.prototype.hasOwnProperty.call(payload, 'assureTelephone')) pushUpdate('assure_telephone', payload.assureTelephone);
  if (Object.prototype.hasOwnProperty.call(payload, 'assureEmail')) pushUpdate('assure_email', payload.assureEmail);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeModele')) pushUpdate('vehicule_modele', payload.vehiculeModele);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeImmatriculation')) pushUpdate('vehicule_immatriculation', payload.vehiculeImmatriculation);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeAnnee')) pushUpdate('vehicule_annee', normalizeCirculationDate(payload.vehiculeAnnee));
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeVin')) pushUpdate('vehicule_vin', payload.vehiculeVin);
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeKilometrage')) {
    const rawKm = payload.vehiculeKilometrage;
    let kmValue;
    if (rawKm === '' || rawKm === null || rawKm === undefined) {
      kmValue = null;
    } else {
      kmValue = Number(rawKm);
      if (Number.isNaN(kmValue)) {
        kmValue = null;
      }
    }
    pushUpdate('vehicule_kilometrage', kmValue);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculePuissanceFiscale')) {
    pushUpdate('vehicule_puissance_fiscale', payload.vehiculePuissanceFiscale);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'vehiculeEnergie')) {
    pushUpdate('vehicule_energie', payload.vehiculeEnergie);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreType')) pushUpdate('sinistre_type', payload.sinistreType);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreCirconstances')) pushUpdate('sinistre_circonstances', payload.sinistreCirconstances);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreDate')) pushUpdate('sinistre_date', payload.sinistreDate);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistrePolice')) pushUpdate('sinistre_police', payload.sinistrePolice);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistrePoliceAdverse')) pushUpdate('sinistre_police_adverse', payload.sinistrePoliceAdverse);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreNomAdverse')) pushUpdate('sinistre_nom_adverse', payload.sinistreNomAdverse);
  if (Object.prototype.hasOwnProperty.call(payload, 'sinistreImmatriculationAdverse')) pushUpdate('sinistre_immatriculation_adverse', payload.sinistreImmatriculationAdverse);
  let nextGuaranteeType;
  if (Object.prototype.hasOwnProperty.call(payload, 'garantieType')) {
    const rawType = payload.garantieType;
    if (rawType === null || rawType === undefined) {
      nextGuaranteeType = null;
    } else if (typeof rawType === 'string') {
      nextGuaranteeType = rawType.trim() || null;
    } else {
      nextGuaranteeType = String(rawType);
    }
    pushUpdate('garantie_type', nextGuaranteeType);
    const requiresFranchise =
      nextGuaranteeType && ['dommage collision', 'tierce'].includes(nextGuaranteeType.toLowerCase());
    if (!requiresFranchise) {
      pushUpdate('garantie_franchise_taux', null);
      pushUpdate('garantie_franchise_montant', null);
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'garantieFranchiseTaux')) {
    const rawRate = payload.garantieFranchiseTaux;
    let rateValue;
    if (rawRate === '' || rawRate === null || rawRate === undefined) {
      rateValue = null;
    } else {
      rateValue = Number(rawRate);
      if (Number.isNaN(rateValue)) {
        rateValue = null;
      }
    }
    pushUpdate('garantie_franchise_taux', rateValue);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'garantieFranchiseMontant')) {
    const rawAmount = payload.garantieFranchiseMontant;
    let amountValue;
    if (rawAmount === '' || rawAmount === null || rawAmount === undefined) {
      amountValue = null;
    } else {
      amountValue = Number(rawAmount);
      if (Number.isNaN(amountValue)) {
        amountValue = null;
      }
    }
    pushUpdate('garantie_franchise_montant', amountValue);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'responsabilite')) pushUpdate('responsabilite', payload.responsabilite);
  if (Object.prototype.hasOwnProperty.call(payload, 'reformeType')) {
    const rawType = payload.reformeType;
    if (rawType === null || rawType === undefined) {
      pushUpdate('reforme_type', null);
    } else if (typeof rawType === 'string') {
      pushUpdate('reforme_type', rawType.trim() || null);
    } else {
      pushUpdate('reforme_type', String(rawType));
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'valeurAssuree')) {
    const amount = payload.valeurAssuree;
    let normalized = null;
    if (amount !== '' && amount !== null && amount !== undefined) {
      const numeric = Number(amount);
      normalized = Number.isNaN(numeric) ? null : numeric;
    }
    pushUpdate('valeur_assuree', normalized);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'valeurVenale')) {
    const amount = payload.valeurVenale;
    let normalized = null;
    if (amount !== '' && amount !== null && amount !== undefined) {
      const numeric = Number(amount);
      normalized = Number.isNaN(numeric) ? null : numeric;
    }
    pushUpdate('valeur_venale', normalized);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'valeurEpaves')) {
    const amount = payload.valeurEpaves;
    let normalized = null;
    if (amount !== '' && amount !== null && amount !== undefined) {
      const numeric = Number(amount);
      normalized = Number.isNaN(numeric) ? null : numeric;
    }
    pushUpdate('valeur_epaves', normalized);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'indemnisationFinale')) {
    const amount = payload.indemnisationFinale;
    let normalized = null;
    if (amount !== '' && amount !== null && amount !== undefined) {
      const numeric = Number(amount);
      normalized = Number.isNaN(numeric) ? null : numeric;
    }
    pushUpdate('indemnisation_finale', normalized);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'synthese')) {
    const text = payload.synthese;
    if (text === null || text === undefined) {
      pushUpdate('synthese', null);
    } else if (typeof text === 'string') {
      pushUpdate('synthese', text.trim() || null);
    } else {
      pushUpdate('synthese', String(text));
    }
  }
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



















