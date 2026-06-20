const ExcelJS = require('exceljs');
const { listDamagesByMission } = require('./damageService');
const { listLaborsByMission } = require('./laborService');
const { listPhotosByMission } = require('./photoService');
const { listDocumentsByMission } = require('./documentService');

const VAT_RATE = 0.2;
const HEADER_FILL = 'FFD90429';
const HEADER_TEXT = 'FFFFFFFF';
const BORDER_COLOR = 'FFD1D5DB';

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const formatDate = (value, includeTime = false) => {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  if (!includeTime) {
    return `${day}/${month}/${year}`;
  }
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const missionReference = (mission) => mission.missionCode || `#${mission.id}`;

const normalizeGuarantee = (value) => String(value || '').trim().toLowerCase();

const guaranteeRequiresFranchise = (value) =>
  ['dommage collision', 'tierce', 'bris de glace'].includes(normalizeGuarantee(value));

const guaranteeIgnoresResponsibility = (value) =>
  ['dommage collision', 'tierce', 'bris de glace'].includes(normalizeGuarantee(value));

const effectiveResponsibility = (mission) => {
  if (
    normalizeGuarantee(mission.garantieType) === 'rc 50%' &&
    (mission.responsabilite === null || mission.responsabilite === undefined || mission.responsabilite === '')
  ) {
    return '50%';
  }
  return mission.responsabilite;
};

const parseResponsibility = (value) => {
  const numeric = Number(String(value || '').replace('%', '').replace(',', '.').trim());
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, numeric));
};

const calculateFranchise = (mission, totalTtc) => {
  if (!guaranteeRequiresFranchise(mission.garantieType)) {
    return 0;
  }
  const rateAmount = (safeNumber(mission.garantieFranchiseTaux) / 100) * totalTtc;
  return Math.max(rateAmount, safeNumber(mission.garantieFranchiseMontant));
};

const calculateIndemnisation = (mission, totalTtc, vetusteTtc, franchise) => {
  if (mission.indemnisationFinale !== null && mission.indemnisationFinale !== undefined) {
    return Math.max(0, safeNumber(mission.indemnisationFinale));
  }
  const amountAfterDeductions = Math.max(0, totalTtc - vetusteTtc - franchise);
  if (guaranteeIgnoresResponsibility(mission.garantieType)) {
    return amountAfterDeductions;
  }
  return amountAfterDeductions * ((100 - parseResponsibility(effectiveResponsibility(mission))) / 100);
};

const styleWorksheet = (worksheet, { currencyKeys = [], percentKeys = [] } = {}) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  worksheet.getRow(1).height = 30;
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    row.alignment = { vertical: 'top', wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'hair', color: { argb: BORDER_COLOR } },
      };
    });
  });

  currencyKeys.forEach((key) => {
    worksheet.getColumn(key).numFmt = '#,##0.00';
  });
  percentKeys.forEach((key) => {
    worksheet.getColumn(key).numFmt = '0.00';
  });
};

