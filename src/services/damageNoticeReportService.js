const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 70;
const RIGHT = 532;
const PNG_DPI = 96;
const STAMP_SCALE = 0.67;

const safe = (value) => (value === null || value === undefined || value === '' ? '' : String(value));
const hasOwn = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

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
  if (/^\d{4}$/.test(raw)) {
    return `01/01/${raw}`;
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

const drawStamp = (doc, x, y, width = 165) => {
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
  const subjectVehicleLabel = [mission.vehiculeMarque, mission.vehiculeModele].filter(Boolean).join(' ');
  const today = formatDate(new Date().toISOString());

  return {
    city: hasOwn(payload, 'city') ? safe(payload.city) : 'Casablanca',
    reportDate: hasOwn(payload, 'reportDate') ? safe(payload.reportDate) : today,
    recipientInsurer: hasOwn(payload, 'recipientInsurer') ? safe(payload.recipientInsurer) : safe(mission.assureurNom),
    recipientAddressLine1: hasOwn(payload, 'recipientAddressLine1')
      ? safe(payload.recipientAddressLine1)
      : safe(mission.assureurAgenceAdresse),
    recipientAddressLine2: hasOwn(payload, 'recipientAddressLine2') ? safe(payload.recipientAddressLine2) : '',
    recipientAddressLine3: hasOwn(payload, 'recipientAddressLine3') ? safe(payload.recipientAddressLine3) : '',
    serviceLabel: hasOwn(payload, 'serviceLabel') ? safe(payload.serviceLabel) : 'SERVICE SINISTRES MATERIELS :',
    victimReferencePrefix: hasOwn(payload, 'victimReferencePrefix')
      ? safe(payload.victimReferencePrefix)
      : 'POL Ndeg:',
    victimReference: hasOwn(payload, 'victimReference') ? safe(payload.victimReference) : safe(mission.sinistrePolice),
    noticeReference: hasOwn(payload, 'noticeReference') ? safe(payload.noticeReference) : safe(mission.missionCode),
    accidentDate: hasOwn(payload, 'accidentDate') ? safe(payload.accidentDate) : formatDate(mission.sinistreDate),
    subjectOwnerName: hasOwn(payload, 'subjectOwnerName') ? safe(payload.subjectOwnerName) : safe(mission.assureNom),
    adverseOwnerName: hasOwn(payload, 'adverseOwnerName')
      ? safe(payload.adverseOwnerName)
      : safe(mission.sinistreNomAdverse),
    subjectVehicleLabel: hasOwn(payload, 'subjectVehicleLabel') ? safe(payload.subjectVehicleLabel) : safe(subjectVehicleLabel),
    subjectVehicleRegistration: hasOwn(payload, 'subjectVehicleRegistration')
      ? safe(payload.subjectVehicleRegistration)
      : safe(mission.vehiculeImmatriculation),
    subjectPolicyNumber: hasOwn(payload, 'subjectPolicyNumber')
      ? safe(payload.subjectPolicyNumber)
      : safe(mission.sinistrePolice),
    adverseVehicleLabel: hasOwn(payload, 'adverseVehicleLabel') ? safe(payload.adverseVehicleLabel) : '',
    adverseVehicleRegistration: hasOwn(payload, 'adverseVehicleRegistration')
      ? safe(payload.adverseVehicleRegistration)
      : safe(mission.sinistreImmatriculationAdverse),
    adversePolicyNumber: hasOwn(payload, 'adversePolicyNumber')
      ? safe(payload.adversePolicyNumber)
      : safe(mission.sinistrePoliceAdverse),
    adverseInsurer: hasOwn(payload, 'adverseInsurer') ? safe(payload.adverseInsurer) : safe(mission.assureurAdverseNom),
    mandatingCabinetName: hasOwn(payload, 'mandatingCabinetName') ? safe(payload.mandatingCabinetName) : '',
    ceilingArticle: hasOwn(payload, 'ceilingArticle') ? safe(payload.ceilingArticle) : "l'article 25",
    conventionalCeiling: hasOwn(payload, 'conventionalCeiling') ? safe(payload.conventionalCeiling) : '20.000,00',
    salutation: hasOwn(payload, 'salutation') ? safe(payload.salutation) : 'Messieurs,',
    waitingLine: hasOwn(payload, 'waitingLine') ? safe(payload.waitingLine) : "Dans l'attente de vous lire,",
    closingLine: hasOwn(payload, 'closingLine')
      ? safe(payload.closingLine)
      : "Veuillez agreer, Messieurs, l'expression de mes salutations distinguees.",
    signatureLabel: hasOwn(payload, 'signatureLabel') ? safe(payload.signatureLabel) : 'OPALE EXPERTISE',
  };
};

const createMissionDamageNoticeReport = (mission, payload = {}) => {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
  });
  const data = buildDefaultPayload(mission, payload);

  doc.font('Times-Roman').fillColor('#111111');

  doc.font('Times-Roman').fontSize(12.5).text(`${safe(data.city)} le, ${safe(data.reportDate)}`, 362, 102, {
    width: 160,
    align: 'left',
  });

  let recipientY = 138;
  [data.recipientInsurer, data.recipientAddressLine1, data.recipientAddressLine2, data.recipientAddressLine3]
    .filter((line) => line !== '')
    .forEach((line) => {
      doc.font('Times-Roman').fontSize(11.2).text(safe(line), 350, recipientY, {
        width: 170,
      });
      recipientY += 13;
    });

  doc.font('Times-Roman').fontSize(11.2).text(safe(data.serviceLabel), LEFT, 184, {
    width: 260,
    underline: true,
  });
  doc.text(`V.REF    : ${safe(data.victimReferencePrefix)} ${safe(data.victimReference)}`, LEFT, 202, {
    width: 260,
    underline: true,
  });
  doc.text(`N.REF    : ${safe(data.noticeReference)}`, LEFT, 220, {
    width: 260,
    underline: true,
  });
  doc.text(`ACC.DU   : ${safe(data.accidentDate)}`, LEFT, 238, {
    width: 260,
    underline: true,
  });
  doc.text(safe(data.subjectOwnerName), LEFT, 258, {
    width: 220,
  });
  doc.text('C/', LEFT + 58, 274, {
    width: 40,
  });
  doc.text(safe(data.adverseOwnerName), LEFT, 290, {
    width: 220,
  });

  doc.font('Times-Bold').fontSize(12.4).text("AVIS DES DOMMAGES SUPERIEURS AU PLAFOND", 0, 330, {
    width: PAGE_WIDTH,
    align: 'center',
    underline: true,
  });
  doc.text("D'INCONTESTABILITE", 0, 349, {
    width: PAGE_WIDTH,
    align: 'center',
    underline: true,
  });

  doc.font('Times-Roman').fontSize(11.5).text(safe(data.salutation), LEFT, 390, {
    width: RIGHT - LEFT,
  });

  const bodyParagraph1 =
    `Dans le cadre de la convention d'expertises directes dont le cabinet d'assurance ${safe(
      data.mandatingCabinetName
    )} m'a commis pour proceder a l'expertise du vehicule ${safe(data.subjectVehicleLabel)}, ` +
    `Mle: ${safe(data.subjectVehicleRegistration)}, appartenant a ${safe(data.subjectOwnerName)}, ` +
    `assure par vos soins par Police Ndeg: ${safe(data.subjectPolicyNumber)}, lors du sinistre qui se serait produit le ${safe(
      data.accidentDate
    )}, avec le vehicule ${safe(data.adverseVehicleLabel)}, Mle: ${safe(
      data.adverseVehicleRegistration
    )} appartenant a ${safe(data.adverseOwnerName)}, assure a ${safe(data.adverseInsurer)} ` +
    `par Police Ndeg: ${safe(data.adversePolicyNumber)}.`;

  doc.font('Times-Roman').fontSize(10.8).text(bodyParagraph1, LEFT, 420, {
    width: RIGHT - LEFT,
    align: 'justify',
    lineGap: 0.5,
  });

  const bodyParagraph2 =
    `Je vous informe qu'aux premiers examens, le cout de reparation du vehicule en question ` +
    `est superieur au Plafond conventionnel d'incontestabilite prevu par ${safe(
      data.ceilingArticle
    )} (+ ${safe(data.conventionalCeiling)} DHS).`;

  doc.text(bodyParagraph2, LEFT, 506, {
    width: RIGHT - LEFT,
    align: 'justify',
    lineGap: 0.5,
  });

  doc.font('Times-Roman').fontSize(10.8).text(safe(data.waitingLine), LEFT, 564, {
    width: RIGHT - LEFT,
  });
  doc.text(safe(data.closingLine), LEFT, 595, {
    width: RIGHT - LEFT + 8,
  });

  doc.font('Times-Bold').fontSize(12.5).text(safe(data.signatureLabel), 364, 652, {
    width: 160,
    align: 'center',
    underline: true,
  });
  drawStamp(doc, 346, 680, 158);

  return doc;
};

module.exports = {
  createMissionDamageNoticeReport,
};
