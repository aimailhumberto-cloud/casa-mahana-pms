const { getDb } = require('../server/db/database');
const db = getDb();
console.log('=== RESERVAS POR ESTADO ===');
const states = db.prepare("SELECT estado, COUNT(*) as c FROM reservas_hotel GROUP BY estado").all();
console.log(states);

console.log('\n=== RECENT RESERVAS ===');
const recent = db.prepare("SELECT id, cliente, estado, fuente, check_in FROM reservas_hotel ORDER BY id DESC LIMIT 20").all();
console.log(recent);
