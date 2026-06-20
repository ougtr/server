const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { UPLOAD_DIR } = require('../config');

const formatDate = (value) => {
  if (!value) {
    return '-';
  }
  const normalized = String(value).trim();
  if (!normalized) {
    return '-';
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
};

const safeValue = (value) => (value === null || value === undefined || value === '' ? '-' : value);

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `${amount.toFixed(2)} MAD`;
};

const formatOptionalPositiveCurrency = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const amount = Number(value);
  if (Number.isFinite(amount) && amount === 0) {
    return '-';
  }
  return Number.isFinite(amount) ? `${amount.toFixed(2)} MAD` : String(value);
};

const formatTableAmount = (value) => {
  const amount = Number(value) || 0;
  return amount.toFixed(2);
};

const REPORT_ACCENT_COLOR = '#d90429';
const REPORT_ACCENT_SOFT_COLOR = '#fecdd3';
const PNG_DPI = 96;
const REPORT_STAMP_SCALE = 0.67;

const isHexColor = (value) => /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
const settingValue = (settings, key, fallback = '') => {
  const value = settings?.[key];
  return value === null || value === undefined || value === '' ? fallback : String(value);
};
const resolveUploadedAsset = (relativePath) => {
  if (!relativePath) {
    return null;
  }
  const absolutePath = path.resolve(UPLOAD_DIR, relativePath);
  const uploadRoot = path.resolve(UPLOAD_DIR);
  if (!absolutePath.startsWith(uploadRoot) || !fs.existsSync(absolutePath)) {
    return null;
  }
  return absolutePath;
};
const getPrimaryColor = (settings) =>
  isHexColor(settings?.rapportCouleurPrimaire) ? settings.rapportCouleurPrimaire : REPORT_ACCENT_COLOR;
const getSecondaryColor = (settings) =>
  isHexColor(settings?.rapportCouleurSecondaire) ? settings.rapportCouleurSecondaire : '#111827';
const getSoftPrimaryColor = (settings) => getPrimaryColor(settings);

const ENERGY_LABELS = {
  diesel: 'Diesel',
  essence: 'Essence',
  electrique: 'Electrique',
  hybride: 'Hybride',
};

const DAMAGE_TYPE_LABELS = {
  original: 'Original',
  reparation: 'Reparation',
  reccuperation: 'Reccuperation',
  adaptation: 'Adaptation',
  produit_peinture: 'Produit peinture',
};

const formatKilometrage = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numeric = Number(value);
  // Keep raw digits only (no thousands separator) to avoid PDF glyph issues.
  const formatted = Number.isFinite(numeric) ? String(Math.trunc(numeric)) : String(value).trim();
  return `${formatted} km`;
};

const formatEnergyLabel = (value) => {
  if (!value) {
    return '-';
  }
  const normalized = String(value).trim().toLowerCase();
  return ENERGY_LABELS[normalized] || value;
};

const formatDamageTypeLabel = (value) => {
  if (!value) {
    return '-';
  }
  const normalized = String(value).trim().toLowerCase();
  return DAMAGE_TYPE_LABELS[normalized] || value;
};

const formatVatChoice = (value) => (value ? 'Oui' : 'Non');

const GUARANTEE_LABELS = {
  'dommage collision': 'Dommage collision',
  'bris de glace': 'Bris de glace',
  tierce: 'Tierce',
  rc: 'RC',
  'rc 50%': 'RC 50%',
};

const guaranteeRequiresFranchise = (value) => {
  if (!value) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'dommage collision' || normalized === 'tierce' || normalized === 'bris de glace';
};

const isTierceGuarantee = (value) => {
  if (!value) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'tierce' || normalized === 'bris de glace' || normalized === 'dommage collision';
};

const isRc50Guarantee = (value) => String(value || '').trim().toLowerCase() === 'rc 50%';

const getEffectiveResponsibility = (guaranteeType, responsibilityValue) => {
  if (
    isRc50Guarantee(guaranteeType) &&
    (responsibilityValue === null || responsibilityValue === undefined || responsibilityValue === '')
  ) {
    return '50%';
  }
  return responsibilityValue;
};

const formatGuaranteeType = (value) => {
  if (!value) {
    return '-';
  }
  const normalized = String(value).trim().toLowerCase();
  return GUARANTEE_LABELS[normalized] || value;
};

const formatFranchiseRate = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numeric = Number(value);
  const display = Number.isFinite(numeric) ? numeric.toFixed(2) : value;
  return `${display} %`;
};

const formatFranchiseAmount = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numeric = Number(value);
  const display = Number.isFinite(numeric) ? numeric.toFixed(2) : value;
  return `${display} MAD`;
};

const formatResponsabilite = (value) => {
  if (!value) {
    return '-';
  }
  return value;
};

const parseResponsibilityPercent = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const normalized = String(value).replace('%', '').replace(',', '.').trim();
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, numeric));
};

const applyResponsibilityShare = (amount, responsibilityValue) => {
  const baseAmount = Math.max(0, Number(amount) || 0);
  const responsibilityPercent = parseResponsibilityPercent(responsibilityValue);
  const indemnisationShare = (100 - responsibilityPercent) / 100;
  return Math.max(0, baseAmount * indemnisationShare);
};

const REFORME_LABELS = {
  economique: 'Economique',
  technique: 'Technique',
};

const formatReformeType = (value) => {
  if (!value) {
    return '-';
  }
  const normalized = String(value).trim().toLowerCase();
  return REFORME_LABELS[normalized] || value;
};

const formatPlainNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
};

const FRENCH_UNITS = [
  'zero',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];

