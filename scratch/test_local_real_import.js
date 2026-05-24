const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { parseFile, detectColumns, runImport } = require('../server/import-cloudbeds');

const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');
const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  const db = new Database(DB_PATH);
  
  // 1. SELECTIVE CLEANUP FIRST
  db.pragma('foreign_keys = OFF');
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
  for (const tabla of tablasALimpiar) {
    db.prepare(`DELETE FROM ${tabla}`).run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(tabla);
  }
  db.pragma('foreign_keys = ON');
  console.log("Database cleared successfully!");
  
  // 2. RUN IMPORT
  if (fs.existsSync(fileHistory)) {
    const fileBuffer = fs.readFileSync(fileHistory);
    const { headers, rows } = parseFile(fileBuffer, "Historial del huésped principal.xlsx");
    const { mapping } = detectColumns(headers);
    
    console.log("Starting real local import...");
    const results = runImport(db, rows, mapping, { dryRun: false, skipDuplicates: true });
    console.log(`Import finished! Total: ${results.total}, Imported: ${results.imported}, Duplicates: ${results.duplicates}, Errors: ${results.errors}`);
    
    // 3. RUN METRIC CHECKS
    // Let's count how many reservations are assigned to each room type
    const roomTypeCounts = db.prepare(`
      SELECT tipo_habitacion, COUNT(*) as count 
      FROM reservas_hotel 
      GROUP BY tipo_habitacion
    `).all();
    console.log("\nReservaciones por tipo de habitación (en reservas_hotel):");
    console.log(roomTypeCounts);
    
    // Let's count reservations by the name of the assigned room in habitaciones
    const roomNameCounts = db.prepare(`
      SELECT h.nombre as room_name, h.tipo as room_type, COUNT(r.id) as count 
      FROM habitaciones h
      LEFT JOIN reservas_hotel r ON r.habitacion_id = h.id
      GROUP BY h.id
      ORDER BY h.tipo, h.nombre
    `).all();
    console.log("\nReservaciones asignadas a habitaciones específicas:");
    console.log(roomNameCounts.filter(rc => rc.count > 0));
    
    // Let's check some of the target guests
    const targetGuests = [
      'Kenneth', 'David', 'Ingrid', 'Maria', 'Luis', 'Yaqueline', 'Yamilka', 
      'Gilberto', 'Eduardo', 'Jeanie', 'Mileika', 'Mariano', 'Emileny', 
      'Ivani', 'Emerito', 'Ahmed'
    ];
    
    console.log("\nDetalle de huéspedes del screenshot en la DB local:");
    const query = db.prepare(`
      SELECT r.id, r.cliente, r.apellido, r.tipo_habitacion, h.nombre as assigned_room_name, h.tipo as assigned_room_type, r.check_in, r.check_out, r.notas
      FROM reservas_hotel r
      LEFT JOIN habitaciones h ON r.habitacion_id = h.id
      WHERE LOWER(r.cliente) LIKE ? OR LOWER(r.apellido) LIKE ?
    `);
    
    targetGuests.forEach(tg => {
      const matched = query.all(`%${tg.toLowerCase()}%`, `%${tg.toLowerCase()}%`);
      if (matched.length > 0) {
        console.log(`\nCoincidencias para "${tg}" (${matched.length} registros):`);
        matched.slice(0, 5).forEach(m => {
          console.log(`  - ID: ${m.id} | Cliente: ${m.cliente} ${m.apellido} | Tipo: ${m.tipo_habitacion} | Hab Asignada: ${m.assigned_room_name} (${m.assigned_room_type}) | Fechas: ${m.check_in} -> ${m.check_out}`);
        });
      }
    });
  } else {
    console.log("Excel file not found");
  }
  
  db.close();
} catch (e) {
  console.error(e);
}