const createMissionsWorksheet = (workbook) => {
  const worksheet = workbook.addWorksheet('Missions');
  worksheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Code mission', key: 'missionCode', width: 18 },
    { header: 'Statut', key: 'statut', width: 14 },
    { header: 'Réglé', key: 'regle', width: 12 },
    { header: 'Date de creation', key: 'createdAt', width: 19 },
    { header: 'Derniere modification', key: 'updatedAt', width: 21 },
    { header: 'Agent responsable', key: 'agentLogin', width: 20 },
    { header: 'Assureur', key: 'assureurNom', width: 22 },
    { header: 'Contact assureur', key: 'assureurContact', width: 20 },
    { header: 'Agence', key: 'agenceNom', width: 22 },
    { header: 'Adresse agence', key: 'agenceAdresse', width: 30 },
    { header: 'Contact agence', key: 'agenceContact', width: 20 },
    { header: 'Assure - Nom', key: 'assureNom', width: 24 },
    { header: 'Assure - Telephone', key: 'assureTelephone', width: 20 },
    { header: 'Assure - Email', key: 'assureEmail', width: 28 },
    { header: 'Vehicule - Marque', key: 'vehiculeMarque', width: 18 },
    { header: 'Vehicule - Modele', key: 'vehiculeModele', width: 18 },
    { header: 'Immatriculation', key: 'immatriculation', width: 18 },
    { header: 'Date MEC', key: 'dateMec', width: 14 },
    { header: 'N° chassis', key: 'vin', width: 24 },
    { header: 'Kilometrage', key: 'kilometrage', width: 14 },
    { header: 'Puissance fiscale', key: 'puissanceFiscale', width: 16 },
    { header: 'Energie', key: 'energie', width: 14 },
    { header: 'Vehicule vu - Avant travaux', key: 'vuAvant', width: 20 },
    { header: 'Vehicule vu - En cours', key: 'vuEnCours', width: 20 },
    { header: 'Vehicule vu - Apres travaux', key: 'vuApres', width: 20 },
    { header: 'Sinistre N° / Type', key: 'sinistreType', width: 20 },
    { header: 'Date du sinistre', key: 'sinistreDate', width: 16 },
    { header: 'Police', key: 'sinistrePolice', width: 20 },
    { header: 'Circonstances', key: 'circonstances', width: 40 },
    { header: 'Adverse - Nom', key: 'adverseNom', width: 24 },
    { header: 'Adverse - Immatriculation', key: 'adverseImmatriculation', width: 22 },
    { header: 'Adverse - Compagnie', key: 'adverseCompagnie', width: 22 },
    { header: 'Adverse - Police', key: 'adversePolice', width: 20 },
    { header: 'Garage - Nom', key: 'garageNom', width: 22 },
    { header: 'Garage - Adresse', key: 'garageAdresse', width: 30 },
    { header: 'Garage - Contact', key: 'garageContact', width: 20 },
    { header: 'Type de garantie', key: 'garantieType', width: 20 },
    { header: 'Taux franchise (%)', key: 'franchiseTaux', width: 18 },
    { header: 'Franchise saisie', key: 'franchiseSaisie', width: 18 },
    { header: 'Franchise calculee', key: 'franchiseCalculee', width: 20 },
    { header: 'Responsabilite', key: 'responsabilite', width: 16 },
    { header: 'Reforme', key: 'reformeType', width: 16 },
    { header: 'Valeur assuree', key: 'valeurAssuree', width: 18 },
    { header: 'Valeur venale', key: 'valeurVenale', width: 18 },
    { header: 'Valeur epave', key: 'valeurEpaves', width: 18 },
    { header: "Main-d'oeuvre HT", key: 'laborHt', width: 19 },
    { header: "Main-d'oeuvre TTC", key: 'laborTtc', width: 19 },
    { header: 'Fournitures HT', key: 'suppliesHt', width: 18 },
    { header: 'Fournitures TTC', key: 'suppliesTtc', width: 18 },
    { header: 'Montant total HT', key: 'totalHt', width: 18 },
    { header: 'Montant total TTC', key: 'totalTtc', width: 18 },
    { header: 'Vetuste TTC', key: 'vetusteTtc', width: 16 },
    { header: 'Indemnisation finale', key: 'indemnisationFinale', width: 20 },
    { header: 'Synthese', key: 'synthese', width: 45 },
  ];
  styleWorksheet(worksheet, {
    currencyKeys: [
      'franchiseSaisie',
      'franchiseCalculee',
      'valeurAssuree',
      'valeurVenale',
      'valeurEpaves',
      'laborHt',
      'laborTtc',
      'suppliesHt',
      'suppliesTtc',
      'totalHt',
      'totalTtc',
      'vetusteTtc',
      'indemnisationFinale',
    ],
    percentKeys: ['franchiseTaux'],
  });
  return worksheet;
};

const createDamagesWorksheet = (workbook) => {
  const worksheet = workbook.addWorksheet('Dommages');
  worksheet.columns = [
    { header: 'Code mission', key: 'missionCode', width: 18 },
    { header: 'Piece', key: 'piece', width: 28 },
    { header: 'Type de piece', key: 'pieceType', width: 20 },
    { header: 'Prix HT', key: 'priceHt', width: 16 },
    { header: 'TVA appliquee', key: 'withVat', width: 16 },
    { header: 'Prix TTC', key: 'priceTtc', width: 16 },
    { header: 'Vetuste (%)', key: 'vetuste', width: 14 },
    { header: 'Apres vetuste HT', key: 'priceAfter', width: 19 },
    { header: 'Apres vetuste TTC', key: 'priceAfterTtc', width: 20 },
  ];
  styleWorksheet(worksheet, {
    currencyKeys: ['priceHt', 'priceTtc', 'priceAfter', 'priceAfterTtc'],
    percentKeys: ['vetuste'],
  });
  return worksheet;
};

