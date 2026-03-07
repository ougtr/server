const { run, all, get } = require('../db');
const { LABOR_CATEGORIES } = require('../constants');

const VAT_RATE = 0.2;

const normalizeNumber = (value) => {
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

const normalizeBooleanFlag = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return !['0', 'false', 'non', 'off'].includes(lowered);
  }
  return value === undefined || value === null ? true : Boolean(value);
};

const buildDefaultEntries = (rows = []) => {
  const map = new Map(rows.map((row) => [row.category, row]));
  return LABOR_CATEGORIES.map((category) => {
    const existing = map.get(category.id);
    const hours = normalizeNumber(existing?.hours);
    const rate = normalizeNumber(existing?.rate);
    const withVat = normalizeBooleanFlag(existing?.withVat);
    const horsTaxe = hours * rate;
    const tva = withVat ? horsTaxe * VAT_RATE : 0;
    return {
      category: category.id,
      label: category.label,
      hours,
      rate,
      withVat,
      horsTaxe,
      tva,
      ttc: horsTaxe + tva,
    };
  });
};

const computeTotals = (entries, suppliesHt = 0, suppliesTtc = 0) => {
  const totalHours = entries.reduce((sum, item) => sum + item.hours, 0);
  const totalHt = entries.reduce((sum, item) => sum + item.horsTaxe, 0);
  const totalTva = entries.reduce((sum, item) => sum + item.tva, 0);
  const totalTtc = entries.reduce((sum, item) => sum + item.ttc, 0);
  const suppliesTva = Math.max(0, suppliesTtc - suppliesHt);
  return {
    totalHours,
    totalHt,
    totalTva,
    totalTtc,
    suppliesHt,
    suppliesTva,
    suppliesTtc,
    grandTotalHt: totalHt + suppliesHt,
    grandTotalTva: totalTva + suppliesTva,
    grandTotalTtc: totalTtc + suppliesTtc,
  };
};

const listLaborsByMission = async (missionId) => {
  const rows = await all(
    `SELECT category, hours, rate, avec_tva AS withVat
     FROM mission_labors
     WHERE mission_id = ?`,
    [missionId]
  );
  const suppliesRow = await get(
    'SELECT labor_supplies_ht AS supplies, labor_supplies_ttc AS suppliesTtc FROM missions WHERE id = ?',
    [missionId]
  );
  const suppliesHt = normalizeNumber(suppliesRow?.supplies);
  const suppliesTtc = normalizeNumber(suppliesRow?.suppliesTtc);
  const entries = buildDefaultEntries(rows);
  const totals = computeTotals(entries, suppliesHt, suppliesTtc);
  return { entries, totals };
};

const saveLabors = async (missionId, { entries = [], suppliesHt = 0, suppliesTtc = 0 }) => {
  const suppliedMap = new Map(
    (entries || []).map((entry) => [
      entry.category,
      {
        hours: normalizeNumber(entry.hours),
        rate: normalizeNumber(entry.rate),
        withVat: normalizeBooleanFlag(entry.withVat),
      },
    ])
  );
  const txEntries = LABOR_CATEGORIES.map((category) => {
    const payload = suppliedMap.get(category.id) || { hours: 0, rate: 0, withVat: true };
    return {
      category: category.id,
      hours: payload.hours,
      rate: payload.rate,
      withVat: payload.withVat,
    };
  });

  for (const entry of txEntries) {
    await run(
      `INSERT INTO mission_labors (mission_id, category, hours, rate, avec_tva)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(mission_id, category) DO UPDATE SET
          hours = excluded.hours,
          rate = excluded.rate,
          avec_tva = excluded.avec_tva,
          updated_at = CURRENT_TIMESTAMP`,
      [missionId, entry.category, entry.hours, entry.rate, entry.withVat ? 1 : 0]
    );
  }
  await run('UPDATE missions SET labor_supplies_ht = ? WHERE id = ?', [
    normalizeNumber(suppliesHt),
    missionId,
  ]);
  await run('UPDATE missions SET labor_supplies_ttc = ? WHERE id = ?', [
    normalizeNumber(suppliesTtc),
    missionId,
  ]);
  return listLaborsByMission(missionId);
};

module.exports = {
  listLaborsByMission,
  saveLabors,
};
