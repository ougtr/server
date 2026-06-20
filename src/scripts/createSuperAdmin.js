const { initializeDatabase } = require('../db');
const { ROLES } = require('../constants');
const { createUser, getUserByLogin } = require('../services/userService');

const [, , loginArg, passwordArg] = process.argv;

const login = (process.env.SUPER_ADMIN_LOGIN || loginArg || 'superadmin').trim();
const password = process.env.SUPER_ADMIN_PASSWORD || passwordArg;

const main = async () => {
  if (!password || password.length < 6) {
    throw new Error(
      'Mot de passe super admin requis (6 caracteres minimum). Exemple: npm run create-super-admin -- superadmin secret123'
    );
  }

  await initializeDatabase();
  const existing = await getUserByLogin(login);
  if (existing) {
    console.log(`Le compte ${login} existe deja.`);
    return;
  }

  await createUser({
    login,
    password,
    role: ROLES.SUPER_ADMIN,
  });
  console.log(`Compte super admin cree: ${login}`);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
