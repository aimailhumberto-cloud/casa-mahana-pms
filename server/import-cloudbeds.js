/**
 * ══════════════════════════════════════════════
 * Casa Mahana PMS — Cloudbeds Import Module
 * ══════════════════════════════════════════════
 * 
 * Parses CSV/XLSX exports from Cloudbeds and maps
 * them into our PMS schema (reservas_hotel, folio_hotel).
 * 
 * Handles:
 * - Smart column detection (fuzzy header matching)
 * - Status mapping (Cloudbeds → PMS)
 * - Room assignment by name or type
 * - Financial calculations
 * - Duplicate detection
 * - Payment/transaction import
 */

const Papa = require('papaparse');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// ══════════════════════════════════════
// COLUMN MAPPING — Cloudbeds variations
// ══════════════════════════════════════

// Each PMS field has multiple possible Cloudbeds header names
const COLUMN_MAP = {
  reservation_id: [
    'reservation id', 'reservation_id', 'reservationid', 'res id', 'booking id',
    'booking_id', 'id', 'confirmation', 'confirmation number', 'conf #', 'conf#'
  ],
  first_name: [
    'first name', 'first_name', 'firstname', 'guest first name', 'guest_first_name',
    'nombre', 'guest name', 'name'
  ],
  last_name: [
    'last name', 'last_name', 'lastname', 'surname', 'guest last name',
    'guest_last_name', 'apellido', 'family name'
  ],
  email: [
    'email', 'e-mail', 'guest email', 'guest_email', 'correo', 'email address'
  ],
  phone: [
    'phone', 'telephone', 'phone number', 'phone_number', 'guest phone',
    'guest_phone', 'tel', 'telefono', 'teléfono', 'mobile', 'cell'
  ],
  check_in: [
    'check-in', 'check_in', 'checkin', 'check in', 'arrival', 'arrival date',
    'arrival_date', 'start date', 'start_date', 'fecha entrada', 'fecha_entrada',
    'check-in date'
  ],
  check_out: [
    'check-out', 'check_out', 'checkout', 'check out', 'departure', 'departure date',
    'departure_date', 'end date', 'end_date', 'fecha salida', 'fecha_salida',
    'check-out date'
  ],
  nights: [
    'nights', 'noches', 'length of stay', 'los', 'duration', 'stay length',
    'total nights', 'no. of nights'
  ],
  room_type: [
    'room type', 'room_type', 'roomtype', 'type', 'accommodation type',
    'accommodation', 'tipo habitacion', 'tipo habitación', 'tipo_habitacion',
    'room type name', 'room category'
  ],
  room_name: [
    'room', 'room #', 'room number', 'room_number', 'room name', 'room_name',
    'assignment', 'assigned room', 'habitacion', 'habitación', 'room no',
    'room no.', 'unit', 'unit name'
  ],
  adults: [
    'adults', 'adult', 'adultos', 'no. of adults', 'number of adults',
    'adult guests', 'pax adults', 'adult count'
  ],
  children: [
    'children', 'child', 'kids', 'menores', 'niños', 'no. of children',
    'number of children', 'child guests', 'pax children', 'child count'
  ],
  status: [
    'status', 'estado', 'reservation status', 'booking status', 'res status',
    'state'
  ],
  total: [
    'total', 'grand total', 'total amount', 'amount', 'total price',
    'reservation total', 'monto total', 'monto_total', 'total charge',
    'total (usd)', 'total ($)'
  ],
  balance: [
    'balance', 'balance due', 'remaining', 'saldo', 'saldo pendiente',
    'outstanding', 'amount due', 'unpaid'
  ],
  paid: [
    'paid', 'amount paid', 'total paid', 'payments', 'pagado', 'monto pagado',
    'collected', 'received'
  ],
  source: [
    'source', 'channel', 'booking source', 'booking_source', 'fuente',
    'origin', 'booking channel', 'ota', 'channel name'
  ],
  created: [
    'created', 'created at', 'created_at', 'booking date', 'booking_date',
    'reservation date', 'date created', 'date booked', 'booked on',
    'fecha creacion', 'fecha_creacion'
  ],
  notes: [
    'notes', 'note', 'notas', 'comments', 'guest notes', 'special requests',
    'remarks', 'internal notes', 'memo'
  ],
  country: [
    'country', 'nationality', 'nacionalidad', 'pais', 'país', 'guest country',
    'country of residence'
  ],
  // Additional fields
  rate_plan: [
    'rate plan', 'rate_plan', 'plan', 'package', 'rate', 'plan name',
    'rate plan name', 'tariff'
  ],
  arrival_time: [
    'arrival time', 'eta', 'estimated arrival', 'check-in time',
    'hora llegada', 'hora_llegada'
  ],
};