const FRENCH_TENS = {
  20: 'vingt',
  30: 'trente',
  40: 'quarante',
  50: 'cinquante',
  60: 'soixante',
};

const toFrenchBelowHundred = (value) => {
  const number = Math.floor(Math.abs(value));
  if (number < 20) {
    return FRENCH_UNITS[number];
  }

  if (number < 70) {
    const ten = Math.floor(number / 10) * 10;
    const unit = number % 10;
    if (unit === 0) {
      return FRENCH_TENS[ten];
    }
    if (unit === 1) {
      return `${FRENCH_TENS[ten]} et un`;
    }
    return `${FRENCH_TENS[ten]}-${FRENCH_UNITS[unit]}`;
  }

  if (number < 80) {
    const rest = number - 60;
    if (rest === 11) {
      return 'soixante et onze';
    }
    return `soixante-${toFrenchBelowHundred(rest)}`;
  }

  const rest = number - 80;
  const base = rest === 0 ? 'quatre-vingts' : 'quatre-vingt';
  if (rest === 0) {
    return base;
  }
  if (rest === 1) {
    return `${base}-un`;
  }
  return `${base}-${toFrenchBelowHundred(rest)}`;
};

const toFrenchBelowThousand = (value) => {
  const number = Math.floor(Math.abs(value));
  if (number < 100) {
    return toFrenchBelowHundred(number);
  }

  const hundreds = Math.floor(number / 100);
  const rest = number % 100;
  let prefix = hundreds === 1 ? 'cent' : `${FRENCH_UNITS[hundreds]} cent`;

  if (rest === 0 && hundreds > 1) {
    prefix += 's';
  }

  return rest > 0 ? `${prefix} ${toFrenchBelowHundred(rest)}` : prefix;
};

const numberToFrenchWords = (value) => {
  const number = Math.floor(Number(value) || 0);

  if (number === 0) {
    return 'zero';
  }
  if (number < 0) {
    return `moins ${numberToFrenchWords(Math.abs(number))}`;
  }

  const scales = [
    { size: 1000000000, singular: 'milliard', plural: 'milliards' },
    { size: 1000000, singular: 'million', plural: 'millions' },
    { size: 1000, singular: 'mille', plural: 'mille' },
  ];

  let remainder = number;
  const chunks = [];

  scales.forEach(({ size, singular, plural }) => {
    const count = Math.floor(remainder / size);
    if (!count) {
      return;
    }

    if (size === 1000) {
      chunks.push(count === 1 ? 'mille' : `${numberToFrenchWords(count)} mille`);
    } else {
      chunks.push(`${numberToFrenchWords(count)} ${count === 1 ? singular : plural}`);
    }

    remainder %= size;
  });

  if (remainder > 0) {
    chunks.push(toFrenchBelowThousand(remainder));
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim();
};

const formatAmountInFrenchWords = (value) => {
  const numeric = Math.max(0, Number(value) || 0);
  const rounded = Math.round(numeric * 100) / 100;
  const integerPart = Math.floor(rounded);
  const cents = Math.round((rounded - integerPart) * 100);

  const integerWords = numberToFrenchWords(integerPart);
  if (!cents) {
    return integerWords;
  }

  const centsWords = numberToFrenchWords(cents);
  const centimeLabel = cents > 1 ? 'centimes' : 'centime';
  return `${integerWords} et ${centsWords} ${centimeLabel}`;
};

const calculateFranchiseAmount = (mission, evaluationTotalTtc) => {
  if (!mission || !guaranteeRequiresFranchise(mission.garantieType)) {
    return 0;
  }
  const rate = Number(mission.garantieFranchiseTaux) || 0;
  const fixed = Number(mission.garantieFranchiseMontant) || 0;
  const percentValue = (rate / 100) * evaluationTotalTtc;
  return Math.max(percentValue, fixed);
};

const calculateIndemnisationFinale = (mission, netAfterVetusteTtc, franchiseBaseTtc) => {
  const netBase = Math.max(0, netAfterVetusteTtc || 0);
  const franchiseBase = Math.max(0, franchiseBaseTtc || 0);

  // Keep manual user override when it exists.
  if (mission && mission.indemnisationFinale !== undefined && mission.indemnisationFinale !== null) {
    const stored = Number(mission.indemnisationFinale);
    return Number.isNaN(stored) ? netBase : Math.max(0, stored);
  }

  const franchiseAmount = calculateFranchiseAmount(mission, franchiseBase);
  const amountAfterFranchise = Math.max(0, netBase - franchiseAmount);
  if (isTierceGuarantee(mission?.garantieType)) {
    return amountAfterFranchise;
  }
  return applyResponsibilityShare(
    amountAfterFranchise,
    getEffectiveResponsibility(mission?.garantieType, mission?.responsabilite)
  );
};

const addSectionTitle = (doc, title, settings = {}) => {
  doc.x = doc.page.margins.left;
  doc.moveDown(0.22);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase());
  doc
    .strokeColor(getSoftPrimaryColor(settings))
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .stroke();
  doc.moveDown(0.22);
};

const addKeyValue = (doc, label, value, width) => {
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor('#1f2933')
    .text(`${label} :`, { continued: true, width })
    .font('Helvetica')
    .fillColor('#0f172a')
    .text(` ${safeValue(value)}`);
};

const addTwoColumnRows = (doc, rows) => {
  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;
  rows.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
    const top = doc.y;
    addKeyValue(doc, leftLabel, leftValue, colWidth - 10);
    doc.x = doc.page.margins.left + colWidth;
    doc.y = top;
    if (rightLabel || (rightValue !== null && rightValue !== undefined && rightValue !== '')) {
      addKeyValue(doc, rightLabel, rightValue, colWidth - 20);
    }
    doc.x = doc.page.margins.left;
    doc.moveDown(0.15);
  });
  doc.moveDown(0.15);
};