const createLaborsWorksheet = (workbook) => {
  const worksheet = workbook.addWorksheet("Main-d'oeuvre");
  worksheet.columns = [
    { header: 'Code mission', key: 'missionCode', width: 18 },
    { header: 'Categorie', key: 'category', width: 25 },
    { header: "Nombre d'heures", key: 'hours', width: 18 },
    { header: 'Taux horaire', key: 'rate', width: 16 },
    { header: 'TVA appliquee', key: 'withVat', width: 16 },
    { header: 'Hors taxe', key: 'horsTaxe', width: 16 },
    { header: 'TVA', key: 'tva', width: 16 },
    { header: 'Total TTC', key: 'ttc', width: 16 },
  ];
  styleWorksheet(worksheet, {
    currencyKeys: ['rate', 'horsTaxe', 'tva', 'ttc'],
  });
  return worksheet;
};

const createPhotosWorksheet = (workbook) => {
  const worksheet = workbook.addWorksheet('Photos');
  worksheet.columns = [
    { header: 'Code mission', key: 'missionCode', width: 18 },
    { header: 'Phase', key: 'phase', width: 14 },
    { header: 'Libelle', key: 'label', width: 40 },
    { header: 'Fichier', key: 'fichier', width: 50 },
    { header: "Date d'ajout", key: 'uploadedAt', width: 20 },
  ];
  styleWorksheet(worksheet);
  return worksheet;
};

const createDocumentsWorksheet = (workbook) => {
  const worksheet = workbook.addWorksheet('Documents');
  worksheet.columns = [
    { header: 'Code mission', key: 'missionCode', width: 18 },
    { header: 'Nom du document', key: 'nomOriginal', width: 40 },
    { header: 'Type MIME', key: 'mimeType', width: 35 },
    { header: 'Fichier', key: 'fichier', width: 50 },
    { header: "Date d'ajout", key: 'uploadedAt', width: 20 },
  ];
  styleWorksheet(worksheet);
  return worksheet;
};