// ══════════════════════════════════════
// STATUS MAPPING
// ══════════════════════════════════════

const STATUS_MAP = {
  // English Cloudbeds statuses
  'confirmed':    'Confirmada',
  'not confirmed': 'Pendiente',
  'unconfirmed':  'Pendiente',
  'pending':      'Pendiente',
  'checked in':   'Hospedado',
  'in-house':     'Hospedado',
  'in house':     'Hospedado',
  'checked out':  'Check-Out',
  'check-out':    'Check-Out',
  'checkout':     'Check-Out',
  'cancelled':    'Cancelada',
  'canceled':     'Cancelada',
  'no show':      'No-Show',
  'no-show':      'No-Show',
  'noshow':       'No-Show',
  // Spanish (in case Cloudbeds is in Spanish)
  'confirmada':   'Confirmada',
  'pendiente':    'Pendiente',
  'hospedado':    'Hospedado',
  'cancelada':    'Cancelada',
};

// ══════════════════════════════════════
// SOURCE MAPPING
// ══════════════════════════════════════

const SOURCE_MAP = {
  'booking.com':    'Booking.com',
  'booking':        'Booking.com',
  'expedia':        'Expedia',
  'airbnb':         'Airbnb',
  'direct':         'Directo',
  'walk-in':        'Walk-In',
  'walkin':         'Walk-In',
  'walk in':        'Walk-In',
  'phone':          'Teléfono',
  'telephone':      'Teléfono',
  'email':          'Email',
  'website':        'Website',
  'booking engine': 'Website',
  'front desk':     'Recepción',
  'agoda':          'Agoda',
  'tripadvisor':    'TripAdvisor',
  'google':         'Google',
  'whatsapp':       'WhatsApp',
};

// ══════════════════════════════════════
// PARSER
// ══════════════════════════════════════

/**
 * Parse file contents based on extension
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @returns {{ headers: string[], rows: object[] }}
 */
function parseFile(fileBuffer, filename) {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.xlsx' || ext === '.xls') {
    return parseExcel(fileBuffer);
  } else {
    return parseCSV(fileBuffer);
  }
}

function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  // Try to detect delimiter
  const firstLine = text.split('\n')[0];
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';

  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: h => h.trim(),
  });

  return {
    headers: result.meta.fields || [],
    rows: result.data,
    errors: result.errors,
  };
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return {
    headers,
    rows: data,
    errors: [],
  };
}

// ══════════════════════════════════════
// COLUMN DETECTION
// ══════════════════════════════════════

/**
 * Auto-detect which file headers map to which PMS fields
 * @param {string[]} fileHeaders 
 * @returns {{ mapping: object, unmapped: string[] }}
 */
function detectColumns(fileHeaders) {
  const mapping = {};     // pmsField -> fileHeader
  const used = new Set();
  const normalized = fileHeaders.map(h => h.toLowerCase().trim());

  for (const [pmsField, variations] of Object.entries(COLUMN_MAP)) {
    for (const variant of variations) {
      const idx = normalized.indexOf(variant);
      if (idx !== -1 && !used.has(idx)) {
        mapping[pmsField] = fileHeaders[idx]; // original case
        used.add(idx);
        break;
      }
    }
  }

  // Also try partial matching for headers not yet mapped
  for (const [pmsField, variations] of Object.entries(COLUMN_MAP)) {
    if (mapping[pmsField]) continue; // already mapped
    for (const variant of variations) {
      const idx = normalized.findIndex((h, i) => !used.has(i) && h.includes(variant));
      if (idx !== -1) {
        mapping[pmsField] = fileHeaders[idx];
        used.add(idx);
        break;
      }
    }
  }

  const unmapped = fileHeaders.filter((_, i) => !used.has(i));
  return { mapping, unmapped };
}

