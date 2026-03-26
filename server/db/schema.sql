-- Casa Mahana PMS - Database Schema
-- SQLite

-- ═══ HABITACIONES ═══
CREATE TABLE IF NOT EXISTS habitaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,                   -- "FAM(1)", "CAMP(3)", "BOHIO(2)"
  tipo TEXT NOT NULL,                     -- "Familiar", "Doble", "Estándar", "Camping", "Bohío", "Salón", "Restaurante"
  categoria TEXT DEFAULT 'Estadía',       -- "Estadía" o "Pasadía"
  capacidad INTEGER DEFAULT 2,
  capacidad_min INTEGER DEFAULT 1,        -- Mínimo de personas
  capacidad_max INTEGER DEFAULT 4,        -- Máximo de personas
  descripcion_camas TEXT,                 -- "1 King + 1 Litera", etc.
  piso TEXT,
  estado_limpieza TEXT DEFAULT 'Sucia',   -- Sucia, Limpia, Inspeccionada
  estado_habitacion TEXT DEFAULT 'Vacía', -- Vacía, Ocupada
  asignado_a TEXT,
  no_molestar INTEGER DEFAULT 0,
  comentarios TEXT,
  activa INTEGER DEFAULT 1
);

-- ═══ PLANES DE TARIFA / PRODUCTOS ═══
CREATE TABLE IF NOT EXISTS planes_tarifa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'Estadía',       -- "Estadía", "Pasadía", "Otro"
  precio_adulto_noche REAL NOT NULL,
  precio_menor_noche REAL DEFAULT 0,
  precio_mascota_noche REAL DEFAULT 0,
  -- Rich product fields
  incluye TEXT,                           -- JSON array: ["Habitación", "Desayuno", "Cena"]
  horario TEXT,                           -- "Check-in 3PM / Check-out 11AM" or "9AM - 5PM"
  extras_disponibles TEXT,                -- JSON array: ["Spa $25", "Tour $15"]
  tipos_aplicables TEXT,                  -- JSON array of room types: ["Familiar","Doble"] or ["Bohío","Salón"]
  imagen TEXT,                            -- URL or path to product image
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══ REGLAS DE TARIFA POR DÍA ═══
CREATE TABLE IF NOT EXISTS reglas_tarifa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  tipo_dia TEXT NOT NULL,                 -- "entre_semana" (Dom-Jue), "fin_de_semana" (Vie-Sáb), "festivo"
  precio_adulto REAL NOT NULL,
  precio_menor REAL DEFAULT 0,
  precio_mascota REAL DEFAULT 0,
  activo INTEGER DEFAULT 1,
  FOREIGN KEY (plan_id) REFERENCES planes_tarifa(id)
);

-- ═══ DÍAS FESTIVOS ═══
CREATE TABLE IF NOT EXISTS dias_festivos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL UNIQUE,             -- "2026-01-01"
  nombre TEXT NOT NULL                    -- "Año Nuevo"
);

CREATE INDEX IF NOT EXISTS idx_reglas_plan ON reglas_tarifa(plan_id);
CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON dias_festivos(fecha);

-- ═══ RESERVAS DE HOTEL ═══
CREATE TABLE IF NOT EXISTS reservas_hotel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Huésped principal
  cliente TEXT NOT NULL,
  apellido TEXT,
  email TEXT,
  whatsapp TEXT,
  telefono TEXT,
  nacionalidad TEXT,
  -- Habitación
  habitacion_id INTEGER,
  tipo_habitacion TEXT,
  -- Fechas
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  noches INTEGER,
  hora_llegada TEXT,
  -- Huéspedes
  adultos INTEGER DEFAULT 1,
  menores INTEGER DEFAULT 0,
  mascotas INTEGER DEFAULT 0,
  -- Plan y tarifas (snapshot al crear)
  plan_codigo TEXT,
  plan_nombre TEXT,
  precio_adulto_noche REAL,
  precio_menor_noche REAL,
  precio_mascota_noche REAL,
  -- Cálculos
  subtotal REAL DEFAULT 0,
  productos_adicionales REAL DEFAULT 0,
  impuesto_pct REAL DEFAULT 10,
  impuesto_monto REAL DEFAULT 0,
  monto_total REAL DEFAULT 0,
  deposito_sugerido REAL DEFAULT 0,
  monto_pagado REAL DEFAULT 0,
  saldo_pendiente REAL DEFAULT 0,
  -- Estado
  estado TEXT DEFAULT 'Confirmada',
  fuente TEXT DEFAULT 'Teléfono',
  notas TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
);

-- ═══ FOLIO / MOVIMIENTOS ═══
CREATE TABLE IF NOT EXISTS folio_hotel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_id INTEGER NOT NULL,
  tipo TEXT NOT NULL,               -- "credito" o "debito"
  concepto TEXT NOT NULL,
  monto REAL NOT NULL,
  metodo_pago TEXT,
  referencia TEXT,
  registrado_por TEXT,
  fecha TEXT DEFAULT (date('now')),
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reserva_id) REFERENCES reservas_hotel(id)
);

-- ═══ HUÉSPEDES ADICIONALES ═══
CREATE TABLE IF NOT EXISTS huespedes_reserva (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_id INTEGER NOT NULL,
  nombre TEXT,
  apellido TEXT,
  tipo TEXT DEFAULT 'adulto',
  email TEXT,
  telefono TEXT,
  FOREIGN KEY (reserva_id) REFERENCES reservas_hotel(id)
);

-- ═══ USUARIOS ═══
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  rol TEXT DEFAULT 'staff',       -- admin, staff
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ CONFIGURACIÓN ═══
CREATE TABLE IF NOT EXISTS config_hotel (
  clave TEXT PRIMARY KEY,
  valor TEXT,
  descripcion TEXT
);

-- ═══ DOCUMENTOS / ARCHIVOS ═══
CREATE TABLE IF NOT EXISTS documentos_reserva (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reserva_id INTEGER REFERENCES reservas_hotel(id),
  tipo TEXT NOT NULL,          -- 'cedula', 'pasaporte', 'recibo', 'otro'
  nombre_original TEXT,
  nombre_archivo TEXT NOT NULL,
  mime_type TEXT,
  tamaño INTEGER,
  notas TEXT,
  subido_por TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ API KEYS (para agentes AI) ═══
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT NOT NULL UNIQUE,       -- bcrypt hash del API key
  key_preview TEXT NOT NULL,           -- últimos 8 chars para identificar: "...abc12345"
  nombre TEXT NOT NULL,                -- "BEE Smart Agent", "WhatsApp Bot"
  permisos TEXT DEFAULT 'read',        -- "read", "write", "admin"
  rate_limit INTEGER DEFAULT 100,      -- requests por minuto
  activo INTEGER DEFAULT 1,
  last_used TEXT,
  request_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ WEBHOOKS ═══
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,                    -- "https://example.com/webhook"
  eventos TEXT NOT NULL,                -- JSON array: ["reserva.creada", "pago.registrado"]
  secret TEXT,                         -- HMAC signing secret
  activo INTEGER DEFAULT 1,
  last_triggered TEXT,
  fail_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ ÍNDICES ═══
CREATE INDEX IF NOT EXISTS idx_reservas_checkin ON reservas_hotel(check_in);
CREATE INDEX IF NOT EXISTS idx_reservas_checkout ON reservas_hotel(check_out);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON reservas_hotel(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_habitacion ON reservas_hotel(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_documentos_reserva ON documentos_reserva(reserva_id);
CREATE INDEX IF NOT EXISTS idx_folio_reserva ON folio_hotel(reserva_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

