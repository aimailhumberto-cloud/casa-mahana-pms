const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');

const db = new Database(DB_PATH);

try {
  const count = db.prepare("SELECT COUNT(*) as count FROM reservas_hotel").get().count;
  console.log("Total reservaciones importadas en la DB:", count);
  
  if (count > 0) {
    const sample = db.prepare(`
      SELECT r.id, r.cliente, r.apellido, r.tipo_habitacion, h.nombre as room_name, h.tipo as room_type, r.created_by
      FROM reservas_hotel r
      LEFT JOIN habitaciones h ON r.habitacion_id = h.id
      ORDER BY r.id DESC LIMIT 20
    `).all();
    console.log("Últimas 20 reservaciones importadas:");
    console.log(sample);
  }
} catch (e) {
  console.error(e);
} finally {
  db.close();
}
