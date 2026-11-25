const app = require('./app');
const { PORT } = require('./config');
const { initializeDatabase } = require('./db');
const { migrateExistingPhotoWatermarks } = require('./services/photoWatermarkService');

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`API demarree sur le port ${PORT}`);
      // Photo migration may take hours on large installations; keep the API available.
      setImmediate(() => {
        migrateExistingPhotoWatermarks().catch((error) => {
          console.error('Filigrane : reprise interrompue, nouvel essai au prochain demarrage.', error);
        });
      });
    });
  } catch (error) {
    console.error('Impossible de démarrer le serveur', error);
    process.exit(1);
  }
};

startServer();

