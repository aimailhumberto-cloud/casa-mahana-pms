const { getDb, findById } = require('../db/database');

// Get config value
function getConfig(key) {
  const db = getDb();
  const row = db.prepare('SELECT valor FROM config_hotel WHERE clave = ?').get(key);
  return row ? row.valor : null;
}

// Determine day type for a date
function getDayType(dateStr) {
  const db = getDb();
  // Check holidays first
  const festivo = db.prepare('SELECT id FROM dias_festivos WHERE fecha = ?').get(dateStr);
  if (festivo) return 'festivo';
  // Check day of week: 0=Sun, 1=Mon...5=Fri, 6=Sat
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  // Fin de semana = Friday(5) and Saturday(6)
  if (dow === 5 || dow === 6) return 'fin_de_semana';
  return 'entre_semana';
}

// Get rate for a plan + day type
function getRateForDay(planId, tipoDia) {
  const db = getDb();
  return db.prepare('SELECT * FROM reglas_tarifa WHERE plan_id = ? AND tipo_dia = ? AND activo = 1').get(planId, tipoDia);
}

// Calculate reservation totals (day-aware)
function calcReservation(data) {
  const adultos = parseInt(data.adultos) || 1;
  const menores = parseInt(data.menores) || 0;
  const mascotas = parseInt(data.mascotas) || 0;
  const noches = parseInt(data.noches) || 1;
  const precioAdulto = parseFloat(data.precio_adulto_noche) || 0;
  const precioMenor = parseFloat(data.precio_menor_noche) || 0;
  const precioMascota = parseFloat(data.precio_mascota_noche) || 0;
  const extras = parseFloat(data.productos_adicionales) || 0;
  const impuestoPct = parseFloat(data.impuesto_pct) || parseFloat(getConfig('impuesto_turismo_pct')) || 10;
  const depositoPct = parseFloat(getConfig('deposito_sugerido_pct')) || 50;

  const subtotal = Math.round(((adultos * precioAdulto) + (menores * precioMenor) + (mascotas * precioMascota)) * noches * 100) / 100;
  const impuestoMonto = Math.round((subtotal + extras) * (impuestoPct / 100) * 100) / 100;
  const montoTotal = Math.round((subtotal + extras + impuestoMonto) * 100) / 100;
  const depositoSugerido = Math.round(montoTotal * (depositoPct / 100) * 100) / 100;
  const montoPagado = parseFloat(data.monto_pagado) || 0;
  const saldoPendiente = Math.round((montoTotal - montoPagado) * 100) / 100;

  return {
    subtotal,
    productos_adicionales: extras,
    impuesto_pct: impuestoPct,
    impuesto_monto: impuestoMonto,
    monto_total: montoTotal,
    deposito_sugerido: depositoSugerido,
    monto_pagado: montoPagado,
    saldo_pendiente: saldoPendiente
  };
}

// Calculate with day-based rates
function calcReservationWithRates(planId, checkIn, checkOut, adultos, menores, mascotas) {
  const db = getDb();
  const noches = calcNoches(checkIn, checkOut);
  const impuestoPct = parseFloat(getConfig('impuesto_turismo_pct')) || 10;
  const depositoPct = parseFloat(getConfig('deposito_sugerido_pct')) || 50;

  const desglose = []; // per-night breakdown
  let subtotal = 0;

  for (let i = 0; i < noches; i++) {
    const d = new Date(checkIn + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const tipoDia = getDayType(dateStr);
    const rate = getRateForDay(planId, tipoDia);

    let pAdulto, pMenor, pMascota;
    if (rate) {
      pAdulto = rate.precio_adulto;
      pMenor = rate.precio_menor;
      pMascota = rate.precio_mascota;
    } else {
      // Fallback to plan base price
      const plan = findById('planes_tarifa', planId);
      pAdulto = plan.precio_adulto_noche;
      pMenor = plan.precio_menor_noche;
      pMascota = plan.precio_mascota_noche;
    }

    const nightTotal = Math.round(((adultos * pAdulto) + (menores * pMenor) + (mascotas * pMascota)) * 100) / 100;
    subtotal += nightTotal;

    // Check if holiday
    const festivo = db.prepare('SELECT nombre FROM dias_festivos WHERE fecha = ?').get(dateStr);

    desglose.push({
      fecha: dateStr,
      dia: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()],
      tipo_dia: tipoDia,
      festivo_nombre: festivo?.nombre || null,
      precio_adulto: pAdulto,
      precio_menor: pMenor,
      precio_mascota: pMascota,
      total_noche: nightTotal
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const impuestoMonto = Math.round(subtotal * (impuestoPct / 100) * 100) / 100;
  const montoTotal = Math.round((subtotal + impuestoMonto) * 100) / 100;
  const depositoSugerido = Math.round(montoTotal * (depositoPct / 100) * 100) / 100;

  return {
    subtotal, impuesto_pct: impuestoPct, impuesto_monto: impuestoMonto,
    monto_total: montoTotal, deposito_sugerido: depositoSugerido,
    desglose
  };
}

// Calculate nights between two dates
function calcNoches(checkIn, checkOut) {
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

module.exports = {
  getConfig,
  getDayType,
  getRateForDay,
  calcReservation,
  calcReservationWithRates,
  calcNoches
};