const createMissionsExport = async (missions) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Expert auto';
  workbook.created = new Date();

  const missionsSheet = createMissionsWorksheet(workbook);
  const damagesSheet = createDamagesWorksheet(workbook);
  const laborsSheet = createLaborsWorksheet(workbook);
  const photosSheet = createPhotosWorksheet(workbook);
  const documentsSheet = createDocumentsWorksheet(workbook);

  for (const mission of missions) {
    const [damageData, laborData, photos, documents] = await Promise.all([
      listDamagesByMission(mission.id),
      listLaborsByMission(mission.id),
      listPhotosByMission(mission.id),
      listDocumentsByMission(mission.id),
    ]);

    const totalTtc = safeNumber(laborData.totals.grandTotalTtc);
    const vetusteTtc = Math.max(
      0,
      safeNumber(damageData.totals.totalTtc) - safeNumber(damageData.totals.totalAfterTtc)
    );
    const franchiseCalculee = calculateFranchise(mission, totalTtc);
    const indemnisationFinale = calculateIndemnisation(
      mission,
      totalTtc,
      vetusteTtc,
      franchiseCalculee
    );

    missionsSheet.addRow({
      id: mission.id,
      missionCode: missionReference(mission),
      statut: mission.statut || '',
      regle: mission.regle ? 'Oui' : 'Non',
      createdAt: formatDate(mission.createdAt, true),
      updatedAt: formatDate(mission.updatedAt, true),
      agentLogin: mission.agentLogin || '',
      assureurNom: mission.assureurNom || '',
      assureurContact: mission.assureurContact || '',
      agenceNom: mission.assureurAgenceNom || '',
      agenceAdresse: mission.assureurAgenceAdresse || '',
      agenceContact: mission.assureurAgenceContact || '',
      assureNom: mission.assureNom || '',
      assureTelephone: mission.assureTelephone || '',
      assureEmail: mission.assureEmail || '',
      vehiculeMarque: mission.vehiculeMarque || '',
      vehiculeModele: mission.vehiculeModele || '',
      immatriculation: mission.vehiculeImmatriculation || '',
      dateMec: formatDate(mission.vehiculeAnnee),
      vin: mission.vehiculeVin || '',
      kilometrage: mission.vehiculeKilometrage ?? '',
      puissanceFiscale: mission.vehiculePuissanceFiscale || '',
      energie: mission.vehiculeEnergie || '',
      vuAvant: formatDate(mission.vehiculeVuAvantTravaux),
      vuEnCours: formatDate(mission.vehiculeVuEnCoursTravaux),
      vuApres: formatDate(mission.vehiculeVuApresTravaux),
      sinistreType: mission.sinistreType || '',
      sinistreDate: formatDate(mission.sinistreDate),
      sinistrePolice: mission.sinistrePolice || '',
      circonstances: mission.sinistreCirconstances || '',
      adverseNom: mission.sinistreNomAdverse || '',
      adverseImmatriculation: mission.sinistreImmatriculationAdverse || '',
      adverseCompagnie: mission.assureurAdverseNom || '',
      adversePolice: mission.sinistrePoliceAdverse || '',
      garageNom: mission.garageNom || '',
      garageAdresse: mission.garageAdresse || '',
      garageContact: mission.garageContact || '',
      garantieType: mission.garantieType || '',
      franchiseTaux: mission.garantieFranchiseTaux ?? '',
      franchiseSaisie: mission.garantieFranchiseMontant ?? '',
      franchiseCalculee,
      responsabilite: effectiveResponsibility(mission) || '',
      reformeType: mission.reformeType || '',
      valeurAssuree: mission.valeurAssuree ?? '',
      valeurVenale: mission.valeurVenale ?? '',
      valeurEpaves: mission.valeurEpaves ?? '',
      laborHt: safeNumber(laborData.totals.totalHt),
      laborTtc: safeNumber(laborData.totals.totalTtc),
      suppliesHt: safeNumber(laborData.totals.suppliesHt),
      suppliesTtc: safeNumber(laborData.totals.suppliesTtc),
      totalHt: safeNumber(laborData.totals.grandTotalHt),
      totalTtc,
      vetusteTtc,
      indemnisationFinale,
      synthese: mission.synthese || '',
    });

    damageData.items.forEach((damage) => {
      damagesSheet.addRow({
        missionCode: missionReference(mission),
        piece: damage.piece || '',
        pieceType: damage.pieceType || '',
        priceHt: safeNumber(damage.priceHt),
        withVat: damage.withVat ? 'Oui' : 'Non',
        priceTtc: safeNumber(damage.priceTtc),
        vetuste: safeNumber(damage.vetuste),
        priceAfter: safeNumber(damage.priceAfter),
        priceAfterTtc: safeNumber(damage.priceAfterTtc),
      });
    });

    laborData.entries.forEach((labor) => {
      laborsSheet.addRow({
        missionCode: missionReference(mission),
        category: labor.label || labor.category || '',
        hours: safeNumber(labor.hours),
        rate: safeNumber(labor.rate),
        withVat: labor.withVat ? 'Oui' : 'Non',
        horsTaxe: safeNumber(labor.horsTaxe),
        tva: safeNumber(labor.tva),
        ttc: safeNumber(labor.ttc),
      });
    });

    photos.forEach((photo) => {
      photosSheet.addRow({
        missionCode: missionReference(mission),
        phase: photo.phase || '',
        label: photo.label || '',
        fichier: photo.fichier || '',
        uploadedAt: formatDate(photo.uploadedAt, true),
      });
    });

    documents.forEach((document) => {
      documentsSheet.addRow({
        missionCode: missionReference(mission),
        nomOriginal: document.nomOriginal || '',
        mimeType: document.mimeType || '',
        fichier: document.fichier || '',
        uploadedAt: formatDate(document.uploadedAt, true),
      });
    });
  }

  return workbook.xlsx.writeBuffer();
};

module.exports = {
  createMissionsExport,
};
