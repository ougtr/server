const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getUserByLogin } = require('../services/userService');
const { JWT_SECRET } = require('../config');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (!login || !password) {
    return res.status(400).json({ message: 'Login et mot de passe requis' });
  }

  try {
    const user = await getUserByLogin(login.trim());
    if (!user) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Identifiants invalides' });
    }

    const payload = { id: user.id, login: user.login, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, user: payload });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la connexion' });
  }
});

module.exports = router;
