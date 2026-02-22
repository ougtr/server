const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

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
  const formatted = Number.isFinite(numeric) ? numeric.toLocaleString('fr-FR') : value;
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
  tierce: 'Tierce',
  rc: 'RC',
};

const guaranteeRequiresFranchise = (value) => {
  if (!value) {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'dommage collision' || normalized === 'tierce';
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

const calculateFranchiseAmount = (mission, evaluationTotalTtc) => {
  if (!mission) {
    return 0;
  }
  const rate = Number(mission.garantieFranchiseTaux) || 0;
  const fixed = Number(mission.garantieFranchiseMontant) || 0;
  const percentValue = (rate / 100) * evaluationTotalTtc;
  return Math.max(percentValue, fixed);
};

const calculateIndemnisationFinale = (mission, laborTotals) => {
  const base = laborTotals?.grandTotalTtc || 0;
  if (mission && mission.indemnisationFinale !== undefined && mission.indemnisationFinale !== null) {
    const stored = Number(mission.indemnisationFinale);
    return Number.isNaN(stored) ? Math.max(0, base) : stored;
  }
  const franchiseAmount = calculateFranchiseAmount(mission, base);
  return Math.max(0, base - franchiseAmount);
};



const addSectionTitle = (doc, title) => {
  doc.x = doc.page.margins.left;
  doc.moveDown(0.4);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(title.toUpperCase());
  doc
    .strokeColor('#cbd5f5')
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .stroke();
  doc.moveDown(0.4);
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
    addKeyValue(doc, rightLabel, rightValue, colWidth - 20);
    doc.x = doc.page.margins.left;
    doc.moveDown(0.15);
  });
  doc.moveDown(0.15);
};

const addFramedSection = (doc, title, renderContent) => {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const frameLeft = doc.page.margins.left - 2;
  const frameWidth = usableWidth + 4;

  doc.moveDown(0.35);
  const frameTop = doc.y + 10;
  const contentTop = frameTop + 6;
  doc.y = contentTop;
  doc.x = doc.page.margins.left;

  renderContent();
  const contentBottom = doc.y + 4;
  const frameHeight = Math.max(26, contentBottom - frameTop);

  doc
    .save()
    .lineWidth(1)
    .strokeColor('#cbd5f5')
    .roundedRect(frameLeft, frameTop, frameWidth, frameHeight, 6)
    .stroke()
    .restore();

  const titleText = title.toUpperCase();
  const labelPadding = 6;
  doc.font('Helvetica-Bold').fontSize(11);
  const titleWidth = doc.widthOfString(titleText) + labelPadding * 2;
  const labelX = frameLeft + 10;
  const labelY = frameTop - 9;

  doc
    .save()
    .fillColor('#ffffff')
    .rect(labelX - labelPadding, labelY - 2, titleWidth, 16)
    .fill()
    .restore();

  doc.fillColor('#0f172a').text(titleText, labelX, labelY, { lineBreak: false });
  doc.y = frameTop + frameHeight;
  doc.moveDown(0.15);
};

const addInlineSummaryTable = (doc, items) => {
  if (!items || !items.length) {
    return;
  }
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / items.length;
  const rowHeight = 18;
  const startY = doc.y;
  doc
    .lineWidth(0.5)
    .strokeColor('#cbd5f5')
    .rect(doc.page.margins.left, startY, colWidth * items.length, rowHeight)
    .stroke();
  const textY = startY + rowHeight / 2 - 4;
  items.forEach(([label, value], index) => {
    const columnX = doc.page.margins.left + index * colWidth;
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#1f2933')
      .text(`${label} : `, columnX + 4, textY, {
        width: colWidth - 8,
        continued: true,
      })
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(`${safeValue(value)}`, {
        continued: false,
      });
  });
  doc.y = startY + rowHeight + 2;
};

const addTableSection = (doc, headers, rows, firstColumnRatio = 0.2) => {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const remaining = tableWidth * (1 - firstColumnRatio);
  const colWidths = headers.map((_, index) =>
    index === 0 ? tableWidth * firstColumnRatio : remaining / (headers.length - 1)
  );
  const headerHeight = 20;
  const rowHeight = 17;

  const startY = doc.y;
  doc.save().fillColor('#1d4ed8').rect(doc.page.margins.left, startY, tableWidth, headerHeight).fill();

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

  let currentY = startY + headerHeight;
  rows.forEach((row) => {
    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .rect(doc.page.margins.left, currentY, tableWidth, rowHeight)
      .stroke();
    let cellX = doc.page.margins.left;
    row.forEach((cell, index) => {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#0f172a')
        .text(safeValue(cell), cellX + 3, currentY + 5, {
          width: colWidths[index] - 6,
          align: 'center',
        });
      cellX += colWidths[index];
    });
    currentY += rowHeight;
  });
  doc.y = currentY + 6;
  doc.x = doc.page.margins.left;
};