const addDualInfoColumns = (doc, leftConfig, rightConfig, settings = {}) => {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnGap = 12;
  const columnWidth = (usableWidth - columnGap) / 2;
  const startY = doc.y;

  const renderColumn = ({ title, rows }, x) => {
    let currentY = startY;

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(getPrimaryColor(settings)).text(title, x, currentY, {
      width: columnWidth,
    });
    currentY = doc.y + 1;

    rows.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#1f2933')
        .text(`${label} :`, x, currentY, { width: columnWidth, continued: true })
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(` ${safeValue(value)}`, { width: columnWidth });
      currentY = doc.y + 1;
    });

    return currentY;
  };

  const leftBottom = renderColumn(leftConfig, doc.page.margins.left);
  const rightBottom = renderColumn(rightConfig, doc.page.margins.left + columnWidth + columnGap);

  doc.y = Math.max(leftBottom, rightBottom);
  doc.x = doc.page.margins.left;
  doc.moveDown(0.1);
};

const addCompactVehicleColumns = (doc, mission, settings = {}) => {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnGap = 10;
  const firstWidth = usableWidth * 0.31;
  const secondWidth = usableWidth * 0.31;
  const thirdWidth = usableWidth - firstWidth - secondWidth - columnGap * 2;
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const baseFontSize = 8.7;

  const renderColumn = (x, width, rows, title) => {
    let currentY = startY;

    if (title) {
      doc
        .font('Helvetica-Bold')
        .fontSize(9.2)
        .fillColor(getPrimaryColor(settings))
        .text(title, x, currentY, { width, align: 'left' });
      currentY = doc.y + 2;
    }

    rows.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(baseFontSize)
        .fillColor('#1f2933')
        .text(`${label} :`, x, currentY, { width, continued: true })
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(` ${safeValue(value)}`, { width });
      currentY = doc.y + 2;
    });

    return currentY;
  };

  const leftBottom = renderColumn(startX, firstWidth, [
    ['Marque', mission.vehiculeMarque],
    ['Immatriculation', mission.vehiculeImmatriculation],
    ['N° chassis', mission.vehiculeVin],
    ['Puissance fiscale', mission.vehiculePuissanceFiscale],
  ]);

  const middleX = startX + firstWidth + columnGap;
  const middleBottom = renderColumn(middleX, secondWidth, [
    ['Modele', mission.vehiculeModele],
    ['Date MEC', formatDate(mission.vehiculeAnnee)],
    ['Kilometrage', formatKilometrage(mission.vehiculeKilometrage)],
    ['Energie', formatEnergyLabel(mission.vehiculeEnergie)],
  ]);

  const rightX = middleX + secondWidth + columnGap;
  const rightBottom = renderColumn(
    rightX,
    thirdWidth,
    [
      ['Avant travaux', formatDate(mission.vehiculeVuAvantTravaux)],
      ['En cours de travaux', formatDate(mission.vehiculeVuEnCoursTravaux)],
      ['Apr\u00e8s travaux', formatDate(mission.vehiculeVuApresTravaux)],
    ],
    'V\u00e9hicule vu'
  );

  const bottomY = Math.max(leftBottom, middleBottom, rightBottom);
  const dividerTop = startY - 1;

  [startX + firstWidth + columnGap / 2, middleX + secondWidth + columnGap / 2].forEach((dividerX) => {
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(getSoftPrimaryColor(settings))
      .moveTo(dividerX, dividerTop)
      .lineTo(dividerX, bottomY - 1)
      .stroke()
      .restore();
  });

  doc.y = bottomY + 1;
  doc.x = doc.page.margins.left;
};

const addCompactPrimaryInfoColumns = (doc, mission, settings = {}) => {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnGap = 10;
  const columnWidth = (usableWidth - columnGap * 2) / 3;
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const baseFontSize = 8.7;

  const renderColumn = (x, rows) => {
    let currentY = startY;

    rows.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(baseFontSize)
        .fillColor('#1f2933')
        .text(`${label} :`, x, currentY, { width: columnWidth, continued: true })
        .font('Helvetica')
        .fillColor('#0f172a')
        .text(` ${safeValue(value)}`, { width: columnWidth });
      currentY = doc.y + 2;
    });

    return currentY;
  };

  const leftBottom = renderColumn(startX, [
    ['Assureur', mission.assureurNom],
    ['Agence', mission.assureurAgenceNom],
  ]);

  const middleX = startX + columnWidth + columnGap;
  const middleBottom = renderColumn(middleX, [
    ['Contact assureur', mission.assureurContact],
    ['Contact agence', mission.assureurAgenceContact],
  ]);

  const rightX = middleX + columnWidth + columnGap;
  const rightBottom = renderColumn(rightX, [
    ['Adresse agence', mission.assureurAgenceAdresse],
    ['Responsable mission', mission.agentLogin],
  ]);

  const bottomY = Math.max(leftBottom, middleBottom, rightBottom);
  const dividerTop = startY - 1;

  [startX + columnWidth + columnGap / 2, middleX + columnWidth + columnGap / 2].forEach((dividerX) => {
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(getSoftPrimaryColor(settings))
      .moveTo(dividerX, dividerTop)
      .lineTo(dividerX, bottomY - 1)
      .stroke()
      .restore();
  });

  doc.y = bottomY + 1;
  doc.x = doc.page.margins.left;
};

