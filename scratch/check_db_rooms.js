const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');

const db = new Database(DB_PATH);

try {
  const rooms = db.prepare('SELECT id, nombre, tipo, categoria, activa FROM habitaciones').all();
  console.log("Habitaciones registradas en la DB:");
  console.log(rooms);
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
