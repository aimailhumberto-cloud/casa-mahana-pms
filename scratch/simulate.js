const { getDb } = require('../server/db/database');
const db = getDb();

// Let's change reservation 40 to Confirmada
db.prepare("UPDATE reservas_hotel SET estado = 'Confirmada' WHERE id = 40").run();
// Let's change reservation 39 to Cancelada
db.prepare("UPDATE reservas_hotel SET estado = 'Cancelada' WHERE id = 39").run();

console.log('Updated reservation 40 to Confirmada, and 39 to Cancelada');

const all = db.prepare("SELECT id, cliente, estado, fuente FROM reservas_hotel WHERE id >= 38").all();
console.log('Query without estado filter (id >= 38):');
console.log(all);
