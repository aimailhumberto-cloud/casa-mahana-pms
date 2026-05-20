const express = require('express');
const router = express.Router();
const { getDb, findById, create } = require('../db/database');
const { calcNoches, calcReservationWithRates, getConfig } = require('../utils/calculations');
const { fireWebhooks } = require('../utils/webhooks');
const { upload, validateUploadSignature } = require('../utils/upload');
const notifications = require('../notifications');

// ── Helpers ──
function ok(res, data, meta, status = 200) {
  const response = { success: true, data };
  if (meta) response.meta = meta;
  return res.status(status).json(response);
}

function err(res, code, message, status = 400) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function safeJSON(str) {
  if (!str) return [];
  try { return JSON.parse(str); } catch { return []; }
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '');
}

// Public room type photos (for booking widget)
router.get('/tipo-fotos', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT clave, valor FROM config_hotel WHERE clave LIKE 'foto_tipo_%'").all();
    const fotos = {};
    for (const r of rows) { fotos[r.clave.replace('foto_tipo_', '')] = r.valor; }
    ok(res, fotos);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo fotos', 500); }
});

// Public availability — returns room TYPES (not IDs) with availability count
router.get('/disponibilidad', (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) return err(res, 'VALIDATION_ERROR', 'check_in y check_out requeridos');
    if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'check_out debe ser posterior a check_in');
    const db = getDb();
    // Get all active rooms
    const rooms = db.prepare("SELECT id, tipo, categoria, capacidad_min, capacidad_max FROM habitaciones WHERE activa = 1 AND categoria = 'Estadía'").all();
    // Get conflicting reservations (including Por Aprobar which block rooms)
    const conflicts = db.prepare(`
      SELECT habitacion_id FROM reservas_hotel
      WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
        AND check_in < ? AND check_out > ?
    `).all(check_out, check_in).map(r => r.habitacion_id);
    // Group by type
    const types = {};
    for (const room of rooms) {
      const available = !conflicts.includes(room.id);
      if (!types[room.tipo]) {
        types[room.tipo] = { tipo: room.tipo, categoria: room.categoria, capacidad_min: room.capacidad_min, capacidad_max: room.capacidad_max, total: 0, disponibles: 0 };
      }
      types[room.tipo].total++;
      if (available) types[room.tipo].disponibles++;
    }
    const result = Object.values(types).filter(t => t.disponibles > 0);
    ok(res, { check_in, check_out, tipos_disponibles: result });
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error verificando disponibilidad', 500); }
});

// Public plans — only visible_web=1
router.get('/planes', (req, res) => {
  try {
    const { tipo } = req.query; // optional room type filter
    const db = getDb();
    let plans = db.prepare("SELECT id, codigo, nombre, descripcion, categoria, precio_adulto_noche, precio_menor_noche, precio_mascota_noche, incluye, horario, extras_disponibles, tipos_aplicables, imagen FROM planes_tarifa WHERE activo = 1 AND visible_web = 1").all();
    // Filter by room type if provided
    if (tipo) {
      plans = plans.filter(p => {
        const tipos = safeJSON(p.tipos_aplicables);
        return tipos.length === 0 || tipos.includes(tipo);
      });
    }
    plans = plans.map(p => ({
      ...p,
      incluye: safeJSON(p.incluye),
      extras_disponibles: safeJSON(p.extras_disponibles),
      tipos_aplicables: safeJSON(p.tipos_aplicables)
    }));
    ok(res, plans);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando planes', 500); }
});

// Public cotizar
router.get('/cotizar', (req, res) => {
  try {
    const { plan, adultos = 1, menores = 0, mascotas = 0, check_in, check_out } = req.query;
    if (!plan || !check_in || !check_out) return err(res, 'VALIDATION_ERROR', 'plan, check_in, check_out requeridos');
    const db = getDb();
    const planData = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ? AND activo = 1 AND visible_web = 1').get(plan);
    if (!planData) return err(res, 'NOT_FOUND', 'Plan no encontrado', 404);
    const noches = calcNoches(check_in, check_out);
    const totals = calcReservationWithRates(planData.id, check_in, check_out, +adultos, +menores, +mascotas);
    const depositoPct = parseFloat(getConfig('deposito_sugerido_pct')) || 50;
    ok(res, {
      plan: { codigo: planData.codigo, nombre: planData.nombre, descripcion: planData.descripcion },
      noches, adultos: +adultos, menores: +menores, mascotas: +mascotas,
      ...totals,
      deposito_pct: depositoPct,
      deposito_minimo: Math.round(totals.monto_total * (depositoPct / 100) * 100) / 100
    });
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error cotizando', 500); }
});

// PayPal config (public — only returns client_id and mode)
router.get('/paypal-config', (req, res) => {
  try {
    const clientId = getConfig('paypal_client_id') || process.env.PAYPAL_CLIENT_ID || '';
    const mode = getConfig('paypal_mode') || process.env.PAYPAL_MODE || 'sandbox';
    ok(res, { paypal_enabled: !!clientId, paypal_client_id: clientId || null, paypal_mode: mode });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error config PayPal', 500); }
});

// PayPal create order (server-side)
router.post('/paypal/create-order', async (req, res) => {
  try {
    const { monto, descripcion } = req.body;
    if (!monto || monto <= 0) return err(res, 'VALIDATION_ERROR', 'monto requerido');
    const clientId = getConfig('paypal_client_id') || process.env.PAYPAL_CLIENT_ID;
    const secret = getConfig('paypal_secret') || process.env.PAYPAL_CLIENT_SECRET;
    const mode = getConfig('paypal_mode') || process.env.PAYPAL_MODE || 'sandbox';
    if (!clientId || !secret) return err(res, 'CONFIG_ERROR', 'PayPal no configurado');
    const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    // Get access token
    const authResp = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST', headers: { 'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials'
    });
    const authData = await authResp.json();
    if (!authData.access_token) return err(res, 'PAYPAL_ERROR', 'Error autenticando con PayPal', 500);
    // Create order
    const orderResp = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authData.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ amount: { currency_code: 'USD', value: String(monto) }, description: descripcion || 'Reserva Casa Mahana' }]
      })
    });
    const order = await orderResp.json();
    ok(res, { orderId: order.id, status: order.status });
  } catch (e) { console.error('PayPal create-order error:', e); err(res, 'SERVER_ERROR', 'Error creando orden PayPal', 500); }
});

