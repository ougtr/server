const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { UPLOAD_DIR } = require('./config');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const missionRoutes = require('./routes/missions');
const insurerRoutes = require('./routes/insurers');
const vehicleBrandRoutes = require('./routes/vehicleBrands');
const garageRoutes = require('./routes/garages');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(UPLOAD_DIR));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/insurers', insurerRoutes);
app.use('/api/vehicle-brands', vehicleBrandRoutes);
app.use('/api/garages', garageRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
});

module.exports = app;

