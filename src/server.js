const app = require('./app');
const { PORT } = require('./config');
const { initializeDatabase } = require('./db');

const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`API demarree sur le port ${PORT}`);
    });
  } catch (error) {
    console.error('Impossible de démarrer le serveur', error);
    process.exit(1);
  }
};

startServer();

