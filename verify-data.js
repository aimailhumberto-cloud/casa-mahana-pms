const { getDb } = require('./server/db/database');
const db = getDb();

const t = db.prepare('SELECT COUNT(*) as c, SUM(monto_total) as i, SUM(noches) as n FROM reservas_hotel').get();
console.log('Total reservas:', t.c, '| Ingresos: $' + t.i?.toLocaleString(), '| Noches:', t.n);

const y = db.prepare("SELECT SUBSTR(check_in,1,4) as yr, COUNT(*) as r, ROUND(SUM(monto_total)) as i FROM reservas_hotel GROUP BY yr ORDER BY yr").all();
console.log('\nPor año:');
y.forEach(x => console.log(' ', x.yr, ':', x.r, 'res, $' + x.i?.toLocaleString()));

const f = db.prepare('SELECT COUNT(*) as c, ROUND(SUM(monto)) as t FROM folio_hotel').get();
console.log('\nFolios:', f.c, '| Total: $' + f.t?.toLocaleString());

const byRoom = db.prepare("SELECT h.nombre, h.tipo, COUNT(r.id) as res, SUM(r.noches) as noches FROM reservas_hotel r JOIN habitaciones h ON h.id=r.habitacion_id GROUP BY h.id ORDER BY res DESC LIMIT 10").all();
console.log('\nTop 10 habitaciones:');
byRoom.forEach(r => console.log(' ', r.nombre, r.tipo, ':', r.res, 'res,', r.noches, 'noches'));
