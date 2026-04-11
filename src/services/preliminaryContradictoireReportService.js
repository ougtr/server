const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const STAMP_SCALE = 0.67;
const PNG_DPI = 96;
const LEFT = 70;
const RIGHT = 525;

const safe = (value) => (value === null || value === undefined || value === '' ? '' : String(value));
const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const valueOrDefault = (value, fallback = '') => (value === undefined || value === null ? safe(fallback) : safe(value));
const hasOwn = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const normalized = String(value).replace(/\s+/g, '').replace(',', '.').trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeOptionalNumber = (value) => (hasValue(value) ? normalizeNumber(value) : '');

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  return !['0', 'false', 'non', 'off'].includes(normalized);
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  const raw = String(value).trim();
  if (!raw) {
    return '';
  }
  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return raw;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatAmount = (value) => {
  const amount = normalizeNumber(value);
  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);
  const [integerPart, decimalPart] = absoluteAmount.toFixed(2).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${isNegative ? '-' : ''}${groupedInteger},${decimalPart}`;
};

const drawBox = (doc, x, y, width, height) => {
  doc
    .save()
    .lineWidth(0.8)
    .strokeColor('#222222')
    .rect(x, y, width, height)
    .stroke()
    .restore();
};

const drawCheckBox = (doc, x, y, checked) => {
  drawBox(doc, x, y, 18, 18);
  if (!checked) {
    return;
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#111111')
    .text('X', x + 4, y + 1, { lineBreak: false });
};

const drawTable = (doc, x, y, widths, heights) => {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const totalHeight = heights.reduce((sum, height) => sum + height, 0);
  drawBox(doc, x, y, totalWidth, totalHeight);

  let currentX = x;
  widths.slice(0, -1).forEach((width) => {
    currentX += width;
    doc
      .save()
      .lineWidth(0.7)
      .strokeColor('#222222')
      .moveTo(currentX, y)
      .lineTo(currentX, y + totalHeight)
      .stroke()
      .restore();
  });

  let currentY = y;
  heights.slice(0, -1).forEach((height) => {
    currentY += height;
    doc
      .save()
      .lineWidth(0.7)
      .strokeColor('#222222')
      .moveTo(x, currentY)
      .lineTo(x + totalWidth, currentY)
      .stroke()
      .restore();
  });
};

const resolveStampImage = () => {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(projectRoot, 'server', 'cachet-opale.png'),
    path.join(__dirname, '..', '..', 'cachet-opale.png'),
  ];
  return candidates.find((imagePath) => fs.existsSync(imagePath)) || null;
};

const readPngDimensions = (imagePath) => {
  try {
    const buffer = fs.readFileSync(imagePath);
    const isPng =
      buffer.length >= 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    if (!isPng) {
      return null;
    }
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  } catch (error) {
    return null;
  }
};

const drawStamp = (doc, x, y, width = 115) => {
  const stampPath = resolveStampImage();
  if (!stampPath) {
    return;
  }
  const stampSize = readPngDimensions(stampPath);
  const renderedWidth = Math.min(width, ((stampSize?.width || 334) * 72 * STAMP_SCALE) / PNG_DPI);
  const renderedHeight = ((stampSize?.height || 141) * renderedWidth) / (stampSize?.width || 334);
  try {
    doc.image(stampPath, x, y, {
      width: renderedWidth,
      height: renderedHeight,
    });
  } catch (error) {
    // Ignore stamp rendering errors.
  }
};

const buildDefaultPayload = (mission = {}, payload = {}) => {
  const firstExpert = payload.firstExpert || {};
  const secondExpert = payload.secondExpert || {};
  const vehicle = payload.vehicle || {};
  const defaultSuppliesAmount = hasValue(mission?.laborSuppliesHt) ? formatAmount(mission.laborSuppliesHt) : '';
  const defaultLaborBodyAmount = hasValue(payload.defaultLaborBodyAmount) ? safe(payload.defaultLaborBodyAmount) : '';
  const defaultVatAmount = hasValue(payload.defaultVatAmount) ? safe(payload.defaultVatAmount) : '';
  const defaultGrossTotal = hasValue(payload.defaultGrossTotal) ? safe(payload.defaultGrossTotal) : '';
  const defaultVetusteAmount = hasValue(payload.defaultVetusteAmount) ? safe(payload.defaultVetusteAmount) : '';
  const defaultNetTotal = hasValue(payload.defaultNetTotal) ? safe(payload.defaultNetTotal) : '';
  const defaultValueDifference = hasValue(payload.defaultValueDifference) ? safe(payload.defaultValueDifference) : '';

  return {
    reference: safe(payload.reference || mission.missionCode || `M-${mission.id || ''}`),
    issueDate: formatDate(payload.issueDate || mission.sinistreDate),
    insuredName: safe(payload.insuredName || mission.assureNom),
    insuredPhone: safe(payload.insuredPhone || mission.assureTelephone),
    firstExpertInsurer: safe(payload.firstExpertInsurer || mission.assureurNom),
    firstExpertVehicleLabel: safe(
      payload.firstExpertVehicleLabel ||
        [mission.vehiculeMarque, mission.vehiculeModele].filter(Boolean).join(' ')
    ),
    firstExpertVehicleRegistration: safe(payload.firstExpertVehicleRegistration || mission.vehiculeImmatriculation),
    firstExpertPolicyNumber: safe(payload.firstExpertPolicyNumber || mission.sinistrePolice),
    secondExpertName: safe(payload.secondExpertName),
    secondExpertInsurer: safe(payload.secondExpertInsurer || mission.assureurAdverseNom),
    secondExpertVehicleLabel: safe(payload.secondExpertVehicleLabel),
    secondExpertVehicleRegistration: safe(payload.secondExpertVehicleRegistration || mission.sinistreImmatriculationAdverse),
    secondExpertPolicyNumber: safe(payload.secondExpertPolicyNumber || mission.sinistrePoliceAdverse),
    damagedPartyLabel: safe(payload.damagedPartyLabel || mission.assureNom),
    city: safe(payload.city || 'Casa'),
    reportDate: formatDate(payload.reportDate || new Date().toISOString()),
    observations: safe(payload.observations),
    vehicle: {
      marque: safe(vehicle.marque || mission.vehiculeMarque),
      chassis: safe(vehicle.chassis || mission.vehiculeVin),
      type: safe(vehicle.type || mission.vehiculeModele),
      puissance: safe(vehicle.puissance || mission.vehiculePuissanceFiscale),
      dmc: formatDate(vehicle.dmc || mission.vehiculeAnnee),
      carburant: safe(vehicle.carburant || mission.vehiculeEnergie),
      cylindres: safe(vehicle.cylindres),
      kilometrage: safe(
        vehicle.kilometrage !== undefined && vehicle.kilometrage !== null && vehicle.kilometrage !== ''
          ? vehicle.kilometrage
          : mission.vehiculeKilometrage
      ),
    },
    firstExpert: {
      repairSelected: normalizeBoolean(firstExpert.repairSelected, true),
      repairerName: safe(firstExpert.repairerName || mission.garageNom),
      suppliesAmount: valueOrDefault(firstExpert.suppliesAmount, defaultSuppliesAmount),
      laborBodyAmount: valueOrDefault(firstExpert.laborBodyAmount, defaultLaborBodyAmount),
      laborPaintAmount: valueOrDefault(firstExpert.laborPaintAmount, ''),
      laborMechanicalAmount: valueOrDefault(firstExpert.laborMechanicalAmount, ''),
      vatAmount: valueOrDefault(firstExpert.vatAmount, defaultVatAmount),
      grossTotal: valueOrDefault(firstExpert.grossTotal, defaultGrossTotal),
      vetusteAmount: valueOrDefault(firstExpert.vetusteAmount, defaultVetusteAmount),
      netTotal: valueOrDefault(firstExpert.netTotal, defaultNetTotal),
      reformeType: safe(firstExpert.reformeType || mission.reformeType),
      valeurVenale: valueOrDefault(firstExpert.valeurVenale, hasValue(mission.valeurVenale) ? formatAmount(mission.valeurVenale) : ''),
      valeurEpave: valueOrDefault(firstExpert.valeurEpave, hasValue(mission.valeurEpaves) ? formatAmount(mission.valeurEpaves) : ''),
      valueDifference: valueOrDefault(firstExpert.valueDifference, defaultValueDifference),
      companyLabel: hasOwn(firstExpert, 'companyLabel') ? safe(firstExpert.companyLabel) : safe(mission.assureurNom),
      cabinetLabel: hasOwn(firstExpert, 'cabinetLabel') ? safe(firstExpert.cabinetLabel) : 'OPALE EXPERTISE',
    },
    secondExpert: {
      repairSelected: normalizeBoolean(secondExpert.repairSelected, false),
      suppliesAmount: valueOrDefault(secondExpert.suppliesAmount, ''),
      laborBodyAmount: valueOrDefault(secondExpert.laborBodyAmount, ''),
      laborPaintAmount: valueOrDefault(secondExpert.laborPaintAmount, ''),
      laborMechanicalAmount: valueOrDefault(secondExpert.laborMechanicalAmount, ''),
      vatAmount: valueOrDefault(secondExpert.vatAmount, ''),
      grossTotal: valueOrDefault(secondExpert.grossTotal, ''),
      vetusteAmount: valueOrDefault(secondExpert.vetusteAmount, ''),
      netTotal: valueOrDefault(secondExpert.netTotal, ''),
      reformeType: safe(secondExpert.reformeType),
      valeurVenale: valueOrDefault(secondExpert.valeurVenale, ''),
      valeurEpave: valueOrDefault(secondExpert.valeurEpave, ''),
      valueDifference: valueOrDefault(secondExpert.valueDifference, ''),
      companyLabel: hasOwn(secondExpert, 'companyLabel')
        ? safe(secondExpert.companyLabel)
        : safe(payload.secondExpertInsurer || mission.assureurAdverseNom),
      cabinetLabel: hasOwn(secondExpert, 'cabinetLabel') ? safe(secondExpert.cabinetLabel) : '',
    },
  };
};

const drawHeader = (doc) => {
  drawBox(doc, 42, 24, PAGE_WIDTH - 84, 46);
  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor('#111111')
    .text("Annexe 4 : Rapport d'expertise préliminaire - Contradictoire", 50, 38, {
      width: PAGE_WIDTH - 100,
      align: 'center',
    });
};

const drawInfoPanel = (doc, data) => {
  drawTable(doc, 70, 94, [126, 346], [22, 22, 40]);
  doc.font('Helvetica-Bold').fontSize(9.8).fillColor('#111111');
  doc.text('N/Réf', 78, 101, { width: 110 });
  doc.text('Sinistre du', 78, 123, { width: 110 });
  doc.text('Assuré', 78, 145, { width: 110 });
  doc.text('GSM :', 78, 165, { width: 110 });

  doc.font('Helvetica-Bold').fontSize(9.5);
  doc.text(`.........${safe(data.reference)}.................................`, 208, 101, { width: 312 });
  doc.text(`............${safe(data.issueDate)}.............................`, 208, 123, { width: 312 });
  doc.text(`•    ${safe(data.insuredName)}.................................`, 202, 145, { width: 318 });
  doc.text(`•    ${safe(data.insuredPhone)}.....................................`, 202, 165, { width: 318 });
};

const drawIntro = (doc, data) => {
  doc.font('Helvetica-Bold').fontSize(10).text('Entre les soussignés :', LEFT, 192, { width: 250 });

  doc.font('Helvetica-Bold').fontSize(10.5);
  doc.text('OPALE EXPERTISE,', LEFT, 222, { lineBreak: false });
  doc.font('Helvetica').text(` désigné par la compagnie ${safe(data.firstExpertInsurer)}`, 186, 222, {
    lineBreak: false,
  });
  doc.text(
    ` assureur du véhicule ${safe(data.firstExpertVehicleLabel)} immatriculé ${safe(
      data.firstExpertVehicleRegistration
    )} par la police N° ${safe(data.firstExpertPolicyNumber)}`,
    LEFT,
    240,
    { width: 435, lineGap: 0.5 }
  );

  doc.font('Helvetica-Bold').text('Et Monsieur', LEFT, 272, { lineBreak: false });
  doc
    .font('Helvetica')
    .text(` ${safe(data.secondExpertName)} , Expert désigné par la compagnie ${safe(data.secondExpertInsurer)}`, 134, 272, {
      width: 390,
      lineGap: 0.5,
    });
  doc.text(
    `assureur du ${safe(data.secondExpertVehicleLabel)} véhicule immatriculé ${safe(
      data.secondExpertVehicleRegistration
    )} par la police N° ${safe(data.secondExpertPolicyNumber)}`,
    LEFT,
    290,
    { width: 435, lineGap: 0.5 }
  );

  doc.text(
    `A l'effet de procéder à l'estimation contradictoire des dommages subis par ${safe(
      data.damagedPartyLabel
    )} dont les caractéristiques se présentent comme suit :`,
    LEFT,
    326,
    { width: 435, lineGap: 1 }
  );
};

const drawVehicleTable = (doc, vehicle) => {
  doc.font('Helvetica-Bold').fontSize(10).text('CARACTERISTIQUE TECHNIQUE DU VEHICULE :', LEFT, 370, {
    width: 340,
    underline: true,
  });
  drawTable(doc, 70, 396, [112, 112, 112, 116], [20, 20, 20, 20]);

  const rows = [
    ['Marque', vehicle.marque, 'Châssis', vehicle.chassis],
    ['Type', vehicle.type, 'Puissance', vehicle.puissance],
    ['DMC', vehicle.dmc, 'Carburant', vehicle.carburant],
    ['N° Cylindre', vehicle.cylindres, 'Kilométrage', vehicle.kilometrage],
  ];

  let y = 402;
  rows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
    doc.font('Helvetica-Bold').fontSize(9.4);
    doc.text(leftLabel, 76, y, { width: 90, lineBreak: false });
    doc.text(safe(leftValue), 188, y, { width: 98, lineBreak: false });
    doc.text(rightLabel, 300, y, { width: 90, lineBreak: false });
    doc.text(safe(rightValue), 412, y, { width: 102 });
    y += 20;
  });
};

const drawEstimationTable = (doc, x, y, expertData, lineItems, includeRepairer = false) => {
  doc.font('Helvetica-Bold').fontSize(10).text('ESTIMATION DES DOMMAGES :', x + 40, y, {
    width: 170,
    underline: true,
  });
  drawCheckBox(doc, x, y + 30, expertData.repairSelected);
  doc.font('Helvetica-Bold').fontSize(10).text('Réparation', x + 24, y + 35, { width: 120 });
  if (includeRepairer) {
    doc.text('Nom Réparateur :', x + 245, y + 35, { width: 130 });
    doc.font('Helvetica').text(safe(expertData.repairerName), x + 338, y + 35, { width: 140 });
  }

  const itemRowHeight = 18;
  const bodyHeight = Math.max(34, lineItems.length * itemRowHeight + 10);
  const rowVerticalOffset = 3;
  drawTable(doc, x, y + 70, [314, 162], [21, bodyHeight, 19, 19, 19]);
  doc.font('Helvetica-Bold').fontSize(9.6);
  doc.text('Désignation et descriptif', x + 80, y + 79, { width: 180, align: 'center' });
  doc.text('Valeur estimée', x + 338, y + 79, { width: 120, align: 'center' });

  doc.font('Helvetica').fontSize(9.2);
  doc.font('Helvetica-Bold').fontSize(9.8);
  lineItems.forEach((item, index) => {
    const rowY = y + 97 + index * itemRowHeight + rowVerticalOffset;
    doc.font('Helvetica').fontSize(9.2).text(item.label, x + 6, rowY, { width: 290 });
    doc.font('Helvetica-Bold').fontSize(9.8).text(safe(item.value), x + 332, rowY, {
      width: 120,
      align: 'center',
    });
  });

  doc.font('Helvetica-Bold').fontSize(9.8);
  const totalsStartY = y + 91 + bodyHeight;
  doc.text('Total brut des dommages', x + 6, totalsStartY + rowVerticalOffset, { width: 200 });
  doc.text(safe(expertData.grossTotal), x + 332, totalsStartY + rowVerticalOffset, {
    width: 120,
    align: 'center',
  });

  doc.font('Helvetica').fontSize(9.2);
  doc.text('A déduire vétusté  ..........', x + 6, totalsStartY + 19 + rowVerticalOffset, { width: 200 });
  doc.font('Helvetica-Bold').fontSize(9.8);
  doc.text(safe(expertData.vetusteAmount), x + 332, totalsStartY + 19 + rowVerticalOffset, {
    width: 120,
    align: 'center',
  });
  doc.text('Total net des dommages', x + 6, totalsStartY + 38 + rowVerticalOffset, { width: 200 });
  doc.text(safe(expertData.netTotal), x + 332, totalsStartY + 38 + rowVerticalOffset, {
    width: 120,
    align: 'center',
  });
};

const drawReformeBlock = (doc, x, y, expertData) => {
  const reformeType = safe(expertData.reformeType).trim().toLowerCase();
  const isEconomic = reformeType === 'economique';
  const isTechnical = reformeType === 'technique';
  drawCheckBox(doc, x, y, isEconomic);
  doc.font('Helvetica-Bold').fontSize(9.8).text('Réforme Economique', x + 24, y + 3, { width: 150 });
  drawCheckBox(doc, x + 340, y, isTechnical);
  doc.text('Réforme Technique', x + 364, y + 3, { width: 140 });

  drawTable(doc, x + 24, y + 36, [252, 204], [18, 18, 18]);
  doc.font('Helvetica').fontSize(8.8);
  doc.text('Valeur Vénale', x + 30, y + 44, { width: 200 });
  doc.text('Valeur épave (sous réserve de la maximalisation)', x + 30, y + 62, { width: 240 });
  doc.text('Différence des valeurs', x + 30, y + 80, { width: 180 });

  doc.font('Helvetica-Bold').fontSize(8.8);
  doc.text(safe(expertData.valeurVenale), x + 292, y + 44, { width: 170, align: 'center' });
  doc.text(safe(expertData.valeurEpave), x + 292, y + 62, { width: 170, align: 'center' });
  doc.text(safe(expertData.valueDifference), x + 292, y + 80, { width: 170, align: 'center' });
};

const drawObservationLines = (doc, x, y, width, rows) => {
  const rowGap = 18;
  for (let index = 0; index < rows; index += 1) {
    const rowY = y + index * rowGap;
    doc
      .save()
      .lineWidth(0.8)
      .dash(1, { space: 2 })
      .strokeColor('#111111')
      .moveTo(x, rowY)
      .lineTo(x + width, rowY)
      .stroke()
      .restore();
  }
};

const createMissionPreliminaryContradictoireReport = (mission, payload = {}) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
  });
  const data = buildDefaultPayload(mission, payload);

  drawHeader(doc);
  drawInfoPanel(doc, data);
  drawIntro(doc, data);
  drawVehicleTable(doc, data.vehicle);

  doc.font('Helvetica-Bold').fontSize(10).text('POSITION DU 1ER EXPERT :', LEFT, 480, {
    width: 220,
    underline: true,
  });
  drawEstimationTable(
    doc,
    70,
    506,
    data.firstExpert,
    [
      {
        label: '-Fournitures (pièces, fournitures peinture)',
        value: data.firstExpert.suppliesAmount,
      },
      {
        label: "-Main d'oeuvre tôlerie",
        value: data.firstExpert.laborBodyAmount,
      },
      {
        label: '-TVA',
        value: data.firstExpert.vatAmount,
      },
    ],
    true
  );
  doc.font('Helvetica').fontSize(9.4).text('Page 19', 0, 764, { width: PAGE_WIDTH, align: 'center' });
  drawStamp(doc, 334, 756, 205);

  doc.addPage();

  drawReformeBlock(doc, 36, 38, data.firstExpert);

  doc.font('Helvetica-Bold').fontSize(10).text('POSITION DU 2eme EXPERT :', LEFT, 142, {
    width: 220,
    underline: true,
  });
  drawEstimationTable(
    doc,
    70,
    168,
    data.secondExpert,
    [
      {
        label: '-Fournitures (pièces, fournitures peinture)',
        value: data.secondExpert.suppliesAmount,
      },
      {
        label: "-Main d'oeuvre tôlerie",
        value: data.secondExpert.laborBodyAmount,
      },
      {
        label: "-Main d'oeuvre peinture",
        value: data.secondExpert.laborPaintAmount,
      },
      {
        label: "-Main d'oeuvre mécanique",
        value: data.secondExpert.laborMechanicalAmount,
      },
    ],
    false
  );
  drawReformeBlock(doc, 36, 402, data.secondExpert);

  doc.font('Helvetica-Bold').fontSize(10).text('OBSERVATION OU MOTIF DE DESACORD :', LEFT, 506, {
    width: 250,
    underline: true,
  });
  drawObservationLines(doc, LEFT, 556, RIGHT - LEFT, 4);
  doc.font('Helvetica').fontSize(9).text(safe(data.observations), LEFT, 550, {
    width: RIGHT - LEFT,
    height: 86,
    lineGap: 1.2,
  });

  doc.font('Helvetica').fontSize(10).text(
    'En foi de quoi, la présente minute est établie pour servir et valoir ce que de droit .',
    LEFT,
    628,
    { width: 330 }
  );
  doc.font('Helvetica-Bold').fontSize(10).text(`Fait à ${safe(data.city)}, le ${safe(data.reportDate)}`, 330, 648, {
    width: 150,
    align: 'center',
  });

  doc.font('Helvetica-Bold').fontSize(10).text('EXPERT DE LA COMPAGNIE', LEFT, 684, { width: 150 });
  doc.text('EXPERT DE LA COMPAGNIE', 356, 684, { width: 150 });

  doc.font('Helvetica-Bold').fontSize(9.5).text(`.......${safe(data.firstExpert.companyLabel)}.........................`, LEFT, 708, {
    width: 145,
  });
  doc.text(`Cabinet...${safe(data.firstExpert.cabinetLabel)}......`, LEFT, 730, { width: 160 });

  doc.text(`.......${safe(data.secondExpert.companyLabel)}.........................`, 356, 708, { width: 145 });
  doc.text(`Cabinet .................................`, 356, 730, { width: 150 });
  if (data.secondExpert.cabinetLabel) {
    doc.font('Helvetica-Bold').fontSize(9.5).text(`Cabinet ${safe(data.secondExpert.cabinetLabel)}`, 356, 730, {
      width: 160,
    });
  }

  drawStamp(doc, 36, 752, 215);
  doc.font('Helvetica').fontSize(9.4).text('Page 20', 0, 764, { width: PAGE_WIDTH, align: 'center' });

  return doc;
};

module.exports = {
  createMissionPreliminaryContradictoireReport,
};