// PayPal capture order
router.post('/paypal/capture-order', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return err(res, 'VALIDATION_ERROR', 'orderId requerido');
    const clientId = getConfig('paypal_client_id') || process.env.PAYPAL_CLIENT_ID;
    const secret = getConfig('paypal_secret') || process.env.PAYPAL_CLIENT_SECRET;
    const mode = getConfig('paypal_mode') || process.env.PAYPAL_MODE || 'sandbox';
    const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const authResp = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST', headers: { 'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials'
    });
    const authData = await authResp.json();
    const captureResp = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${authData.access_token}`, 'Content-Type': 'application/json' }
    });
    const capture = await captureResp.json();
    ok(res, { status: capture.status, orderId: capture.id, payer: capture.payer });
  } catch (e) { console.error('PayPal capture error:', e); err(res, 'SERVER_ERROR', 'Error capturando pago PayPal', 500); }
});

// Public reservation creation (with PayPal or manual payment)
router.post('/reservar', (req, res) => {
  try {
    const { cliente, apellido, email, whatsapp, nacionalidad, check_in, check_out, tipo_habitacion, plan_codigo, adultos = 1, menores = 0, mascotas = 0, monto_pagado = 0, paypal_order_id, pago_tipo = 'deposito', metodo_pago, referencia } = req.body;
    // Validations
    const missing = [];
    if (!cliente) missing.push('cliente');
    if (!email) missing.push('email');
    if (!check_in) missing.push('check_in');
    if (!check_out) missing.push('check_out');
    if (!tipo_habitacion) missing.push('tipo_habitacion');
    if (!plan_codigo) missing.push('plan_codigo');
    if (missing.length) return err(res, 'VALIDATION_ERROR', `Campos requeridos: ${missing.join(', ')}`);
    if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'Check-out debe ser posterior a check_in');

    const todayStr = new Date().toISOString().split('T')[0];
    if (check_in < todayStr) return err(res, 'VALIDATION_ERROR', 'No se puede reservar en fechas pasadas');

    const db = getDb();
    const plan = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ? AND activo = 1 AND visible_web = 1').get(plan_codigo);
    if (!plan) return err(res, 'NOT_FOUND', 'Plan no disponible');

    // Find an available room of the requested type
    const rooms = db.prepare("SELECT id FROM habitaciones WHERE tipo = ? AND activa = 1 AND categoria = 'Estadía'").all(tipo_habitacion);
    const conflicts = db.prepare(`
      SELECT habitacion_id FROM reservas_hotel
      WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
        AND check_in < ? AND check_out > ?
    `).all(check_out, check_in).map(r => r.habitacion_id);
    const availableRoom = rooms.find(r => !conflicts.includes(r.id));
    if (!availableRoom) return err(res, 'NO_AVAILABILITY', 'No hay habitaciones disponibles para esas fechas');

    // Calculate totals
    const totals = calcReservationWithRates(plan.id, check_in, check_out, +adultos, +menores, +mascotas);
    const noches = calcNoches(check_in, check_out);
    const paidAmount = parseFloat(monto_pagado) || 0;

    const data = {
      cliente: sanitize(cliente), apellido: sanitize(apellido || ''), email: sanitize(email), whatsapp: sanitize(whatsapp || ''),
      telefono: '', nacionalidad: sanitize(nacionalidad || ''),
      habitacion_id: availableRoom.id, tipo_habitacion,
      check_in, check_out, noches, adultos: +adultos, menores: +menores, mascotas: +mascotas,
      plan_codigo, plan_nombre: plan.nombre,
      precio_adulto_noche: plan.precio_adulto_noche, precio_menor_noche: plan.precio_menor_noche, precio_mascota_noche: plan.precio_mascota_noche,
      subtotal: totals.subtotal, impuesto_pct: totals.impuesto_pct, impuesto_monto: totals.impuesto_monto,
      monto_total: totals.monto_total, deposito_sugerido: totals.deposito_sugerido,
      monto_pagado: paidAmount, saldo_pendiente: Math.round((totals.monto_total - paidAmount) * 100) / 100,
      estado: 'Pendiente', fuente: 'Website',
      notas: metodo_pago ? `${metodo_pago.toUpperCase()} Ref: ${referencia || 'N/A'}` : (paypal_order_id ? `PayPal Order: ${paypal_order_id}` : ''),
      created_by: 'Web Booking'
    };

    const reserva = create('reservas_hotel', data);

    // Add folio entries
    if (totals.subtotal > 0) {
      db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, registrado_por) VALUES (?, ?, ?, ?, ?)').run(
        reserva.id, 'debito', `${plan.nombre} (${noches} noches)`, totals.subtotal, 'Web Booking');
    }
    if (totals.impuesto_monto > 0) {
      db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, registrado_por) VALUES (?, ?, ?, ?, ?)').run(
        reserva.id, 'debito', `Impuesto ${totals.impuesto_pct}%`, totals.impuesto_monto, 'Web Booking');
    }
    if (paidAmount > 0) {
      const finalMetodo = metodo_pago || 'paypal';
      const finalReferencia = referencia || paypal_order_id || '';
      db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, referencia, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        reserva.id, 'credito', pago_tipo === 'total' ? 'Pago total (Website)' : 'Depósito (Website)',
        paidAmount, finalMetodo, finalReferencia, 'Web Booking');
    }

    // Fire webhook
    fireWebhooks('reserva.creada', { reserva_id: reserva.id, cliente, check_in, check_out, plan: plan.nombre, monto_total: totals.monto_total, monto_pagado: paidAmount, fuente: 'Website' });

    ok(res, { reserva_id: reserva.id, mensaje: 'Reserva recibida. Nuestro equipo la revisará y confirmaremos por email/WhatsApp.' }, null, 201);

    // Fire notifications for web booking (async)
    const fullReserva = findById('reservas_hotel', reserva.id);
    const hab = fullReserva.habitacion_id ? findById('habitaciones', fullReserva.habitacion_id) : null;
    
    notifications.notifyReservationConfirmed(fullReserva, hab).catch(e => console.log('Booking notif error:', e.message));
    notifications.notifyAdminNewBooking(fullReserva, hab).catch(e => console.log('Admin notif error:', e.message));
  } catch (e) { console.error('Public booking error:', e); err(res, 'SERVER_ERROR', 'Error creando reserva', 500); }
});

// Public upload of transaction receipt/comprobante
router.post('/reservas/:id/comprobante', upload.single('comprobante'), validateUploadSignature, (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo requerido (JPEG, PNG, WebP, PDF, máx 10MB)');
    const reserva = findById('reservas_hotel', req.params.id);
    if (!reserva) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);
    
    const db = getDb();
    const tipo = 'recibo';
    db.prepare(`INSERT INTO documentos_reserva (reserva_id, tipo, nombre_original, nombre_archivo, mime_type, tamaño, notas, subido_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      req.params.id, tipo, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size,
      req.body.notas || 'Comprobante subido por Huésped desde el Widget de Reservas.', 'Huésped Online'
    );
    const doc = db.prepare('SELECT * FROM documentos_reserva WHERE reserva_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    ok(res, doc, null, 201);
  } catch (e) {
    console.error('Error subiendo comprobante publico:', e);
    err(res, 'SERVER_ERROR', 'Error subiendo comprobante', 500);
  }
});

module.exports = router;
