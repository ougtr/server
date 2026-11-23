const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const sharp = require('sharp');
const { createMissionPhotoReport } = require('./photoReportService');

let uploadDir;
const mission = { id: 42, missionCode: 'TEST-42', vehiculeImmatriculation: '12345-A-6' };
const photos = [
  { id: 3, fichier: '42/apres.png', phase: 'apres', label: 'Photo finale' },
  { id: 1, fichier: '42/avant.png', phase: null, label: 'Photo initiale' },
  { id: 2, fichier: '42/en_cours.png', phase: 'en_cours', label: 'Photo travaux' },
];

before(async () => {
  uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-photo-pdf-'));
  await fs.mkdir(path.join(uploadDir, '42'));
  for (const [index, photo] of photos.entries()) {
    await sharp({
      create: {
        width: index === 0 ? 120 : 60,
        height: index === 0 ? 60 : 120,
        channels: 4,
        background: { r: 30, g: 80, b: 160, alpha: 0.6 },
      },
    }).png().toFile(path.join(uploadDir, photo.fichier));
  }
});

after(async () => {
  await fs.rm(uploadDir, { recursive: true, force: true });
});

const renderPdf = (doc) => new Promise((resolve, reject) => {
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', reject);
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.end();
});

const readPdf = (buffer) => {
  const source = buffer.toString('latin1');
  let text = '';
  for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      const content = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
      for (const encoded of content.matchAll(/<([0-9a-f]+)>/gi)) {
        text += Buffer.from(encoded[1], 'hex').toString('latin1');
      }
    } catch (error) {
      // JPEG image streams are not compressed text streams.
    }
  }
  return { pageCount: (source.match(/\/Type \/Page\s/g) || []).length, text };
};

test('global PDF groups all photos Avant, En cours, Apres with mission and captions', async () => {
  const buffer = await renderPdf(await createMissionPhotoReport(mission, photos, null, uploadDir));
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  const result = readPdf(buffer);
  assert.equal(result.pageCount, 3);
  assert.ok(result.text.includes('TEST-42'));
  assert.ok(result.text.includes('12345-A-6'));
  assert.ok(result.text.indexOf('Photo initiale') < result.text.indexOf('Photo travaux'));
  assert.ok(result.text.indexOf('Photo travaux') < result.text.indexOf('Photo finale'));
});

for (const [phase, caption] of [['avant', 'Photo initiale'], ['en_cours', 'Photo travaux'], ['apres', 'Photo finale']]) {
  test(`phase PDF includes only ${phase}`, async () => {
    const result = readPdf(await renderPdf(await createMissionPhotoReport(mission, photos, phase, uploadDir)));
    assert.equal(result.pageCount, 1);
    assert.ok(result.text.includes(caption));
    for (const photo of photos.filter((item) => item.label !== caption)) {
      assert.ok(!result.text.includes(photo.label));
    }
  });
}

test('invalid and empty selections return explicit errors', async () => {
  await assert.rejects(createMissionPhotoReport(mission, photos, 'unknown', uploadDir), { statusCode: 400 });
  await assert.rejects(createMissionPhotoReport(mission, [], null, uploadDir), { statusCode: 404 });
  await assert.rejects(createMissionPhotoReport(mission, [photos[0]], 'avant', uploadDir), { statusCode: 404 });
});

test('missing or corrupt files fail explicitly instead of silently omitting photos', async () => {
  await assert.rejects(createMissionPhotoReport(mission, [
    { id: 99, fichier: '42/missing.png', phase: 'avant' },
  ], null, uploadDir), { statusCode: 422 });
  await fs.writeFile(path.join(uploadDir, '42/corrupt.png'), 'not an image');
  await assert.rejects(createMissionPhotoReport(mission, [
    { id: 99, fichier: '42/corrupt.png', phase: 'avant' },
  ], null, uploadDir), { statusCode: 422 });
});

test('photo paths cannot read outside the mission directory', async () => {
  await assert.rejects(createMissionPhotoReport(mission, [
    { id: 99, fichier: '43/other-mission.png', phase: 'avant' },
  ], null, uploadDir), /Chemin de photo invalide/);
});
