const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb, findAll, findById, create, update, remove } = require('./db/database');
const { verifyPassword, hashPassword, generateToken, requireAuth, requireRole, requireWrite, generateApiKey, hashApiKey } = require('./auth');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3201;

// ── Uploads directory ──
const UPLOADS_DIR = path.join(__dirname, '../data/uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── Middleware ──
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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

// Get config value
function getConfig(key) {
  const db = getDb();
  const row = db.prepare('SELECT valor FROM config_hotel WHERE clave = ?').get(key);
  return row ? row.valor : null;
}

// ── Determine day type for a date ──
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

// ── Get rate for a plan + day type ──
function getRateForDay(planId, tipoDia) {
  const db = getDb();
  return db.prepare('SELECT * FROM reglas_tarifa WHERE plan_id = ? AND tipo_dia = ? AND activo = 1').get(planId, tipoDia);
}

// ── Calculate reservation totals (day-aware) ──
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

// ── Calculate with day-based rates ──
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

// ══════════════════════════════════════
// AUTH
// ══════════════════════════════════════

app.post('/api/v1/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, 'VALIDATION_ERROR', 'Email y contraseña requeridos');
    const db = getDb();
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ? AND activo = 1').get(email.toLowerCase().trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return err(res, 'AUTH_FAILED', 'Credenciales inválidas', 401);
    }
    ok(res, { token: generateToken(user), user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
  } catch (e) { console.error('Login error:', e); err(res, 'SERVER_ERROR', 'Error en login', 500); }
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  ok(res, { id: req.user.id, email: req.user.email, nombre: req.user.nombre, rol: req.user.rol });
});

// ══════════════════════════════════════
// HABITACIONES
// ══════════════════════════════════════

app.get('/api/v1/habitaciones', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const rooms = db.prepare('SELECT * FROM habitaciones WHERE activa = 1 ORDER BY tipo, id').all();
    ok(res, rooms);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando habitaciones', 500); }
});

// All rooms (including inactive) — for admin
app.get('/api/v1/habitaciones/todas', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const rooms = db.prepare('SELECT * FROM habitaciones ORDER BY tipo, id').all();
    ok(res, rooms);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando habitaciones', 500); }
});

// Distinct room types — for dropdowns
app.get('/api/v1/habitaciones/tipos', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const tipos = db.prepare('SELECT DISTINCT tipo FROM habitaciones WHERE activa = 1 ORDER BY tipo').all().map(r => r.tipo);
    ok(res, tipos);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando tipos', 500); }
});

// Create room
app.post('/api/v1/habitaciones', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { nombre, tipo } = req.body;
    if (!nombre || !tipo) return err(res, 'VALIDATION_ERROR', 'nombre y tipo requeridos');
    const db = getDb();
    // Check duplicate name
    const dup = db.prepare('SELECT id FROM habitaciones WHERE nombre = ?').get(nombre);
    if (dup) return err(res, 'DUPLICATE', `Ya existe una habitación con nombre "${nombre}"`);
    const data = {
      nombre: sanitize(nombre),
      tipo: sanitize(tipo),
      capacidad: parseInt(req.body.capacidad_max) || parseInt(req.body.capacidad) || 2,
      capacidad_min: parseInt(req.body.capacidad_min) || 1,
      capacidad_max: parseInt(req.body.capacidad_max) || 4,
      descripcion_camas: sanitize(req.body.descripcion_camas || ''),
      piso: sanitize(req.body.piso || ''),
    };
    const room = create('habitaciones', data);
    ok(res, room, null, 201);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error creando habitación', 500); }
});

// Update room (full edit)
app.put('/api/v1/habitaciones/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const existing = findById('habitaciones', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Habitación no encontrada', 404);
    const data = {};
    const allowed = ['nombre', 'tipo', 'capacidad', 'capacidad_min', 'capacidad_max', 'descripcion_camas', 'piso', 'activa'];
    for (const f of allowed) {
      if (req.body[f] !== undefined) data[f] = typeof req.body[f] === 'string' ? sanitize(req.body[f]) : req.body[f];
    }
    // Keep capacidad in sync with capacidad_max
    if (data.capacidad_max) data.capacidad = data.capacidad_max;
    const updated = update('habitaciones', req.params.id, data);
    ok(res, updated);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error actualizando habitación', 500); }
});

// Delete room (soft-delete)
app.delete('/api/v1/habitaciones/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const existing = findById('habitaciones', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Habitación no encontrada', 404);
    // Check if room has active reservations
    const db = getDb();
    const active = db.prepare(`SELECT COUNT(*) as c FROM reservas_hotel WHERE habitacion_id = ? AND estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')`).get(req.params.id);
    if (active.c > 0) return err(res, 'HAS_RESERVATIONS', `No se puede eliminar: tiene ${active.c} reservas activas`);
    update('habitaciones', req.params.id, { activa: 0 });
    ok(res, { deleted: true });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error eliminando habitación', 500); }
});

