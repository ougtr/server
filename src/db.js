const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('./config');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function runCallback(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

const initializeDatabase = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('GESTIONNAIRE', 'AGENT')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS insurers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE NOT NULL,
      contact TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS vehicle_brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS garages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT UNIQUE NOT NULL,
      adresse TEXT,
      contact TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assureur_nom TEXT NOT NULL,
      assureur_contact TEXT,
      assure_nom TEXT NOT NULL,
      assure_telephone TEXT,
      assure_email TEXT,
      vehicule_marque TEXT,
      vehicule_modele TEXT,
      vehicule_immatriculation TEXT,
      vehicule_annee INTEGER,
      sinistre_type TEXT,
      sinistre_circonstances TEXT,
      sinistre_date TEXT,
      sinistre_police TEXT,
      garage_nom TEXT,
      garage_adresse TEXT,
      garage_contact TEXT,
      agent_id INTEGER,
      assureur_id INTEGER,
      vehicule_marque_id INTEGER,
      garage_id INTEGER,
      statut TEXT NOT NULL DEFAULT 'cree' CHECK (statut IN ('cree', 'affectee', 'en_cours', 'terminee')),
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(agent_id) REFERENCES users(id),
      FOREIGN KEY(created_by) REFERENCES users(id),
      FOREIGN KEY(assureur_id) REFERENCES insurers(id),
      FOREIGN KEY(vehicule_marque_id) REFERENCES vehicle_brands(id),
      FOREIGN KEY(garage_id) REFERENCES garages(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS mission_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      fichier TEXT NOT NULL,
      phase TEXT CHECK (phase IN ('avant', 'apres')) DEFAULT 'avant',
      label TEXT,
      uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    )
  `);

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_id INTEGER');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN vehicule_marque_id INTEGER');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN garage_id INTEGER');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }
  try {
    await run('ALTER TABLE missions ADD COLUMN sinistre_police TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('CREATE INDEX IF NOT EXISTS idx_missions_assureur ON missions(assureur_id)');
  } catch (error) {
    // ignore index errors
  }

  try {
    await run('CREATE INDEX IF NOT EXISTS idx_missions_marque ON missions(vehicule_marque_id)');
  } catch (error) {
    // ignore index errors
  }

  try {
    await run('CREATE INDEX IF NOT EXISTS idx_missions_garage ON missions(garage_id)');
  } catch (error) {
    // ignore index errors
  }

  try {
    await run('ALTER TABLE mission_photos ADD COLUMN label TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }
};

module.exports = {
  db,
  run,
  get,
  all,
  initializeDatabase,
};





