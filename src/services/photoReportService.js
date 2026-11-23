const PDFDocument = require('pdfkit');
const path = require('path');
const sharp = require('sharp');
const { UPLOAD_DIR } = require('../config');

const PHOTO_REPORT_PHASES = [
  { value: 'avant', label: 'Avant' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'apres', label: 'Apr\u00e8s' },
];

const createMissionPhotoReport = async (mission, photos, phase = null, uploadDir = UPLOAD_DIR) => {
  if (phase !== null && !PHOTO_REPORT_PHASES.some((item) => item.value === phase)) {
    const error = new Error('Phase de photos invalide');
    error.statusCode = 400;
    throw error;
  }

  const groups = PHOTO_REPORT_PHASES
    .filter((item) => !phase || item.value === phase)
    .map((item) => ({
      ...item,
      photos: photos.filter((photo) => (photo.phase || 'avant') === item.value),
    }));
  const photoCount = groups.reduce((count, group) => count + group.photos.length, 0);
  if (!photoCount) {
    const error = new Error('Aucune photo disponible pour cette selection');
    error.statusCode = 404;
    throw error;
  }

  const doc = new PDFDocument({
    size: 'A4',
    autoFirstPage: false,
    margins: { top: 36, bottom: 36, left: 36, right: 36 },
    info: { Title: `Photos - Mission ${mission.missionCode || mission.id}` },
  });
  const missionDir = path.resolve(uploadDir, String(mission.id));
  let pageNumber = 0;

  try {
    for (const group of groups) {
      for (const photo of group.photos) {
        const imagePath = path.resolve(uploadDir, String(photo.fichier).replace(/\\/g, '/'));
        const relativePath = path.relative(missionDir, imagePath);
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          throw new Error('Chemin de photo invalide');
        }

        let image;
        try {
          image = await sharp(imagePath)
            .rotate()
            .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 85 })
            .toBuffer();
        } catch (cause) {
          const error = new Error(`Impossible de lire la photo ${photo.id}. Verifiez son fichier avant de relancer le PDF.`);
          error.statusCode = 422;
          throw error;
        }

        doc.addPage();
        pageNumber += 1;
        const width = doc.page.width - 72;
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('Photos de la mission');
        doc.font('Helvetica').fontSize(10).fillColor('#475569')
          .text(`Mission : ${mission.missionCode || `#${mission.id}`}`, { width, height: 16, ellipsis: true });
        doc.text(`Immatriculation : ${mission.vehiculeImmatriculation || '-'}`, { width, height: 16, ellipsis: true });
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1d4ed8').text(`Phase : ${group.label}`);
        doc.moveDown(0.4);
        doc.font('Helvetica').fontSize(10).fillColor('#0f172a')
          .text(photo.label || 'Photo sans libelle', { width, height: 42, ellipsis: true });

        const imageTop = Math.max(170, doc.y + 12);
        doc.image(image, 36, imageTop, {
          fit: [width, doc.page.height - imageTop - 70],
          align: 'center',
          valign: 'center',
        });
        doc.font('Helvetica').fontSize(9).fillColor('#64748b')
          .text(`${group.label} | Photo ${pageNumber} / ${photoCount}`, 36, doc.page.height - 48, {
            width,
            align: 'center',
            lineBreak: false,
          });
      }
    }
    return doc;
  } catch (error) {
    doc.destroy();
    throw error;
  }
};

module.exports = { createMissionPhotoReport };