app.patch('/api/v1/habitaciones/:id/limpieza', requireAuth, (req, res) => {
  try {
    const { estado_limpieza } = req.body;
    const valid = ['Sucia', 'Limpia', 'Inspeccionada'];
    if (!valid.includes(estado_limpieza)) return err(res, 'VALIDATION_ERROR', `Estados válidos: ${valid.join(', ')}`);
    const updated = update('habitaciones', req.params.id, { estado_limpieza });
    ok(res, updated);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error actualizando limpieza', 500); }
});

// Bulk update limpieza for multiple rooms
app.patch('/api/v1/habitaciones/masiva', requireAuth, (req, res) => {
  try {
    const { ids, estado_limpieza } = req.body;
    const valid = ['Sucia', 'Limpia', 'Inspeccionada'];
    if (!Array.isArray(ids) || ids.length === 0) return err(res, 'VALIDATION_ERROR', 'ids requeridos');
    if (!valid.includes(estado_limpieza)) return err(res, 'VALIDATION_ERROR', `Estados válidos: ${valid.join(', ')}`);
    const db = getDb();
    const stmt = db.prepare('UPDATE habitaciones SET estado_limpieza = ? WHERE id = ?');
    const txn = db.transaction(() => { for (const id of ids) stmt.run(estado_limpieza, id); });
    txn();
    ok(res, { updated: ids.length, estado_limpieza });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error en actualización masiva', 500); }
});

app.patch('/api/v1/habitaciones/:id', requireAuth, (req, res) => {
  try {
    const data = {};
    const allowed = ['estado_limpieza', 'estado_habitacion', 'asignado_a', 'no_molestar', 'comentarios'];
    for (const f of allowed) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
    const updated = update('habitaciones', req.params.id, data);
    ok(res, updated);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error actualizando habitación', 500); }
});

// Bulk action (like Cloudbeds "Acción masiva")
app.patch('/api/v1/habitaciones/masiva', requireAuth, (req, res) => {
  try {
    const { ids, estado_limpieza } = req.body;
    if (!ids || !Array.isArray(ids) || !estado_limpieza) return err(res, 'VALIDATION_ERROR', 'ids[] y estado_limpieza requeridos');
    const db = getDb();
    const stmt = db.prepare('UPDATE habitaciones SET estado_limpieza = ? WHERE id = ?');
    const tx = db.transaction(() => { for (const id of ids) stmt.run(estado_limpieza, id); });
    tx();
    ok(res, { updated: ids.length });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error en acción masiva', 500); }
});

// ══════════════════════════════════════
// PLANES DE TARIFA
// ══════════════════════════════════════

app.get('/api/v1/hotel/planes', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const showAll = req.query.all === '1'; // include inactive
    const plans = db.prepare(`SELECT * FROM planes_tarifa ${showAll ? '' : 'WHERE activo = 1'} ORDER BY categoria, precio_adulto_noche ASC`).all();
    // Parse JSON fields
    const parsed = plans.map(p => ({
      ...p,
      incluye: safeJSON(p.incluye),
      extras_disponibles: safeJSON(p.extras_disponibles),
      tipos_aplicables: safeJSON(p.tipos_aplicables),
    }));
    ok(res, parsed);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error listando planes', 500); }
});

app.get('/api/v1/hotel/productos/:id', requireAuth, (req, res) => {
  try {
    const p = findById('planes_tarifa', req.params.id);
    if (!p) return err(res, 'NOT_FOUND', 'Producto no encontrado', 404);
    ok(res, { ...p, incluye: safeJSON(p.incluye), extras_disponibles: safeJSON(p.extras_disponibles), tipos_aplicables: safeJSON(p.tipos_aplicables) });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo producto', 500); }
});

app.post('/api/v1/hotel/planes', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { codigo, nombre, precio_adulto_noche } = req.body;
    if (!codigo || !nombre || precio_adulto_noche === undefined) return err(res, 'VALIDATION_ERROR', 'codigo, nombre y precio_adulto_noche requeridos');
    const db = getDb();
    // Check unique codigo
    const existing = db.prepare('SELECT id FROM planes_tarifa WHERE codigo = ?').get(sanitize(codigo));
    if (existing) return err(res, 'DUPLICATE', 'Ya existe un producto con ese código');
    const plan = create('planes_tarifa', {
      codigo: sanitize(codigo), nombre: sanitize(nombre),
      descripcion: sanitize(req.body.descripcion || ''),
      categoria: req.body.categoria || 'Estadía',
      precio_adulto_noche, precio_menor_noche: req.body.precio_menor_noche || 0,
      precio_mascota_noche: req.body.precio_mascota_noche || 0,
      incluye: req.body.incluye ? JSON.stringify(req.body.incluye) : null,
      horario: req.body.horario || null,
      extras_disponibles: req.body.extras_disponibles ? JSON.stringify(req.body.extras_disponibles) : null,
      tipos_aplicables: req.body.tipos_aplicables ? JSON.stringify(req.body.tipos_aplicables) : null,
      imagen: req.body.imagen || null,
    });
    ok(res, plan, null, 201);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error creando producto', 500); }
});

app.put('/api/v1/hotel/planes/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const existing = findById('planes_tarifa', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Producto no encontrado', 404);
    const data = {};
    const allowed = ['nombre', 'descripcion', 'categoria', 'precio_adulto_noche', 'precio_menor_noche', 'precio_mascota_noche', 'horario', 'imagen', 'activo', 'visible_web'];
    for (const f of allowed) { if (req.body[f] !== undefined) data[f] = req.body[f]; }
    // JSON array fields
    if (req.body.incluye !== undefined) data.incluye = JSON.stringify(req.body.incluye);
    if (req.body.extras_disponibles !== undefined) data.extras_disponibles = JSON.stringify(req.body.extras_disponibles);
    if (req.body.tipos_aplicables !== undefined) data.tipos_aplicables = JSON.stringify(req.body.tipos_aplicables);
    data.updated_at = new Date().toISOString();
    const updated = update('planes_tarifa', req.params.id, data);

    // Auto-sync entre_semana rate rule when base price changes
    if (req.body.precio_adulto_noche !== undefined || req.body.precio_menor_noche !== undefined || req.body.precio_mascota_noche !== undefined) {
      const db = getDb();
      const newAdulto = parseFloat(req.body.precio_adulto_noche ?? existing.precio_adulto_noche);
      const newMenor = parseFloat(req.body.precio_menor_noche ?? existing.precio_menor_noche);
      const newMascota = parseFloat(req.body.precio_mascota_noche ?? existing.precio_mascota_noche);
      const existingRule = db.prepare("SELECT id FROM reglas_tarifa WHERE plan_id = ? AND tipo_dia = 'entre_semana'").get(req.params.id);
      if (existingRule) {
        db.prepare("UPDATE reglas_tarifa SET precio_adulto = ?, precio_menor = ?, precio_mascota = ? WHERE id = ?")
          .run(newAdulto, newMenor, newMascota, existingRule.id);
      } else {
        db.prepare("INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota) VALUES (?, 'entre_semana', ?, ?, ?)")
          .run(req.params.id, newAdulto, newMenor, newMascota);
      }
    }

    ok(res, updated);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error actualizando producto', 500); }
});

app.delete('/api/v1/hotel/planes/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const existing = findById('planes_tarifa', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Producto no encontrado', 404);
    update('planes_tarifa', req.params.id, { activo: 0, updated_at: new Date().toISOString() });
    ok(res, { message: 'Producto desactivado' });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error eliminando producto', 500); }
});

// Upload product photo
app.post('/api/v1/hotel/planes/:id/foto', requireAuth, requireRole('admin'), upload.single('foto'), (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo de imagen requerido');
    const existing = findById('planes_tarifa', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Producto no encontrado', 404);
    const imageUrl = `/uploads/${req.file.filename}`;
    update('planes_tarifa', req.params.id, { imagen: imageUrl, updated_at: new Date().toISOString() });
    ok(res, { imagen: imageUrl, filename: req.file.filename });
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error subiendo foto', 500); }
});

// Cotizar — preview pricing with day-based rates
app.get('/api/v1/hotel/cotizar', requireAuth, (req, res) => {
  try {
    const { plan, adultos = 1, menores = 0, mascotas = 0, check_in, check_out } = req.query;
    if (!plan || !check_in || !check_out) return err(res, 'VALIDATION_ERROR', 'plan, check_in, check_out requeridos');
    const db = getDb();
    const planData = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ? AND activo = 1').get(plan);
    if (!planData) return err(res, 'NOT_FOUND', 'Plan no encontrado', 404);
    const noches = calcNoches(check_in, check_out);
    const totals = calcReservationWithRates(planData.id, check_in, check_out, +adultos, +menores, +mascotas);
    ok(res, {
      plan: { ...planData, incluye: safeJSON(planData.incluye), extras_disponibles: safeJSON(planData.extras_disponibles) },
      noches, adultos: +adultos, menores: +menores, mascotas: +mascotas,
      ...totals
    });
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error cotizando', 500); }
});

// ══════════════════════════════════════
// REGLAS DE TARIFA
// ══════════════════════════════════════

// Get rate rules for a plan
app.get('/api/v1/hotel/planes/:id/reglas', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const reglas = db.prepare("SELECT * FROM reglas_tarifa WHERE plan_id = ? ORDER BY CASE tipo_dia WHEN 'entre_semana' THEN 1 WHEN 'fin_de_semana' THEN 2 WHEN 'festivo' THEN 3 END").all(req.params.id);
    ok(res, reglas);
  } catch (e) { console.error('Reglas error:', e); err(res, 'SERVER_ERROR', 'Error listando reglas', 500); }
});

