const XLSX = require('xlsx');
const fs = require('fs');

const file = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

if (!fs.existsSync(file)) {
  console.log("El archivo no existe.");
  process.exit(0);
}

try {
  const workbook = XLSX.readFile(file, {
    cellNF: true,
    cellStyles: true,
    cellDates: true,
    cellFormula: true,
    sheetStubs: true
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Pre-process Column A to resolve HYPERLINK formulas
  for (const key in sheet) {
    if (key.startsWith('A') && sheet[key]) {
      const cell = sheet[key];
      if (cell.f && cell.f.startsWith('HYPERLINK(')) {
        // Extract the second argument of HYPERLINK
        const match = cell.f.match(/HYPERLINK\(".*?",\s*"([^"]+)"\)/);
        if (match && match[1]) {
          cell.v = match[1];
          cell.t = 's';
          cell.w = match[1];
          cell.h = match[1];
        } else {
          const displayMatch = cell.f.match(/display=([^&"]+)/);
          if (displayMatch && displayMatch[1]) {
            const decoded = decodeURIComponent(displayMatch[1]);
            cell.v = decoded;
            cell.t = 's';
            cell.w = decoded;
            cell.h = decoded;
          }
        }
      }
    }
  }
  
  // Now read rows using sheet_to_json starting from Row 6 (index 5)
  const data = XLSX.utils.sheet_to_json(sheet, { range: 5, defval: '' });
  
  console.log("Total filas parseadas con sheet_to_json:", data.length);
  console.log("\nMuestra de las primeras 5 filas parseadas:");
  for (let i = 0; i < Math.min(data.length, 5); i++) {
    console.log(`Fila #${i + 1}:`, JSON.stringify(data[i], null, 2));
  }

} catch (e) {
  console.error(e);
}
