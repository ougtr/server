const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { authenticate, authorizeRoles } = require('../middleware/auth');
const missionService = require('../services/missionService');
const { addPhotos, listPhotosByMission, getPhotoById, deletePhoto } = require('../services/photoService');
const { ROLES, MISSION_STATUSES, PHOTO_LABELS } = require('../constants');
const { UPLOAD_DIR } = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const missionDir = path.join(UPLOAD_DIR, req.params.id);
    fs.mkdirSync(missionDir, { recursive: true });
    cb(null, missionDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `mission-${req.params.id}-${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

router.use(authenticate);

const loadMissionForUser = async (req, res, next) => {
  try {
    const mission = await missionService.getMissionById(req.params.id);
    if (!mission) {
      return res.status(404).json({ message: 'Mission introuvable' });
    }

    if (req.user.role === ROLES.AGENT && mission.agentId !== req.user.id) {
      return res.status(403).json({ message: 'Acces refuse' });
    }

    req.mission = mission;
    next();
  } catch (error) {
    next(error);
  }
};

router.get('/', async (req, res) => {
  const { statut, agentId, fromDate, toDate, keyword } = req.query;
  const trimmedKeyword = typeof keyword === 'string' ? keyword.trim() : '';

  if (trimmedKeyword && trimmedKeyword.length < 3) {
    return res.status(400).json({ message: 'Le mot-cle doit contenir au moins 3 caracteres' });
  }


  try {
    const missions = await missionService.listMissions({
      role: req.user.role,
      userId: req.user.id,
      filters: {
        statut,
        agentId,
        fromDate,
        toDate,
        keyword: trimmedKeyword || undefined,
      },
    });
    res.json({ missions, statuses: MISSION_STATUSES, photoLabels: PHOTO_LABELS });
  } catch (error) {
    res.status(500).json({ message: 'Impossible de recuperer les missions' });
  }
});

router.get('/:id', loadMissionForUser, async (req, res) => {
  try {
    const photos = await listPhotosByMission(req.params.id);
    res.json({ mission: req.mission, photos, photoLabels: PHOTO_LABELS });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la recuperation de la mission' });
  }
});

router.post('/', authorizeRoles(ROLES.GESTIONNAIRE), async (req, res) => {
  try {
    const mission = await missionService.createMission(req.body, req.user.id);
    res.status(201).json(mission);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', authorizeRoles(ROLES.GESTIONNAIRE), async (req, res) => {
  try {
    const existing = await missionService.getMissionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Mission introuvable' });
    }

    const mission = await missionService.updateMission(req.params.id, req.body || {});
    res.json(mission);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id/status', loadMissionForUser, async (req, res) => {
  const { statut } = req.body;
  if (!statut) {
    return res.status(400).json({ message: 'Nouveau statut requis' });
  }

  if (!MISSION_STATUSES.includes(statut)) {
    return res.status(400).json({ message: 'Statut invalide' });
  }

  if (statut === 'terminee' && req.user.role !== ROLES.GESTIONNAIRE) {
    return res.status(403).json({ message: 'Seul le gestionnaire peut cloturer la mission' });
  }

  try {
    const updated = await missionService.updateMissionStatus(req.params.id, statut);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', authorizeRoles(ROLES.GESTIONNAIRE), async (req, res) => {
  try {
    const existing = await missionService.getMissionById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Mission introuvable' });
    }

    await missionService.deleteMission(req.params.id);

    try {
      const missionDir = path.join(UPLOAD_DIR, req.params.id);
      if (fs.existsSync(missionDir)) {
        fs.rmSync(missionDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.error('Suppression des fichiers mission impossible', err);
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la mission' });
  }
});

router.post(
  '/:id/photos',
  loadMissionForUser,
  upload.array('photos', 10),
  async (req, res) => {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: 'Aucun fichier recu' });
    }

    const phase = req.body.phase === 'apres' ? 'apres' : 'avant';
    const label = (req.body.label || '').trim();

    if (!label) {
      return res.status(400).json({ message: 'Libelle de photo requis' });
    }

    if (!PHOTO_LABELS.includes(label)) {
      return res.status(400).json({ message: 'Libelle de photo inconnu' });
    }

    try {
      const files = req.files.map((file) => ({
        ...file,
        relativePath: `${req.params.id}/${file.filename}`,
      }));

      const saved = await addPhotos({
        missionId: req.params.id,
        files,
        phase,
        label,
        uploadedBy: req.user.id,
      });

      let mission = req.mission;
      if (
        req.user.role === ROLES.AGENT &&
        mission.statut !== 'terminee' &&
        mission.statut !== 'en_cours'
      ) {
        mission = await missionService.updateMissionStatus(req.params.id, 'en_cours');
      } else {
        mission = await missionService.getMissionById(req.params.id);
      }

      const photos = await listPhotosByMission(req.params.id);
      res.status(201).json({ photos, mission });
    } catch (error) {
      res.status(500).json({ message: 'Erreur lors de lenregistrement des photos' });
    }
  }
);

router.delete('/:id/photos/:photoId', loadMissionForUser, async (req, res) => {
  try {
    const photo = await getPhotoById(req.params.photoId);
    if (!photo || photo.missionId !== Number(req.params.id)) {
      return res.status(404).json({ message: 'Photo introuvable' });
    }

    const absolutePath = path.join(UPLOAD_DIR, photo.fichier);
    try {
      fs.unlinkSync(absolutePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Impossible de supprimer le fichier photo', err);
      }
    }

    await deletePhoto(photo.id);
    const photos = await listPhotosByMission(req.params.id);
    const mission = await missionService.getMissionById(req.params.id);
    res.json({ photos, mission });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la photo' });
  }
});

module.exports = router;




