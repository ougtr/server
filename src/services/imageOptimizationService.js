const fs = require('fs');
const path = require('path');
const { watermarkPhoto } = require('./photoWatermarkService');

const optimizeUploadedPhoto = async (file, { uploadedAt = new Date().toISOString(), ...options } = {}) => {
  if (!file?.path || !String(file.mimetype || '').startsWith('image/')) {
    throw new Error('Le fichier doit etre une image lisible');
  }
  const parsed = path.parse(file.path);
  const filename = `${parsed.name}.jpg`;
  const outputPath = path.join(parsed.dir, filename);
  await watermarkPhoto({ ...options, filePath: file.path, outputPath, uploadedAt, optimize: true });
  if (path.resolve(outputPath) !== path.resolve(file.path)) fs.unlinkSync(file.path);
  return {
    ...file,
    path: outputPath,
    filename,
    size: fs.statSync(outputPath).size,
    mimetype: 'image/jpeg',
  };
};

module.exports = { optimizeUploadedPhoto };