// ══════════════════════════════════════
// DATE PARSER
// ══════════════════════════════════════

/**
 * Parse various date formats into YYYY-MM-DD
 */
function parseDate(value) {
  if (!value) return null;

  // If already a Date object (from XLSX)
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  const str = String(value).trim();
  if (!str) return null;

  // ISO format: 2026-03-15 or 2026-03-15T...
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }

  // US format: 03/15/2026 or 3/15/2026
  const usMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
  }

  // EU format: 15/03/2026 (day > 12 tells us it's DD/MM)
  const euMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (euMatch && parseInt(euMatch[1]) > 12) {
    return `${euMatch[3]}-${euMatch[2].padStart(2, '0')}-${euMatch[1].padStart(2, '0')}`;
  }

  // Try native Date parse as fallback
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// ══════════════════════════════════════
// ROW PROCESSOR
// ══════════════════════════════════════

/**
 * Extract a row's value using the detected mapping
 */
function getValue(row, mapping, pmsField) {
  const header = mapping[pmsField];
  if (!header) return null;
  const val = row[header];
  if (val === undefined || val === null || val === '') return null;
  return typeof val === 'string' ? val.trim() : val;
}

/**
 * Process a single row into a PMS reservation object
 */
function processRow(row, mapping, rooms, plans) {
  const errors = [];
  const warnings = [];

  // ── Required: Guest name ──
  let cliente = getValue(row, mapping, 'first_name');
  let apellido = getValue(row, mapping, 'last_name');
  
  // Handle case where full name is in one field
  if (cliente && !apellido && cliente.includes(' ')) {
    const parts = cliente.split(' ');
    cliente = parts[0];
    apellido = parts.slice(1).join(' ');
  }

  if (!cliente) {
    errors.push('Sin nombre de huésped');
    return { data: null, errors, warnings };
  }

  // ── Required: Dates ──
  const checkIn = parseDate(getValue(row, mapping, 'check_in'));
  const checkOut = parseDate(getValue(row, mapping, 'check_out'));

  if (!checkIn) {
    errors.push('Sin fecha de check-in');
    return { data: null, errors, warnings };
  }
  if (!checkOut) {
    errors.push('Sin fecha de check-out');
    return { data: null, errors, warnings };
  }

  if (checkOut <= checkIn) {
    errors.push(`Check-out (${checkOut}) no es posterior a check-in (${checkIn})`);
    return { data: null, errors, warnings };
  }

  // ── Nights ──
  const rawNights = getValue(row, mapping, 'nights');
  const d1 = new Date(checkIn);
  const d2 = new Date(checkOut);
  const calcNoches = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
  const noches = rawNights ? parseInt(rawNights) : calcNoches;

  // ── Room ──
  let habitacionId = null;
  let tipoHabitacion = '';
  
  const roomName = getValue(row, mapping, 'room_name');
  const roomType = getValue(row, mapping, 'room_type');

  // Try to match room by name
  if (roomName) {
    const room = rooms.find(r => 
      r.nombre.toLowerCase() === String(roomName).toLowerCase() ||
      r.nombre.toLowerCase().includes(String(roomName).toLowerCase())
    );
    if (room) {
      habitacionId = room.id;
      tipoHabitacion = room.tipo;
    } else {
      warnings.push(`Habitación "${roomName}" no encontrada en PMS`);
    }
  }

  // Try to match by room type
  if (!habitacionId && roomType) {
    tipoHabitacion = mapRoomType(roomType);
    // Find first available room of that type
    const room = rooms.find(r => r.tipo.toLowerCase() === tipoHabitacion.toLowerCase());
    if (room) {
      habitacionId = room.id;
    } else {
      warnings.push(`Tipo "${roomType}" no mapeado a habitación PMS`);
    }
  }

  // ── Status ──
  const rawStatus = getValue(row, mapping, 'status');
  let estado = 'Confirmada';
  if (rawStatus) {
    const mapped = STATUS_MAP[rawStatus.toLowerCase()];
    if (mapped) {
      estado = mapped;
    } else {
      warnings.push(`Estado desconocido: "${rawStatus}", usando "Confirmada"`);
    }
  }

  // ── Guests ──
  const adultos = parseInt(getValue(row, mapping, 'adults')) || 1;
  const menores = parseInt(getValue(row, mapping, 'children')) || 0;

  // ── Financial ──
  const montoTotal = parseFloat(getValue(row, mapping, 'total')) || 0;
  const saldoPendiente = parseFloat(getValue(row, mapping, 'balance')) || 0;
  const montoPagado = parseFloat(getValue(row, mapping, 'paid')) || (montoTotal - saldoPendiente);

  // ── Source ──
  const rawSource = getValue(row, mapping, 'source');
  let fuente = 'Cloudbeds';
  if (rawSource) {
    const mapped = SOURCE_MAP[rawSource.toLowerCase()];
    fuente = mapped || rawSource;
  }

  // ── Other fields ──
  const reservationId = getValue(row, mapping, 'reservation_id');
  const email = getValue(row, mapping, 'email');
  const phone = getValue(row, mapping, 'phone');
  const nationality = getValue(row, mapping, 'country');
  const notes = getValue(row, mapping, 'notes');
  const createdAt = parseDate(getValue(row, mapping, 'created'));
  const ratePlan = getValue(row, mapping, 'rate_plan');
  const arrivalTime = getValue(row, mapping, 'arrival_time');

  // ── Build note with reference ──
  const noteParts = [];
  if (reservationId) noteParts.push(`CB#${reservationId}`);
  if (notes) noteParts.push(notes);
  const fullNotes = noteParts.join(' | ');

  // ── Calculate financials ──
  const impuestoPct = 10;
  const subtotal = montoTotal > 0 ? Math.round((montoTotal / (1 + impuestoPct / 100)) * 100) / 100 : 0;
  const impuestoMonto = Math.round((montoTotal - subtotal) * 100) / 100;
  const depositoPct = 50;
  const depositoSugerido = Math.round(montoTotal * (depositoPct / 100) * 100) / 100;

  // ── Price per night (reverse-calculated) ──
  const precioNoche = noches > 0 && subtotal > 0
    ? Math.round((subtotal / noches / Math.max(adultos, 1)) * 100) / 100
    : 0;

  const data = {
    cliente,
    apellido: apellido || '',
    email: email || '',
    whatsapp: phone || '',
    telefono: phone || '',
    nacionalidad: nationality || '',
    habitacion_id: habitacionId,
    tipo_habitacion: tipoHabitacion,
    check_in: checkIn,
    check_out: checkOut,
    noches,
    hora_llegada: arrivalTime || null,
    adultos,
    menores,
    mascotas: 0,
    plan_codigo: null,
    plan_nombre: ratePlan || '',
    precio_adulto_noche: precioNoche,
    precio_menor_noche: 0,
    precio_mascota_noche: 0,
    subtotal,
    productos_adicionales: 0,
    impuesto_pct: impuestoPct,
    impuesto_monto: impuestoMonto,
    monto_total: montoTotal,
    deposito_sugerido: depositoSugerido,
    monto_pagado: Math.max(0, montoPagado),
    saldo_pendiente: Math.max(0, montoTotal - Math.max(0, montoPagado)),
    estado,
    fuente: `${fuente} (CB Import)`,
    notas: fullNotes,
    created_by: 'Cloudbeds Import',
    created_at: createdAt || new Date().toISOString(),
    // Extra reference for duplicate detection
    _cb_reservation_id: reservationId,
    _cb_raw_status: rawStatus,
  };

  return { data, errors, warnings };
}

