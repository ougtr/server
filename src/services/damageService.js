const { run, all, get } = require('../db');

const mapDamage = (row) => {
  if (!row) return null;
  const priceHt = Number(row.price_ht) || 0;
  const vetuste = Number(row.vetuste) || 0;
  const priceAfter = Math.max(0, priceHt * (1 - vetuste / 100));
  return {
    id: row.id,
    missionId: row.mission_id,
    piece: row.piece,
    priceHt,
    vetuste,
    priceAfter,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const buildTotals = (items) => {
  const totalHt = items.reduce((sum, item) => sum + item.priceHt, 0);
  const totalAfter = items.reduce((sum, item) => sum + item.priceAfter, 0);
  const totalTtc = totalHt * 1.2;
  const totalAfterTtc = totalAfter * 1.2;
  return {
    totalHt,
    totalTtc,
    totalAfter,
    totalAfterTtc,
  };
};

const listDamagesByMission = async (missionId) => {
  const rows = await all(
    `SELECT id, mission_id, piece, price_ht, vetuste, created_at, updated_at
     FROM mission_damages
     WHERE mission_id = ?
     ORDER BY created_at ASC`,
    [missionId]
  );
  const items = rows.map(mapDamage);
  return {
    items,
    totals: buildTotals(items),
  };
};

const addDamage = async ({ missionId, piece, priceHt, vetuste }) => {
  const normalizedPiece = (piece || '').trim();
  if (!normalizedPiece) {
    throw new Error('Piece requise');
  }
  const safePrice = Number(priceHt);
  const safeVetuste = Number(vetuste);
  if (Number.isNaN(safePrice) || safePrice < 0) {
    throw new Error('Tarif hors taxe invalide');
  }
  if (Number.isNaN(safeVetuste) || safeVetuste < 0 || safeVetuste > 100) {
    throw new Error('Vetuste doit etre comprise entre 0 et 100');
  }

  const result = await run(
    `INSERT INTO mission_damages (mission_id, piece, price_ht, vetuste)
     VALUES (?, ?, ?, ?)`,
    [missionId, normalizedPiece, safePrice, safeVetuste]
  );
  const row = await get(
    `SELECT id, mission_id, piece, price_ht, vetuste, created_at, updated_at
     FROM mission_damages
     WHERE id = ?`,
    [result.id]
  );
  return mapDamage(row);
};

const getDamageById = async (id) =>
  mapDamage(
    await get(
      `SELECT id, mission_id, piece, price_ht, vetuste, created_at, updated_at
       FROM mission_damages
       WHERE id = ?`,
      [id]
    )
  );

const updateDamage = async (id, { piece, priceHt, vetuste }) => {
  const normalizedPiece = (piece || '').trim();
  if (!normalizedPiece) {
    throw new Error('Piece requise');
  }
  const safePrice = Number(priceHt);
  const safeVetuste = Number(vetuste);
  if (Number.isNaN(safePrice) || safePrice < 0) {
    throw new Error('Tarif hors taxe invalide');
  }
  if (Number.isNaN(safeVetuste) || safeVetuste < 0 || safeVetuste > 100) {
    throw new Error('Vetuste doit etre comprise entre 0 et 100');
  }
  await run(
    `UPDATE mission_damages
     SET piece = ?, price_ht = ?, vetuste = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [normalizedPiece, safePrice, safeVetuste, id]
  );
  return getDamageById(id);
};

const deleteDamage = async (id) => {
  await run('DELETE FROM mission_damages WHERE id = ?', [id]);
};

module.exports = {
  listDamagesByMission,
  addDamage,
  updateDamage,
  deleteDamage,
  getDamageById,
  buildTotals,
};
