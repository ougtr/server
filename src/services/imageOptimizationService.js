const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const MAX_IMAGE_WIDTH = 2560;
const MAX_IMAGE_HEIGHT = 2560;
const JPEG_QUALITY = 80;

const PROCESSABLE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.jfif',
  '.png',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.bmp',
  '.heic',
  '.heif',
  '.avif',
]);

const isProcessableImage = (file) => {
  const extension = path.extname(file.originalname || file.filename || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();
  return mimeType.startsWith('image/') && PROCESSABLE_EXTENSIONS.has(extension);
};

const deleteFileIfExists = (filePath) => {
  if (!filePath) {
    return;
  }
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const optimizeUploadedPhoto = async (file) => {
  if (!file || !file.path || !isProcessableImage(file)) {
    return file;
  }

  const originalPath = file.path;
  const parsed = path.parse(originalPath);
  const finalFilename = `${parsed.name}.jpg`;
  const finalPath = path.join(parsed.dir, finalFilename);
  const tempPath = path.join(parsed.dir, `${parsed.name}.optimized.jpg`);

  try {
    await sharp(originalPath)
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
      })
      .toFile(tempPath);

    if (finalPath === originalPath) {
      deleteFileIfExists(originalPath);
    }
    if (finalPath !== tempPath && fs.existsSync(finalPath)) {
      deleteFileIfExists(finalPath);
    }
    if (finalPath !== tempPath) {
      fs.renameSync(tempPath, finalPath);
    }
    if (finalPath !== originalPath) {
      deleteFileIfExists(originalPath);
    }

    const finalStat = fs.statSync(finalPath);
    return {
      ...file,
      path: finalPath,
      filename: finalFilename,
      size: finalStat.size,
      mimetype: 'image/jpeg',
    };
  } catch (error) {
    try {
      deleteFileIfExists(tempPath);
    } catch (cleanupError) {
      // ignore cleanup failure and keep the original file path.
    }
    return file;
  }
};

module.exports = {
  optimizeUploadedPhoto,
};
