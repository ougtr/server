const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const FOOTER_HEIGHT = 84;
const NUMERO_LABEL = `N${String.fromCharCode(176)}`;
const PNG_DPI = 96;
const STAMP_SCALE = 0.67;
const STAMP_RIGHT_MARGIN = 42;
const STAMP_BOTTOM_MARGIN = 34;
const INFO_LABEL_X = 70;
const INFO_COLON_X = 168;
const INFO_VALUE_X = 181;
const INFO_LABEL_WIDTH = 94;

const normalizeAmount = (value) => {
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

const formatShortDate = (value) => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const FRENCH_MONTHS = [
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Aout',
  'Septembre',
  'Octobre',
  'Novembre',
  'Decembre',
];

const formatLongDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return `${date.getDate()} ${FRENCH_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const toMoney = (value) => {
  const amount = normalizeAmount(value);
  return amount.toFixed(2).replace('.', ',');
};

const safe = (value) => (value === null || value === undefined || value === '' ? '-' : String(value));

const UNITS = [
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

const TENS = {
  20: 'vingt',
  30: 'trente',
  40: 'quarante',
  50: 'cinquante',
  60: 'soixante',
};

const belowHundred = (value) => {
  if (value < 20) {
    return UNITS[value];
  }
  if (value < 70) {
    const ten = Math.floor(value / 10) * 10;
    const unit = value % 10;
    if (unit === 0) {
      return TENS[ten];
    }
    if (unit === 1) {
      return `${TENS[ten]} et un`;
    }
    return `${TENS[ten]}-${UNITS[unit]}`;
  }
  if (value < 80) {
    const rest = value - 60;
    if (rest === 11) {
      return 'soixante et onze';
    }
    return `soixante-${belowHundred(rest)}`;
  }
  const rest = value - 80;
  const base = rest === 0 ? 'quatre-vingts' : 'quatre-vingt';
  if (rest === 0) {
    return base;
  }
  return `${base}-${belowHundred(rest)}`;
};

const belowThousand = (value) => {
  if (value < 100) {
    return belowHundred(value);
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  let prefix = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent`;
  if (rest === 0 && hundreds > 1) {
    prefix += 's';
  }
  return rest ? `${prefix} ${belowHundred(rest)}` : prefix;
};

