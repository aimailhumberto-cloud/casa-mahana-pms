const express = require('express');
const router = express.Router();
const path = require('path');
const { getDb } = require('../db/database');
const { requireAuth, requireRole } = require('../auth');
const { parseFile, detectColumns, runImport } = require('../import-cloudbeds');
const { importUpload } = require('../utils/upload');

// ── Helpers ──
function ok(res, data, meta, status = 200) {
  const response = { success: true, data };
  if (meta) response.meta = meta;
  return res.status(status).json(response);
}

function err(res, code, message, status = 400) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[<>]/g, '');
}

// Guest column mapping (Cloudbeds Spanish export)
const GUEST_COLUMNS = {
  nombre: ['nombre', 'first name', 'first_name', 'name', 'guest name'],
  apellido: ['apellido', 'last name', 'last_name', 'surname', 'family name'],
  email: ['correo electrónico', 'correo electronico', 'correo', 'email', 'e-mail', 'guest email'],
  telefono: ['teléfono', 'telefono', 'phone', 'telephone', 'mobile', 'cell'],
  direccion: ['dirección', 'direccion', 'address', 'street'],
  ciudad: ['ciudad', 'city'],
  pais: ['país', 'pais', 'country', 'nationality'],
  provincia: ['provincia', 'state', 'region'],
  codigo_postal: ['código postal', 'codigo postal', 'zip', 'postal code', 'zip code'],
  total_reservas: ['total de las reservas', 'total reservas', 'reservations', 'total reservations', 'bookings'],
  noches_estadia: ['noches de estadía', 'noches de estadia', 'noches', 'nights', 'total nights', 'stay nights'],
  total_ingresos: ['total de ingresos', 'ingresos', 'revenue', 'total revenue', 'income'],
  ultima_estadia: ['última estadía', 'ultima estadia', 'last stay', 'last visit', 'last checkout'],
  huesped_habitual: ['huésped habitual', 'huesped habitual', 'returning guest', 'repeat guest', 'habitual'],
  estado_huesped: ['estado del huésped', 'estado del huesped', 'guest status', 'status'],
};

function detectGuestColumns(fileHeaders) {
  const mapping = {};
  const used = new Set();
  const normalized = fileHeaders.map(h => h.toLowerCase().trim());

  for (const [field, variations] of Object.entries(GUEST_COLUMNS)) {
    for (const variant of variations) {
      const idx = normalized.findIndex((h, i) => !used.has(i) && (h === variant || h.includes(variant)));
      if (idx !== -1) {
        mapping[field] = fileHeaders[idx];
        used.add(idx);
        break;
      }
    }
  }
  const unmapped = fileHeaders.filter((_, i) => !used.has(i));
  return { mapping, unmapped };
}

// Preview import (dry run — no data saved)
router.post('/import/preview', requireAuth, requireRole('admin'), importUpload.single('archivo'), (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo CSV o XLSX requerido');
    const { headers, rows, errors: parseErrors } = parseFile(req.file.buffer, req.file.originalname);
    if (rows.length === 0) return err(res, 'EMPTY_FILE', 'El archivo no contiene datos');
    const { mapping, unmapped } = detectColumns(headers);

    // Check minimum required columns
    if (!mapping.first_name) return err(res, 'MISSING_COLUMN', 'No se encontró columna de nombre del huésped');
    if (!mapping.check_in) return err(res, 'MISSING_COLUMN', 'No se encontró columna de check-in');
    if (!mapping.check_out) return err(res, 'MISSING_COLUMN', 'No se encontró columna de check-out');

    const db = getDb();
    const results = runImport(db, rows, mapping, { dryRun: true, skipDuplicates: true });

    ok(res, {
      filename: req.file.originalname,
      total_rows: rows.length,
      headers,
      mapping,
      unmapped,
      preview: results.details.slice(0, 20),
      summary: {
        will_import: results.imported,
        duplicates: results.duplicates,
        errors: results.errors,
      },
      parse_errors: parseErrors?.slice(0, 5) || [],
    });
  } catch (e) {
    console.error('Import preview error:', e);
    err(res, 'SERVER_ERROR', `Error procesando archivo: ${e.message}`, 500);
  }
});