const addObservationSection = (doc, mission) => {
  doc.moveDown(0.6);
  addSectionTitle(doc, 'Observations');
  const content =
    typeof mission.synthese === 'string' && mission.synthese.trim().length
      ? mission.synthese.trim()
      : `Ce rapport regroupe les informations communiquees le ${formatDate(
          mission.updatedAt || mission.createdAt
        )}. Il est destine a servir de support pour la redaction finale du rapport d'expertise.`;
  doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(content, { align: 'left' });
};

const addSignatureSection = (doc) => {
  const generationDate = formatDate(new Date().toISOString());
  const boxWidth = 180;
  const boxHeight = 55;
  const spacing = 16;
  let startY = doc.page.height - doc.page.margins.bottom - (boxHeight + spacing);

  if (doc.y > startY) {
    doc.addPage();
    startY = doc.page.height - doc.page.margins.bottom - (boxHeight + spacing);
  }

  doc.y = startY;
  doc.x = doc.page.margins.left;
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor('#0f172a')
    .text(`Fait le : ${generationDate}`);

  doc.moveDown(0.35);
  const boxX = doc.page.width - doc.page.margins.right - boxWidth;
  const boxY = doc.y;
  doc
    .lineWidth(0.8)
    .strokeColor('#94a3b8')
    .rect(boxX, boxY, boxWidth, boxHeight)
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor('#475569')
    .text('Cachet / Signature', boxX + 10, boxY + 8);
  doc.y = boxY + boxHeight;
};

const resolveLogo = () => {
  const projectRoot = path.resolve(__dirname, '..', '..', '..');
  const candidates = [
    path.join(projectRoot, 'client', 'public', 'opale.jpg'),
    path.join(__dirname, '..', '..', 'public', 'opale.jpg'),
    path.join(__dirname, '..', 'public', 'opale.jpg'),
  ];
  return candidates.find((logoPath) => fs.existsSync(logoPath)) || null;
};

