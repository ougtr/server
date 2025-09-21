const { run, get, all } = require('../db');

const addPhotos = async ({ missionId, files, phase, label, uploadedBy }) => {
  const saved = [];
  for (const file of files) {
    const storedPath = file.relativePath || file.filename;
    const inserted = await run(
      'INSERT INTO mission_photos (mission_id, fichier, phase, label, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [missionId, storedPath, phase, label || null, uploadedBy]
    );
    saved.push({
      id: inserted.id,
      missionId,
      fichier: storedPath,
      phase,
      label: label || null,
      uploadedBy,
    });
  }
  return saved;
};

const listPhotosByMission = async (missionId) => {
  const rows = await all(
    `SELECT id, mission_id AS missionId, fichier, phase, label, uploaded_by AS uploadedBy, uploaded_at AS uploadedAt
     FROM mission_photos
     WHERE mission_id = ?
     ORDER BY uploaded_at DESC`,
    [missionId]
  );
  return rows.map((row) => ({
    ...row,
    url: `/uploads/${row.fichier}`,
  }));
};

const getPhotoById = (id) =>
  get(
    `SELECT id, mission_id AS missionId, fichier, phase, label, uploaded_by AS uploadedBy, uploaded_at AS uploadedAt
     FROM mission_photos
     WHERE id = ?`,
    [id]
  );

const deletePhoto = (id) => run('DELETE FROM mission_photos WHERE id = ?', [id]);

module.exports = {
  addPhotos,
  listPhotosByMission,
  getPhotoById,
  deletePhoto,
};
