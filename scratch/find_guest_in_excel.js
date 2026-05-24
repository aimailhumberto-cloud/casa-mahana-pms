const XLSX = require('xlsx');
const fs = require('fs');

const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  if (fs.existsSync(fileHistory)) {
    const wb = XLSX.readFile(fileHistory, { sheetStubs: true, cellFormula: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    
    // Resolve hyperlink formulas first
    for (const key in sheet) {
      if (key.startsWith('A') && sheet[key]) {
        const cell = sheet[key];
        if (cell.f && cell.f.startsWith('HYPERLINK(')) {
          const match = cell.f.match(/HYPERLINK\(".*?",\s*"([^"]+)"\)/);
          if (match && match[1]) {
            cell.v = match[1];
          }
        }
      }
    }
    
    const rawRows = XLSX.utils.sheet_to_json(sheet, { range: 5 });
    
    const targetGuests = [
      'Kenneth', 'David', 'Ingrid', 'Maria', 'Luis', 'Yaqueline', 'Yamilka', 
      'Gilberto', 'Eduardo', 'Jeanie', 'Mileika', 'Mariano', 'Emileny', 
      'Ivani', 'Emerito', 'Ahmed'
    ];
    
    console.log("Looking for targets...");
    rawRows.forEach((r, idx) => {
      const name = r['Primary Guest Full Name'] || '';
      const matched = targetGuests.some(tg => name.toLowerCase().includes(tg.toLowerCase()));
      if (matched) {
        console.log(`Row ${idx+6}: Name="${name}" | RoomTypes="${r['Room Types']}" | RoomNumbers="${r['Room Numbers']}" | CheckIn="${r['Check-In Date']}" | CheckOut="${r['Check-Out Date']}"`);
      }
    });
  } else {
    console.log("Excel file not found");
  }
} catch (e) {
  console.error(e);
}
