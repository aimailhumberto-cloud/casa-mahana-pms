const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db/database');
const logger = require('./utils/logger');
const { startScheduler } = require('./utils/scheduler');

const app = express();
const PORT = process.env.PORT || 3201;

// ── Middleware ──
const corsOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true;

if (process.env.NODE_ENV === 'production' && corsOrigins === true) {
  logger.warn('⚠️ WARNING: ALLOWED_ORIGINS not set in production. Falling back to reflected origins.');
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production' && corsOrigins !== true ? corsOrigins : true,
  credentials: true
}));
app.use(express.json());

// Request logging middleware with status code and duration
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// ── Helpers ──
function ok(res, data, meta, status = 200) {
  const response = { success: true, data };
  if (meta) response.meta = meta;
  return res.status(status).json(response);
}

const WEBHOOK_EVENTS = ['reserva.creada', 'reserva.estado', 'reserva.actualizada', 'pago.registrado', 'habitacion.limpieza', 'plan.actualizado'];

// ── Modular Routers ──
const authRouter = require('./routes/auth');
const habRouter = require('./routes/habitaciones');
const apiRouter = require('./routes/apikeys');
const webRouter = require('./routes/webhooks');
const adminRouter = require('./routes/admin');
const publicRouter = require('./routes/public');
const hotelRouter = require('./routes/hotel');

// ── Mount Routes ──
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/habitaciones', habRouter);
app.use('/api/v1/api-keys', apiRouter);
app.use('/api/v1/webhooks', webRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/public', publicRouter);
app.use('/api/v1', hotelRouter); // serves /hotel/* and /reportes/*

// ── Health Check ──
app.get('/health', (req, res) => {
  try {
    const db = getDb();
    // Run a quick query to ensure database is responsive
    db.prepare('SELECT 1').get();
    
    // Check if data directory is writable
    const dbDir = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
    fs.accessSync(dbDir, fs.constants.W_OK);
    
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      storage: 'writable'
    });
  } catch (err) {
    logger.error('Healthcheck failed:', err);
    return res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
});

// ── OPENAPI / SCHEMA DISCOVERY ──

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
          { method: 'PATCH', path: '/hotel/reservas/:id/status', description: 'Change status', auth: 'write', body: { estado: 'Pendiente|Confirmada|Hospedado|Check-Out|Cancelada|No-Show' } }
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

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// ── Static Assets (production) ──
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ── Start Server ──
const server = app.listen(PORT, () => {
  const db = getDb(); // Initialize on startup

  // Start background scheduler
  try {
    startScheduler();
  } catch (err) {
    logger.error('Failed to start background scheduler:', err);
  }

  // ── Auto-migrate Cloudbeds guest history (one-time) ──
  try {
    const guestCount = db.prepare("SELECT COUNT(*) as c FROM huespedes WHERE total_reservas > 0 AND total_ingresos > 0").get().c;
    const importedCount = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'").get().c;

    // Fix: if existing imports have Camping rooms, delete and re-generate
    let needsMigration = guestCount > 0 && importedCount === 0;
    if (importedCount > 0) {
      const campingImports = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE created_by = 'Cloudbeds Import' AND tipo_habitacion = 'Camping'").get().c;
      if (campingImports > 0) {
        logger.info(`🔧 Fixing ${campingImports} Camping-assigned historical reservations...`);
        db.prepare("DELETE FROM folio_hotel WHERE reserva_id IN (SELECT id FROM reservas_hotel WHERE created_by = 'Cloudbeds Import')").run();
        db.prepare("DELETE FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'").run();
        needsMigration = true;
      }
    }

    if (needsMigration) {
      logger.info(`🔄 Auto-migrating ${guestCount} guests into historical reservations...`);

      const rooms = db.prepare("SELECT id, nombre, tipo FROM habitaciones WHERE categoria = 'Estadía' AND activa = 1 AND tipo != 'Camping'").all();
      if (rooms.length === 0) {
        logger.warn('⚠️ No Estadía rooms found, skipping migration');
      } else {
        const guests = db.prepare("SELECT * FROM huespedes WHERE total_reservas > 0 AND total_ingresos > 0 ORDER BY ultima_estadia DESC").all();

        const addDays = (ds, days) => {
          const d = new Date(ds + 'T12:00:00Z');
          d.setUTCDate(d.getUTCDate() + days);
          return d.toISOString().split('T')[0];
        };

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
        txn();
        logger.info(`✅ Migrated ${total.toLocaleString()} historical reservations ($${revenue.toLocaleString()})`);
      }
    }
  } catch (e) {
    logger.error('Migration check error:', e);
  }

  logger.info(`🏨 Casa Mahana PMS running on port ${PORT}`);
});

module.exports = { app, server };
