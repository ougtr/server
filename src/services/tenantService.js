const { run, get, all } = require('../db');
const { createUser } = require('./userService');
const { ROLES } = require('../constants');

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const mapTenant = (row) =>
  row
    ? {
        id: row.id,
        nom: row.nom,
        slug: row.slug,
        actif: Number(row.actif) === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

const SETTING_FIELDS = [
  ['cabinetNom', 'cabinet_nom'],
  ['cabinetAdresse', 'cabinet_adresse'],
  ['cabinetTelephone', 'cabinet_telephone'],
  ['cabinetEmail', 'cabinet_email'],
  ['cabinetSiteWeb', 'cabinet_site_web'],
  ['rib', 'rib'],
  ['banque', 'banque'],
  ['logoPath', 'logo_path'],
  ['cachetPath', 'cachet_path'],
  ['ice', 'ice'],
  ['identifiantFiscal', 'identifiant_fiscal'],
  ['registreCommerce', 'registre_commerce'],
  ['cnss', 'cnss'],
  ['expertNom', 'expert_nom'],
  ['villeDefaut', 'ville_defaut'],
  ['missionReferencePrefix', 'mission_reference_prefix'],
  ['rapportCouleurPrimaire', 'rapport_couleur_primaire'],
  ['rapportCouleurSecondaire', 'rapport_couleur_secondaire'],
  ['mentionsLegales', 'mentions_legales'],
  ['rapportFooter', 'rapport_footer'],
];

const mapTenantSettings = (row) => {
  if (!row) {
    return null;
  }
  return SETTING_FIELDS.reduce(
    (acc, [apiName, columnName]) => ({
      ...acc,
      [apiName]: row[columnName] || '',
    }),
    {
      tenantId: row.tenant_id,
      updatedAt: row.updated_at,
    }
  );
};

const listTenants = async () => {
  const rows = await all('SELECT * FROM tenants ORDER BY nom ASC');
  return rows.map(mapTenant);
};

const getTenantById = async (id) => mapTenant(await get('SELECT * FROM tenants WHERE id = ?', [id]));

const ensureTenantSettings = async (tenantId) => {
  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    throw new Error('Cabinet introuvable');
  }
  await run(
    `INSERT OR IGNORE INTO tenant_settings (tenant_id, cabinet_nom)
     VALUES (?, ?)`,
    [tenantId, tenant.nom]
  );
};

const getTenantSettings = async (tenantId) => {
  await ensureTenantSettings(tenantId);
  return mapTenantSettings(await get('SELECT * FROM tenant_settings WHERE tenant_id = ?', [tenantId]));
};

const createTenant = async ({ nom, slug, adminLogin, adminPassword }) => {
  const sanitizedName = String(nom || '').trim();
  if (!sanitizedName) {
    throw new Error('Nom du cabinet requis');
  }
  const sanitizedSlug = slugify(slug || sanitizedName);
  if (!sanitizedSlug) {
    throw new Error('Identifiant cabinet invalide');
  }

  const result = await run(
    `INSERT INTO tenants (nom, slug)
     VALUES (?, ?)`,
    [sanitizedName, sanitizedSlug]
  );
  await run(
    `INSERT OR IGNORE INTO tenant_settings (tenant_id, cabinet_nom)
     VALUES (?, ?)`,
    [result.id, sanitizedName]
  );

  if (adminLogin && adminPassword) {
    await createUser({
      login: adminLogin,
      password: adminPassword,
      role: ROLES.ADMIN_CABINET,
      tenantId: result.id,
    });
  }

  return getTenantById(result.id);
};

const updateTenant = async (id, { nom, actif }) => {
  const updates = [];
  const params = [];

  if (typeof nom !== 'undefined') {
    const sanitizedName = String(nom || '').trim();
    if (!sanitizedName) {
      throw new Error('Nom du cabinet requis');
    }
    updates.push('nom = ?');
    params.push(sanitizedName);
    await run('UPDATE tenant_settings SET cabinet_nom = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ?', [
      sanitizedName,
      id,
    ]);
  }

  if (typeof actif !== 'undefined') {
    updates.push('actif = ?');
    params.push(actif ? 1 : 0);
  }

  if (!updates.length) {
    return getTenantById(id);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  await run(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params);
  return getTenantById(id);
};

const updateTenantSettings = async (tenantId, payload = {}) => {
  await ensureTenantSettings(tenantId);

  const updates = [];
  const params = [];

  SETTING_FIELDS.forEach(([apiName, columnName]) => {
    if (!Object.prototype.hasOwnProperty.call(payload, apiName)) {
      return;
    }
    updates.push(`${columnName} = ?`);
    const value = payload[apiName];
    params.push(value === null || value === undefined ? null : String(value).trim());
  });

  if (!updates.length) {
    return getTenantSettings(tenantId);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(tenantId);
  await run(`UPDATE tenant_settings SET ${updates.join(', ')} WHERE tenant_id = ?`, params);

  if (Object.prototype.hasOwnProperty.call(payload, 'cabinetNom')) {
    const nextName = String(payload.cabinetNom || '').trim();
    if (nextName) {
      await run('UPDATE tenants SET nom = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextName, tenantId]);
    }
  }

  return getTenantSettings(tenantId);
};

module.exports = {
  listTenants,
  getTenantById,
  getTenantSettings,
  createTenant,
  updateTenant,
  updateTenantSettings,
};
