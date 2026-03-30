/**
 * FIX: Redistribute historical reservations to non-Camping rooms only.
 * Cloudbeds data was hotel-style reservations (Familiar/Doble/Estándar),
 * not camping. The original round-robin assigned 63% to Camping which is wrong.
 */
const { getDb } = require('./server/db/database');
const db = getDb();

// Delete existing imports
console.log('🗑️ Eliminando reservas Cloudbeds Import existentes...');
const deleted1 = db.prepare("DELETE FROM folio_hotel WHERE reserva_id IN (SELECT id FROM reservas_hotel WHERE created_by = 'Cloudbeds Import')").run();
const deleted2 = db.prepare("DELETE FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'").run();
console.log(`   Eliminados: ${deleted2.changes} reservas, ${deleted1.changes} folios`);

// Only use non-camping rooms (Familiar, Doble, Estándar)
const rooms = db.prepare(`
  SELECT id, nombre, tipo FROM habitaciones 
  WHERE categoria = 'Estadía' AND activa = 1 AND tipo != 'Camping'
`).all();

console.log(`\n🔄 Re-migración con ${rooms.length} habitaciones (sin Camping):`);
rooms.forEach(r => console.log(`   ${r.nombre} (${r.tipo})`));

const guests = db.prepare("SELECT * FROM huespedes WHERE total_reservas > 0 AND total_ingresos > 0 ORDER BY ultima_estadia DESC").all();

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

const insertR = db.prepare(`INSERT INTO reservas_hotel (cliente, apellido, email, telefono, nacionalidad, habitacion_id, tipo_habitacion, check_in, check_out, noches, adultos, menores, mascotas, plan_nombre, subtotal, impuesto_pct, impuesto_monto, monto_total, monto_pagado, saldo_pendiente, estado, fuente, notas, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,10,?,?,?,0,'Check-Out','Cloudbeds',?,'Cloudbeds Import',?)`);
const insertF = db.prepare("INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, registrado_por, fecha, created_at) VALUES (?,'credito','Pago histórico Cloudbeds',?,'Histórico','Cloudbeds Import',?,?)");

let total = 0, revenue = 0, ri = 0;
const txn = db.transaction(() => {
  for (const g of guests) {
    const nr = Math.max(1, g.total_reservas || 1);
    const tn = Math.max(nr, g.noches_estadia || nr);
    const tr = g.total_ingresos || 0;
    const an = Math.max(1, Math.round(tn / nr));
    const ar = Math.round((tr / nr) * 100) / 100;
    let anchor = g.ultima_estadia;
    if (!anchor || anchor.length < 8) anchor = '2024-06-01';

    for (let i = 0; i < nr; i++) {
      const off = i * (an + 30 + Math.floor(Math.random() * 30));
      const co = addDays(anchor, -off);
      const ci = addDays(co, -an);
      const room = rooms[ri % rooms.length]; ri++;
      let rev = i === nr - 1 && nr > 1 ? Math.round((tr - ar * (nr - 1)) * 100) / 100 : ar;
      if (rev < 0) rev = ar;
      const sub = Math.round(rev / 1.10 * 100) / 100;
      const tax = Math.round((rev - sub) * 100) / 100;
      const r = insertR.run(g.nombre, g.apellido||'', g.email||'', g.telefono||'', g.pais||'', room.id, room.tipo, ci, co, an, Math.min(2, Math.max(1, Math.ceil(rev/150))), 'Estadía Todo Incluido', sub, tax, rev, rev, `Historial Cloudbeds #${i+1}/${nr}`, ci+'T08:00:00');
      insertF.run(r.lastInsertRowid, rev, ci, ci+'T08:00:00');
      total++; revenue += rev;
    }
  }
});

console.log('\n⏳ Ejecutando...');
txn();

console.log(`\n✅ Completado: ${total.toLocaleString()} reservas, $${revenue.toLocaleString()}`);

// Verify
db.prepare("SELECT tipo_habitacion, COUNT(*) as res, SUM(noches) as noches, ROUND(SUM(monto_total)) as ing FROM reservas_hotel WHERE created_by='Cloudbeds Import' GROUP BY tipo_habitacion ORDER BY res DESC").all().forEach(r => {
  console.log(`   ${r.tipo_habitacion}: ${r.res} res, ${r.noches} noches, $${r.ing}`);
});