// Update rate rules for a plan (batch upsert)
app.put('/api/v1/hotel/planes/:id/reglas', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const planId = req.params.id;
    const existing = findById('planes_tarifa', planId);
    if (!existing) return err(res, 'NOT_FOUND', 'Plan no encontrado', 404);
    const db = getDb();
    const { reglas } = req.body; // [{tipo_dia, precio_adulto, precio_menor, precio_mascota}]
    if (!Array.isArray(reglas)) return err(res, 'VALIDATION_ERROR', 'reglas debe ser un array');
    const upsert = db.prepare(`
      INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(plan_id, tipo_dia) DO UPDATE SET precio_adulto=excluded.precio_adulto, precio_menor=excluded.precio_menor, precio_mascota=excluded.precio_mascota
    `);
    // SQLite doesn't have ON CONFLICT for non-unique columns, so delete+insert
    const del = db.prepare('DELETE FROM reglas_tarifa WHERE plan_id = ?');
    const ins = db.prepare('INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota) VALUES (?, ?, ?, ?, ?)');
    const txn = db.transaction(() => {
      del.run(planId);
      for (const r of reglas) {
        if (r.tipo_dia && r.precio_adulto !== undefined) {
          ins.run(planId, r.tipo_dia, r.precio_adulto, r.precio_menor || 0, r.precio_mascota || 0);
        }
      }
    });
    txn();
    const updated = db.prepare('SELECT * FROM reglas_tarifa WHERE plan_id = ? ORDER BY tipo_dia').all(planId);
    ok(res, updated);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error actualizando reglas', 500); }
});

// ══════════════════════════════════════
// DÍAS FESTIVOS
// ══════════════════════════════════════

app.get('/api/v1/hotel/festivos', requireAuth, (req, res) => {
  try {
    const db = getDb();
    ok(res, db.prepare('SELECT * FROM dias_festivos ORDER BY fecha').all());
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando festivos', 500); }
});

app.post('/api/v1/hotel/festivos', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { fecha, nombre } = req.body;
    if (!fecha || !nombre) return err(res, 'VALIDATION_ERROR', 'fecha y nombre requeridos');
    const db = getDb();
    const existing = db.prepare('SELECT id FROM dias_festivos WHERE fecha = ?').get(fecha);
    if (existing) return err(res, 'DUPLICATE', 'Ya existe un festivo para esa fecha');
    db.prepare('INSERT INTO dias_festivos (fecha, nombre) VALUES (?, ?)').run(fecha, sanitize(nombre));
    ok(res, { fecha, nombre }, null, 201);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error creando festivo', 500); }
});

app.delete('/api/v1/hotel/festivos/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM dias_festivos WHERE id = ?').run(req.params.id);
    ok(res, { message: 'Festivo eliminado' });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error eliminando festivo', 500); }
});

// ══════════════════════════════════════
// DISPONIBILIDAD
// ══════════════════════════════════════

app.get('/api/v1/hotel/disponibilidad', requireAuth, (req, res) => {
  try {
    const { check_in, check_out } = req.query;
    if (!check_in || !check_out) return err(res, 'VALIDATION_ERROR', 'check_in y check_out requeridos');
    const db = getDb();
    // Find rooms with conflicting reservations
    const occupied = db.prepare(`
      SELECT DISTINCT habitacion_id FROM reservas_hotel
      WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
        AND check_in < ? AND check_out > ?
    `).all(check_out, check_in).map(r => r.habitacion_id);

    const allRooms = db.prepare('SELECT * FROM habitaciones WHERE activa = 1 ORDER BY id').all();
    const available = allRooms.map(room => ({
      ...room,
      disponible: !occupied.includes(room.id)
    }));
    ok(res, available);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error verificando disponibilidad', 500); }
});

// Calendar grid data
app.get('/api/v1/hotel/calendario', requireAuth, (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) return err(res, 'VALIDATION_ERROR', 'desde y hasta requeridos');
    const db = getDb();
    const rooms = db.prepare('SELECT * FROM habitaciones WHERE activa = 1 ORDER BY categoria, tipo, id').all();
    const reservations = db.prepare(`
      SELECT r.*, h.nombre as habitacion_nombre, h.tipo as habitacion_tipo
      FROM reservas_hotel r
      LEFT JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE r.estado NOT IN ('Cancelada', 'No-Show')
        AND r.check_in < ? AND r.check_out > ?
      ORDER BY r.check_in
    `).all(hasta, desde);
    ok(res, { habitaciones: rooms, reservas: reservations });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error cargando calendario', 500); }
});

// ══════════════════════════════════════
// RESERVAS DE HOTEL
// ══════════════════════════════════════

