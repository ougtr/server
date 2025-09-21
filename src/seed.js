const readline = require('readline');
const { initializeDatabase } = require('./db');
const { createUser, getUserByLogin } = require('./services/userService');
const { ROLES } = require('./constants');

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
};

const seed = async () => {
  await initializeDatabase();
  const existing = await getUserByLogin('admin');
  if (existing) {
    console.log('Un compte admin existe deja.');
    return;
  }

  const password = await askQuestion('Mot de passe pour le compte admin (defaut admin123): ');
  const finalPassword = password.trim() || 'admin123';
  await createUser({ login: 'admin', password: finalPassword, role: ROLES.GESTIONNAIRE });
  console.log('Compte admin cree (login: admin).');
};

seed().catch((err) => {
  console.error('Erreur lors du seed', err);
  process.exit(1);
});
