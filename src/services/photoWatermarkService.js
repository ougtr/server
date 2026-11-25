const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const readExif = require('exif-reader');
const { UPLOAD_DIR, PHOTO_WATERMARK_DIR } = require('../config');

const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const readJson = (filename) => {
  try {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const writeJson = (filename, value) => {
  const temp = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, filename);
  } finally {
    fs.rmSync(temp, { force: true });
  }
};

const isWithin = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
};

const replaceImage = async (temporaryPath, targetPath) => {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(temporaryPath, targetPath);
      return;
    } catch (error) {
      // Windows scanners can briefly lock freshly processed images.
      if (attempt >= 5 || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (2 ** attempt)));
    }
  }
};

const selectWatermarkDate = (metadata, uploadedAt, preferCaptureDate) => {
  if (preferCaptureDate && metadata.exif) {
    try {
      // EXIF stores the camera's local clock; preserve its calendar date as recorded.
      const takenAt = readExif(metadata.exif).Photo?.DateTimeOriginal;
      if (takenAt instanceof Date && Number.isFinite(takenAt.getTime())) {
        return { date: takenAt.toLocaleDateString('fr-FR', { timeZone: 'UTC' }), source: 'capture' };
      }
    } catch (error) {
      // Malformed camera metadata falls back to the recorded upload date.
    }
  }
  const raw = String(uploadedAt || '');
  const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw;
  const date = new Date(normalized);
  if (!raw || !Number.isFinite(date.getTime())) throw new Error('Date upload absente ou invalide');
  return { date: date.toLocaleDateString('fr-FR', { timeZone: 'Africa/Casablanca' }), source: 'upload' };
};

const watermarkSvg = (width, height, date) => {
  const size = Math.min(48, width / 12, height / 9);
  const margin = Math.max(1, Math.min(width, height) * 0.025);
  const x = width - margin;
  const y = height - margin - size * 1.45;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <g font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" font-weight="bold" text-anchor="end">
      <g fill="white" stroke="#151515" stroke-width="${size * 0.07}" stroke-linejoin="round" paint-order="stroke">
        <text x="${x}" y="${y}">Opale expertise</text>
        <text x="${x}" y="${y + size * 1.3}">${date}</text>
      </g>
    </g>
  </svg>`);
};

const watermarkPhoto = async ({
  filePath,
  outputPath = filePath,
  uploadedAt,
  preferCaptureDate = true,
  optimize = false,
  uploadDir = UPLOAD_DIR,
  stateDir = PHOTO_WATERMARK_DIR,
}) => {
  const root = path.resolve(uploadDir);
  const privateRoot = path.resolve(stateDir);
  const target = path.resolve(outputPath);
  const source = path.resolve(filePath);
  if (privateRoot === root || isWithin(root, privateRoot)) {
    throw new Error('Les sauvegardes des photos doivent etre hors du dossier public uploads');
  }
  if (!isWithin(root, target) || !isWithin(root, source)) throw new Error('Chemin de photo invalide');
  if (!isWithin(fs.realpathSync(root), fs.realpathSync(source))) throw new Error('Chemin de photo invalide');

  const key = hash(Buffer.from(path.relative(root, target).replace(/\\/g, '/')));
  const originalsDir = path.join(privateRoot, 'originals');
  const recordsDir = path.join(privateRoot, 'records');
  fs.mkdirSync(originalsDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(recordsDir, { recursive: true, mode: 0o700 });
  const backup = path.join(originalsDir, `${key}.original`);
  const recordPath = path.join(recordsDir, `${key}.json`);
  const record = readJson(recordPath);
  if (record && fs.existsSync(target) && hash(fs.readFileSync(target)) === record.outputSha256) {
    return { ...record, skipped: true };
  }

  const metadata = await sharp(fs.existsSync(backup) ? backup : source).metadata();
  const watermarkDate = record?.watermarkDate || selectWatermarkDate(metadata, uploadedAt, preferCaptureDate);
  // The immutable source also allows recovery if the process stops after replacing the image.
  try {
    fs.copyFileSync(source, backup, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backup, 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  let image = sharp(backup).rotate();
  if (optimize) {
    image = image.resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
  }
  const { data, info } = await image.flatten({ background: '#ffffff' }).raw().toBuffer({ resolveWithObject: true });
  let result = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .composite([{ input: watermarkSvg(info.width, info.height, watermarkDate.date) }]);
  const format = optimize ? 'jpeg' : metadata.format;
  result = format === 'jpeg' ? result.jpeg({ quality: 85, mozjpeg: true }) : result.toFormat(format);
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${crypto.randomUUID()}.watermark.tmp`);
  try {
    await result.toFile(temp);
    const nextRecord = {
      version: 1,
      file: path.relative(root, target).replace(/\\/g, '/'),
      originalFile: path.relative(root, source).replace(/\\/g, '/'),
      watermarkDate,
      appliedAt: new Date().toISOString(),
      outputSha256: hash(fs.readFileSync(temp)),
    };
    // Persist the intended output before replacement, so restart can detect a completed write.
    writeJson(recordPath, nextRecord);
    await replaceImage(temp, target);
    return { ...nextRecord, skipped: false };
  } finally {
    fs.rmSync(temp, { force: true });
  }
};

const migrateExistingPhotoWatermarks = async ({
  uploadDir = UPLOAD_DIR,
  stateDir = PHOTO_WATERMARK_DIR,
  listPhotos = () => require('../db').all('SELECT id, fichier, uploaded_at AS uploadedAt FROM mission_photos ORDER BY id'),
  logger = console,
} = {}) => {
  const donePath = path.join(stateDir, 'existing-photos-v1.complete.json');
  if (readJson(donePath)) return { skipped: true };
  if (path.resolve(stateDir) === path.resolve(uploadDir) || isWithin(path.resolve(uploadDir), path.resolve(stateDir))) {
    throw new Error('Le suivi du filigrane doit etre hors du dossier public uploads');
  }
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const lockPath = path.join(stateDir, 'migration.lock');
  const previousLock = readJson(lockPath);
  if (previousLock) {
    try {
      process.kill(previousLock.pid, 0);
      return { busy: true };
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
      fs.unlinkSync(lockPath);
    }
  }
  try {
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid }), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code === 'EEXIST') return { busy: true };
    throw error;
  }
  try {
    const photos = await listPhotos();
    const summary = { total: photos.length, processed: 0, skipped: 0, failed: 0 };
    logger.info(`Filigrane : verification de ${photos.length} photo(s) existante(s).`);
    for (const photo of photos) {
      try {
        const result = await watermarkPhoto({
          filePath: path.resolve(uploadDir, String(photo.fichier).replace(/\\/g, '/')),
          uploadedAt: photo.uploadedAt,
          preferCaptureDate: false,
          uploadDir,
          stateDir,
        });
        summary[result.skipped ? 'skipped' : 'processed'] += 1;
      } catch (error) {
        summary.failed += 1;
        logger.error(`Filigrane : photo ${photo.id} non traitee : ${error.message}`);
      }
    }
    if (!summary.failed) writeJson(donePath, { ...summary, completedAt: new Date().toISOString() });
    logger.info('Filigrane : reprise terminee.', summary);
    return summary;
  } finally {
    fs.rmSync(lockPath, { force: true });
  }
};

module.exports = { watermarkPhoto, migrateExistingPhotoWatermarks };