app.get('/api/v1/hotel/reservas', requireAuth, (req, res) => {
  try {
    const { estado, tipo_habitacion, cliente, check_in_desde, check_in_hasta, page = 1, limit = 50 } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    if (tipo_habitacion) where.tipo_habitacion = tipo_habitacion;
    if (cliente) where.cliente_like = cliente;
    if (check_in_desde) where.check_in_gte = check_in_desde;
    if (check_in_hasta) where.check_in_lte = check_in_hasta;
    const result = findAll('reservas_hotel', { where, page: Number(page), limit: Number(limit), orderBy: 'check_in DESC' });
    // Attach room name + categoria
    const db = getDb();
    result.data = result.data.map(r => {
      if (r.habitacion_id) {
        const room = db.prepare('SELECT nombre, tipo, categoria FROM habitaciones WHERE id = ?').get(r.habitacion_id);
        if (room) {
          r.habitacion_nombre = room.nombre;
          r.categoria_habitacion = room.categoria;
          r.tipo_hab = room.tipo;
        }
      }
      return r;
    });
    ok(res, result.data, result.meta);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error listando reservas', 500); }
});

app.get('/api/v1/hotel/reservas/:id', requireAuth, (req, res) => {
  try {
    const reserva = findById('reservas_hotel', req.params.id);
    if (!reserva) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);
    const db = getDb();
    // Attach room info
    if (reserva.habitacion_id) {
      const room = findById('habitaciones', reserva.habitacion_id);
      reserva.habitacion = room;
    }
    // Attach folio
    reserva.folio = db.prepare('SELECT * FROM folio_hotel WHERE reserva_id = ? ORDER BY id ASC').all(req.params.id);
    // Attach additional guests
    reserva.huespedes_adicionales = db.prepare('SELECT * FROM huespedes_reserva WHERE reserva_id = ?').all(req.params.id);
    // Attach documents
    reserva.documentos = db.prepare('SELECT * FROM documentos_reserva WHERE reserva_id = ? ORDER BY created_at DESC').all(req.params.id);
    ok(res, reserva);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo reserva', 500); }
});

app.post('/api/v1/hotel/reservas', requireAuth, (req, res) => {
  try {
    const { cliente, check_in, check_out, habitacion_id } = req.body;
    const missing = [];
    if (!cliente) missing.push('cliente');
    if (!check_in) missing.push('check_in');
    if (!check_out) missing.push('check_out');
    if (!habitacion_id) missing.push('habitacion_id');
    if (missing.length > 0) return err(res, 'VALIDATION_ERROR', `Campos requeridos: ${missing.join(', ')}`);

    // Date validation
    if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'Check-out debe ser posterior al check-in');
    const todayStr = new Date().toISOString().split('T')[0];
    if (check_in < todayStr) return err(res, 'VALIDATION_ERROR', 'No se puede reservar en el pasado');

    const db = getDb();

    // ── Validate room availability ──
    if (habitacion_id) {
      const room = findById('habitaciones', habitacion_id);
      if (!room) return err(res, 'NOT_FOUND', 'Habitación no encontrada', 404);

      const conflict = db.prepare(`
        SELECT id, cliente, check_in, check_out FROM reservas_hotel
        WHERE habitacion_id = ? AND estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
          AND check_in < ? AND check_out > ?
      `).get(habitacion_id, check_out, check_in);

      if (conflict) {
        return err(res, 'ROOM_OCCUPIED', `Habitación ocupada del ${conflict.check_in} al ${conflict.check_out} por ${conflict.cliente}`);
      }

      // ── Validate guest capacity ──
      const totalGuests = (parseInt(req.body.adultos) || 1) + (parseInt(req.body.menores) || 0);
      const minCap = room.capacidad_min || 1;
      const maxCap = room.capacidad_max || room.capacidad || 4;
      if (totalGuests < minCap || totalGuests > maxCap) {
        return err(res, 'CAPACITY_ERROR', `${room.nombre} (${room.tipo}) admite de ${minCap} a ${maxCap} personas${room.descripcion_camas ? ` (${room.descripcion_camas})` : ''}. Seleccionaste ${totalGuests} huéspedes.`);
      }
    }

    // ── Duplicate detection ──
    const duplicate = db.prepare(`
      SELECT id FROM reservas_hotel
      WHERE LOWER(cliente) = LOWER(?) AND check_in = ? AND check_out = ?
        AND estado NOT IN ('Cancelada', 'No-Show')
    `).get(cliente, check_in, check_out);

    if (duplicate) {
      return err(res, 'DUPLICATE', `Ya existe una reserva para ${cliente} en esas fechas (ID: ${duplicate.id})`);
    }

    // ── Build reservation data ──
    const noches = calcNoches(check_in, check_out);
    const data = {
      cliente: sanitize(cliente),
      apellido: sanitize(req.body.apellido || ''),
      email: sanitize(req.body.email || ''),
      whatsapp: sanitize(req.body.whatsapp || ''),
      telefono: sanitize(req.body.telefono || ''),
      nacionalidad: sanitize(req.body.nacionalidad || ''),
      habitacion_id: habitacion_id || null,
      tipo_habitacion: sanitize(req.body.tipo_habitacion || ''),
      check_in, check_out, noches,
      hora_llegada: req.body.hora_llegada || null,
      adultos: parseInt(req.body.adultos) || 1,
      menores: parseInt(req.body.menores) || 0,
      mascotas: parseInt(req.body.mascotas) || 0,
      plan_codigo: req.body.plan_codigo || null,
      plan_nombre: sanitize(req.body.plan_nombre || ''),
      precio_adulto_noche: parseFloat(req.body.precio_adulto_noche) || 0,
      precio_menor_noche: parseFloat(req.body.precio_menor_noche) || 0,
      precio_mascota_noche: parseFloat(req.body.precio_mascota_noche) || 0,
      estado: req.body.estado || 'Confirmada',
      fuente: sanitize(req.body.fuente || 'Teléfono'),
      notas: sanitize(req.body.notas || ''),
      created_by: req.user.nombre || req.user.email
    };

    // Auto-fill from plan if plan_codigo provided
    if (data.plan_codigo && (!data.precio_adulto_noche || data.precio_adulto_noche === 0)) {
      const plan = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ? AND activo = 1').get(data.plan_codigo);
      if (plan) {
        data.plan_nombre = plan.nombre;
        data.precio_adulto_noche = plan.precio_adulto_noche;
        data.precio_menor_noche = plan.precio_menor_noche;
        data.precio_mascota_noche = plan.precio_mascota_noche;
      }
    }

    // Auto-fill tipo_habitacion from room
    if (habitacion_id && !data.tipo_habitacion) {
      const room = findById('habitaciones', habitacion_id);
      if (room) data.tipo_habitacion = room.tipo;
    }

    // Calculate totals using day-aware pricing
    let totals;
    if (data.plan_codigo) {
      const plan = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ? AND activo = 1').get(data.plan_codigo);
      if (plan) {
        totals = calcReservationWithRates(plan.id, check_in, check_out, data.adultos, data.menores, data.mascotas);
        // Store base rate from entre_semana rule for display
        data.plan_nombre = plan.nombre;
      } else {
        totals = calcReservation({ ...data, noches });
      }
    } else {
      totals = calcReservation({ ...data, noches });
    }
    // Apply calculated totals (subtotal, impuesto, monto_total, etc.)
    data.subtotal = totals.subtotal;
    data.impuesto_pct = totals.impuesto_pct;
    data.impuesto_monto = totals.impuesto_monto;
    data.monto_total = totals.monto_total;
    data.deposito_sugerido = totals.deposito_sugerido;
    data.monto_pagado = 0;
    data.saldo_pendiente = totals.monto_total;

    const reserva = create('reservas_hotel', data);

    // Create initial folio entries (débitos)
    if (data.subtotal > 0) {
      db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, registrado_por) VALUES (?, ?, ?, ?, ?)').run(
        reserva.id, 'debito', `Habitación: ${data.plan_nombre || 'Tarifa base'} (${noches} noches)`, data.subtotal, req.user.nombre
      );
    }
    if (data.impuesto_monto > 0) {
      db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, registrado_por) VALUES (?, ?, ?, ?, ?)').run(
        reserva.id, 'debito', `Impuesto Turismo ${data.impuesto_pct}%`, data.impuesto_monto, req.user.nombre
      );
    }

    ok(res, reserva, null, 201);
  } catch (e) { console.error('Error creating reserva:', e); err(res, 'SERVER_ERROR', 'Error creando reserva', 500); }
});

app.put('/api/v1/hotel/reservas/:id', requireAuth, (req, res) => {
  try {
    const existing = findById('reservas_hotel', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);

    const data = {};
    const allowed = ['cliente', 'apellido', 'email', 'whatsapp', 'telefono', 'nacionalidad',
      'habitacion_id', 'tipo_habitacion', 'check_in', 'check_out', 'hora_llegada',
      'adultos', 'menores', 'mascotas', 'plan_codigo', 'plan_nombre',
      'precio_adulto_noche', 'precio_menor_noche', 'precio_mascota_noche',
      'productos_adicionales', 'estado', 'fuente', 'notas'];

    for (const f of allowed) {
      if (req.body[f] !== undefined) data[f] = typeof req.body[f] === 'string' ? sanitize(req.body[f]) : req.body[f];
    }

    // Recalculate if pricing changed
    const merged = { ...existing, ...data };
    if (data.adultos !== undefined || data.menores !== undefined || data.mascotas !== undefined ||
        data.precio_adulto_noche !== undefined || data.check_in !== undefined || data.check_out !== undefined ||
        data.productos_adicionales !== undefined) {
      merged.noches = calcNoches(merged.check_in, merged.check_out);
      data.noches = merged.noches;
      const totals = calcReservation(merged);
      Object.assign(data, totals);
    }

    // Validate room availability if changing room or dates
    if (data.habitacion_id || data.check_in || data.check_out) {
      const db = getDb();
      const roomId = data.habitacion_id || existing.habitacion_id;
      const ci = data.check_in || existing.check_in;
      const co = data.check_out || existing.check_out;
      if (roomId) {
        const conflict = db.prepare(`
          SELECT id, cliente FROM reservas_hotel
          WHERE habitacion_id = ? AND id != ? AND estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
            AND check_in < ? AND check_out > ?
        `).get(roomId, req.params.id, co, ci);
        if (conflict) return err(res, 'ROOM_OCCUPIED', `Habitación ocupada por ${conflict.cliente}`);
      }
    }

    const updated = update('reservas_hotel', req.params.id, data);
    ok(res, updated);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error actualizando reserva', 500); }
});

// Status change (Check-in / Check-out)
app.patch('/api/v1/hotel/reservas/:id/status', requireAuth, (req, res) => {
  try {
    const { estado } = req.body;
    const valid = ['Pendiente', 'Confirmada', 'Hospedado', 'Check-Out', 'Cancelada', 'No-Show'];
    if (!valid.includes(estado)) return err(res, 'VALIDATION_ERROR', `Estados válidos: ${valid.join(', ')}`);

    const existing = findById('reservas_hotel', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);

    const updated = update('reservas_hotel', req.params.id, { estado });

    // Auto-update room status
    if (existing.habitacion_id) {
      if (estado === 'Hospedado') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Ocupada' });
      } else if (estado === 'Check-Out') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía', estado_limpieza: 'Sucia' });
      } else if (estado === 'Cancelada' || estado === 'No-Show') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía' });
      }
    }

    ok(res, updated);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error cambiando estado', 500); }
});

