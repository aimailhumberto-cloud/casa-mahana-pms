/**
 * ONE-TIME MIGRATION: Transform huespedes (Cloudbeds guest directory)
 * into historical reservas_hotel records.
 * 
 * For each guest:
 *   - Creates N reservations (total_reservas) spread over time
 *   - Distributes their total_ingresos and noches_estadia across those reservations
 *   - Assigns rooms rotating through available Estadía rooms
 *   - Sets estado='Check-Out', fuente='Cloudbeds', created_by='Cloudbeds Import'
 *   - Creates folio entries (pagos) so financial reports work
 *   
 * The ultima_estadia is used as anchor; earlier stays are spaced backwards.
 */

const { getDb } = require('./server/db/database');
const db = getDb();

// ── Get all Estadía rooms for assignment ──
const rooms = db.prepare(`
  SELECT id, nombre, tipo FROM habitaciones 
  WHERE categoria = 'Estadía' AND activa = 1 AND tipo != 'Camping'
`).all();

if (rooms.length === 0) {
  console.error('❌ No hay habitaciones de Estadía activas');
  process.exit(1);
}

// ── Get all guests with reservations ──
const guests = db.prepare(`
  SELECT * FROM huespedes 
  WHERE total_reservas > 0 AND total_ingresos > 0
  ORDER BY ultima_estadia DESC
`).all();

console.log(`\n🔄 Migración Histórica — Cloudbeds → Reservas`);
console.log(`   ${guests.length} huéspedes con reservas`);
console.log(`   ${rooms.length} habitaciones disponibles`);

// ── Check if already migrated ──
const existing = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'").get();
if (existing.c > 0) {
  console.log(`\n⚠️  Ya existen ${existing.c} reservas importadas de Cloudbeds.`);
  console.log(`   Para re-ejecutar, primero elimina las existentes:`);
  console.log(`   DELETE FROM folio_hotel WHERE reserva_id IN (SELECT id FROM reservas_hotel WHERE created_by = 'Cloudbeds Import');`);
  console.log(`   DELETE FROM reservas_hotel WHERE created_by = 'Cloudbeds Import';`);
  process.exit(1);
}

// ── Helper: add days to a date string ──
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Prepared statements ──
const insertReserva = db.prepare(`
  INSERT INTO reservas_hotel (
    cliente, apellido, email, telefono, nacionalidad,
    habitacion_id, tipo_habitacion,
    check_in, check_out, noches,
    adultos, menores, mascotas,
    plan_nombre,
    subtotal, impuesto_pct, impuesto_monto, monto_total,
    monto_pagado, saldo_pendiente,
    estado, fuente, notas, created_by, created_at
  ) VALUES (
    ?, ?, ?, ?, ?,
    ?, ?,
    ?, ?, ?,
    ?, 0, 0,
    ?,
    ?, 10, ?, ?,
    ?, 0,
    'Check-Out', 'Cloudbeds', ?, 'Cloudbeds Import', ?
  )
`);

const insertFolio = db.prepare(`
  INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, registrado_por, fecha, created_at)
  VALUES (?, 'credito', 'Pago histórico Cloudbeds', ?, 'Histórico', 'Cloudbeds Import', ?, ?)
`);

// ── Run migration in a transaction ──
let totalReservas = 0;
let totalIngresos = 0;
let roomIdx = 0;

