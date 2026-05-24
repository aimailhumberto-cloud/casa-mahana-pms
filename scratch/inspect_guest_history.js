const XLSX = require('xlsx');
const fs = require('fs');

const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";
const fileReservations = "C:\\Users\\Usuario\\Downloads\\reservations.xlsx";

try {
  if (fs.existsSync(fileHistory)) {
    const wb = XLSX.readFile(fileHistory, { sheetStubs: true, cellFormula: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { range: 5 });
    
    const types = new Set();
    rawRows.forEach(r => {
      if (r['Room Types']) types.add(r['Room Types']);
    });
    console.log("Categorías de habitación en Historial del huésped principal.xlsx:", Array.from(types));
  }
  
  if (fs.existsSync(fileReservations)) {
    const wb = XLSX.readFile(fileReservations);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet);
    
    const categories = new Set();
    const roomNumbers = new Set();
    rawRows.forEach(r => {
      if (r['Categoría de habitación']) categories.add(r['Categoría de habitación']);
      if (r['Número de habitación']) roomNumbers.add(r['Número de habitación']);
    });
    console.log("\nCategorías de habitación en reservations.xlsx:", Array.from(categories));
    console.log("\nNúmeros de habitación en reservations.xlsx:", Array.from(roomNumbers).slice(0, 10));
  }
} catch (e) {
  console.error(e);
}
