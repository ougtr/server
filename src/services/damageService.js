const { run, all, get } = require('../db');

const DAMAGE_TYPE_VALUES = ['original', 'reparation', 'reccuperation', 'adaptation', 'produit_peinture'];

const normalizePieceType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 'original';
  }
  if (DAMAGE_TYPE_VALUES.includes(normalized)) {
    return normalized;
  }
  return 'original';
};

const normalizeBooleanFlag = (value) => {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'number') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'false' || lowered === '0' || lowered === 'non') {
      return 0;
    }
  }
  return 1;
};

const mapDamage = (row) => {
  if (!row) return null;
  const priceHt = Number(row.price_ht) || 0;
  const vetuste = Number(row.vetuste) || 0;
  const priceAfter = Math.max(0, priceHt * (1 - vetuste / 100));
  const withVat = row.avec_tva === undefined || row.avec_tva === null ? true : Number(row.avec_tva) !== 0;
  const vatFactor = withVat ? 1.2 : 1;
  return {
    id: row.id,
    missionId: row.mission_id,
    piece: row.piece,
    priceHt,
    vetuste,
    pieceType: row.piece_type || 'original',
    withVat,
    priceAfter,
    priceTtc: priceHt * vatFactor,
    priceAfterTtc: priceAfter * vatFactor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const buildTotals = (items) => {
  const totalHt = items.reduce((sum, item) => sum + item.priceHt, 0);
  const totalAfter = items.reduce((sum, item) => sum + item.priceAfter, 0);
  const totalTtc = items.reduce((sum, item) => sum + (item.priceTtc || 0), 0);
  const totalAfterTtc = items.reduce((sum, item) => sum + (item.priceAfterTtc || 0), 0);
  return {
    totalHt,
    totalTtc,
    totalAfter,
    totalAfterTtc,
  };
};

const listDamagesByMission = async (missionId) => {
  const rows = await all(
    `SELECT id, mission_id, piece, price_ht, vetuste, piece_type, avec_tva, created_at, updated_at
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

const addDamage = async ({ missionId, piece, priceHt, vetuste, pieceType, withVat }) => {
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

  const sanitizedType = normalizePieceType(pieceType);
  const vatFlag = normalizeBooleanFlag(withVat);

  const result = await run(
    `INSERT INTO mission_damages (mission_id, piece, price_ht, vetuste, piece_type, avec_tva)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [missionId, normalizedPiece, safePrice, safeVetuste, sanitizedType, vatFlag]
  );
  const row = await get(
    `SELECT id, mission_id, piece, price_ht, vetuste, piece_type, avec_tva, created_at, updated_at
     FROM mission_damages
     WHERE id = ?`,
    [result.id]
  );
  return mapDamage(row);
};

const getDamageById = async (id) =>
  mapDamage(
    await get(
      `SELECT id, mission_id, piece, price_ht, vetuste, piece_type, avec_tva, created_at, updated_at
       FROM mission_damages
       WHERE id = ?`,
      [id]
    )
  );

const updateDamage = async (id, { piece, priceHt, vetuste, pieceType, withVat }) => {
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
  const sanitizedType = normalizePieceType(pieceType);
  const vatFlag = normalizeBooleanFlag(withVat);

  await run(
    `UPDATE mission_damages
     SET piece = ?, price_ht = ?, vetuste = ?, piece_type = ?, avec_tva = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [normalizedPiece, safePrice, safeVetuste, sanitizedType, vatFlag, id]
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
