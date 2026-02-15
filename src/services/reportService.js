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
    doc.moveDown(0.2);
  });
  doc.moveDown(0.2);
};

const addTableSection = (doc, headers, rows, firstColumnRatio = 0.2) => {
  const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const remaining = tableWidth * (1 - firstColumnRatio);
  const colWidths = headers.map((_, index) =>
    index === 0 ? tableWidth * firstColumnRatio : remaining / (headers.length - 1)
  );
  const headerHeight = 22;
  const rowHeight = 20;

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

const moveSectionNearBottom = (doc, offset = 120) => {
  const targetY = doc.page.height - doc.page.margins.bottom - offset;
  if (doc.y < targetY) {
    const lineHeight = doc.currentLineHeight();
    const linesToMove = Math.ceil((targetY - doc.y) / lineHeight);
    doc.moveDown(linesToMove);
  }
};

const addSyntheseSection = (doc, mission) => {
  moveSectionNearBottom(doc, 130);
  addSectionTitle(doc, 'Synthese');
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#0f172a')
    .text(
      `Ce rapport regroupe les informations communiquees le ${formatDate(
        mission.updatedAt || mission.createdAt
      )}. Il est destine a servir de support pour la redaction finale du rapport d'expertise.`
    );
  doc.moveDown(0.6);
  doc
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .fillColor('#475569')
    .text('Ce rapport a ete genere automatiquement a partir des informations saisies dans Gestion Missions Auto.', {
      align: 'left',
    });
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
  doc.moveDown(0.5);

  addSectionTitle(doc, 'Informations principales');
  addTwoColumnRows(doc, [
    ['Assureur', mission.assureurNom, 'Contact assureur', mission.assureurContact],
    ['Agence', mission.assureurAgenceNom, 'Contact agence', mission.assureurAgenceContact],
    ['Adresse agence', mission.assureurAgenceAdresse, 'Responsable mission', mission.agentLogin],
  ]);

  addSectionTitle(doc, 'Assure');
  addTwoColumnRows(doc, [
    ['Nom', mission.assureNom, 'Telephone', mission.assureTelephone],
    ['Email', mission.assureEmail, 'Statut', mission.statut],
  ]);

  addSectionTitle(doc, 'Vehicule');
  addTwoColumnRows(doc, [
    ['Marque', mission.vehiculeMarque, 'Modele', mission.vehiculeModele],
    ['Immatriculation', mission.vehiculeImmatriculation, 'Date de mise en circulation', formatDate(mission.vehiculeAnnee)],
  ]);

  addSectionTitle(doc, 'Sinistre');
  addTwoColumnRows(doc, [
    ['Code sinistre', mission.sinistreType, 'Date', formatDate(mission.sinistreDate)],
    ['Police', mission.sinistrePolice, 'Police vehicule adverse', mission.sinistrePoliceAdverse],
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

  addSectionTitle(doc, 'Garage');
  addTwoColumnRows(doc, [
    ['Garage', mission.garageNom, 'Contact garage', mission.garageContact],
    ['Adresse garage', mission.garageAdresse, '', ''],
  ]);

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
    ];

    addTableSection(
      doc,
      ['Main d\'oeuvre', 'Nombre d\'heures', 'Taux horaire', 'Hors taxe', 'T.V.A', 'Total TTC'],
      [...laborRows, ...summaryRows],
      0.28
    );
  }

  addSyntheseSection(doc, mission);

  if (damageData.items && damageData.items.length) {
    doc.addPage();
    addSectionTitle(doc, 'Description des dommages');
    const damageRows = damageData.items.map((item) => {
      const priceTtc = (item.priceHt || 0) * 1.2;
      return [
        item.piece,
        `${(item.priceHt || 0).toFixed(2)} HT`,
        `${(item.vetuste || 0).toFixed(0)} %`,
        `${(item.priceAfter || 0).toFixed(2)} HT`,
        `${priceTtc.toFixed(2)} TTC`,
      ];
    });
    const totals = damageData.totals || {};
    const summaryRows = [
      [
        'Total dommages',
        '',
        '',
        formatCurrency(totals.totalHt),
        formatCurrency(totals.totalTtc),
      ],
      [
        'Apres vetuste',
        '',
        '',
        formatCurrency(totals.totalAfter),
        formatCurrency(totals.totalAfterTtc),
      ],
    ];

    addTableSection(
      doc,
      ['Piece', 'Prix HT', 'Vetuste', 'Apres vetuste', 'Prix TTC'],
      [...damageRows, ...summaryRows],
      0.3
    );
  }

  return doc;
};

module.exports = {
  createMissionReport,
};
