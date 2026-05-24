const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const EXCEL_PATH = 'C:\\Users\\Usuario\\Downloads\\Reservas_Operativas (4).xlsx';

if (!fs.existsSync(EXCEL_PATH)) {
  console.error(`ERROR: No se encontró el archivo: ${EXCEL_PATH}`);
  process.exit(1);
}

try {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  console.log('====================================================');
  console.log(' PRIMERAS 15 FILAS DE RESERVAS_OPERATIVAS (4).XLSX ');
  console.log('====================================================');
  
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    console.log(`Fila #${i + 1}:`, JSON.stringify(rawRows[i]));
  }
  
  console.log('====================================================');
} catch (error) {
  console.error('Error:', error);
}