const addFramedSection = (doc, title, renderContent, options = {}) => {
  if (typeof renderContent !== 'function') {
    return;
  }
  const {
    topSpacing = 0.08,
    titleHeight = 18,
    contentGap = 1,
    bottomPadding = 1,
    minHeight = 30,
  } = options;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const frameLeft = doc.page.margins.left - 2;
  const frameWidth = usableWidth + 4;
  const titlePadding = 8;

  doc.moveDown(topSpacing);
  const frameTop = doc.y + 4;
  const contentTop = frameTop + titleHeight + contentGap;
  doc.y = contentTop;
  doc.x = doc.page.margins.left;

  renderContent();
  const contentBottom = doc.y + bottomPadding;
  const frameHeight = Math.max(minHeight, contentBottom - frameTop);

  doc
    .save()
    .lineWidth(1)
    .strokeColor(getSoftPrimaryColor(options.settings))
    .roundedRect(frameLeft, frameTop, frameWidth, frameHeight, 6)
    .stroke()
    .restore();

  const titleText = title.toUpperCase();
  doc.font('Helvetica-Bold').fontSize(11);
  const titleWidth = doc.widthOfString(titleText) + titlePadding * 2;
  const labelX = frameLeft + 12;
  const labelY = frameTop + 3;

  doc
    .save()
    .fillColor('#ffffff')
    .rect(labelX - titlePadding, labelY - 2, titleWidth, titleHeight)
    .fill()
    .restore();

  doc.fillColor('#0f172a').text(titleText, labelX, labelY, { lineBreak: false });
  doc.y = frameTop + frameHeight;
  doc.moveDown(0.04);
};