// ══════════════════════════════════════
// FOLIO / PAGOS
// ══════════════════════════════════════

app.get('/api/v1/hotel/reservas/:id/folio', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const entries = db.prepare('SELECT * FROM folio_hotel WHERE reserva_id = ? ORDER BY created_at').all(req.params.id);
    ok(res, entries);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo folio', 500); }
});

// Register payment (crédito)
app.post('/api/v1/hotel/reservas/:id/folio', requireAuth, (req, res) => {
  try {
    const reserva = findById('reservas_hotel', req.params.id);
    if (!reserva) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);

    const { monto, concepto, tipo = 'credito', metodo_pago, referencia } = req.body;
    if (!monto || !concepto) return err(res, 'VALIDATION_ERROR', 'monto y concepto requeridos');

    const db = getDb();
    db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, referencia, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      req.params.id, tipo, sanitize(concepto), parseFloat(monto), sanitize(metodo_pago || ''), sanitize(referencia || ''), req.user.nombre
    );

    // Recalculate balance
    if (tipo === 'credito') {
      const newPagado = Math.round((parseFloat(reserva.monto_pagado) + parseFloat(monto)) * 100) / 100;
      const newSaldo = Math.round((parseFloat(reserva.monto_total) - newPagado) * 100) / 100;
      update('reservas_hotel', req.params.id, { monto_pagado: newPagado, saldo_pendiente: newSaldo });
    } else if (tipo === 'debito') {
      // Extra charge — recalculate total
      const newExtras = Math.round((parseFloat(reserva.productos_adicionales) + parseFloat(monto)) * 100) / 100;
      const recalc = calcReservation({ ...reserva, productos_adicionales: newExtras });
      update('reservas_hotel', req.params.id, { productos_adicionales: newExtras, ...recalc });
    }

    const updated = findById('reservas_hotel', req.params.id);
    ok(res, updated, null, 201);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error registrando movimiento', 500); }
});

// Saldos pendientes
app.get('/api/v1/hotel/saldos', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const pending = db.prepare(`
      SELECT r.*, h.nombre as habitacion_nombre
      FROM reservas_hotel r
      LEFT JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE r.saldo_pendiente > 0 AND r.estado NOT IN ('Cancelada', 'No-Show')
      ORDER BY r.check_in ASC
    `).all();
    ok(res, pending);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo saldos', 500); }
});

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════

app.get('/api/v1/hotel/dashboard', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const hoy = new Date().toISOString().split('T')[0];
    const { periodo = 'mes' } = req.query; // dia, semana, mes, total

    // Period date range
    let periodoDesde;
    const d = new Date();
    if (periodo === 'dia') periodoDesde = hoy;
    else if (periodo === 'semana') { d.setDate(d.getDate() - 7); periodoDesde = d.toISOString().split('T')[0]; }
    else if (periodo === 'total') periodoDesde = '2020-01-01';
    else { periodoDesde = hoy.substring(0, 7) + '-01'; } // mes

    const totalRooms = db.prepare('SELECT COUNT(*) as c FROM habitaciones WHERE activa = 1').get().c;
    const occupied = db.prepare(`
      SELECT COUNT(DISTINCT habitacion_id) as c FROM reservas_hotel
      WHERE estado = 'Hospedado' AND check_in <= ? AND check_out > ?
    `).get(hoy, hoy).c;

    const llegadasHoy = db.prepare(`SELECT COUNT(*) as c FROM reservas_hotel WHERE check_in = ? AND estado NOT IN ('Cancelada', 'No-Show')`).get(hoy).c;
    const salidasHoy = db.prepare(`SELECT COUNT(*) as c FROM reservas_hotel WHERE check_out = ? AND estado NOT IN ('Cancelada', 'No-Show')`).get(hoy).c;
    const hospedados = db.prepare(`SELECT COUNT(*) as c FROM reservas_hotel WHERE estado = 'Hospedado'`).get().c;

    const saldoTotal = db.prepare(`
      SELECT COALESCE(SUM(saldo_pendiente), 0) as total FROM reservas_hotel
      WHERE saldo_pendiente > 0 AND estado NOT IN ('Cancelada', 'No-Show')
    `).get().total;

    // Period-filtered financials
    const ingresosPeriodo = db.prepare(`
      SELECT COALESCE(SUM(monto_total), 0) as total FROM reservas_hotel
      WHERE check_in >= ? AND estado NOT IN ('Cancelada', 'No-Show')
    `).get(periodoDesde).total;

    const reservasPeriodo = db.prepare(`
      SELECT COUNT(*) as c FROM reservas_hotel WHERE created_at >= ? AND estado NOT IN ('Cancelada', 'No-Show')
    `).get(periodoDesde).c;

    // Split reservas by category
    const reservasEstadia = db.prepare(`
      SELECT COUNT(*) as c FROM reservas_hotel r
      JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE r.created_at >= ? AND r.estado NOT IN ('Cancelada', 'No-Show') AND h.categoria = 'Estadía'
    `).get(periodoDesde).c;
    const reservasPasadia = db.prepare(`
      SELECT COUNT(*) as c FROM reservas_hotel r
      JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE r.created_at >= ? AND r.estado NOT IN ('Cancelada', 'No-Show') AND h.categoria = 'Pasadía'
    `).get(periodoDesde).c;

    const recientes = db.prepare(`
      SELECT r.*, h.nombre as habitacion_nombre FROM reservas_hotel r
      LEFT JOIN habitaciones h ON r.habitacion_id = h.id
      ORDER BY r.created_at DESC LIMIT 10
    `).all();

    const limpiezaStats = db.prepare(`
      SELECT estado_limpieza, COUNT(*) as c FROM habitaciones WHERE activa = 1 GROUP BY estado_limpieza
    `).all();

    // Status distribution (pie chart data)
    const statusDist = db.prepare(`
      SELECT estado, COUNT(*) as c FROM reservas_hotel
      WHERE check_in >= ? GROUP BY estado ORDER BY c DESC
    `).all(periodoDesde);

    // Occupancy timeline (last 14 days) — SPLIT by category
    const totalEstadia = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE activa = 1 AND categoria = 'Estadía'").get().c;
    const totalPasadia = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE activa = 1 AND categoria = 'Pasadía'").get().c;
    const timelineEstadia = [];
    const timelinePasadia = [];
    for (let i = 13; i >= 0; i--) {
      const dd = new Date(); dd.setDate(dd.getDate() - i);
      const ds = dd.toISOString().split('T')[0];
      const occE = db.prepare(`
        SELECT COUNT(DISTINCT r.habitacion_id) as c FROM reservas_hotel r
        JOIN habitaciones h ON r.habitacion_id = h.id
        WHERE h.categoria = 'Estadía' AND r.estado NOT IN ('Cancelada', 'No-Show') AND r.check_in <= ? AND r.check_out > ?
      `).get(ds, ds).c;
      const occP = db.prepare(`
        SELECT COUNT(DISTINCT r.habitacion_id) as c FROM reservas_hotel r
        JOIN habitaciones h ON r.habitacion_id = h.id
        WHERE h.categoria = 'Pasadía' AND r.estado NOT IN ('Cancelada', 'No-Show') AND r.check_in <= ? AND r.check_out > ?
      `).get(ds, ds).c;
      timelineEstadia.push({ fecha: ds, ocupadas: occE, pct: totalEstadia > 0 ? Math.round((occE / totalEstadia) * 100) : 0 });
      timelinePasadia.push({ fecha: ds, ocupadas: occP, pct: totalPasadia > 0 ? Math.round((occP / totalPasadia) * 100) : 0 });
    }

    // Ingresos por plan (for pie chart — more business-relevant)
    const ingresosPorPlan = db.prepare(`
      SELECT plan_nombre, COUNT(*) as reservas, COALESCE(SUM(monto_total), 0) as total
      FROM reservas_hotel
      WHERE check_in >= ? AND estado NOT IN ('Cancelada', 'No-Show') AND plan_nombre IS NOT NULL AND plan_nombre != ''
      GROUP BY plan_nombre ORDER BY total DESC
    `).all(periodoDesde);

    // Ocupación por tipo de habitación
    const ocupacionPorTipo = db.prepare(`
      SELECT h.tipo, h.categoria, COUNT(DISTINCT r.id) as reservas
      FROM reservas_hotel r
      JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE r.check_in >= ? AND r.estado NOT IN ('Cancelada', 'No-Show')
      GROUP BY h.tipo ORDER BY reservas DESC
    `).all(periodoDesde);

    // Limpieza by category
    const limpiezaEstadia = db.prepare(`SELECT estado_limpieza, COUNT(*) as c FROM habitaciones WHERE activa = 1 AND categoria = 'Estadía' GROUP BY estado_limpieza`).all();
    const limpiezaPasadia = db.prepare(`SELECT estado_limpieza, COUNT(*) as c FROM habitaciones WHERE activa = 1 AND categoria = 'Pasadía' GROUP BY estado_limpieza`).all();

    // Occupied counts by category
    const occupiedEstadia = db.prepare(`
      SELECT COUNT(DISTINCT r.habitacion_id) as c FROM reservas_hotel r
      JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE h.categoria = 'Estadía' AND r.estado = 'Hospedado' AND r.check_in <= ? AND r.check_out > ?
    `).get(hoy, hoy).c;
    const occupiedPasadia = db.prepare(`
      SELECT COUNT(DISTINCT r.habitacion_id) as c FROM reservas_hotel r
      JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE h.categoria = 'Pasadía' AND r.estado = 'Hospedado' AND r.check_in <= ? AND r.check_out > ?
    `).get(hoy, hoy).c;

    ok(res, {
      ocupacion: {
        total: totalRooms, ocupadas: occupied, porcentaje: Math.round((occupied / totalRooms) * 100),
        estadia: { total: totalEstadia, ocupadas: occupiedEstadia, pct: totalEstadia > 0 ? Math.round((occupiedEstadia / totalEstadia) * 100) : 0 },
        pasadia: { total: totalPasadia, ocupadas: occupiedPasadia, pct: totalPasadia > 0 ? Math.round((occupiedPasadia / totalPasadia) * 100) : 0 },
      },
      hoy: { llegadas: llegadasHoy, salidas: salidasHoy, hospedados },
      financiero: { ingresos_periodo: Math.round(ingresosPeriodo * 100) / 100, saldo_pendiente_total: Math.round(saldoTotal * 100) / 100, reservas_periodo: reservasPeriodo, reservas_estadia: reservasEstadia, reservas_pasadia: reservasPasadia },
      limpieza: limpiezaStats,
      limpieza_estadia: limpiezaEstadia,
      limpieza_pasadia: limpiezaPasadia,
      recientes,
      status_distribucion: statusDist,
      timeline_estadia: timelineEstadia,
      timeline_pasadia: timelinePasadia,
      ingresos_por_plan: ingresosPorPlan,
      ocupacion_por_tipo: ocupacionPorTipo,
      periodo
    });
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error cargando dashboard', 500); }
});