// ══════════════════════════════════════
// ROOM TYPE MAPPING
// ══════════════════════════════════════

function mapRoomType(cbType) {
  if (!cbType) return '';
  const lower = cbType.toLowerCase();

  // Direct matches
  if (lower.includes('familiar') || lower.includes('family')) return 'Familiar';
  if (lower.includes('doble') || lower.includes('double') || lower.includes('twin')) return 'Doble';
  if (lower.includes('estándar') || lower.includes('estandar') || lower.includes('standard')) return 'Estándar';
  if (lower.includes('camping') || lower.includes('tent') || lower.includes('glamping')) return 'Camping';
  if (lower.includes('bohío') || lower.includes('bohio') || lower.includes('cabana') || lower.includes('cabaña')) return 'Bohío';
  if (lower.includes('salón') || lower.includes('salon') || lower.includes('hall') || lower.includes('event')) return 'Salón';
  if (lower.includes('restaurante') || lower.includes('restaurant') || lower.includes('dining')) return 'Restaurante';
  if (lower.includes('suite')) return 'Familiar';
  if (lower.includes('single') || lower.includes('sencilla')) return 'Estándar';

  return cbType; // return as-is if no match
}

// ══════════════════════════════════════
// IMPORT RUNNER
// ══════════════════════════════════════

