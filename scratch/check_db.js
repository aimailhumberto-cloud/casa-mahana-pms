const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/casa-mahana.db');
console.log('Opening database at:', dbPath);

try {
  const db = new Database(dbPath, { fileMustExist: true });
  const rows = db.prepare("SELECT clave, valor FROM config_hotel WHERE clave LIKE 'paypal%'").all();
  console.log('PayPal keys found in DB:', rows);
} catch (err) {
  console.error('Error opening DB or querying:', err.message);
}