const createMissionReport = (
  mission,
  damageData = { items: [], totals: {} },
  laborData = { entries: [], totals: {} }
) => {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const logoPath = resolveLogo();
  if (logoPath) {
    try {
      doc.image(logoPath, doc.page.margins.left, doc.y, { width: 80 });
    } catch (error) {
      // ignore logo rendering errors
    }
    doc.moveDown(0.4);
  }

  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('Rapport d\'expertise', { align: 'right' });
  doc.fontSize(10).font('Helvetica').fillColor('#475569').text(`Mission #${mission.id}`, { align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#475569').text(
    `N° immatriculation : ${mission.vehiculeImmatriculation || '-'}`,
    { align: 'right' }
  );
  doc.moveDown(0.5);

  const damageVetusteLoss = Math.max(0, (damageData.totals?.totalTtc || 0) - (damageData.totals?.totalAfterTtc || 0));
  const evaluationTotals = laborData?.totals || {};
  const evaluationTotalTtc = evaluationTotals.grandTotalTtc || 0;
  const indemnisationValue = calculateIndemnisationFinale(mission, evaluationTotals);
  addFramedSection(doc, 'Informations principales', () => {
    addTwoColumnRows(doc, [
      ['Assureur', mission.assureurNom, 'Contact assureur', mission.assureurContact],
      ['Agence', mission.assureurAgenceNom, 'Contact agence', mission.assureurAgenceContact],
      ['Adresse agence', mission.assureurAgenceAdresse, 'Responsable mission', mission.agentLogin],
    ]);
  });

  addFramedSection(doc, 'Assure', () => {
    addTwoColumnRows(doc, [
      ['Nom', mission.assureNom, 'Telephone', mission.assureTelephone],
      ['Email', mission.assureEmail, 'Statut', mission.statut],
    ]);
  });

  addFramedSection(doc, 'Vehicule', () => {
    addTwoColumnRows(doc, [
      ['Marque', mission.vehiculeMarque, 'Modele', mission.vehiculeModele],
      ['Immatriculation', mission.vehiculeImmatriculation, 'Date de mise en circulation', formatDate(mission.vehiculeAnnee)],
      ['Numero de chassis (VIN)', mission.vehiculeVin, 'Kilometrage', formatKilometrage(mission.vehiculeKilometrage)],
      ['Puissance fiscale', mission.vehiculePuissanceFiscale, 'Energie', formatEnergyLabel(mission.vehiculeEnergie)],
    ]);
  });

  addFramedSection(doc, 'Sinistre', () => {
    addTwoColumnRows(doc, [
      ['Code sinistre', mission.sinistreType, 'Date', formatDate(mission.sinistreDate)],
      ['Police', mission.sinistrePolice, 'Police vehicule adverse', mission.sinistrePoliceAdverse],
      ['Nom & prenom adverse', mission.sinistreNomAdverse, 'Immatriculation adverse', mission.sinistreImmatriculationAdverse],
      ['Compagnie adverse', mission.assureurAdverseNom, 'Circonstances', mission.sinistreCirconstances],
    ]);
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#1f2933')
      .text('Observations :', { continued: true })
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(` ${safeValue(mission.sinistreCirconstances)}`);
  });

  addFramedSection(doc, 'Garage', () => {
    addTwoColumnRows(doc, [
      ['Garage', mission.garageNom, 'Contact garage', mission.garageContact],
      ['Adresse garage', mission.garageAdresse, '', ''],
    ]);
  });

  if (laborData.entries && laborData.entries.length) {
    addSectionTitle(doc, 'Evaluation de la remise en etat');
    const laborRows = laborData.entries.map((entry) => [
      entry.label,
      (entry.hours || 0).toFixed(2),
      `${(entry.rate || 0).toFixed(2)} MAD`,
      `${(entry.horsTaxe || 0).toFixed(2)} MAD`,
      `${(entry.tva || 0).toFixed(2)} MAD`,
      `${(entry.ttc || 0).toFixed(2)} MAD`,
    ]);
    const totals = laborData.totals || {};
    const summaryRows = [
      [
        'Total main d\'oeuvre',
        '',
        '',
        formatCurrency(totals.totalHt),
        formatCurrency(totals.totalTva),
        formatCurrency(totals.totalTtc),
      ],
      [
        'Fournitures',
        '',
        '',
        formatCurrency(totals.suppliesHt),
        formatCurrency(totals.suppliesTva),
        formatCurrency(totals.suppliesTtc),
      ],
      [
        'Montant total',
        '',
        '',
        formatCurrency(totals.grandTotalHt),
        formatCurrency(totals.totalTva),
        formatCurrency(totals.grandTotalTtc),
      ],
      [
        'Vetuste TTC',
        '',
        '',
        '',
        '',
        formatCurrency(damageVetusteLoss),
      ],
      [
        'Indemnisation finale',
        '',
        '',
        '',
        '',
        formatCurrency(indemnisationValue),
      ],
    ];

    addTableSection(
      doc,
      ['Main d\'oeuvre', 'Nombre d\'heures', 'Taux horaire', 'Hors taxe', 'T.V.A', 'Total TTC'],
      [...laborRows, ...summaryRows],
      0.28
    );

    const guaranteeItems = [
      ['Type de garantie', formatGuaranteeType(mission.garantieType)],
    ];
    if (guaranteeRequiresFranchise(mission.garantieType)) {
      guaranteeItems.push(
        ['Taux franchise', formatFranchiseRate(mission.garantieFranchiseTaux)],
        ['Franchise (MAD)', formatFranchiseAmount(mission.garantieFranchiseMontant)]
      );
    }
    addInlineSummaryTable(doc, guaranteeItems);
    addInlineSummaryTable(doc, [['Responsabilite', formatResponsabilite(mission.responsabilite)]]);
    addInlineSummaryTable(doc, [
      ['Reforme', formatReformeType(mission.reformeType)],
      ['Valeur assuree', formatPlainNumber(mission.valeurAssuree)],
      ['Valeur venale', formatPlainNumber(mission.valeurVenale)],
      ['Valeur epaves', formatPlainNumber(mission.valeurEpaves)],
    ]);
    doc.moveDown(0.3);
  }

  if (damageData.items && damageData.items.length) {
    addSignatureSection(doc);
    doc.addPage();
    addSectionTitle(doc, 'Description des dommages');
    const damageRows = damageData.items.map((item) => {
      const priceTtc =
        item.priceTtc !== undefined
          ? item.priceTtc
          : (item.priceHt || 0) * (item.withVat ? 1.2 : 1);
      return [
        item.piece,
        formatDamageTypeLabel(item.pieceType),
        `${(item.priceHt || 0).toFixed(2)} HT`,
        `${(item.vetuste || 0).toFixed(0)} %`,
        `${(item.priceAfter || 0).toFixed(2)} HT`,
        formatVatChoice(item.withVat),
        `${priceTtc.toFixed(2)} TTC`,
      ];
    });
    const totals = damageData.totals || {};
    const summaryRows = [
      [
        'Total dommages',
        '',
        formatCurrency(totals.totalHt),
        '',
        '',
        '',
        formatCurrency(totals.totalTtc),
      ],
      [
        'Apres vetuste',
        '',
        '',
        '',
        formatCurrency(totals.totalAfter),
        '',
        formatCurrency(totals.totalAfterTtc),
      ],
    ];

    addTableSection(
      doc,
      ['Piece', 'Type', 'Prix HT', 'Vetuste', 'Apres vetuste', 'TVA', 'Prix TTC'],
      [...damageRows, ...summaryRows],
      0.22
    );
    addObservationSection(doc, mission);
    addSignatureSection(doc);
  } else {
    addObservationSection(doc, mission);
    addSignatureSection(doc);
  }

  return doc;
};

module.exports = {
  createMissionReport,
};























