const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const { TENANT_ADMIN_ROLES } = require('../constants');
const { UPLOAD_DIR } = require('../config');
const tenantService = require('../services/tenantService');

const router = express.Router();

const sanitizeFilename = (value) => String(value || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantDir = path.join(UPLOAD_DIR, 'tenants', String(req.tenantId));
    fs.mkdirSync(tenantDir, { recursive: true });
    cb(null, tenantDir);
  },
  filename: (req, file, cb) => {
    cb(null, `settings-${file.fieldname}-${Date.now()}-${sanitizeFilename(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      cb(new Error('Seuls les fichiers image sont autorises'));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate, authorizeRoles(...TENANT_ADMIN_ROLES));

router.get('/me', async (req, res) => {
  try {
    const settings = await tenantService.getTenantSettings(req.tenantId);
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put(
  '/me',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'cachet', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const payload = { ...(req.body || {}) };
      const logo = req.files?.logo?.[0];
      const cachet = req.files?.cachet?.[0];

      if (logo) {
        payload.logoPath = path.posix.join('tenants', String(req.tenantId), logo.filename);
      }
      if (cachet) {
        payload.cachetPath = path.posix.join('tenants', String(req.tenantId), cachet.filename);
      }

      const settings = await tenantService.updateTenantSettings(req.tenantId, payload);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

module.exports = router;