// ══════════════════════════════════════
// DOCUMENTOS / ARCHIVOS
// ══════════════════════════════════════

// Upload document
app.post('/api/v1/hotel/reservas/:id/documentos', requireAuth, upload.single('archivo'), (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo requerido (JPEG, PNG, WebP, PDF, máx 10MB)');
    const reserva = findById('reservas_hotel', req.params.id);
    if (!reserva) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);
    const db = getDb();
    const tipo = req.body.tipo || 'otro'; // cedula, pasaporte, recibo, otro
    db.prepare(`INSERT INTO documentos_reserva (reserva_id, tipo, nombre_original, nombre_archivo, mime_type, tamaño, notas, subido_por)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      req.params.id, tipo, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size,
      req.body.notas || '', req.user.nombre
    );
    const doc = db.prepare('SELECT * FROM documentos_reserva WHERE reserva_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
    ok(res, doc, null, 201);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error subiendo documento', 500); }
});

// List documents
app.get('/api/v1/hotel/reservas/:id/documentos', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const docs = db.prepare('SELECT * FROM documentos_reserva WHERE reserva_id = ? ORDER BY created_at DESC').all(req.params.id);
    ok(res, docs);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando documentos', 500); }
});

// Serve document file (supports ?token= query param for new-tab viewing)
app.get('/api/v1/hotel/documentos/:docId/archivo', (req, res) => {
  try {
    // Try normal auth first, then fall back to query token
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token;
    if (!authHeader && !queryToken) return res.status(401).json({ error: 'Token requerido' });
    
    const { decodeToken } = require('./auth');
    const token = authHeader ? authHeader.replace('Bearer ', '') : queryToken;
    const decoded = decodeToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const db = getDb();
    const doc = db.prepare('SELECT * FROM documentos_reserva WHERE id = ?').get(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    const filePath = path.join(UPLOADS_DIR, doc.nombre_archivo);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.nombre_original}"`);
    res.sendFile(filePath);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error sirviendo archivo', 500); }
});

// Delete document
app.delete('/api/v1/hotel/documentos/:docId', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const doc = db.prepare('SELECT * FROM documentos_reserva WHERE id = ?').get(req.params.docId);
    if (!doc) return err(res, 'NOT_FOUND', 'Documento no encontrado', 404);
    // Delete file
    const filePath = path.join(UPLOADS_DIR, doc.nombre_archivo);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM documentos_reserva WHERE id = ?').run(req.params.docId);
    ok(res, { deleted: true });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error eliminando documento', 500); }
});

// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════

app.get('/api/v1/hotel/config', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare('SELECT * FROM config_hotel').all();
    const obj = {};
    for (const c of config) obj[c.clave] = c.valor;
    ok(res, obj);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo config', 500); }
});

// ══════════════════════════════════════
// API KEYS (Fase 5)
// ══════════════════════════════════════

// Create API key (admin only)
app.post('/api/v1/api-keys', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { nombre, permisos = 'read', rate_limit = 100 } = req.body;
    if (!nombre) return err(res, 'VALIDATION_ERROR', 'nombre requerido');
    if (!['read', 'write', 'admin'].includes(permisos)) return err(res, 'VALIDATION_ERROR', 'permisos debe ser: read, write, admin');
    
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPreview = '...' + rawKey.slice(-8);
    
    const db = getDb();
    db.prepare('INSERT INTO api_keys (key_hash, key_preview, nombre, permisos, rate_limit) VALUES (?, ?, ?, ?, ?)')
      .run(keyHash, keyPreview, nombre, permisos, rate_limit);
    
    const created = db.prepare('SELECT id, key_preview, nombre, permisos, rate_limit, activo, created_at FROM api_keys WHERE key_hash = ?').get(keyHash);
    
    ok(res, {
      ...created,
      api_key: rawKey,  // Only returned once at creation!
      warning: '⚠️ Guarda esta API key. No se puede recuperar después.'
    }, null, 201);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error creando API key', 500); }
});

// List API keys (admin)
app.get('/api/v1/api-keys', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const keys = db.prepare('SELECT id, key_preview, nombre, permisos, rate_limit, activo, last_used, request_count, created_at FROM api_keys ORDER BY created_at DESC').all();
    ok(res, keys);
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando API keys', 500); }
});