// Execute import (saves data)
router.post('/import/execute', requireAuth, requireRole('admin'), importUpload.single('archivo'), (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo CSV o XLSX requerido');
    const { headers, rows, errors: parseErrors } = parseFile(req.file.buffer, req.file.originalname);
    if (rows.length === 0) return err(res, 'EMPTY_FILE', 'El archivo no contiene datos');
    const { mapping, unmapped } = detectColumns(headers);

    if (!mapping.first_name) return err(res, 'MISSING_COLUMN', 'No se encontró columna de nombre del huésped');
    if (!mapping.check_in) return err(res, 'MISSING_COLUMN', 'No se encontró columna de check-in');
    if (!mapping.check_out) return err(res, 'MISSING_COLUMN', 'No se encontró columna de check-out');

    const db = getDb();
    const results = runImport(db, rows, mapping, { dryRun: false, skipDuplicates: true });

    ok(res, {
      filename: req.file.originalname,
      summary: {
        total: results.total,
        imported: results.imported,
        duplicates: results.duplicates,
        errors: results.errors,
      },
      mapping,
      details: results.details,
    });
  } catch (e) {
    console.error('Import execute error:', e);
    err(res, 'SERVER_ERROR', `Error importando: ${e.message}`, 500);
  }
});

// Import history — count imported reservations + guests
router.get('/import/stats', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDb();
    const imported = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'").get().c;
    const lastImport = db.prepare("SELECT created_at FROM reservas_hotel WHERE created_by = 'Cloudbeds Import' ORDER BY id DESC LIMIT 1").get();
    // Guest stats
    let guestsImported = 0, lastGuestImport = null;
    try {
      guestsImported = db.prepare("SELECT COUNT(*) as c FROM huespedes WHERE fuente_import = 'Cloudbeds'").get().c;
      const lg = db.prepare("SELECT created_at FROM huespedes WHERE fuente_import = 'Cloudbeds' ORDER BY id DESC LIMIT 1").get();
      lastGuestImport = lg?.created_at || null;
    } catch(e) { /* table may not exist yet */ }
    ok(res, {
      total_imported: imported,
      last_import: lastImport?.created_at || null,
      guests_imported: guestsImported,
      last_guest_import: lastGuestImport,
    });
  } catch (e) { err(res, 'SERVER_ERROR', 'Error obteniendo stats', 500); }
});

// Preview guests import
router.post('/import/guests/preview', requireAuth, requireRole('admin'), importUpload.single('archivo'), (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo requerido');
    const { headers, rows } = parseFile(req.file.buffer, req.file.originalname);
    if (rows.length === 0) return err(res, 'EMPTY_FILE', 'El archivo no contiene datos');

    const { mapping, unmapped } = detectGuestColumns(headers);
    if (!mapping.nombre) return err(res, 'MISSING_COLUMN', 'No se encontró columna de nombre');

    const db = getDb();
    let duplicates = 0, willImport = 0, errors = 0;
    const preview = [];

    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      const nombre = row[mapping.nombre]?.toString().trim();
      const apellido = mapping.apellido ? row[mapping.apellido]?.toString().trim() : '';
      const email = mapping.email ? row[mapping.email]?.toString().trim() : '';

      if (!nombre) { errors++; preview.push({ row: i+1, status: 'error', errors: ['Sin nombre'] }); continue; }

      // Check duplicate
      let isDup = false;
      try {
        if (email) {
          isDup = !!db.prepare("SELECT id FROM huespedes WHERE email = ?").get(email);
        }
        if (!isDup) {
          isDup = !!db.prepare("SELECT id FROM huespedes WHERE LOWER(nombre) = LOWER(?) AND LOWER(apellido) = LOWER(?)").get(nombre, apellido || '');
        }
      } catch(e) { /* table may not exist */ }

      if (isDup) {
        duplicates++;
        preview.push({ row: i+1, status: 'duplicate', guest: `${nombre} ${apellido}`, email });
      } else {
        willImport++;
        const totalRes = mapping.total_reservas ? parseInt(row[mapping.total_reservas]) || 0 : 0;
        const totalRev = mapping.total_ingresos ? parseFloat(row[mapping.total_ingresos]) || 0 : 0;
        const noches = mapping.noches_estadia ? parseInt(row[mapping.noches_estadia]) || 0 : 0;
        const pais = mapping.pais ? row[mapping.pais]?.toString().trim() : '';
        preview.push({
          row: i+1, status: 'preview', guest: `${nombre} ${apellido}`,
          email, pais, total_reservas: totalRes, total_ingresos: totalRev, noches,
        });
      }
    }

    // Count totals for full file
    let fullDups = 0, fullImport = 0, fullErrors = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const nombre = row[mapping.nombre]?.toString().trim();
      if (!nombre) { fullErrors++; continue; }
      const apellido = mapping.apellido ? row[mapping.apellido]?.toString().trim() : '';
      const email = mapping.email ? row[mapping.email]?.toString().trim() : '';
      let isDup = false;
      try {
        if (email) isDup = !!db.prepare("SELECT id FROM huespedes WHERE email = ?").get(email);
        if (!isDup) isDup = !!db.prepare("SELECT id FROM huespedes WHERE LOWER(nombre) = LOWER(?) AND LOWER(apellido) = LOWER(?)").get(nombre, apellido || '');
      } catch(e) { }
      if (isDup) fullDups++; else fullImport++;
    }

    ok(res, {
      type: 'guests',
      filename: req.file.originalname,
      total_rows: rows.length,
      headers,
      mapping,
      unmapped,
      preview,
      summary: {
        will_import: fullImport,
        duplicates: fullDups,
        errors: fullErrors,
      },
    });
  } catch (e) {
    console.error('Guest preview error:', e);
    err(res, 'SERVER_ERROR', `Error procesando archivo: ${e.message}`, 500);
  }
});

