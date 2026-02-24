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

const calculateIndemnisationFinale = (mission, netAfterVetusteTtc, franchiseBaseTtc) => {
  const netBase = Math.max(0, netAfterVetusteTtc || 0);
  const franchiseBase = Math.max(0, franchiseBaseTtc || 0);

  // Keep manual user override when it exists.
  if (mission && mission.indemnisationFinale !== undefined && mission.indemnisationFinale !== null) {
    const stored = Number(mission.indemnisationFinale);
    return Number.isNaN(stored) ? netBase : Math.max(0, stored);
  }

  const franchiseAmount = calculateFranchiseAmount(mission, franchiseBase);
  return Math.max(0, netBase - franchiseAmount);
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
    if (rightLabel || (rightValue !== null && rightValue !== undefined && rightValue !== '')) {
      addKeyValue(doc, rightLabel, rightValue, colWidth - 20);
    }
    doc.x = doc.page.margins.left;
    doc.moveDown(0.15);
  });
  doc.moveDown(0.15);
};

const addFramedSection = (doc, title, renderContent) => {
  if (typeof renderContent !== 'function') {
    return;
  }
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
  const minColWidth = Math.min(usableWidth / items.length, 140);
  const padding = 8;

  const measurements = items.map(([label, value]) => {
    doc.font('Helvetica-Bold').fontSize(8.5);
    const labelWidth = doc.widthOfString(`${label} : `);
    doc.font('Helvetica').fontSize(8.5);
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
    const extra = (usableWidth - totalWidth) / items.length;
    colWidths = colWidths.map((width) => width + extra);
  }

  doc.font('Helvetica').fontSize(8.5);
  const textHeights = items.map(([label, value], index) =>
    doc.heightOfString(`${label} : ${safeValue(value)}`, {
      width: colWidths[index] - padding * 2,
      align: 'left',
    })
  );
  const rowHeight = Math.max(18, Math.max(...textHeights) + padding);

  const startY = doc.y;
  doc
    .lineWidth(0.5)
    .strokeColor('#cbd5f5')
    .rect(doc.page.margins.left, startY, usableWidth, rowHeight)
    .stroke();

  const textY = startY + padding / 2;
  let currentX = doc.page.margins.left;
  items.forEach(([label, value], index) => {
    const colWidth = colWidths[index];
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor('#1f2933')
      .text(`${label} : `, currentX + padding / 2, textY, {
        width: colWidth - padding,
        continued: true,
      })
      .font('Helvetica')
      .fillColor('#0f172a')
      .text(`${safeValue(value)}`, {
        continued: false,
        width: colWidth - padding,
      });
    currentX += colWidth;
  });

  doc.y = startY + rowHeight + 2;
};

const addTableSection = (doc, headers, rows, firstColumnRatio = 0.2, options = {}) => {
  const { headerHeight = 26, rowMinHeight = 17, rowPadding = 6 } = options;
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const remaining = tableWidth * (1 - firstColumnRatio);
  const colWidths = headers.map((_, index) =>
    index === 0 ? tableWidth * firstColumnRatio : remaining / (headers.length - 1)
  );

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
    doc.font('Helvetica').fontSize(9);
    const cellHeights = row.map((cell, index) =>
      doc.heightOfString(safeValue(cell), {
        width: colWidths[index] - 6,
        align: 'center',
      })
    );
    const effectiveRowHeight = Math.max(rowMinHeight, ...cellHeights) + rowPadding;

    doc
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .rect(doc.page.margins.left, currentY, tableWidth, effectiveRowHeight)
      .stroke();

    let cellX = doc.page.margins.left;
    row.forEach((cell, index) => {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#0f172a')
        .text(safeValue(cell), cellX + 3, currentY + Math.max(3, Math.floor(rowPadding / 2)), {
          width: colWidths[index] - 6,
          align: 'center',
        });
      cellX += colWidths[index];
    });

    currentY += effectiveRowHeight;
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
  const boxWidth = 170;
  const boxHeight = 46;
  const spacing = 10;
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
  const doc = new PDFDocument({ size: 'A4', margin: 32 });
  const missionLabel = mission.missionCode ? mission.missionCode : `#${mission.id}`;

  const logoPath = resolveLogo();
  if (logoPath) {
    try {
      doc.image(logoPath, doc.page.margins.left, doc.y, { width: 80 });
    } catch (error) {
      // ignore logo rendering errors
    }
    doc.moveDown(0.2);
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
  const indemnisationValue = calculateIndemnisationFinale(mission, netAfterVetusteTtc, franchiseBaseTtc);

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
        formatCurrency(laborHt),
        formatCurrency(laborTva),
        formatCurrency(laborTtc),
      ],
      [
        'Fournitures',
        '',
        '',
        formatCurrency(suppliesHt),
        formatCurrency(suppliesTva),
        formatCurrency(suppliesTtc),
      ],
      [
        'Montant total',
        '',
        '',
        formatCurrency(grandTotalHt),
        formatCurrency(combinedTva),
        formatCurrency(combinedTtc),
      ],
    ];

    addTableSection(
      doc,
      ['Main d\'oeuvre', 'Nombre d\'heures', 'Taux horaire', 'Hors taxe', 'T.V.A', 'Total TTC'],
      [...laborRows, ...summaryRows],
      0.28,
      { headerHeight: 20, rowMinHeight: 14, rowPadding: 4 }
    );

    addInlineSummaryTable(doc, [
      ['Total main d\'oeuvre (TTC)', formatCurrency(laborTtc)],
      ['Fournitures (TTC)', formatCurrency(suppliesTtc)],
      ['Montant total (TTC)', formatCurrency(combinedTtc)],
    ]);

    const guaranteeItems = [
      ['Responsabilite', formatResponsabilite(mission.responsabilite)],
      ['Type de garantie', formatGuaranteeType(mission.garantieType)],
    ];
    if (guaranteeRequiresFranchise(mission.garantieType)) {
      guaranteeItems.push(
        ['Taux franchise', formatFranchiseRate(mission.garantieFranchiseTaux)],
        ['Franchise (MAD)', formatFranchiseAmount(mission.garantieFranchiseMontant)]
      );
    }
    addInlineSummaryTable(doc, guaranteeItems);

    addInlineSummaryTable(doc, [
      ['Reforme', formatReformeType(mission.reformeType)],
      ['Valeur assuree', formatPlainNumber(mission.valeurAssuree)],
      ['Valeur venale', formatPlainNumber(mission.valeurVenale)],
      ['Valeur epaves', formatPlainNumber(mission.valeurEpaves)],
    ]);

    addInlineSummaryTable(doc, [
      ['Vetuste TTC', formatCurrency(damageVetusteLoss)],
      ['Indemnisation finale', formatCurrency(indemnisationValue)],
    ]);

    doc.moveDown(0.3);
  }

  if (damageData.items && damageData.items.length) {
    addSignatureSection(doc);
    doc.addPage();
    addSectionTitle(doc, 'Description des dommages');

    const damageRows = damageData.items.map((item) => {
      const priceHt = item.priceHt || 0;
      const priceAfter = item.priceAfter || 0;
      const priceTtc = item.priceTtc !== undefined ? item.priceTtc : priceHt * (item.withVat ? 1.2 : 1);
      const priceAfterTtc =
        item.priceAfterTtc !== undefined ? item.priceAfterTtc : priceAfter * (item.withVat ? 1.2 : 1);

      return [
        item.piece,
        formatDamageTypeLabel(item.pieceType),
        `${priceHt.toFixed(2)} HT`,
        formatVatChoice(item.withVat),
        `${priceTtc.toFixed(2)} TTC`,
        `${(item.vetuste || 0).toFixed(0)} %`,
        `${priceAfter.toFixed(2)} HT`,
        `${priceAfterTtc.toFixed(2)} TTC`,
      ];
    });

    const totals = damageData.totals || {};
    const summaryRows = [
      ['Total dommages', '', formatCurrency(totals.totalHt), '', formatCurrency(totals.totalTtc), '', '', ''],
      ['Apres vetuste', '', '', '', '', '', formatCurrency(totals.totalAfter), formatCurrency(totals.totalAfterTtc)],
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
      0.18
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
