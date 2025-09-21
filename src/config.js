const path = require('path');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'gestion.db');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

module.exports = {
  PORT,
  JWT_SECRET,
  DB_PATH,
  UPLOAD_DIR,
};

s