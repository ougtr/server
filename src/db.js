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
      vehicule_annee TEXT,
      vehicule_vin TEXT,
      vehicule_kilometrage INTEGER,
      vehicule_puissance_fiscale TEXT,
      vehicule_energie TEXT,
      garantie_type TEXT,
      garantie_franchise_taux REAL,
      garantie_franchise_montant REAL,
      responsabilite TEXT,
      reforme_type TEXT,
      valeur_assuree REAL,
      valeur_venale REAL,
      valeur_epaves REAL,
      indemnisation_finale REAL,
      synthese TEXT,
      sinistre_type TEXT,
      sinistre_circonstances TEXT,
      sinistre_date TEXT,
      sinistre_police TEXT,
      sinistre_police_adverse TEXT,
      sinistre_nom_adverse TEXT,
      sinistre_immatriculation_adverse TEXT,
      garage_nom TEXT,
      garage_adresse TEXT,
      garage_contact TEXT,
      agent_id INTEGER,
      assureur_id INTEGER,
      assureur_agence_id INTEGER,
      assureur_agence_nom TEXT,
      assureur_agence_adresse TEXT,
      assureur_agence_contact TEXT,
      assureur_adverse_id INTEGER,
      assureur_adverse_nom TEXT,
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

  await run(`
    CREATE TABLE IF NOT EXISTS insurer_agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insurer_id INTEGER NOT NULL,
      nom TEXT NOT NULL,
      adresse TEXT,
      telephone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(insurer_id) REFERENCES insurers(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS mission_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      fichier TEXT NOT NULL,
      nom_original TEXT,
      mime_type TEXT,
      uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS mission_labors (
      mission_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      hours REAL NOT NULL DEFAULT 0,
      rate REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (mission_id, category),
      FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS mission_damages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mission_id INTEGER NOT NULL,
      piece TEXT NOT NULL,
      price_ht REAL NOT NULL DEFAULT 0,
      vetuste REAL NOT NULL DEFAULT 0,
      piece_type TEXT,
      avec_tva INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(mission_id) REFERENCES missions(id) ON DELETE CASCADE
    )
  `);

  try {
    await run('CREATE INDEX IF NOT EXISTS idx_mission_damages_mission ON mission_damages(mission_id)');
  } catch (error) {
    // ignore
  }

  try {
    await run('ALTER TABLE mission_damages ADD COLUMN piece_type TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE mission_damages ADD COLUMN avec_tva INTEGER NOT NULL DEFAULT 1');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

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
    await run('ALTER TABLE missions ADD COLUMN sinistre_police_adverse TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN labor_supplies_ht REAL DEFAULT 0');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_adverse_id INTEGER');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_adverse_nom TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN sinistre_nom_adverse TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN sinistre_immatriculation_adverse TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN vehicule_vin TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN vehicule_kilometrage INTEGER');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN vehicule_puissance_fiscale TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN vehicule_energie TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN garantie_type TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN garantie_franchise_taux REAL');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN garantie_franchise_montant REAL');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN responsabilite TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN reforme_type TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN valeur_assuree REAL');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN valeur_venale REAL');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN valeur_epaves REAL');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN synthese TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN indemnisation_finale REAL');
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

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_agence_id INTEGER');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_agence_nom TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_agence_adresse TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('ALTER TABLE missions ADD COLUMN assureur_agence_contact TEXT');
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) {
      throw error;
    }
  }

  try {
    await run('CREATE INDEX IF NOT EXISTS idx_agencies_insurer ON insurer_agencies(insurer_id)');
  } catch (error) {
    // ignore index errors
  }

};

module.exports = {
  db,
  run,
  get,
  all,
  initializeDatabase,
};