// Revoke API key (admin)
app.delete('/api/v1/api-keys/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE api_keys SET activo = 0 WHERE id = ?').run(req.params.id);
    ok(res, { message: 'API key revocada' });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error revocando API key', 500); }
});

// ══════════════════════════════════════
// WEBHOOKS (Fase 5)
// ══════════════════════════════════════

const WEBHOOK_EVENTS = ['reserva.creada', 'reserva.estado', 'reserva.actualizada', 'pago.registrado', 'habitacion.limpieza', 'plan.actualizado'];

// Fire webhook helper
function fireWebhooks(evento, payload) {
  try {
    const db = getDb();
    const hooks = db.prepare("SELECT * FROM webhooks WHERE activo = 1").all();
    for (const hook of hooks) {
      const eventos = JSON.parse(hook.eventos || '[]');
      if (!eventos.includes(evento) && !eventos.includes('*')) continue;
      
      const body = JSON.stringify({ evento, timestamp: new Date().toISOString(), data: payload });
      const signature = hook.secret ? crypto.createHmac('sha256', hook.secret).update(body).digest('hex') : null;
      
      // Fire and forget
      const url = new URL(hook.url);
      const options = {
        hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': evento, ...(signature ? { 'X-Webhook-Signature': `sha256=${signature}` } : {}) }
      };
      const lib = url.protocol === 'https:' ? require('https') : require('http');
      const req = lib.request(options, (r) => {
        db.prepare('UPDATE webhooks SET last_triggered = datetime("now"), fail_count = CASE WHEN ? < 300 THEN 0 ELSE fail_count + 1 END WHERE id = ?').run(r.statusCode, hook.id);
      });
      req.on('error', () => {
        db.prepare('UPDATE webhooks SET fail_count = fail_count + 1 WHERE id = ?').run(hook.id);
      });
      req.write(body);
      req.end();
    }
  } catch (e) { console.error('Webhook error:', e.message); }
}

// CRUD webhooks (admin)
app.post('/api/v1/webhooks', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const { url, eventos } = req.body;
    if (!url || !eventos) return err(res, 'VALIDATION_ERROR', 'url y eventos requeridos');
    if (!Array.isArray(eventos)) return err(res, 'VALIDATION_ERROR', 'eventos debe ser un array');
    const invalid = eventos.filter(e => e !== '*' && !WEBHOOK_EVENTS.includes(e));
    if (invalid.length) return err(res, 'VALIDATION_ERROR', `Eventos inválidos: ${invalid.join(', ')}. Válidos: ${WEBHOOK_EVENTS.join(', ')}, *`);
    
    const secret = crypto.randomBytes(16).toString('hex');
    const db = getDb();
    const result = db.prepare('INSERT INTO webhooks (url, eventos, secret) VALUES (?, ?, ?)').run(url, JSON.stringify(eventos), secret);
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(result.lastInsertRowid);
    ok(res, { ...hook, eventos: JSON.parse(hook.eventos), signing_secret: secret, warning: '⚠️ Guarda el signing_secret. No se puede recuperar.' }, null, 201);
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error creando webhook', 500); }
});

app.get('/api/v1/webhooks', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const hooks = db.prepare('SELECT id, url, eventos, activo, last_triggered, fail_count, created_at FROM webhooks ORDER BY created_at DESC').all();
    ok(res, hooks.map(h => ({ ...h, eventos: JSON.parse(h.eventos || '[]') })));
  } catch (e) { err(res, 'SERVER_ERROR', 'Error listando webhooks', 500); }
});

app.delete('/api/v1/webhooks/:id', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id);
    ok(res, { message: 'Webhook eliminado' });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error eliminando webhook', 500); }
});

// Test webhook
app.post('/api/v1/webhooks/:id/test', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const hook = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
    if (!hook) return err(res, 'NOT_FOUND', 'Webhook no encontrado', 404);
    
    const testPayload = { test: true, message: 'Test webhook from Casa Mahana PMS', timestamp: new Date().toISOString() };
    const body = JSON.stringify({ evento: 'test', timestamp: new Date().toISOString(), data: testPayload });
    const signature = hook.secret ? crypto.createHmac('sha256', hook.secret).update(body).digest('hex') : null;
    
    const url = new URL(hook.url);
    const options = {
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Event': 'test', ...(signature ? { 'X-Webhook-Signature': `sha256=${signature}` } : {}) }
    };
    const lib = url.protocol === 'https:' ? require('https') : require('http');
    const req2 = lib.request(options, (r) => {
      let d = ''; r.on('data', c => d += c);
      r.on('end', () => ok(res, { status: r.statusCode, response: d.substring(0, 200) }));
    });
    req2.on('error', (e) => ok(res, { status: 'error', message: e.message }));
    req2.write(body);
    req2.end();
  } catch (e) { err(res, 'SERVER_ERROR', 'Error testing webhook', 500); }
});

// ══════════════════════════════════════
// OPENAPI / SCHEMA DISCOVERY (Fase 5)
// ══════════════════════════════════════

