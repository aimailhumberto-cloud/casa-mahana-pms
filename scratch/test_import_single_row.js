const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { parseFile, detectColumns, runImport } = require('../server/import-cloudbeds');

const DB_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'casa-mahana.db');
const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  const db = new Database(DB_PATH);
  
  // Clear the database (dry-run style, we won't commit if we use a transaction, or we can just run a check)
  console.log("Testing with database:", DB_PATH);
  
  if (fs.existsSync(fileHistory)) {
    const fileBuffer = fs.readFileSync(fileHistory);
    const { headers, rows } = parseFile(fileBuffer, "Historial del huésped principal.xlsx");
    const { mapping } = detectColumns(headers);
    
    console.log("Mapped columns:", mapping);
    
    // Let's run a dry run and inspect results for the specific names: Kenneth, Ingrid, Maria, Luis, etc.
    const rooms = db.prepare('SELECT * FROM habitaciones WHERE activa = 1 ORDER BY id').all();
    const targetGuests = [
      'Kenneth', 'David', 'Ingrid', 'Maria', 'Luis', 'Yaqueline', 'Yamilka', 
      'Gilberto', 'Eduardo', 'Jeanie', 'Mileika', 'Mariano', 'Emileny', 
      'Ivani', 'Emerito', 'Ahmed'
    ];
    
    // We will run the import in dryRun mode
    const results = runImport(db, rows, mapping, { dryRun: true });
    
    console.log("\nSample matched rows from import results:");
    const matchedDetails = results.details.filter(d => 
      d.guest && targetGuests.some(tg => d.guest.toLowerCase().includes(tg.toLowerCase()))
    );
    
    console.log(JSON.stringify(matchedDetails.slice(0, 30), null, 2));
  } else {
    console.log("Excel file not found at:", fileHistory);
  }
  
  db.close();
} catch (e) {
  console.error(e);
}
