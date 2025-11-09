const { run, get, all } = require('../db');

const addDocuments = async ({ missionId, files, uploadedBy }) => {
  const saved = [];
  for (const file of files) {
    const storedPath = file.relativePath || file.filename;
    const inserted = await run(
      `INSERT INTO mission_documents (mission_id, fichier, nom_original, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        missionId,
        storedPath,
        file.originalName || file.originalname || null,
        file.mimeType || file.mimetype || null,
        uploadedBy,
      ]
    );
    saved.push({
      id: inserted.id,
      missionId,
      fichier: storedPath,
      nomOriginal: file.originalName || file.originalname || null,
      mimeType: file.mimeType || file.mimetype || null,
      uploadedBy,
    });
  }
  return saved;
};

const listDocumentsByMission = async (missionId) => {
  const rows = await all(
    `SELECT id,
            mission_id AS missionId,
            fichier,
            nom_original AS nomOriginal,
            mime_type AS mimeType,
            uploaded_by AS uploadedBy,
            uploaded_at AS uploadedAt
     FROM mission_documents
     WHERE mission_id = ?
     ORDER BY uploaded_at DESC`,
    [missionId]
  );

  return rows.map((row) => ({
    ...row,
    url: `/uploads/${row.fichier}`,
  }));
};

const getDocumentById = (id) =>
  get(
    `SELECT id,
            mission_id AS missionId,
            fichier,
            nom_original AS nomOriginal,
            mime_type AS mimeType,
            uploaded_by AS uploadedBy,
            uploaded_at AS uploadedAt
     FROM mission_documents
     WHERE id = ?`,
    [id]
  );

const deleteDocument = (id) => run('DELETE FROM mission_documents WHERE id = ?', [id]);

module.exports = {
  addDocuments,
  listDocumentsByMission,
  getDocumentById,
  deleteDocument,
};