const txn = db.transaction(() => {
  for (const guest of guests) {
    const numReservas = Math.max(1, guest.total_reservas || 1);
    const totalNoches = Math.max(numReservas, guest.noches_estadia || numReservas);
    const totalRevenue = guest.total_ingresos || 0;

    // Average per reservation
    const avgNoches = Math.max(1, Math.round(totalNoches / numReservas));
    const avgRevenue = Math.round((totalRevenue / numReservas) * 100) / 100;

    // Anchor date: ultima_estadia or a default
    let anchor = guest.ultima_estadia;
    if (!anchor || anchor.length < 8) anchor = '2024-06-01';

    // For each reservation, work backwards from anchor
    for (let i = 0; i < numReservas; i++) {
      // Spacing: each earlier reservation is ~45 days before the previous
      const dayOffset = i * (avgNoches + 30 + Math.floor(Math.random() * 30));
      const checkOut = addDays(anchor, -dayOffset);
      const checkIn = addDays(checkOut, -avgNoches);
      
      // Assign room (rotate through all Estadía rooms)
      const room = rooms[roomIdx % rooms.length];
      roomIdx++;

      // Revenue for this reservation (last one gets the remainder)
      let thisRevenue;
      if (i === numReservas - 1 && numReservas > 1) {
        thisRevenue = Math.round((totalRevenue - avgRevenue * (numReservas - 1)) * 100) / 100;
        if (thisRevenue < 0) thisRevenue = avgRevenue;
      } else {
        thisRevenue = avgRevenue;
      }

      const subtotal = Math.round(thisRevenue / 1.10 * 100) / 100; // Remove 10% tax
      const tax = Math.round((thisRevenue - subtotal) * 100) / 100;

      const nota = `Historial importado Cloudbeds • Estadía #${i + 1}/${numReservas}`;
      const createdAt = checkIn + 'T08:00:00';

      const result = insertReserva.run(
        guest.nombre, guest.apellido || '', guest.email || '', guest.telefono || '', guest.pais || '',
        room.id, room.tipo,
        checkIn, checkOut, avgNoches,
        Math.min(2, Math.max(1, Math.ceil(thisRevenue / 150))), // estimated adults
        'Estadía Todo Incluido',
        subtotal, tax, thisRevenue,
        thisRevenue,
        nota, createdAt
      );

      // Create a payment in folio
      insertFolio.run(result.lastInsertRowid, thisRevenue, checkIn, createdAt);

      totalReservas++;
      totalIngresos += thisRevenue;
    }
  }
});

console.log('\n⏳ Ejecutando migración...');
txn();

console.log(`\n✅ Migración completada!`);
console.log(`   ${totalReservas.toLocaleString()} reservas históricas creadas`);
console.log(`   $${totalIngresos.toLocaleString(undefined, { minimumFractionDigits: 2 })} en ingresos históricos`);
console.log(`   ${rooms.length} habitaciones utilizadas (rotación)`);

// ── Verify ──
const stats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    MIN(check_in) as desde,
    MAX(check_out) as hasta,
    SUM(monto_total) as ingresos,
    SUM(noches) as noches
  FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'
`).get();

console.log(`\n📊 Verificación:`);
console.log(`   Rango: ${stats.desde} → ${stats.hasta}`);
console.log(`   Total reservas: ${stats.total}`);
console.log(`   Total noches: ${stats.noches}`);
console.log(`   Total ingresos: $${stats.ingresos?.toLocaleString()}`);

// Show occupancy by year
const byYear = db.prepare(`
  SELECT SUBSTR(check_in, 1, 4) as year, 
         COUNT(*) as reservas, 
         SUM(noches) as noches, 
         ROUND(SUM(monto_total)) as ingresos
  FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'
  GROUP BY SUBSTR(check_in, 1, 4) ORDER BY year
`).all();

console.log(`\n📅 Por año:`);
byYear.forEach(y => console.log(`   ${y.year}: ${y.reservas} reservas, ${y.noches} noches, $${y.ingresos?.toLocaleString()}`));

// Show by room type
const byType = db.prepare(`
  SELECT tipo_habitacion, COUNT(*) as reservas, ROUND(SUM(monto_total)) as ingresos
  FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'
  GROUP BY tipo_habitacion ORDER BY reservas DESC
`).all();

console.log(`\n🏨 Por tipo de habitación:`);
byType.forEach(t => console.log(`   ${t.tipo_habitacion}: ${t.reservas} reservas, $${t.ingresos?.toLocaleString()}`));
