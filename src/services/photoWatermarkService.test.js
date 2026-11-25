const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const { watermarkPhoto, migrateExistingPhotoWatermarks } = require('./photoWatermarkService');
const { optimizeUploadedPhoto } = require('./imageOptimizationService');

const setup = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-watermark-'));
  const uploadDir = path.join(dir, 'uploads');
  const stateDir = path.join(dir, 'private');
  fs.mkdirSync(path.join(uploadDir, '42'), { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { uploadDir, stateDir };
};

const image = (color = '#337799', width = 800, height = 600) =>
  sharp({ create: { width, height, channels: 3, background: color } });
const records = (stateDir) => fs.readdirSync(path.join(stateDir, 'records'))
  .map((file) => JSON.parse(fs.readFileSync(path.join(stateDir, 'records', file), 'utf8')));

test('new upload uses capture date, rotates, resizes and preserves its exact original', async (t) => {
  const options = setup(t);
  const filePath = path.join(options.uploadDir, '42/camera.png');
  await image('#337799', 3000, 1600).withExif({
    IFD2: { DateTimeOriginal: '2024:05:20 23:59:00' },
  }).withMetadata({ orientation: 6 }).png().toFile(filePath);
  const original = fs.readFileSync(filePath);
  const result = await optimizeUploadedPhoto({ path: filePath, mimetype: 'image/png' }, {
    ...options, uploadedAt: '2026-11-23T12:00:00Z',
  });
  assert.equal(result.mimetype, 'image/jpeg');
  assert.equal(fs.existsSync(filePath), false);
  const metadata = await sharp(result.path).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.ok(metadata.width <= 2560 && metadata.height <= 2560);
  assert.ok(metadata.height > metadata.width);
  const [record] = records(options.stateDir);
  assert.deepEqual(record.watermarkDate, { date: '20/05/2024', source: 'capture' });
  const backup = fs.readdirSync(path.join(options.stateDir, 'originals'))[0];
  assert.deepEqual(fs.readFileSync(path.join(options.stateDir, 'originals', backup)), original);
});

for (const color of ['#ffffff', '#000000']) {
  test(`watermark changes only the lower-right region on ${color}`, async (t) => {
    const options = setup(t);
    const filePath = path.join(options.uploadDir, '42/photo.png');
    await image(color).png().toFile(filePath);
    const before = await sharp(filePath).removeAlpha().raw().toBuffer();
    await watermarkPhoto({ ...options, filePath, uploadedAt: '2026-11-23T12:00:00Z' });
    const after = await sharp(filePath).removeAlpha().raw().toBuffer();
    let changed = 0;
    for (let y = 0; y < 600; y++) {
      for (let x = 0; x < 800; x++) {
        const index = (y * 800 + x) * 3;
        if (!before.subarray(index, index + 3).equals(after.subarray(index, index + 3))) {
          changed++;
          assert.ok(x > 350 && y > 430, `Unexpected pixel changed at ${x},${y}`);
        }
      }
    }
    assert.ok(changed > 500);
    assert.deepEqual(records(options.stateDir)[0].watermarkDate, { date: '23/11/2026', source: 'upload' });
  });
}

test('SQLite UTC upload dates are converted to Casablanca, never to the processing date', async (t) => {
  const options = setup(t);
  const filePath = path.join(options.uploadDir, '42/photo.jpg');
  await image().jpeg().toFile(filePath);
  const result = await watermarkPhoto({ ...options, filePath, uploadedAt: '2026-07-13 23:30:00', preferCaptureDate: false });
  assert.equal(result.watermarkDate.date, '14/07/2026');
});

test('migration resumes failed photos, skips successes, then runs no more once completed', async (t) => {
  const options = setup(t);
  const first = path.join(options.uploadDir, '42/first.jpg');
  await image().withExif({ IFD2: { DateTimeOriginal: '2020:01:01 12:00:00' } }).jpeg().toFile(first);
  let queries = 0;
  const listPhotos = async () => {
    queries++;
    return [
      { id: 1, fichier: '42/first.jpg', uploadedAt: '2024-06-15 10:00:00' },
      { id: 2, fichier: '42/missing.jpg', uploadedAt: '2024-06-16 10:00:00' },
    ];
  };
  const logger = { info() {}, error() {} };
  const firstResult = await migrateExistingPhotoWatermarks({ ...options, listPhotos, logger });
  assert.equal(firstResult.processed, 1);
  assert.equal(firstResult.failed, 1);
  assert.deepEqual(records(options.stateDir)[0].watermarkDate, { date: '15/06/2024', source: 'upload' });
  const marked = fs.readFileSync(first);
  await image().jpeg().toFile(path.join(options.uploadDir, '42/missing.jpg'));
  const secondResult = await migrateExistingPhotoWatermarks({ ...options, listPhotos, logger });
  assert.equal(secondResult.processed, 1);
  assert.equal(secondResult.skipped, 1);
  assert.equal(secondResult.failed, 0);
  assert.deepEqual(fs.readFileSync(first), marked);
  assert.deepEqual(await migrateExistingPhotoWatermarks({ ...options, listPhotos, logger }), { skipped: true });
  assert.equal(queries, 2);
});

test('recovery uses the saved original if replacement was interrupted', async (t) => {
  const options = setup(t);
  const filePath = path.join(options.uploadDir, '42/photo.png');
  await image().png().toFile(filePath);
  const original = fs.readFileSync(filePath);
  await watermarkPhoto({ ...options, filePath, uploadedAt: '2024-06-15 10:00:00' });
  const marked = fs.readFileSync(filePath);
  fs.writeFileSync(filePath, original);
  await watermarkPhoto({ ...options, filePath, uploadedAt: '2026-11-23 12:00:00' });
  assert.deepEqual(fs.readFileSync(filePath), marked);
  const repeated = await watermarkPhoto({ ...options, filePath, uploadedAt: '2026-11-23 12:00:00' });
  assert.equal(repeated.skipped, true);
});

test('invalid images fail and originals remain untouched; private data cannot be public', async (t) => {
  const options = setup(t);
  const filePath = path.join(options.uploadDir, '42/invalid.png');
  fs.writeFileSync(filePath, 'invalid image');
  await assert.rejects(optimizeUploadedPhoto({ path: filePath, mimetype: 'image/png' }, options));
  assert.equal(fs.readFileSync(filePath, 'utf8'), 'invalid image');
  await image().png().toFile(filePath);
  await watermarkPhoto({ ...options, filePath, uploadedAt: '2024-06-15 10:00:00' });
  await assert.rejects(watermarkPhoto({ ...options, filePath, stateDir: path.join(options.uploadDir, 'private') }), /hors du dossier public/);
});

test('temporary Windows file locks are retried without removing the original', async (t) => {
  const options = setup(t);
  const filePath = path.join(options.uploadDir, '42/locked.png');
  await image().png().toFile(filePath);
  const original = fs.readFileSync(filePath);
  const rename = fs.promises.rename;
  let attempts = 0;
  t.after(() => { fs.promises.rename = rename; });
  fs.promises.rename = async (source, target) => {
    attempts++;
    if (attempts === 1) {
      assert.deepEqual(fs.readFileSync(filePath), original);
      const error = new Error('Temporary lock');
      error.code = 'EPERM';
      throw error;
    }
    return rename(source, target);
  };
  await watermarkPhoto({ ...options, filePath, uploadedAt: '2024-06-15 10:00:00' });
  assert.equal(attempts, 2);
  assert.notDeepEqual(fs.readFileSync(filePath), original);
});
