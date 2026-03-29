const { getDb } = require('./server/db/database');
const db = getDb();
const bugs = [];
const warnings = [];

// 1. Data integrity
const nullHab = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE habitacion_id IS NULL").get().c;
if (nullHab > 0) bugs.push('Reservas sin habitacion_id: ' + nullHab);

const badDates = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE check_in > check_out").get().c;
if (badDates > 0) bugs.push('Reservas check_in > check_out: ' + badDates);

const badNoches = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE noches != CAST(julianday(check_out) - julianday(check_in) AS INTEGER) AND noches IS NOT NULL").get().c;
if (badNoches > 0) warnings.push('Noches inconsistentes: ' + badNoches);

const badTotals = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE ABS(monto_total - (subtotal + impuesto_monto)) > 0.02 AND monto_total IS NOT NULL").get().c;
if (badTotals > 0) bugs.push('monto_total != subtotal+impuesto: ' + badTotals);

const badSaldo = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE ABS(saldo_pendiente - (monto_total - monto_pagado)) > 0.02 AND saldo_pendiente IS NOT NULL").get().c;
if (badSaldo > 0) bugs.push('saldo != total-pagado: ' + badSaldo);

// 2. Folio vs reserva
const folioMismatch = db.prepare("SELECT COUNT(*) as c FROM (SELECT r.id FROM reservas_hotel r LEFT JOIN (SELECT reserva_id, SUM(CASE WHEN tipo='credito' THEN monto ELSE 0 END) as s FROM folio_hotel GROUP BY reserva_id) f ON f.reserva_id=r.id WHERE ABS(r.monto_pagado - COALESCE(f.s,0)) > 0.02)").get().c;
if (folioMismatch > 0) warnings.push('Folio vs monto_pagado mismatch: ' + folioMismatch);

// 3. Dashboard: ingresos without upper bound
const hoy = new Date().toISOString().split('T')[0];
const mesDesde = hoy.substring(0, 7) + '-01';
const dashIng = db.prepare("SELECT COALESCE(SUM(monto_total),0) as t FROM reservas_hotel WHERE check_in >= ? AND estado NOT IN ('Cancelada','No-Show')").get(mesDesde).t;
const dashIngBound = db.prepare("SELECT COALESCE(SUM(monto_total),0) as t FROM reservas_hotel WHERE check_in >= ? AND check_in <= ? AND estado NOT IN ('Cancelada','No-Show')").get(mesDesde, hoy).t;
if (Math.abs(dashIng - dashIngBound) > 1) bugs.push('Dashboard ingresos sin upper bound: $' + dashIng + ' vs $' + dashIngBound + ' (incluye futuras)');

// 4. Report revenue excludes Hospedado
const hospRev = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(monto_total),0) as t FROM reservas_hotel WHERE estado='Hospedado'").get();
if (hospRev.c > 0) bugs.push('Reportes excluyen Hospedado: ' + hospRev.c + ' reservas, $' + hospRev.t);

// 5. Occupancy uses SUM(noches) instead of effective days
const daysInMonth = Math.max(1, Math.ceil((new Date(hoy).getTime() - new Date(mesDesde).getTime()) / 86400000) + 1);
const nochesAllE = db.prepare("SELECT COALESCE(SUM(r.noches),0) as n FROM reservas_hotel r JOIN habitaciones h ON r.habitacion_id=h.id WHERE h.categoria='Estadía' AND r.estado NOT IN ('Cancelada','No-Show') AND r.check_in<=? AND r.check_out>=?").get(hoy, mesDesde).n;
const totalE = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE activa=1 AND categoria='Estadía'").get().c;
const slots = totalE * daysInMonth;
if (nochesAllE > slots) bugs.push('Ocupacion inflada: ' + nochesAllE + ' noches > ' + slots + ' slots. SUM(noches) cuenta completas aun si parte cae fuera del rango.');

// 6. Saldos: Reportes excluyen Check-Out, CxC no
const saldosCxC = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE saldo_pendiente>0 AND estado NOT IN ('Cancelada','No-Show')").get().c;
const saldosRep = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE saldo_pendiente>0 AND estado NOT IN ('Cancelada','No-Show','Check-Out')").get().c;
if (saldosCxC !== saldosRep) warnings.push('Saldos: CxC=' + saldosCxC + ' vs Reportes=' + saldosRep + ' (reportes excluyen Check-Out)');

// 7. Estados
const estados = db.prepare("SELECT estado, COUNT(*) as c FROM reservas_hotel GROUP BY estado ORDER BY c DESC").all();
const noHosp = !estados.find(e => e.estado === 'Hospedado');
if (noHosp) warnings.push('No hay reservas Hospedado. Dashboard siempre mostrara 0 hospedados.');

// 8. Cross-check totals
const totalFolio = db.prepare("SELECT COALESCE(SUM(monto),0) as t FROM folio_hotel WHERE tipo='credito'").get().t;
const totalPagado = db.prepare("SELECT COALESCE(SUM(monto_pagado),0) as t FROM reservas_hotel").get().t;
if (Math.abs(totalFolio - totalPagado) > 1) bugs.push('Folio creditos ($' + totalFolio + ') != monto_pagado ($' + totalPagado + ')');

// OUTPUT
console.log('BUGS (' + bugs.length + '):');
bugs.forEach((b,i) => console.log((i+1) + '. ' + b));
console.log('WARNINGS (' + warnings.length + '):');
warnings.forEach((w,i) => console.log((i+1) + '. ' + w));
console.log('ESTADOS:', estados.map(e => e.estado + ':' + e.c).join(', '));
