const XLSX = require('xlsx');
const fs = require('fs');

const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  if (fs.existsSync(fileHistory)) {
    const wb = XLSX.readFile(fileHistory, { sheetStubs: true, cellFormula: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { range: 5 });
    
    console.log("Total filas:", rawRows.length);
    console.log("Cabeceras:", Object.keys(rawRows[0] || {}));
    
    // Mostrar las primeras 10 filas del historial
    const sample = rawRows.slice(0, 10).map(r => ({
      name: r['Primary Guest Full Name'] || r['Guest Name'] || '',
      roomType: r['Room Types'] || r['Room Type'] || '',
      roomName: r['Room Numbers'] || r['Room Number'] || '',
      nights: r['Room Nights'] || r['Nights'] || '',
      total: r['Grand Total'] || r['Total'] || '',
      status: r['Status'] || ''
    }));
    console.log("Muestra de filas:\n", JSON.stringify(sample, null, 2));
  }
} catch (e) {
  console.error(e);
}
