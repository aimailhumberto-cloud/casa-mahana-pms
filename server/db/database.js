const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { hashPassword } = require('../auth');

const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    // ── Seed habitaciones ──
    const roomCount = db.prepare('SELECT COUNT(*) as c FROM habitaciones').get();
    if (roomCount.c === 0) {
      const insertRoom = db.prepare('INSERT INTO habitaciones (nombre, tipo, categoria, capacidad, capacidad_min, capacidad_max, descripcion_camas) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const seedRooms = db.transaction(() => {
        // Estadía
        for (let i = 1; i <= 4; i++) insertRoom.run(`FAM(${i})`, 'Familiar', 'Estadía', 6, 2, 6, '1 King + 1 Litera');
        for (let i = 1; i <= 5; i++) insertRoom.run(`DOB(${i})`, 'Doble', 'Estadía', 4, 2, 4, '1 Queen + 1 Sencilla');
        for (let i = 1; i <= 3; i++) insertRoom.run(`EST(${i})`, 'Estándar', 'Estadía', 3, 2, 3, '1 Doble + 1 Sencilla');
        for (let i = 1; i <= 20; i++) insertRoom.run(`CAMP(${i})`, 'Camping', 'Estadía', 2, 1, 2, 'Tienda / Hamaca');
        // Pasadía
        for (let i = 1; i <= 17; i++) insertRoom.run(`BOHIO(${i})`, 'Bohío', 'Pasadía', 10, 1, 10, 'Bohío techado');
        insertRoom.run('SALON(1)', 'Salón', 'Pasadía', 50, 1, 50, 'Salón para eventos (~50 personas)');
        insertRoom.run('REST(1)', 'Restaurante', 'Pasadía', 40, 1, 40, 'Área de restaurante');
      });
      seedRooms();
      console.log('✅ Seeded habitaciones (Estadía + Pasadía)');
    } else {
      // Migration: add columns if missing and rename types
      const cols = db.prepare('PRAGMA table_info(habitaciones)').all().map(c => c.name);
      if (!cols.includes('capacidad_min')) {
        db.exec('ALTER TABLE habitaciones ADD COLUMN capacidad_min INTEGER DEFAULT 1');
        db.exec('ALTER TABLE habitaciones ADD COLUMN capacidad_max INTEGER DEFAULT 4');
        db.exec('ALTER TABLE habitaciones ADD COLUMN descripcion_camas TEXT');
      }
      if (!cols.includes('categoria')) {
        db.exec("ALTER TABLE habitaciones ADD COLUMN categoria TEXT DEFAULT 'Estadía'");
        // Rename old types
        db.exec("UPDATE habitaciones SET tipo = 'Doble' WHERE tipo = 'Standard'");
        db.exec("UPDATE habitaciones SET tipo = 'Estándar' WHERE tipo = 'Sencilla'");
        // Rename old room names
        db.exec("UPDATE habitaciones SET nombre = REPLACE(nombre, 'STD(', 'DOB(') WHERE nombre LIKE 'STD(%'");
        db.exec("UPDATE habitaciones SET nombre = REPLACE(nombre, 'SEN(', 'EST(') WHERE nombre LIKE 'SEN(%'");
        // Update capacity for renamed types
        db.exec("UPDATE habitaciones SET capacidad_min=2, capacidad_max=6, descripcion_camas='1 King + 1 Litera' WHERE tipo='Familiar'");
        db.exec("UPDATE habitaciones SET capacidad_min=2, capacidad_max=4, descripcion_camas='1 Queen + 1 Sencilla' WHERE tipo='Doble'");
        db.exec("UPDATE habitaciones SET capacidad_min=2, capacidad_max=3, descripcion_camas='1 Doble + 1 Sencilla' WHERE tipo='Estándar'");
        // Seed new rooms if not exist
        const insertRoom = db.prepare('INSERT INTO habitaciones (nombre, tipo, categoria, capacidad, capacidad_min, capacidad_max, descripcion_camas) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const hasCamping = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE tipo = 'Camping'").get().c;
        if (hasCamping === 0) {
          for (let i = 1; i <= 20; i++) insertRoom.run(`CAMP(${i})`, 'Camping', 'Estadía', 2, 1, 2, 'Tienda / Hamaca');
        }
        const hasBohio = db.prepare("SELECT COUNT(*) as c FROM habitaciones WHERE tipo = 'Bohío'").get().c;
        if (hasBohio === 0) {
          for (let i = 1; i <= 17; i++) insertRoom.run(`BOHIO(${i})`, 'Bohío', 'Pasadía', 10, 1, 10, 'Bohío techado');
          insertRoom.run('SALON(1)', 'Salón', 'Pasadía', 50, 1, 50, 'Salón para eventos (~50 personas)');
          insertRoom.run('REST(1)', 'Restaurante', 'Pasadía', 40, 1, 40, 'Área de restaurante');
        }
        console.log('✅ Migrated habitaciones: categoría + tipos renombrados + nuevas unidades');
      }
    }

    // ── Seed planes de tarifa ──
    const planCount = db.prepare('SELECT COUNT(*) as c FROM planes_tarifa').get();
    if (planCount.c === 0) {
      const insertPlan = db.prepare(`INSERT INTO planes_tarifa 
        (codigo, nombre, descripcion, categoria, precio_adulto_noche, precio_menor_noche, precio_mascota_noche, incluye, horario, extras_disponibles, tipos_aplicables, visible_web) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      // Estadía
      insertPlan.run('oferta_simple', 'Oferta Simple', 'Solo habitación, sin comidas', 'Estadía', 50, 25, 15,
        JSON.stringify(['Habitación', 'Estacionamiento', 'WiFi']),
        'Check-in 3:00 PM / Check-out 11:00 AM',
        JSON.stringify(['Desayuno $12', 'Almuerzo $15', 'Cena $18', 'Spa $25']),
        JSON.stringify(['Familiar', 'Doble', 'Estándar', 'Camping']), 0);
      insertPlan.run('mahana_exp', 'Mahana Experience', 'Habitación + Desayuno buffet', 'Estadía', 70, 35, 15,
        JSON.stringify(['Habitación', 'Desayuno Buffet', 'Piscina', 'WiFi', 'Estacionamiento']),
        'Check-in 3:00 PM / Check-out 11:00 AM / Desayuno 7-10 AM',
        JSON.stringify(['Almuerzo $15', 'Cena $18', 'Spa $25', 'Tour $20']),
        JSON.stringify(['Familiar', 'Doble', 'Estándar']), 1);
      insertPlan.run('todo_incluido', 'Todo Incluido', 'Habitación + 3 comidas completas', 'Estadía', 90, 45, 15,
        JSON.stringify(['Habitación', 'Desayuno Buffet', 'Almuerzo', 'Cena', 'Piscina', 'WiFi', 'Estacionamiento', 'Snacks']),
        'Check-in 3:00 PM / Check-out 11:00 AM / Desayuno 7-10 AM / Almuerzo 12-3 PM / Cena 6-9 PM',
        JSON.stringify(['Spa $25', 'Tour $20', 'Masaje $30']),
        JSON.stringify(['Familiar', 'Doble', 'Estándar']), 1);
      insertPlan.run('open_bar', 'Open Bar Premium', 'Habitación + comidas + open bar ilimitado', 'Estadía', 120, 60, 15,
        JSON.stringify(['Habitación', 'Desayuno Buffet', 'Almuerzo', 'Cena', 'Open Bar', 'Piscina', 'WiFi', 'Estacionamiento', 'Snacks', 'Room Service']),
        'Check-in 3:00 PM / Check-out 11:00 AM / Bar 10 AM - 12 AM',
        JSON.stringify(['Spa $25', 'Tour $20']),
        JSON.stringify(['Familiar', 'Doble']), 0);
      // Pasadía
      insertPlan.run('pasadia_entrada', 'Pasadía Entrada', 'Solo acceso al área de piscina y playa', 'Pasadía', 5.50, 3, 0,
        JSON.stringify(['Acceso Piscina', 'Acceso Playa', 'Estacionamiento']),
        '9:00 AM - 5:00 PM',
        JSON.stringify(['Almuerzo $12', 'Cerveza $3', 'Cóctel $5', 'Bohío $15']),
        JSON.stringify(['Bohío', 'Salón', 'Restaurante']), 0);
      insertPlan.run('pasadia_comidas', 'Pasadía Comidas + Semi Open Bar', 'Acceso + comida + bebidas incluidas', 'Pasadía', 35, 20, 0,
        JSON.stringify(['Acceso Piscina', 'Acceso Playa', 'Almuerzo', 'Semi Open Bar (cerveza, ron, vodka)', 'Estacionamiento']),
        '9:00 AM - 5:00 PM / Almuerzo 12-2 PM / Bar 10 AM - 4 PM',
        JSON.stringify(['Cóctel Premium $5', 'Bohío $10', 'Masaje $25']),
        JSON.stringify(['Bohío', 'Salón', 'Restaurante']), 0);
      console.log('✅ Seeded planes (Estadía + Pasadía) con campos ricos');
    } else {
      // Migration: add new product columns if missing
      const planCols = db.prepare('PRAGMA table_info(planes_tarifa)').all().map(c => c.name);
      if (!planCols.includes('categoria')) {
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN categoria TEXT DEFAULT 'Estadía'");
      }
      if (!planCols.includes('incluye')) {
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN incluye TEXT");
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN horario TEXT");
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN extras_disponibles TEXT");
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN tipos_aplicables TEXT");
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN imagen TEXT");
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))");
        // Populate existing plans with rich data
        const updatePlan = db.prepare('UPDATE planes_tarifa SET incluye=?, horario=?, extras_disponibles=?, tipos_aplicables=? WHERE codigo=?');
        updatePlan.run(JSON.stringify(['Habitación', 'Estacionamiento', 'WiFi']), 'Check-in 3PM / Check-out 11AM', JSON.stringify(['Desayuno $12']), JSON.stringify(['Familiar','Doble','Estándar','Camping']), 'oferta_simple');
        updatePlan.run(JSON.stringify(['Habitación', 'Desayuno Buffet', 'Piscina', 'WiFi']), 'Check-in 3PM / Check-out 11AM', JSON.stringify(['Almuerzo $15', 'Spa $25']), JSON.stringify(['Familiar','Doble','Estándar']), 'mahana_exp');
        updatePlan.run(JSON.stringify(['Habitación', 'Desayuno', 'Almuerzo', 'Cena', 'Piscina']), 'Check-in 3PM / Check-out 11AM', JSON.stringify(['Spa $25']), JSON.stringify(['Familiar','Doble','Estándar']), 'todo_incluido');
        updatePlan.run(JSON.stringify(['Habitación', 'Desayuno', 'Almuerzo', 'Cena', 'Open Bar', 'Piscina']), 'Check-in 3PM / Bar 10AM-12AM', JSON.stringify(['Spa $25']), JSON.stringify(['Familiar','Doble']), 'open_bar');
        updatePlan.run(JSON.stringify(['Acceso Piscina', 'Playa', 'Estacionamiento']), '9AM - 5PM', JSON.stringify(['Almuerzo $12', 'Bohío $15']), JSON.stringify(['Bohío','Salón','Restaurante']), 'pasadia_entrada');
        updatePlan.run(JSON.stringify(['Piscina', 'Playa', 'Almuerzo', 'Semi Open Bar']), '9AM - 5PM', JSON.stringify(['Cóctel Premium $5']), JSON.stringify(['Bohío','Salón','Restaurante']), 'pasadia_comidas');
        console.log('✅ Migrated planes: campos ricos (incluye, horario, extras, tipos)');
      }
      if (!planCols.includes('visible_web')) {
        db.exec("ALTER TABLE planes_tarifa ADD COLUMN visible_web INTEGER DEFAULT 0");
        db.exec("UPDATE planes_tarifa SET visible_web = 1 WHERE codigo IN ('mahana_exp', 'todo_incluido')");
        console.log('✅ Migrated: visible_web (mahana_exp + todo_incluido enabled)');
      }
      // Seed Pasadía plans if missing
      const hasPasadia = db.prepare("SELECT COUNT(*) as c FROM planes_tarifa WHERE codigo LIKE 'pasadia%'").get().c;
      if (hasPasadia === 0) {
        const insertPlan = db.prepare('INSERT INTO planes_tarifa (codigo, nombre, descripcion, categoria, precio_adulto_noche, precio_menor_noche, precio_mascota_noche) VALUES (?, ?, ?, ?, ?, ?, ?)');
        insertPlan.run('pasadia_entrada', 'Pasadía Entrada', 'Solo entrada al día', 'Pasadía', 5.50, 3, 0);
        insertPlan.run('pasadia_comidas', 'Pasadía Comidas + Semi Open Bar', 'Entrada + comidas + semi open bar', 'Pasadía', 35, 20, 0);
      }
    }

    // ── Seed config ──
    const configCount = db.prepare('SELECT COUNT(*) as c FROM config_hotel').get();
    if (configCount.c === 0) {
      const insertConfig = db.prepare('INSERT INTO config_hotel (clave, valor, descripcion) VALUES (?, ?, ?)');
      insertConfig.run('impuesto_turismo_pct', '10', 'Impuesto turismo (%)');
      insertConfig.run('deposito_sugerido_pct', '50', 'Depósito sugerido (%)');
      insertConfig.run('moneda', 'USD', 'Moneda');
      insertConfig.run('nombre_propiedad', 'Casa Mahana', 'Nombre del hotel');
      insertConfig.run('paypal_client_id', '', 'PayPal Client ID');
      insertConfig.run('paypal_secret', '', 'PayPal Secret');
      insertConfig.run('paypal_mode', 'sandbox', 'PayPal mode: sandbox o live');
      console.log('✅ Seeded config');
    }

    // ── Seed reglas de tarifa por día ──
    const reglasCount = db.prepare('SELECT COUNT(*) as c FROM reglas_tarifa').get();
    if (reglasCount.c === 0) {
      const insertRegla = db.prepare('INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota) VALUES (?, ?, ?, ?, ?)');
      const allPlans = db.prepare('SELECT id, codigo, precio_adulto_noche, precio_menor_noche, precio_mascota_noche FROM planes_tarifa').all();
      const seedReglas = db.transaction(() => {
        for (const p of allPlans) {
          // Entre semana = base price (already in plan)
          insertRegla.run(p.id, 'entre_semana', p.precio_adulto_noche, p.precio_menor_noche, p.precio_mascota_noche);
          // Fin de semana = ~25-30% más
          const wkendMult = p.codigo.startsWith('pasadia') ? 1.20 : 1.25;
          insertRegla.run(p.id, 'fin_de_semana',
            Math.round(p.precio_adulto_noche * wkendMult * 100) / 100,
            Math.round(p.precio_menor_noche * wkendMult * 100) / 100,
            p.precio_mascota_noche);
          // Festivo = ~40-50% más
          const festMult = p.codigo.startsWith('pasadia') ? 1.40 : 1.50;
          insertRegla.run(p.id, 'festivo',
            Math.round(p.precio_adulto_noche * festMult * 100) / 100,
            Math.round(p.precio_menor_noche * festMult * 100) / 100,
            p.precio_mascota_noche);
        }
      });
      seedReglas();
      console.log('✅ Seeded reglas de tarifa (entre_semana/fin_de_semana/festivo)');
    }

    // ── Seed días festivos (Panamá) ──
    const festivosCount = db.prepare('SELECT COUNT(*) as c FROM dias_festivos').get();
    if (festivosCount.c === 0) {
      const insertFestivo = db.prepare('INSERT INTO dias_festivos (fecha, nombre) VALUES (?, ?)');
      const festivos = [
        ['2026-01-01', 'Año Nuevo'], ['2026-01-09', 'Día de los Mártires'],
        ['2026-02-16', 'Carnaval Lunes'], ['2026-02-17', 'Carnaval Martes'],
        ['2026-04-03', 'Viernes Santo'], ['2026-05-01', 'Día del Trabajo'],
        ['2026-11-03', 'Separación de Colombia'], ['2026-11-04', 'Día de la Bandera'],
        ['2026-11-05', 'Consolidación de Colón'], ['2026-11-10', 'Primer Grito de Independencia'],
        ['2026-11-28', 'Independencia de España'], ['2026-12-08', 'Día de las Madres'],
        ['2026-12-25', 'Navidad'],
      ];
      for (const [f, n] of festivos) insertFestivo.run(f, n);
      console.log('✅ Seeded días festivos (Panamá 2026)');
    }

    // ── Seed admin user ──
    const userCount = db.prepare('SELECT COUNT(*) as c FROM usuarios').get();
    if (userCount.c === 0) {
      db.prepare('INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (?, ?, ?, ?)').run(
        'admin@casamahana.com',
        hashPassword('admin123'),
        'Admin',
        'admin'
      );
      console.log('✅ Seeded admin user: admin@casamahana.com / admin123');
    }

    console.log('✅ Database initialized at', DB_PATH);
  }
  return db;
}

// ── Table whitelist ──
const VALID_TABLES = ['habitaciones', 'planes_tarifa', 'reservas_hotel', 'folio_hotel', 'huespedes_reserva', 'usuarios', 'config_hotel'];

function validateTable(table) {
  if (!VALID_TABLES.includes(table)) throw new Error(`Invalid table: ${table}`);
}

// ── Generic CRUD ──
function findAll(table, { where = {}, orderBy = 'id DESC', page = 1, limit = 50 } = {}) {
  validateTable(table);
  const d = getDb();
  const conditions = [];
  const values = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined || value === null || value === '') continue;
    if (key.endsWith('_gte')) { conditions.push(`${key.replace('_gte', '')} >= ?`); values.push(value); }
    else if (key.endsWith('_lte')) { conditions.push(`${key.replace('_lte', '')} <= ?`); values.push(value); }
    else if (key.endsWith('_like')) { conditions.push(`${key.replace('_like', '')} LIKE ?`); values.push(`%${value}%`); }
    else { conditions.push(`${key} = ?`); values.push(value); }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const { total } = d.prepare(`SELECT COUNT(*) as total FROM ${table} ${whereClause}`).get(...values);
  const data = d.prepare(`SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...values, limit, offset);
  return { data, meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) } };
}

function findById(table, id) {
  validateTable(table);
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function create(table, data) {
  validateTable(table);
  const d = getDb();
  const fields = Object.keys(data);
  const placeholders = fields.map(() => '?').join(', ');
  const result = d.prepare(`INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders})`).run(...Object.values(data));
  return findById(table, result.lastInsertRowid);
}

function update(table, id, data) {
  validateTable(table);
  const d = getDb();
  try {
    const cols = d.prepare(`PRAGMA table_info(${table})`).all();
    if (cols.some(c => c.name === 'updated_at')) data.updated_at = new Date().toISOString();
  } catch {}
  const fields = Object.keys(data);
  if (fields.length === 0) return findById(table, id);
  const setClause = fields.map(f => `${f} = ?`).join(', ');
  d.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).run(...Object.values(data), id);
  return findById(table, id);
}

function remove(table, id) {
  validateTable(table);
  const item = findById(table, id);
  if (!item) return null;
  getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return item;
}

module.exports = { getDb, findAll, findById, create, update, remove };