/**
 * Import parsed rows into PMS database
 * @param {object} db - SQLite database instance  
 * @param {object[]} rows - Parsed file rows
 * @param {object} mapping - Column mapping
 * @param {object} options - { dryRun, skipDuplicates }
 * @returns {object} Import results
 */
function runImport(db, rows, mapping, options = {}) {
  const { dryRun = false, skipDuplicates = true } = options;

  // Get rooms and plans for matching
  const rooms = db.prepare('SELECT * FROM habitaciones WHERE activa = 1 ORDER BY id').all();
  const plans = db.prepare('SELECT * FROM planes_tarifa WHERE activo = 1').all();

  const results = {
    total: rows.length,
    imported: 0,
    duplicates: 0,
    errors: 0,
    skipped: 0,
    details: [], // per-row results
  };

  const importTxn = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        const { data, errors, warnings } = processRow(row, mapping, rooms, plans);

        if (errors.length > 0) {
          results.errors++;
          results.details.push({ row: rowNum, status: 'error', errors, warnings });
          continue;
        }

        // ── Duplicate check ──
        if (skipDuplicates) {
          const existing = db.prepare(`
            SELECT id FROM reservas_hotel 
            WHERE LOWER(cliente) = LOWER(?) AND check_in = ? AND check_out = ?
              AND estado NOT IN ('Cancelada', 'No-Show')
          `).get(data.cliente, data.check_in, data.check_out);

          // Also check by Cloudbeds reservation ID in notes
          let existingByCbId = null;
          if (data._cb_reservation_id) {
            existingByCbId = db.prepare(`
              SELECT id FROM reservas_hotel WHERE notas LIKE ?
            `).get(`%CB#${data._cb_reservation_id}%`);
          }

          if (existing || existingByCbId) {
            results.duplicates++;
            results.details.push({
              row: rowNum,
              status: 'duplicate',
              guest: `${data.cliente} ${data.apellido}`,
              dates: `${data.check_in} → ${data.check_out}`,
              existingId: (existing || existingByCbId)?.id,
              warnings,
            });
            continue;
          }
        }

        if (dryRun) {
          results.imported++;
          results.details.push({
            row: rowNum,
            status: 'preview',
            guest: `${data.cliente} ${data.apellido}`,
            dates: `${data.check_in} → ${data.check_out}`,
            room: data.tipo_habitacion || '—',
            total: data.monto_total,
            estado: data.estado,
            warnings,
          });
          continue;
        }

        // ── Insert reservation ──
        // Remove internal fields
        const cbId = data._cb_reservation_id;
        const cbStatus = data._cb_raw_status;
        delete data._cb_reservation_id;
        delete data._cb_raw_status;

        const fields = Object.keys(data);
        const placeholders = fields.map(() => '?').join(', ');
        const insertResult = db.prepare(
          `INSERT INTO reservas_hotel (${fields.join(', ')}) VALUES (${placeholders})`
        ).run(...Object.values(data));

        const reservaId = insertResult.lastInsertRowid;

        // ── Create folio entries ──
        if (data.subtotal > 0) {
          db.prepare(
            'INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, registrado_por, fecha) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(reservaId, 'debito', `Hospedaje (${data.noches} noches)`, data.subtotal, 'CB Import', data.check_in);
        }
        if (data.impuesto_monto > 0) {
          db.prepare(
            'INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, registrado_por, fecha) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(reservaId, 'debito', `Impuesto ${data.impuesto_pct}%`, data.impuesto_monto, 'CB Import', data.check_in);
        }
        if (data.monto_pagado > 0) {
          db.prepare(
            'INSERT INTO folio_hotel (reserva_id, tipo, concepto, monto, metodo_pago, registrado_por, fecha) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).run(reservaId, 'credito', 'Pago registrado (Cloudbeds)', data.monto_pagado, '', 'CB Import', data.check_in);
        }

        // ── Update room status for active reservations ──
        if (data.habitacion_id && data.estado === 'Hospedado') {
          db.prepare('UPDATE habitaciones SET estado_habitacion = ? WHERE id = ?').run('Ocupada', data.habitacion_id);
        }

        results.imported++;
        results.details.push({
          row: rowNum,
          status: 'imported',
          reservaId,
          guest: `${data.cliente} ${data.apellido}`,
          dates: `${data.check_in} → ${data.check_out}`,
          room: data.tipo_habitacion || '—',
          total: data.monto_total,
          estado: data.estado,
          warnings,
        });

      } catch (e) {
        results.errors++;
        results.details.push({
          row: rowNum,
          status: 'error',
          errors: [e.message],
          warnings: [],
        });
      }
    }
  });

  if (!dryRun) {
    importTxn(); // Run as single transaction (atomic)
  } else {
    // For dry run, process without transaction
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const { data, errors, warnings } = processRow(row, mapping, rooms, plans);
        if (errors.length > 0) {
          results.errors++;
          results.details.push({ row: rowNum, status: 'error', errors, warnings });
          continue;
        }
        // Duplicate check
        if (skipDuplicates) {
          const existing = db.prepare(`
            SELECT id FROM reservas_hotel 
            WHERE LOWER(cliente) = LOWER(?) AND check_in = ? AND check_out = ?
              AND estado NOT IN ('Cancelada', 'No-Show')
          `).get(data.cliente, data.check_in, data.check_out);
          let existingByCbId = null;
          if (data._cb_reservation_id) {
            existingByCbId = db.prepare(`SELECT id FROM reservas_hotel WHERE notas LIKE ?`).get(`%CB#${data._cb_reservation_id}%`);
          }
          if (existing || existingByCbId) {
            results.duplicates++;
            results.details.push({ row: rowNum, status: 'duplicate', guest: `${data.cliente} ${data.apellido}`, dates: `${data.check_in} → ${data.check_out}`, existingId: (existing || existingByCbId)?.id, warnings });
            continue;
          }
        }
        results.imported++;
        results.details.push({
          row: rowNum, status: 'preview',
          guest: `${data.cliente} ${data.apellido}`,
          dates: `${data.check_in} → ${data.check_out}`,
          room: data.tipo_habitacion || '—',
          total: data.monto_total,
          estado: data.estado,
          warnings,
        });
      } catch (e) {
        results.errors++;
        results.details.push({ row: rowNum, status: 'error', errors: [e.message], warnings: [] });
      }
    }
  }

  return results;
}

module.exports = {
  parseFile,
  detectColumns,
  runImport,
  COLUMN_MAP,
  STATUS_MAP,
  SOURCE_MAP,
};