// Execute guests import
router.post('/import/guests/execute', requireAuth, requireRole('admin'), importUpload.single('archivo'), (req, res) => {
  try {
    if (!req.file) return err(res, 'VALIDATION_ERROR', 'Archivo requerido');
    const { headers, rows } = parseFile(req.file.buffer, req.file.originalname);
    if (rows.length === 0) return err(res, 'EMPTY_FILE', 'El archivo no contiene datos');

    const { mapping } = detectGuestColumns(headers);
    if (!mapping.nombre) return err(res, 'MISSING_COLUMN', 'No se encontró columna de nombre');

    const db = getDb();
    let imported = 0, duplicates = 0, errors = 0;
    const details = [];

    const parseGuestDate = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      // DD/MM/YYYY format (Cloudbeds Spanish)
      const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      // ISO
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);
      // Date object
      if (val instanceof Date) return val.toISOString().split('T')[0];
      return str;
    };

    const txn = db.transaction(() => {
      const insertStmt = db.prepare(`INSERT INTO huespedes 
        (nombre, apellido, email, telefono, direccion, ciudad, pais, provincia, codigo_postal,
         total_reservas, noches_estadia, total_ingresos, ultima_estadia, huesped_habitual, estado_huesped, fuente_import)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const nombre = row[mapping.nombre]?.toString().trim();
          if (!nombre) { errors++; details.push({ row: i+1, status: 'error', errors: ['Sin nombre'] }); continue; }

          const apellido = mapping.apellido ? row[mapping.apellido]?.toString().trim() || '' : '';
          const email = mapping.email ? row[mapping.email]?.toString().trim() || '' : '';
          const telefono = mapping.telefono ? row[mapping.telefono]?.toString().trim() || '' : '';
          const direccion = mapping.direccion ? row[mapping.direccion]?.toString().trim() || '' : '';
          const ciudad = mapping.ciudad ? row[mapping.ciudad]?.toString().trim() || '' : '';
          const pais = mapping.pais ? row[mapping.pais]?.toString().trim() || '' : '';
          const provincia = mapping.provincia ? row[mapping.provincia]?.toString().trim() || '' : '';
          const codigoPostal = mapping.codigo_postal ? row[mapping.codigo_postal]?.toString().trim() || '' : '';
          const totalReservas = mapping.total_reservas ? parseInt(row[mapping.total_reservas]) || 0 : 0;
          const nochesEstadia = mapping.noches_estadia ? parseInt(row[mapping.noches_estadia]) || 0 : 0;
          const totalIngresos = mapping.total_ingresos ? parseFloat(row[mapping.total_ingresos]) || 0 : 0;
          const ultimaEstadia = mapping.ultima_estadia ? parseGuestDate(row[mapping.ultima_estadia]) : null;
          const habitual = mapping.huesped_habitual ? (row[mapping.huesped_habitual]?.toString().toLowerCase() === 'sí' || row[mapping.huesped_habitual]?.toString().toLowerCase() === 'si' || row[mapping.huesped_habitual]?.toString().toLowerCase() === 'yes' ? 1 : 0) : 0;
          const estadoHuesped = mapping.estado_huesped ? row[mapping.estado_huesped]?.toString().trim() || '' : '';

          // Duplicate check
          let isDup = false;
          if (email) isDup = !!db.prepare("SELECT id FROM huespedes WHERE email = ?").get(email);
          if (!isDup) isDup = !!db.prepare("SELECT id FROM huespedes WHERE LOWER(nombre) = LOWER(?) AND LOWER(apellido) = LOWER(?)").get(nombre, apellido);

          if (isDup) {
            duplicates++;
            details.push({ row: i+1, status: 'duplicate', guest: `${nombre} ${apellido}` });
            continue;
          }

          insertStmt.run(nombre, apellido, email, telefono, direccion, ciudad, pais, provincia, codigoPostal,
            totalReservas, nochesEstadia, totalIngresos, ultimaEstadia, habitual, estadoHuesped, 'Cloudbeds');

          imported++;
          if (details.length < 100) {
            details.push({ row: i+1, status: 'imported', guest: `${nombre} ${apellido}`, email, pais, total_reservas: totalReservas, total_ingresos: totalIngresos });
          }
        } catch (e) {
          errors++;
          details.push({ row: i+1, status: 'error', errors: [e.message] });
        }
      }
    });
    txn();

    // ── Auto-generate historical reservations from imported guests ──
    let migratedRes = 0, migratedRev = 0;
    if (imported > 0) {
      try {
        const existingImports = db.prepare("SELECT COUNT(*) as c FROM reservas_hotel WHERE created_by = 'Cloudbeds Import'").get().c;
        if (existingImports === 0) {
          const rooms = db.prepare("SELECT id, nombre, tipo FROM habitaciones WHERE categoria = 'Estadía' AND activa = 1").all();
          if (rooms.length > 0) {
            const allGuests = db.prepare("SELECT * FROM huespedes WHERE total_reservas > 0 AND total_ingresos > 0 ORDER BY ultima_estadia DESC").all();
            const addD = (ds, days) => { const dt = new Date(ds + 'T12:00:00Z'); dt.setUTCDate(dt.getUTCDate() + days); return dt.toISOString().split('T')[0]; };
            const iR = db.prepare("INSERT INTO reservas_hotel (cliente, apellido, email, telefono, nacionalidad, habitacion_id, tipo_habitacion, check_in, check_out, noches, adultos, menores, mascotas, plan_nombre, subtotal, impuesto_pct, impuesto_monto, monto_total, monto_pagado, saldo_pendiente, estado, fuente, notas, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,10,?,?,?,0,'Check-Out','Cloudbeds',?,'Cloudbeds Import',?)");
            const iF = db.prepare("INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, registrado_por, fecha, created_at) VALUES (?,'credito','Pago histórico Cloudbeds',?,'Histórico','Cloudbeds Import',?,?)");
            let ri = 0;
            const txn2 = db.transaction(() => {
              for (const g of allGuests) {
                const nr = Math.max(1, g.total_reservas || 1);
                const tn = Math.max(nr, g.noches_estadia || nr);
                const tr = g.total_ingresos || 0;
                const an = Math.max(1, Math.round(tn / nr));
                const ar = Math.round((tr / nr) * 100) / 100;
                let anchor = g.ultima_estadia;
                if (!anchor || anchor.length < 8) anchor = '2024-06-01';
                for (let i = 0; i < nr; i++) {
                  const off = i * (an + 30 + Math.floor(Math.random() * 30));
                  const co = addD(anchor, -off);
                  const ci = addD(co, -an);
                  const room = rooms[ri % rooms.length]; ri++;
                  let rev = i === nr - 1 && nr > 1 ? Math.round((tr - ar * (nr - 1)) * 100) / 100 : ar;
                  if (rev < 0) rev = ar;
                  const sub = Math.round(rev / 1.10 * 100) / 100;
                  const tax = Math.round((rev - sub) * 100) / 100;
                  const r2 = iR.run(g.nombre, g.apellido||'', g.email||'', g.telefono||'', g.pais||'', room.id, room.tipo, ci, co, an, Math.min(2, Math.max(1, Math.ceil(rev/150))), 'Estadía Todo Incluido', sub, tax, rev, rev, `Historial Cloudbeds #${i+1}/${nr}`, ci+'T08:00:00');
                  iF.run(r2.lastInsertRowid, rev, ci, ci+'T08:00:00');
                  migratedRes++; migratedRev += rev;
                }
              }
            });
            txn2();
            console.log(`✅ Auto-generated ${migratedRes} historical reservations ($${migratedRev.toLocaleString()})`);
          }
        }
      } catch (me) { console.error('Migration after import:', me.message); }
    }

    ok(res, {
      type: 'guests',
      filename: req.file.originalname,
      summary: { total: rows.length, imported, duplicates, errors, reservas_generadas: migratedRes },
      details: details.slice(0, 50),
    });
  } catch (e) {
    console.error('Guest import error:', e);
    err(res, 'SERVER_ERROR', `Error importando huéspedes: ${e.message}`, 500);
  }
});

module.exports = router;
