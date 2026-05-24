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
    
    // Run dryRun so we get all details
    const results = runImport(db, rows, mapping, { dryRun: true });
    
    console.log("First 20 import errors:");
    const errorsOnly = results.details.filter(d => d.status === 'error');
    console.log(JSON.stringify(errorsOnly.slice(0, 20), null, 2));
  }
  db.close();
} catch (e) {
  console.error(e);
}
