const XLSX = require('xlsx');
const fs = require('fs');
const { parseFile, detectColumns } = require('../server/import-cloudbeds');

const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  if (fs.existsSync(fileHistory)) {
    const fileBuffer = fs.readFileSync(fileHistory);
    const { headers, rows } = parseFile(fileBuffer, "Historial del huésped principal.xlsx");
    
    console.log("Total parsed rows:", rows.length);
    
    const targetGuests = [
      'Kenneth', 'David', 'Ingrid', 'Maria', 'Luis', 'Yaqueline', 'Yamilka', 
      'Gilberto', 'Eduardo', 'Jeanie', 'Mileika', 'Mariano', 'Emileny', 
      'Ivani', 'Emerito', 'Ahmed'
    ];
    
    console.log("Searching for target guests in parsed rows...");
    rows.forEach((r, idx) => {
      const name = r['Primary Guest Full Name'] || '';
      const matched = targetGuests.some(tg => name.toLowerCase().includes(tg.toLowerCase()));
      if (matched) {
        console.log(`Parsed Row ${idx+6}: Name="${name}" | RoomTypes="${r['Room Types']}" | RoomNumbers="${r['Room Numbers']}" | CheckIn="${r['Check-In Date']}" | CheckOut="${r['Check-Out Date']}"`);
      }
    });
  } else {
    console.log("Excel file not found");
  }
} catch (e) {
  console.error(e);
}
