const readline = require('readline');
const { initializeDatabase, run } = require('./db');
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

const defaultVehicleBrands = [
  'Toyota',
  'Volkswagen',
  'Mercedes-Benz',
  'BMW',
  'Audi',
  'Ford',
  'Chevrolet',
  'Honda',
  'Hyundai',
  'Kia',
  'Nissan',
  'Peugeot',
  'Renault',
  'Citroen',
  'Fiat',
  'Opel',
  'Volvo',
  'Jaguar',
  'Land Rover',
  'Porsche',
  'Ferrari',
  'Lamborghini',
  'Maserati',
  'Alfa Romeo',
  'Bentley',
  'Bugatti',
  'Aston Martin',
  'Rolls-Royce',
  'Tesla',
  'BYD',
  'Geely',
  'Great Wall',
  'Mazda',
  'Subaru',
  'Suzuki',
  'Mitsubishi',
  'Seat',
  'Skoda',
  'Dacia',
  'Mini',
  'Jeep',
  'Dodge',
  'RAM',
  'GMC',
  'Lexus',
  'Infiniti',
  'Acura',
  'Genesis',
  'SsangYong',
  'Mahindra',
  'Tata',
  'Chery',
  'Saab',
  'Smart',
  'Haval',
];

const seedVehicleBrands = async () => {
  for (const brand of defaultVehicleBrands) {
    await run('INSERT OR IGNORE INTO vehicle_brands (nom) VALUES (?)', [brand]);
  }
  console.log(`Marques inserees/verify : ${defaultVehicleBrands.length}`);
};

const defaultInsurers = [
  'Wafa Assurance',
  'RMA',
  'Mutuelle Taamine Chaabi',
  'Axa Assurance Maroc',
  'Sanlam Assurance',
  'AtlantaSanad',
  'MCMA',
  'Marocaine Vie',
  'Allianz Assurance Maroc',
  'MAMDA',
  'CAT',
  'MATU',
  'Maroc Assistance Internationale',
  'Africa First Assist',
  'Wafa Ima Assistance',
  'Euler Hermes ACMAR',
  'RMA Assistance',
  'Coface Maroc',
  'Axa Assistance Maroc',
  'Smaex',
  'Takafulia Assurance',
  'Wafa Takaful',
  'Al Maghribia Takaful',
  'Taawounyiate Taamine Takafuli',
];

const seedInsurers = async () => {
  for (const insurer of defaultInsurers) {
    await run('INSERT OR IGNORE INTO insurers (nom) VALUES (?)', [insurer]);
  }
  console.log(`Assureurs verifies : ${defaultInsurers.length}`);
};

const seed = async () => {
  await initializeDatabase();
  await seedInsurers();
  await seedVehicleBrands();
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
