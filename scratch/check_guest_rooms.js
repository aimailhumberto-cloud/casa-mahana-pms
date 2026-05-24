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
    
    console.log("Buscando huéspedes del screenshot en el Excel:");
    rawRows.forEach(r => {
      const name = r['Primary Guest Full Name'] || '';
      const matched = targetGuests.some(tg => name.toLowerCase().includes(tg.toLowerCase()));
      if (matched) {
        console.log(`Huésped: ${name} | Tipo: ${r['Room Types']} | Habitación: ${r['Room Numbers']} | Noches: ${r['Room Nights']}`);
      }
    });
  }
} catch (e) {
  console.error(e);
}
