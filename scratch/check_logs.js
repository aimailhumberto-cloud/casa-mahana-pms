const { getDb } = require('../server/db/database');
const db = getDb();
try {
  const rows = db.prepare('SELECT id, reserva_id, tipo, canal, destinatario, resultado, SUBSTR(contenido, 1, 100) as cont_preview FROM notificaciones_log ORDER BY id DESC LIMIT 5').all();
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.error('Error fetching logs:', e);
}
