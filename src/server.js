const app = require('./app');
const { PORT } = require('./config');
const { initializeDatabase } = require('./db');
const { migrateExistingPhotoWatermarks } = require('./services/photoWatermarkService');

const startServer = async () => {
  try {
    await initializeDatabase();
    await migrateExistingPhotoWatermarks();
    app.listen(PORT, () => {
      console.log(`API demarree sur le port ${PORT}`);
    });
  } catch (error) {
    console.error('Impossible de démarrer le serveur', error);
    process.exit(1);
  }
};

startServer();

