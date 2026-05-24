const XLSX = require('xlsx');
const fs = require('fs');

const file = "C:\\Users\\Usuario\\Downloads\\Historial del huésped principal.xlsx";

if (!fs.existsSync(file)) {
  console.log("El archivo no existe.");
  process.exit(0);
}

function extractNameFromFormula(cell) {
  if (!cell) return '';
  if (cell.v) return String(cell.v).trim();
  if (cell.f && cell.f.startsWith('HYPERLINK(')) {
    // Let's log the formula to see what it is
    console.log(`[LOG] Formula: ${cell.f}`);
    
    // Match the second parameter of HYPERLINK: HYPERLINK("url", "Name")
    const match = cell.f.match(/HYPERLINK\(".*?",\s*"([^"]+)"\)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Fallback: extract the display query param from URL if possible, or just the text
    const displayMatch = cell.f.match(/display=([^&"]+)/);
    if (displayMatch && displayMatch[1]) {
      return decodeURIComponent(displayMatch[1]);
    }
    
    // Simple split fallback
    const parts = cell.f.split('", "');
    if (parts.length > 1) {
      let name = parts[parts.length - 1];
      if (name.endsWith('")')) {
        name = name.slice(0, -2);
      }
      return name;
    }
  }
  return '';
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
  
  console.log("--- PROBANDO EXTRACCIÓN DE NOMBRES EN FILAS DE MUESTRA ---");
  
  const testRows = [7, 8, 9, 10, 11, 7253, 7254, 7255];
  testRows.forEach(r => {
    const aCell = sheet[`A${r}`];
    const bCell = sheet[`B${r}`];
    // Let's print raw A cell first
    console.log(`Raw cell A${r}:`, aCell ? { t: aCell.t, f: aCell.f, v: aCell.v } : 'undefined');
    const name = extractNameFromFormula(aCell);
    const guestId = bCell ? bCell.v : 'N/A';
    console.log(`Fila ${r} -> ID: ${guestId} | Nombre extraído: "${name}"\n`);
  });

} catch (e) {
  console.error(e);
}
