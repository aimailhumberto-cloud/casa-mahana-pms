const { getDb } = require('./server/db/database');
const db = getDb();

console.log('=== Reservas por tipo habitacion ===');
db.prepare("SELECT tipo_habitacion, COUNT(*) as res, SUM(noches) as noches, ROUND(SUM(monto_total)) as ing FROM reservas_hotel GROUP BY tipo_habitacion ORDER BY noches DESC").all().forEach(r => {
  console.log(`  ${r.tipo_habitacion}: ${r.res} res, ${r.noches} noches, $${r.ing}`);
});

console.log('\n=== Habitaciones Estadia por tipo ===');
db.prepare("SELECT tipo, COUNT(*) as c FROM habitaciones WHERE activa=1 AND categoria='Estadía' GROUP BY tipo").all().forEach(r => {
  console.log(`  ${r.tipo}: ${r.c} habitaciones`);
});

console.log('\n=== Proporcion esperada ===');
const total = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE activa=1 AND categoria='Estadía'").get().c;
db.prepare("SELECT tipo, COUNT(*) as c FROM habitaciones WHERE activa=1 AND categoria='Estadía' GROUP BY tipo").all().forEach(r => {
  console.log(`  ${r.tipo}: ${((r.c / total) * 100).toFixed(0)}% de habitaciones`);
});

console.log('\n=== Reservas Camping sample ===');
db.prepare("SELECT id, cliente, check_in, check_out, noches, monto_total, tipo_habitacion FROM reservas_hotel WHERE tipo_habitacion='Camping' ORDER BY noches DESC LIMIT 10").all().forEach(r => {
  console.log(`  #${r.id} ${r.cliente} ${r.check_in}->${r.check_out} ${r.noches}n $${r.monto_total}`);
});

// The issue: camping has 20 rooms out of 32 total = 62.5% of rooms
// So they get 62.5% of all reservations by the rotation logic
// But in reality camping probably has lower revenue per booking
console.log('\n=== Diagnostico ===');
const camping = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE tipo='Camping' AND activa=1").get().c;
const totalR = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE activa=1 AND categoria='Estadía'").get().c;
console.log(`  Camping: ${camping}/${totalR} habitaciones = ${((camping/totalR)*100).toFixed(0)}%`);
console.log(`  El script de migracion rota ROUND-ROBIN por las ${totalR} habitaciones`);
console.log(`  Camping recibe ~${((camping/totalR)*100).toFixed(0)}% de todas las reservas`);
