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
    
    // We will do dryRun = false but in a transaction that we manually rollback so we don't save it
    db.pragma('foreign_keys = OFF');
    const txn = db.transaction(() => {
      const results = runImport(db, rows, mapping, { dryRun: false, skipDuplicates: true });
      console.log("Summary inside transaction:");
      console.log(`Total: ${results.total}, Imported: ${results.imported}, Duplicates: ${results.duplicates}, Errors: ${results.errors}`);
      
      const errors = results.details.filter(d => d.status === 'error');
      console.log("Total errors inside transaction:", errors.length);
      if (errors.length > 0) {
        console.log("Sample errors:");
        console.log(JSON.stringify(errors.slice(0, 10), null, 2));
      }
      
      // Rollback transaction by throwing a mock error
      throw new Error("MOCK_ROLLBACK");
    });
    
    try {
      txn();
    } catch(e) {
      if (e.message !== "MOCK_ROLLBACK") {
        throw e;
      }
    }
  }
  db.close();
} catch (e) {
  console.error(e);
}
