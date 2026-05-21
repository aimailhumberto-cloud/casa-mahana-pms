const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Determinar el directorio de la base de datos
const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');
const UPLOADS_DIR = path.join(DB_DIR, 'uploads');

console.log('====================================================');
console.log('   CASA MAHANA PMS - SCRIPT DE LIMPIEZA SELECTIVA   ');
console.log('====================================================');
console.log(`Base de datos destino: ${DB_PATH}`);
console.log(`Carpeta de uploads:    ${UPLOADS_DIR}`);
console.log('----------------------------------------------------');

if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: No se encontró la base de datos en: ${DB_PATH}`);
  process.exit(1);
}

// Inicializar conexión
const db = new Database(DB_PATH);

try {
  // Desactivar llaves foráneas temporalmente para poder limpiar las tablas sin restricciones de integridad referencial
  db.pragma('foreign_keys = OFF');
  
  console.log('Iniciando limpieza selectiva de tablas transaccionales...');

  // Tablas a vaciar
  const tablasALimpiar = [
    'documentos_reserva',
    'solicitudes_modificacion',
    'reversiones_log',
    'notificaciones_log',
    'huespedes_reserva',
    'folio_hotel',
    'reservas_hotel',
    'huespedes'
  ];

  // Iniciar una transacción de SQLite para asegurar atomicidad
  const limpiarTodo = db.transaction(() => {
    for (const tabla of tablasALimpiar) {
      // 1. Obtener conteo previo
      const prevCount = db.prepare(`SELECT count(*) as count FROM ${tabla}`).get().count;
      
      // 2. Limpiar registros
      db.prepare(`DELETE FROM ${tabla}`).run();
      
      // 3. Reiniciar el autoincremental de la tabla en sqlite_sequence
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(tabla);
      
      console.log(` - Tabla [${tabla}]: Se eliminaron ${prevCount} registros y se reinició el contador ID.`);
    }
  });

  // Ejecutar transacción
  limpiarTodo();

  // Reactivar llaves foráneas
  db.pragma('foreign_keys = ON');
  
  console.log('\n¡Limpieza de base de datos finalizada con éxito!');
  console.log('Las habitaciones, tarifas, reglas, configuración, usuarios y contraseñas permanecen INTACTAS.');

  // ── Limpieza de la carpeta de uploads (comprobantes de pago subidos de prueba) ──
  console.log('\n----------------------------------------------------');
  console.log('Limpiando archivos de comprobantes de pago de prueba en uploads...');
  
  if (fs.existsSync(UPLOADS_DIR)) {
    const archivos = fs.readdirSync(UPLOADS_DIR);
    let archivosBorradosCount = 0;
    let espacioLiberadoBytes = 0;

    for (const archivo of archivos) {
      const archivoPath = path.join(UPLOADS_DIR, archivo);
      const stat = fs.statSync(archivoPath);
      
      if (stat.isFile()) {
        espacioLiberadoBytes += stat.size;
        fs.unlinkSync(archivoPath);
        archivosBorradosCount++;
      }
    }
    const espacioMb = (espacioLiberadoBytes / (1024 * 1024)).toFixed(2);
    console.log(` - Se eliminaron ${archivosBorradosCount} archivos de comprobantes.`);
    console.log(` - Se liberaron ${espacioMb} MB en el disco.`);
  } else {
    console.log(' No se encontró la carpeta de uploads o está vacía.');
  }

  console.log('====================================================');
  console.log('   PROCESO COMPLETADO EXITOSAMENTE (BASE LIMPIA)    ');
  console.log('====================================================');

} catch (error) {
  console.error('Ocurrió un error durante la ejecución de la limpieza:', error);
  // Asegurar reactivar llaves foráneas en caso de fallo
  try { db.pragma('foreign_keys = ON'); } catch (e) {}
  process.exit(1);
} finally {
  db.close();
}