const numberToFrench = (value) => {
  const amount = Math.floor(Number(value) || 0);
  if (amount === 0) {
    return 'zero';
  }
  if (amount < 0) {
    return `moins ${numberToFrench(Math.abs(amount))}`;
  }
  const parts = [];
  let remainder = amount;
  const scales = [
    { size: 1000000000, singular: 'milliard', plural: 'milliards' },
    { size: 1000000, singular: 'million', plural: 'millions' },
    { size: 1000, singular: 'mille', plural: 'mille' },
  ];

  scales.forEach(({ size, singular, plural }) => {
    const count = Math.floor(remainder / size);
    if (!count) {
      return;
    }
    if (size === 1000) {
      parts.push(count === 1 ? 'mille' : `${numberToFrench(count)} mille`);
    } else {
      parts.push(`${numberToFrench(count)} ${count === 1 ? singular : plural}`);
    }
    remainder %= size;
  });

  if (remainder > 0) {
    parts.push(belowThousand(remainder));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const totalToWords = (value) => numberToFrench(Math.round(Number(value) || 0)).toUpperCase();

const resolveLogo = () => {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(projectRoot, 'client', 'public', 'opale.jpg'),
    path.join(__dirname, '..', '..', 'public', 'opale.jpg'),
    path.join(__dirname, '..', 'public', 'opale.jpg'),
  ];
  return candidates.find((logoPath) => fs.existsSync(logoPath)) || null;
};

const resolveFooterImage = () => {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(projectRoot, 'server', 'opale-en-pied.png'),
    path.join(__dirname, '..', '..', 'opale-en-pied.png'),
  ];
  return candidates.find((imagePath) => fs.existsSync(imagePath)) || null;
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

const drawStamp = (doc) => {
  const stampPath = resolveStampImage();
  if (stampPath) {
    const stampSize = readPngDimensions(stampPath);
    const stampWidth = ((stampSize?.width || 334) * 72 * STAMP_SCALE) / PNG_DPI;
    const stampHeight = ((stampSize?.height || 141) * 72 * STAMP_SCALE) / PNG_DPI;
    doc.image(
      stampPath,
      PAGE_WIDTH - stampWidth - STAMP_RIGHT_MARGIN,
      PAGE_HEIGHT - FOOTER_HEIGHT - stampHeight - STAMP_BOTTOM_MARGIN,
      {
        width: stampWidth,
        height: stampHeight,
      }
    );
    return;
  }
  doc.save();
  doc.rotate(-12, { origin: [470, 700] });
  doc
    .font('Helvetica-BoldOblique')
    .fontSize(11)
    .fillColor('#4f46e5')
    .opacity(0.7)
    .text('OPALE EXPERTISE', 395, 676, {
      width: 150,
      align: 'center',
    });
  doc.restore();
};

const drawFeeLine = (doc, y, label, value) => {
  doc.font('Helvetica').fontSize(10).fillColor('#2f2f2f');
  doc.text('>', 88, y);
  doc.text(label, 105, y, { lineBreak: false });
  doc
    .save()
    .lineWidth(0.7)
    .dash(1.2, { space: 1.6 })
    .strokeColor('#666666')
    .moveTo(160, y + 9)
    .lineTo(360, y + 9)
    .stroke()
    .restore();
  doc.font('Helvetica-Bold').text(toMoney(value), 380, y, {
    width: 60,
    align: 'right',
  });
};

const createMissionHonorairesReport = (mission, amounts = {}) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
  });

  const logoPath = resolveLogo();
  const footerPath = resolveFooterImage();
  const issueDate = new Date();
  const vehicleLabel = [mission?.vehiculeMarque, mission?.vehiculeModele].filter(Boolean).join(' ') || '-';

  const honoraires = normalizeAmount(amounts.honoraires ?? mission?.honorairesHt ?? 0);
  const taxe = honoraires * 0.2;
  const photos = normalizeAmount(amounts.photos ?? mission?.honorairesPhotos ?? 0);
  const deplacement = normalizeAmount(amounts.deplacement ?? mission?.honorairesDeplacement ?? 0);
  const total = honoraires + taxe + photos + deplacement;

  if (logoPath) {
    doc
      .rect(18, 48, 22, 48)
      .fill('#000000');
    doc.image(logoPath, 48, 48, {
      width: 190,
    });
  }

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#333333')
    .text(`CASABLANCA, le ${formatLongDate(issueDate)}`, 355, 152, {
      width: 185,
      align: 'left',
    });

  const infoRows = [
    ['Reference Opale', safe(mission?.missionCode || `M-${mission?.id || '-'}`)],
    [`Sinistre ${NUMERO_LABEL}`, safe(mission?.sinistreType)],
    ['Date du Sinistre', formatShortDate(mission?.sinistreDate)],
    ['Assure', safe(mission?.assureNom)],
    ['Vehicule', safe(vehicleLabel)],
    ['Matricule', safe(mission?.vehiculeImmatriculation)],
    ['Compagnie', safe(mission?.assureurNom)],
    [`Police ${NUMERO_LABEL}`, safe(mission?.sinistrePolice)],
  ];

  let infoY = 190;
  infoRows.forEach(([label, value]) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#333333')
      .text(`${label}`, INFO_LABEL_X, infoY, { width: INFO_LABEL_WIDTH, lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .text(':', INFO_COLON_X, infoY, { width: 10, lineBreak: false })
      .text(safe(value), INFO_VALUE_X, infoY, { width: 180 });
    infoY += 18;
  });

  doc
    .font('Helvetica-Bold')
    .fontSize(17)
    .fillColor('#222222')
    .text("NOTE D'HONORAIRES", 150, 370, {
      width: 190,
      align: 'left',
      underline: true,
    });
  doc
    .font('Helvetica')
    .fontSize(12)
    .text(`${NUMERO_LABEL} : ${safe(mission?.missionCode || `M-${mission?.id || '-'}`)}`, 392, 373, {
      width: 120,
      align: 'left',
    });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#333333')
    .text('Messieurs,', 70, 434)
    .text(
      "Nous vous prions de bien vouloir trouver ci-dessous le detail de nos honoraires concernant l'affaire citee en marge.",
      70,
      463,
      { width: 390, lineGap: 2 }
    );

  drawFeeLine(doc, 508, 'Honoraires', honoraires);
  drawFeeLine(doc, 530, 'Taxe', taxe);
  drawFeeLine(doc, 552, 'Photos', photos);
  drawFeeLine(doc, 574, 'Deplacement', deplacement);

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#222222')
    .text('TOTAL :', 255, 604, { width: 80, align: 'right' })
    .text(toMoney(total), 350, 601, { width: 90, align: 'right' });

  const totalWordsLabel = "Arrete la presente note d'honoraires a la somme de : ";
  const totalWordsValue = `${totalToWords(total)} DH`;

  doc.font('Helvetica').fontSize(9.9).fillColor('#333333');
  doc.text(totalWordsLabel, 70, 632, {
    width: 310,
    lineBreak: false,
  });
  doc
    .font('Helvetica-Bold')
    .text(totalWordsValue, 70 + doc.widthOfString(totalWordsLabel), 632, {
      width: 160,
      lineBreak: false,
    });
  doc
    .font('Helvetica')
    .text('Nous vous remercions par avance de votre reglement.', 70, 716, {
      width: 300,
    })
    .text('Veuillez accepter, Messieurs, nos salutations distinguees.', 70, 734, {
      width: 300,
    });

  drawStamp(doc);

  if (footerPath) {
    doc.image(footerPath, 0, PAGE_HEIGHT - FOOTER_HEIGHT, {
      width: PAGE_WIDTH,
      height: FOOTER_HEIGHT,
    });
  }

  return doc;
};

module.exports = {
  createMissionHonorairesReport,
};
