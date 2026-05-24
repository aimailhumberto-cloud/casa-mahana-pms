const XLSX = require('xlsx');
const fs = require('fs');

const fileHistory = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

try {
  if (fs.existsSync(fileHistory)) {
    const wb = XLSX.readFile(fileHistory, { sheetStubs: true, cellFormula: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    
    // Let's print cells in row 6 (which is row index 5)
    // In excel, row 6 cells are A6, B6, C6, D6, etc.
    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
    console.log("Row 6 cells:");
    cols.forEach(c => {
      const cell = sheet[`${c}6`];
      console.log(`${c}6:`, cell ? { v: cell.v, f: cell.f, t: cell.t } : 'empty');
    });

    console.log("\nRow 7 cells:");
    cols.forEach(c => {
      const cell = sheet[`${c}7`];
      console.log(`${c}7:`, cell ? { v: cell.v, f: cell.f, t: cell.t } : 'empty');
    });
    
  } else {
    console.log("Excel file not found");
  }
} catch (e) {
  console.error(e);
}
