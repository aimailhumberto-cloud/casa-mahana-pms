const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { parseFile, detectColumns, runImport } = require('../server/import-cloudbeds');

const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');
const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  const db = new Database(DB_PATH);
  if (fs.existsSync(fileHistory)) {
    const fileBuffer = fs.readFileSync(fileHistory);
    const { headers, rows } = parseFile(fileBuffer, "Historial del huésped principal.xlsx");
    const { mapping } = detectColumns(headers);
    
    // Clear database first
    db.pragma('foreign_keys = OFF');
    const tablasALimpiar = [
      'documentos_reserva', 'solicitudes_modificacion', 'reversiones_log', 'notificaciones_log',
      'huespedes_reserva', 'folio_hotel', 'reservas_hotel', 'huespedes'
    ];
    for (const t of tablasALimpiar) {
      db.prepare(`DELETE FROM ${t}`).run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = ?").run(t);
    }
    db.pragma('foreign_keys = ON');
    
    // Run the import inside a transaction we rollback, so we can capture results
    const txn = db.transaction(() => {
      const results = runImport(db, rows, mapping, { dryRun: false, skipDuplicates: true });
      const errors = results.details.filter(d => d.status === 'error');
      console.log(`Total rows: ${results.total}, Imported: ${results.imported}, Duplicates: ${results.duplicates}, Errors: ${results.errors}`);
      console.log("Sample errors from runImport:");
      console.log(JSON.stringify(errors.slice(0, 15), null, 2));
      throw new Error("ROLLBACK");
    });
    
    try { txn(); } catch(e) { if(e.message !== "ROLLBACK") throw e; }
  }
  db.close();
} catch (e) {
  console.error(e);
}