// Schema discovery endpoint — for AI agents
app.get('/api/v1/schema', (req, res) => {
  ok(res, {
    name: 'Casa Mahana PMS API',
    version: '1.0.0',
    base_url: '/api/v1',
    auth: {
      methods: ['Bearer JWT (from POST /auth/login)', 'X-API-Key header'],
      note: 'All endpoints require auth except /api/docs, /api/openapi.json, /api/v1/schema'
    },
    entities: {
      habitaciones: {
        description: 'Hotel rooms and pasadía units',
        endpoints: [
          { method: 'GET', path: '/hotel/habitaciones', description: 'List all rooms', auth: 'read' },
          { method: 'GET', path: '/hotel/habitaciones/:id', description: 'Get room by ID', auth: 'read' },
          { method: 'PATCH', path: '/hotel/habitaciones/:id', description: 'Update room (limpieza, etc)', auth: 'write' },
          { method: 'PATCH', path: '/habitaciones/masiva', description: 'Bulk update limpieza', auth: 'admin', body: { ids: '[1,2,3]', estado_limpieza: 'Limpia|Sucia|Inspeccionada' } }
        ],
        fields: { id: 'int', nombre: 'string', tipo: 'string (Familiar|Doble|Estándar|Camping|Bohío|Salón)', categoria: 'string (Estadía|Pasadía)', estado_limpieza: 'string (Sucia|Limpia|Inspeccionada)', estado_habitacion: 'string (Vacía|Ocupada)' }
      },
      planes: {
        description: 'Rate plans / products',
        endpoints: [
          { method: 'GET', path: '/hotel/planes', description: 'List plans', auth: 'read' },
          { method: 'POST', path: '/hotel/planes', description: 'Create plan', auth: 'admin' },
          { method: 'PUT', path: '/hotel/planes/:id', description: 'Update plan', auth: 'admin' },
          { method: 'GET', path: '/hotel/planes/:id/reglas', description: 'Get day-based rate rules', auth: 'read' },
          { method: 'PUT', path: '/hotel/planes/:id/reglas', description: 'Update rate rules', auth: 'admin' }
        ],
        fields: { id: 'int', codigo: 'string (unique)', nombre: 'string', categoria: 'string (Estadía|Pasadía)', precio_adulto_noche: 'float', precio_menor_noche: 'float', precio_mascota_noche: 'float' }
      },
      reservas: {
        description: 'Hotel reservations',
        endpoints: [
          { method: 'GET', path: '/hotel/reservas', description: 'List reservations (filterable)', auth: 'read', query: 'estado, cliente, check_in_desde, check_in_hasta, page, limit' },
          { method: 'GET', path: '/hotel/reservas/:id', description: 'Get reservation detail with folio', auth: 'read' },
          { method: 'POST', path: '/hotel/reservas', description: 'Create reservation', auth: 'write', required: 'cliente, check_in, check_out, habitacion_id, plan_codigo' },
          { method: 'PUT', path: '/hotel/reservas/:id', description: 'Update reservation', auth: 'write' },
          { method: 'PATCH', path: '/hotel/reservas/:id/estado', description: 'Change status', auth: 'write', body: { estado: 'Confirmada|Check-In|Check-Out|Cancelada|No-Show|Por Aprobar' } }
        ],
        fields: { id: 'int', cliente: 'string', apellido: 'string', check_in: 'date', check_out: 'date', habitacion_id: 'int', plan_codigo: 'string', adultos: 'int', menores: 'int', estado: 'string', monto_total: 'float', saldo_pendiente: 'float' }
      },
      folio: {
        description: 'Payment/charge records per reservation',
        endpoints: [
          { method: 'POST', path: '/hotel/reservas/:id/folio', description: 'Add payment or charge', auth: 'write', body: { monto: 'float', concepto: 'string', tipo: 'credito|debito', metodo_pago: 'efectivo|transferencia|yappy|tarjeta|paypal' } }
        ]
      },
      cotizar: {
        description: 'Price quotation engine (day-aware)',
        endpoints: [
          { method: 'GET', path: '/hotel/cotizar', description: 'Get price quote', auth: 'read', query: 'plan (codigo), adultos, menores, mascotas, check_in, check_out', returns: 'subtotal, impuesto, monto_total, desglose per night' }
        ]
      },
      disponibilidad: {
        description: 'Room availability check',
        endpoints: [
          { method: 'GET', path: '/hotel/disponibilidad', description: 'Check available rooms', auth: 'read', query: 'check_in, check_out' }
        ]
      },
      dashboard: {
        description: 'Dashboard analytics',
        endpoints: [
          { method: 'GET', path: '/hotel/dashboard', description: 'Get occupancy, revenue, stats', auth: 'read' }
        ]
      },
      api_keys: {
        description: 'API key management',
        endpoints: [
          { method: 'POST', path: '/api-keys', description: 'Create API key', auth: 'admin' },
          { method: 'GET', path: '/api-keys', description: 'List API keys', auth: 'admin' },
          { method: 'DELETE', path: '/api-keys/:id', description: 'Revoke API key', auth: 'admin' }
        ]
      },
      webhooks: {
        description: 'Webhook subscriptions',
        endpoints: [
          { method: 'POST', path: '/webhooks', description: 'Create webhook', auth: 'admin' },
          { method: 'GET', path: '/webhooks', description: 'List webhooks', auth: 'admin' },
          { method: 'DELETE', path: '/webhooks/:id', description: 'Delete webhook', auth: 'admin' },
          { method: 'POST', path: '/webhooks/:id/test', description: 'Test webhook', auth: 'admin' }
        ],
        available_events: WEBHOOK_EVENTS
      }
    },
    rate_limiting: { default: '100 req/min per API key', headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'] },
    day_types: { entre_semana: 'Sunday-Thursday', fin_de_semana: 'Friday-Saturday', festivo: 'Configured holidays' }
  });
});

// OpenAPI JSON spec
app.get('/api/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: { title: 'Casa Mahana PMS API', version: '1.0.0', description: 'Hotel Management System API with day-based pricing, AI agent support, and webhook events.' },
    servers: [{ url: '/api/v1' }],
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' }
      }
    },
    paths: {
      '/auth/login': { post: { summary: 'Login', tags: ['Auth'], requestBody: { content: { 'application/json': { schema: { properties: { email: { type: 'string' }, password: { type: 'string' } } } } } } } },
      '/hotel/habitaciones': { get: { summary: 'List rooms', tags: ['Rooms'], security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }] } },
      '/hotel/planes': { get: { summary: 'List plans', tags: ['Plans'] }, post: { summary: 'Create plan', tags: ['Plans'] } },
      '/hotel/reservas': { get: { summary: 'List reservations', tags: ['Reservations'] }, post: { summary: 'Create reservation', tags: ['Reservations'] } },
      '/hotel/reservas/{id}': { get: { summary: 'Get reservation', tags: ['Reservations'] }, put: { summary: 'Update reservation', tags: ['Reservations'] } },
      '/hotel/cotizar': { get: { summary: 'Price quotation', tags: ['Pricing'] } },
      '/hotel/disponibilidad': { get: { summary: 'Check availability', tags: ['Availability'] } },
      '/hotel/dashboard': { get: { summary: 'Dashboard stats', tags: ['Dashboard'] } },
      '/api-keys': { get: { summary: 'List API keys', tags: ['API Keys'] }, post: { summary: 'Create API key', tags: ['API Keys'] } },
      '/webhooks': { get: { summary: 'List webhooks', tags: ['Webhooks'] }, post: { summary: 'Create webhook', tags: ['Webhooks'] } }
    }
  });
});

// Swagger UI
app.get('/api/docs', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><title>Casa Mahana PMS API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui', deepLinking: true });</script>
</body></html>`);
});

// ══════════════════════════════════════
// PUBLIC BOOKING API (no auth - Fase 6)
// ══════════════════════════════════════

// Public availability — returns room TYPES (not IDs) with availability count
app.get('/api/v1/public/disponibilidad', (req, res) => {
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
app.get('/api/v1/public/planes', (req, res) => {
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
app.get('/api/v1/public/cotizar', (req, res) => {
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
app.get('/api/v1/public/paypal-config', (req, res) => {
  try {
    const clientId = getConfig('paypal_client_id') || process.env.PAYPAL_CLIENT_ID || '';
    const mode = getConfig('paypal_mode') || process.env.PAYPAL_MODE || 'sandbox';
    ok(res, { paypal_enabled: !!clientId, paypal_client_id: clientId || null, paypal_mode: mode });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error config PayPal', 500); }
});

// PayPal create order (server-side)
app.post('/api/v1/public/paypal/create-order', async (req, res) => {
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
app.post('/api/v1/public/paypal/capture-order', async (req, res) => {
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

// Public reservation creation (with PayPal payment)
app.post('/api/v1/public/reservar', (req, res) => {
  try {
    const { cliente, apellido, email, whatsapp, nacionalidad, check_in, check_out, tipo_habitacion, plan_codigo, adultos = 1, menores = 0, mascotas = 0, monto_pagado = 0, paypal_order_id, pago_tipo = 'deposito' } = req.body;
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
      estado: 'Por Aprobar', fuente: 'Website', notas: paypal_order_id ? `PayPal Order: ${paypal_order_id}` : '',
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
      db.prepare('INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, referencia, registrado_por) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        reserva.id, 'credito', pago_tipo === 'total' ? 'Pago total (Website)' : 'Depósito (Website)',
        paidAmount, 'paypal', paypal_order_id || '', 'Web Booking');
    }

    // Fire webhook
    fireWebhooks('reserva.creada', { reserva_id: reserva.id, cliente, check_in, check_out, plan: plan.nombre, monto_total: totals.monto_total, monto_pagado: paidAmount, fuente: 'Website' });

    ok(res, { reserva_id: reserva.id, mensaje: 'Reserva recibida. Nuestro equipo la revisará y confirmaremos por email/WhatsApp.' }, null, 201);
  } catch (e) { console.error('Public booking error:', e); err(res, 'SERVER_ERROR', 'Error creando reserva', 500); }
});

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// ══════════════════════════════════════
// STATIC ASSETS (production)
// ══════════════════════════════════════

const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ══════════════════════════════════════
// START
// ══════════════════════════════════════

app.listen(PORT, () => {
  getDb(); // Initialize on startup
  console.log(`🏨 Casa Mahana PMS running on port ${PORT}`);
});