const addInlineSummaryTable = (doc, items, settings = {}) => {
  if (!items || !items.length) {
    return;
  }

  const normalizedItems = items.map((item) => {
    if (!Array.isArray(item)) {
      return item;
    }
    const [label, value, options] = item;
    return {
      label,
      value,
      emphasizeValue: Boolean(options && options.emphasizeValue),
    };
  });

  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const minColWidth = Math.min(usableWidth / normalizedItems.length, 140);
  const padding = 6;

  const measurements = normalizedItems.map(({ label, value, emphasizeValue }) => {
    doc.font('Helvetica-Bold').fontSize(8.5);
    const labelWidth = doc.widthOfString(`${label} : `);
    doc.font(emphasizeValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(emphasizeValue ? 9.5 : 8.5);
    const valueWidth = doc.widthOfString(`${safeValue(value)}`);
    return labelWidth + valueWidth + padding * 2;
  });

  const totalMeasure = measurements.reduce((sum, width) => sum + width, 0) || 1;
  let colWidths = measurements.map((width) => Math.max(minColWidth, (width / totalMeasure) * usableWidth));
  const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
  if (totalWidth > usableWidth) {
    const scale = usableWidth / totalWidth;
    colWidths = colWidths.map((width) => width * scale);
  } else {
    const extra = (usableWidth - totalWidth) / normalizedItems.length;
    colWidths = colWidths.map((width) => width + extra);
  }

  const textHeights = normalizedItems.map(({ label, value, emphasizeValue }, index) => {
    doc.font('Helvetica-Bold').fontSize(8.5);
    const labelHeight = doc.heightOfString(`${label} : `, {
      width: colWidths[index] - padding * 2,
      align: 'left',
    });
    doc.font(emphasizeValue ? 'Helvetica-Bold' : 'Helvetica').fontSize(emphasizeValue ? 9.5 : 8.5);
    const valueHeight = doc.heightOfString(`${safeValue(value)}`, {
      width: colWidths[index] - padding * 2,
      align: 'left',
    });
    return Math.max(labelHeight, valueHeight);
  });
  const rowHeight = Math.max(16, Math.max(...textHeights) + padding);

  const startY = doc.y;
  doc
    .lineWidth(0.5)
    .strokeColor(getSoftPrimaryColor(settings))
    .rect(doc.page.margins.left, startY, usableWidth, rowHeight)
    .stroke();

  const textY = startY + padding / 2;
  let currentX = doc.page.margins.left;
  normalizedItems.forEach(({ label, value, emphasizeValue }, index) => {
    const colWidth = colWidths[index];
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#1f2933')
      .text(`${label} : `, currentX + padding / 2, textY, {
        width: colWidth - padding,
        continued: true,
      })
      .font(emphasizeValue ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(emphasizeValue ? 9.5 : 8.5)
      .fillColor('#0f172a')
      .text(`${safeValue(value)}`, {
        continued: false,
        width: colWidth - padding,
      });
    currentX += colWidth;
  });

  doc.y = startY + rowHeight + 1;
};

const addClosingAmountLine = (doc, amountInWords, settings = {}) => {
  const text = `Arrête le présent rapport d’expertise à la somme de : '${safeValue(amountInWords)} DHS'`;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
  const textHeight = doc.heightOfString(text, {
    width: width - 12,
    align: 'left',
  });
  const rowHeight = Math.max(20, textHeight + 10);
  const top = doc.y;

  doc
    .lineWidth(0.5)
    .strokeColor(getSoftPrimaryColor(settings))
    .rect(doc.page.margins.left, top, width, rowHeight)
    .stroke();

  doc.text(text, doc.page.margins.left + 6, top + 5, {
    width: width - 12,
    align: 'left',
  });

  doc.y = top + rowHeight + 2;
};

const addTableSection = (doc, headers, rows, firstColumnRatio = 0.2, options = {}) => {
  const { headerHeight = 26, rowMinHeight = 17, rowPadding = 6 } = options;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const remaining = tableWidth * (1 - firstColumnRatio);
  const colWidths = headers.map((_, index) =>
    index === 0 ? tableWidth * firstColumnRatio : remaining / (headers.length - 1)
  );
  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const ensureSpaceFor = (heightNeeded) => {
    if (doc.y + heightNeeded <= pageBottom()) {
      return;
    }
    doc.addPage();
  };
  const drawHeader = () => {
    const startY = doc.y;
    doc.save().fillColor(getPrimaryColor(options.settings)).rect(doc.page.margins.left, startY, tableWidth, headerHeight).fill();

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    let headerX = doc.page.margins.left;
    headers.forEach((header, index) => {
      doc.text(header, headerX, startY + 6, {
        width: colWidths[index],
        align: 'center',
      });
      headerX += colWidths[index];
    });
    doc.restore();
    doc.y = startY + headerHeight;
  };

  ensureSpaceFor(headerHeight + rowMinHeight);
  drawHeader();

  rows.forEach((row) => {
    doc.font('Helvetica').fontSize(9);
    const cellHeights = row.map((cell, index) =>
      doc.heightOfString(safeValue(cell), {
        width: colWidths[index] - 6,
        align: 'center',
      })
    );
    const effectiveRowHeight = Math.max(rowMinHeight, ...cellHeights) + rowPadding;

    if (doc.y + effectiveRowHeight > pageBottom()) {
      doc.addPage();
      drawHeader();
    }

    const rowY = doc.y;
    doc
      .strokeColor(getSoftPrimaryColor(options.settings))
      .lineWidth(0.5)
      .rect(doc.page.margins.left, rowY, tableWidth, effectiveRowHeight)
      .stroke();

    let cellX = doc.page.margins.left;
    row.forEach((cell, index) => {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#0f172a')
        .text(safeValue(cell), cellX + 3, rowY + Math.max(3, Math.floor(rowPadding / 2)), {
          width: colWidths[index] - 6,
          align: 'center',
        });
      cellX += colWidths[index];
    });

    doc.y = rowY + effectiveRowHeight;
  });

  doc.y += 4;
  doc.x = doc.page.margins.left;
};

const addObservationSection = (doc, mission, settings = {}) => {
  doc.moveDown(0.6);
  addSectionTitle(doc, 'Observations', settings);
  const content =
    typeof mission.synthese === 'string' && mission.synthese.trim().length
      ? mission.synthese.trim()
      : `Ce rapport regroupe les informations communiquees le ${formatDate(
          mission.updatedAt || mission.createdAt
        )}. Il est destine a servir de support pour la redaction finale du rapport d'expertise.`;
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(content, { align: 'left' });
};

const REPORT_FOOTER_HEIGHT = 62;
const REPORT_SIGNATURE_BOX_WIDTH = 198;
const REPORT_SIGNATURE_BOX_HEIGHT = 85;
const REPORT_SIGNATURE_GAP = 8;
const REPORT_PAGE_BOTTOM_RESERVED = REPORT_FOOTER_HEIGHT + REPORT_SIGNATURE_BOX_HEIGHT + REPORT_SIGNATURE_GAP + 6;

const resolveStampImage = (settings = {}) => {
  const customStamp = resolveUploadedAsset(settings.cachetPath);
  if (customStamp) {
    return customStamp;
  }
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(projectRoot, 'server', 'default-logo.png'),
    path.join(__dirname, '..', '..', 'default-logo.png'),
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

const getContainedImageSize = (imagePath, maxWidth, maxHeight) => {
  const dimensions = readPngDimensions(imagePath);
  if (!dimensions?.width || !dimensions?.height) {
    return { width: maxWidth, height: maxHeight };
  }
  const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
  return {
    width: Math.max(1, dimensions.width * ratio),
    height: Math.max(1, dimensions.height * ratio),
  };
};

const addPageSignatureBlock = (doc, settings = {}) => {
  const previousX = doc.x;
  const previousY = doc.y;
  const previousBottomMargin = doc.page.margins.bottom;
  const generationDate = formatDate(new Date().toISOString());
  const footerTop = doc.page.height - REPORT_FOOTER_HEIGHT;
  const boxX = doc.page.width - doc.page.margins.right - REPORT_SIGNATURE_BOX_WIDTH;
  const boxY = footerTop - REPORT_SIGNATURE_BOX_HEIGHT - REPORT_SIGNATURE_GAP;
  const textY = boxY + 2;
  const stampPath = resolveStampImage(settings);
  const signatureLabelX = boxX + 10;
  const signatureLabelY = boxY + 8;
  const signatureLabelWidth = 76;
  const signatureLabelHeight = 12;

  doc.page.margins.bottom = 0;
  doc
    .font('Helvetica-Bold')
    .fontSize(8.8)
    .fillColor('#0f172a')
    .text(`Fait le : ${generationDate}`, doc.page.margins.left, textY, {
      lineBreak: false,
    });

  doc
    .lineWidth(0.8)
    .strokeColor('#94a3b8')
    .rect(boxX, boxY, REPORT_SIGNATURE_BOX_WIDTH, REPORT_SIGNATURE_BOX_HEIGHT)
    .stroke();

  if (stampPath) {
    const stampSize = readPngDimensions(stampPath);
    const stampWidth = ((stampSize?.width || 334) * 72 * REPORT_STAMP_SCALE) / PNG_DPI;
    const stampHeight = ((stampSize?.height || 141) * 72 * REPORT_STAMP_SCALE) / PNG_DPI;
    const stampX = boxX + (REPORT_SIGNATURE_BOX_WIDTH - stampWidth) / 2;
    const stampY = boxY + (REPORT_SIGNATURE_BOX_HEIGHT - stampHeight) / 2;
    try {
      doc.image(stampPath, stampX, stampY, {
        width: stampWidth,
        height: stampHeight,
      });
    } catch (error) {
      // Keep the label visible even if the stamp image fails to render.
    }
  }

  doc
    .save()
    .fillColor('#ffffff')
    .opacity(0.92)
    .roundedRect(signatureLabelX - 3, signatureLabelY - 1, signatureLabelWidth, signatureLabelHeight, 3)
    .fill()
    .restore();
  doc
    .font('Helvetica')
    .fontSize(7.8)
    .fillColor('#475569')
    .text('Cachet / Signature', signatureLabelX, signatureLabelY, {
      lineBreak: false,
    });

  doc.x = previousX;
  doc.y = previousY;
  doc.page.margins.bottom = previousBottomMargin;
};

const addReportFooter = (doc, settings = {}) => {
  const previousX = doc.x;
  const previousY = doc.y;
  const previousBottomMargin = doc.page.margins.bottom;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const legalBarHeight = 14;
  const bannerHeight = REPORT_FOOTER_HEIGHT - legalBarHeight;
  const footerTop = pageHeight - REPORT_FOOTER_HEIGHT;
  const bannerTop = footerTop;
  const legalTop = footerTop + bannerHeight;
  const contentLeft = 28;
  const footerImagePath = resolveFooterImage(settings);

  if (footerImagePath) {
    doc.page.margins.bottom = 0;
    try {
      doc.image(footerImagePath, 0, footerTop, {
        width: pageWidth,
        height: REPORT_FOOTER_HEIGHT,
      });
    } finally {
      doc.page.margins.bottom = previousBottomMargin;
      doc.x = previousX;
      doc.y = previousY;
    }
    return;
  }

  doc.page.margins.bottom = 0;
  try {

  doc
    .save()
    .fillColor(getPrimaryColor(settings))
    .rect(0, bannerTop, pageWidth, bannerHeight)
    .fill()
    .restore();

  doc
    .save()
    .fillColor(getSecondaryColor(settings))
    .rect(0, legalTop, pageWidth, legalBarHeight)
    .fill()
    .restore();

  const contactRows = [
    [
      ['cabinet', settingValue(settings, 'cabinetNom', 'Expert auto'), true],
      ['address', settingValue(settings, 'cabinetAdresse', 'Adresse a configurer')],
    ],
    [
      ['phone', settingValue(settings, 'cabinetTelephone', 'Telephone a configurer')],
      ['email', settingValue(settings, 'cabinetEmail', 'contact@expert-auto.ma')],
      ['web', settingValue(settings, 'cabinetSiteWeb', 'www.expert-auto.ma')],
    ],
  ];
  const extraFooter = settingValue(settings, 'rapportFooter', '');
  if (extraFooter) {
    contactRows[1].push(['info', extraFooter]);
  }

  const drawFooterIcon = (type, x, y) => {
    const top = y + 0.5;
    doc.save().lineWidth(1).strokeColor('#ffffff').fillColor('#ffffff');

    if (type === 'phone') {
      doc
        .roundedRect(x + 3, top + 1, 6, 10, 2)
        .stroke()
        .circle(x + 6, top + 9.2, 0.7)
        .fill();
    } else if (type === 'email') {
      doc.rect(x + 1, top + 2, 11, 8).stroke();
      doc
        .moveTo(x + 1, top + 2)
        .lineTo(x + 6.5, top + 6.7)
        .lineTo(x + 12, top + 2)
        .stroke();
    } else if (type === 'web') {
      doc.circle(x + 6.5, top + 6, 5.2).stroke();
      doc
        .moveTo(x + 1.3, top + 6)
        .lineTo(x + 11.7, top + 6)
        .moveTo(x + 6.5, top + 0.8)
        .lineTo(x + 6.5, top + 11.2)
        .moveTo(x + 3.2, top + 2.2)
        .bezierCurveTo(x + 5, top + 3.8, x + 8, top + 3.8, x + 9.8, top + 2.2)
        .moveTo(x + 3.2, top + 9.8)
        .bezierCurveTo(x + 5, top + 8.2, x + 8, top + 8.2, x + 9.8, top + 9.8)
        .stroke();
    } else if (type === 'address') {
      doc
        .circle(x + 6.5, top + 5, 4.2)
        .stroke()
        .circle(x + 6.5, top + 5, 1.1)
        .fill()
        .moveTo(x + 4.1, top + 8.4)
        .lineTo(x + 6.5, top + 11.5)
        .lineTo(x + 8.9, top + 8.4)
        .stroke();
    } else if (type === 'info') {
      doc
        .circle(x + 6.5, top + 6, 5)
        .stroke()
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('i', x + 5.4, top + 2.2, { width: 4, lineBreak: false });
    } else {
      doc
        .rect(x + 2, top + 3, 9, 8)
        .stroke()
        .moveTo(x + 1.3, top + 3)
        .lineTo(x + 6.5, top)
        .lineTo(x + 11.7, top + 3)
        .stroke();
    }

    doc.restore();
  };

  const drawContactItem = ([icon, value, bold], x, y, width) => {
    const iconWidth = 17;
    drawFooterIcon(icon, x, y - 1);
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(bold ? 8.3 : 7.8)
      .fillColor('#ffffff')
      .text(String(value), x + iconWidth, y, {
        width: width - iconWidth - 4,
        lineBreak: false,
        ellipsis: true,
      });
  };

  const rowWidth = pageWidth - contentLeft * 2;
  const firstRowWidths = [rowWidth * 0.28, rowWidth * 0.72];
  const secondRowWidths = [rowWidth * 0.25, rowWidth * 0.34, rowWidth * 0.25, rowWidth * 0.16];
  const rowY = [bannerTop + 9, bannerTop + 29];

  let currentX = contentLeft;
  contactRows[0].forEach((item, index) => {
    drawContactItem(item, currentX, rowY[0], firstRowWidths[index]);
    currentX += firstRowWidths[index];
  });

  currentX = contentLeft;
  contactRows[1].forEach((item, index) => {
    const width = secondRowWidths[index] || secondRowWidths[secondRowWidths.length - 1];
    drawContactItem(item, currentX, rowY[1], width);
    currentX += width;
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(7.4)
    .fillColor('#ffffff')
    .text(
      settingValue(
        settings,
        'mentionsLegales',
        [
          settings?.registreCommerce ? `RC : ${settings.registreCommerce}` : '',
          settings?.identifiantFiscal ? `IF : ${settings.identifiantFiscal}` : '',
          settings?.ice ? `ICE : ${settings.ice}` : '',
          settings?.cnss ? `CNSS : ${settings.cnss}` : '',
        ].filter(Boolean).join(' - ') || 'Mentions legales a configurer'
      ),
      0,
      legalTop + 3.2,
      {
        width: pageWidth,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      }
    );

  } finally {
    doc.page.margins.bottom = previousBottomMargin;
    doc.x = previousX;
    doc.y = previousY;
  }
};

const addPageDecorations = (doc, settings = {}) => {
  addPageSignatureBlock(doc, settings);
  addReportFooter(doc, settings);
};

const resolveLogo = (settings = {}) => {
  const customLogo = resolveUploadedAsset(settings.logoPath);
  if (customLogo) {
    return customLogo;
  }
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(projectRoot, 'client', 'public', 'default-logo.png'),
    path.join(projectRoot, 'server', 'default-logo.png'),
    path.join(__dirname, '..', '..', 'default-logo.png'),
  ];
  return candidates.find((logoPath) => fs.existsSync(logoPath)) || null;
};

const resolveFooterImage = (settings = {}) => {
  return null;
};

const createMissionReport = (
  mission,
  damageData = { items: [], totals: {} },
  laborData = { entries: [], totals: {} },
  settings = {}
) => {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 26, right: 32, bottom: REPORT_PAGE_BOTTOM_RESERVED, left: 32 },
  });
  const missionLabel = mission.missionCode ? mission.missionCode : `#${mission.id}`;

  doc.on('pageAdded', () => {
    addPageDecorations(doc, settings);
  });
  addPageDecorations(doc, settings);

  const logoPath = resolveLogo(settings);
  if (logoPath) {
    try {
      const logoSize = getContainedImageSize(logoPath, 260, 55);
      doc.image(logoPath, doc.page.margins.left, doc.y, logoSize);
    } catch (error) {
      // ignore logo rendering errors
    }
    doc.moveDown(0.2);
  } else if (settings?.cabinetNom) {
    doc.fontSize(16).font('Helvetica-Bold').fillColor(getPrimaryColor(settings)).text(settings.cabinetNom, {
      width: 220,
    });
  }

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('Rapport d\'expertise', { align: 'right' });
  doc.fontSize(10).font('Helvetica').fillColor('#475569').text(`Mission ${missionLabel}`, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569').text(
    `No immatriculation : ${mission.vehiculeImmatriculation || '-'}`,
    { align: 'right' }
  );
  doc.moveDown(0.2);

  const damageVetusteLoss = Math.max(
    0,
    (damageData.totals?.totalTtc || 0) - (damageData.totals?.totalAfterTtc || 0)
  );

  const evaluationTotals = laborData?.totals || {};
  const franchiseBaseTtc = evaluationTotals.grandTotalTtc || 0;
  const netAfterVetusteTtc = Math.max(0, franchiseBaseTtc - damageVetusteLoss);
  const franchiseCalculee = calculateFranchiseAmount(mission, franchiseBaseTtc);
  const indemnisationValue = calculateIndemnisationFinale(mission, netAfterVetusteTtc, franchiseBaseTtc);

  addFramedSection(doc, 'Informations principales', () => {
    addCompactPrimaryInfoColumns(doc, mission, settings);
  }, { settings });

  addFramedSection(doc, 'Vehicule', () => {
    addCompactVehicleColumns(doc, mission, settings);
  }, { settings });

  addFramedSection(doc, 'Sinistre', () => {
    addDualInfoColumns(
      doc,
      {
        title: 'Assure',
        rows: [
          ['Police', mission.sinistrePolice],
          ['Code sinistre', mission.sinistreType],
          ['Nom et prenom', mission.assureNom],
          ['Telephone', mission.assureTelephone],
          ['Circonstances', mission.sinistreCirconstances],
        ],
      },
      {
        title: 'Adverse',
        rows: [
          ['Nom et prenom', mission.sinistreNomAdverse],
          ['Immatriculation', mission.sinistreImmatriculationAdverse],
          ['Police', mission.sinistrePoliceAdverse],
          ['Compagnie', mission.assureurAdverseNom],
          ['Date de survenance', formatDate(mission.sinistreDate)],
        ],
      },
      settings
    );
  }, { settings });

  addFramedSection(
    doc,
    'Garage',
    () => {
      addTwoColumnRows(doc, [
        ['Garage', mission.garageNom, 'Contact garage', mission.garageContact],
        ['Adresse garage', mission.garageAdresse, '', ''],
      ]);
    },
    { bottomPadding: 8, minHeight: 38, settings }
  );

  if (laborData.entries && laborData.entries.length) {
    addSectionTitle(doc, 'Evaluation de la remise en etat', settings);

    const laborRows = laborData.entries.map((entry) => [
      entry.label,
      (entry.hours || 0).toFixed(2),
      formatTableAmount(entry.rate),
      formatVatChoice(entry.withVat),
      formatTableAmount(entry.horsTaxe),
      formatTableAmount(entry.tva),
      formatTableAmount(entry.ttc),
    ]);

    const totals = laborData.totals || {};
    const laborHt = totals.totalHt || 0;
    const suppliesHt = totals.suppliesHt || 0;
    const grandTotalHt = totals.grandTotalHt || laborHt + suppliesHt;
    const laborTva = totals.totalTva || 0;
    const suppliesTva = Math.max(0, (totals.suppliesTtc || 0) - suppliesHt);
    const combinedTva = laborTva + suppliesTva;
    const laborTtc = totals.totalTtc || 0;
    const suppliesTtc = totals.suppliesTtc || 0;
    const combinedTtc = laborTtc + suppliesTtc;

    const summaryRows = [
      [
        'Total main d\'oeuvre',
        '',
        '',
        '',
        formatTableAmount(laborHt),
        formatTableAmount(laborTva),
        formatTableAmount(laborTtc),
      ],
      [
        'Fournitures',
        '',
        '',
        '',
        formatTableAmount(suppliesHt),
        formatTableAmount(suppliesTva),
        formatTableAmount(suppliesTtc),
      ],
      [
        'Montant total hors taxe',
        '',
        '',
        '',
        `${formatTableAmount(grandTotalHt)} HT`,
        formatTableAmount(combinedTva),
        formatTableAmount(combinedTtc),
      ],
    ];

    addTableSection(
      doc,
      ['Main d\'oeuvre', 'Nbr H.', 'Taux horaire', 'TVA', 'Hors taxe', 'T.V.A', 'Total TTC'],
      [...laborRows, ...summaryRows],
      0.24,
      { headerHeight: 20, rowMinHeight: 14, rowPadding: 4, settings }
    );

    addInlineSummaryTable(doc, [
      ['Total main d\'oeuvre (TTC)', formatCurrency(laborTtc)],
      ['Fournitures (TTC)', formatCurrency(suppliesTtc)],
      ['Montant total (TTC)', formatCurrency(combinedTtc), { emphasizeValue: true }],
    ], settings);

    const guaranteeItems = [
      [
        'Responsabilite',
        formatResponsabilite(getEffectiveResponsibility(mission.garantieType, mission.responsabilite)),
      ],
      ['Type de garantie', formatGuaranteeType(mission.garantieType)],
    ];
    if (guaranteeRequiresFranchise(mission.garantieType)) {
      guaranteeItems.push(
        ['Taux franchise', formatFranchiseRate(mission.garantieFranchiseTaux)],
        ['Franchise', formatFranchiseAmount(franchiseCalculee)]
      );
    }
    addInlineSummaryTable(doc, guaranteeItems, settings);

    addInlineSummaryTable(doc, [
      ['Reforme', formatReformeType(mission.reformeType)],
      ['Valeur assuree', formatPlainNumber(mission.valeurAssuree)],
      ['Valeur venale', formatPlainNumber(mission.valeurVenale)],
      ['Valeur epaves', formatPlainNumber(mission.valeurEpaves)],
    ], settings);

    addInlineSummaryTable(doc, [
      ['Montant devis initial', formatOptionalPositiveCurrency(mission.montantDevisInitial)],
      ['Vetuste TTC', formatCurrency(damageVetusteLoss)],
      ['Indemnisation finale', formatCurrency(indemnisationValue), { emphasizeValue: true }],
    ], settings);
    addClosingAmountLine(doc, formatAmountInFrenchWords(indemnisationValue), settings);

    doc.moveDown(0.3);
  }

  if (damageData.items && damageData.items.length) {
    doc.addPage();
    addSectionTitle(doc, 'Description des dommages', settings);

    const damageRows = damageData.items.map((item) => {
      const priceHt = item.priceHt || 0;
      const priceAfter = item.priceAfter || 0;
      const priceTtc = item.priceTtc !== undefined ? item.priceTtc : priceHt * (item.withVat ? 1.2 : 1);
      const priceAfterTtc =
        item.priceAfterTtc !== undefined ? item.priceAfterTtc : priceAfter * (item.withVat ? 1.2 : 1);

      return [
        item.piece,
        formatDamageTypeLabel(item.pieceType),
        formatTableAmount(priceHt),
        formatVatChoice(item.withVat),
        formatTableAmount(priceTtc),
        `${(item.vetuste || 0).toFixed(0)} %`,
        formatTableAmount(priceAfter),
        formatTableAmount(priceAfterTtc),
      ];
    });

    const totals = damageData.totals || {};
    const summaryRows = [
      ['Total dommages', '', formatTableAmount(totals.totalHt), '', formatTableAmount(totals.totalTtc), '', '', ''],
      ['Apres vetuste', '', '', '', '', '', formatTableAmount(totals.totalAfter), formatTableAmount(totals.totalAfterTtc)],
    ];

    addTableSection(
      doc,
      [
        'Piece',
        'Type',
        'Prix HT',
        'TVA',
        'Prix TTC',
        'Vetuste',
        'Apres vetuste (HT)',
        'Apres vetuste (TTC)',
      ],
      [...damageRows, ...summaryRows],
      0.18,
      { settings }
    );

    addObservationSection(doc, mission, settings);
  } else {
    doc.addPage();
    addObservationSection(doc, mission, settings);
  }

  return doc;
};

module.exports = {
  createMissionReport,
};
