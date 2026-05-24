const fs = require('fs');
const path = require('path');

const downloadsDir = "C:\\Users\\Usuario\\Downloads";

try {
  if (!fs.existsSync(downloadsDir)) {
    console.log("El directorio de descargas no existe.");
    process.exit(0);
  }

  const files = fs.readdirSync(downloadsDir);
  console.log("Archivos en la carpeta de descargas:");
  
  // Filter for xlsx/csv files or anything containing "guest", "historial", "reservas", "cloudbeds"
  const filtered = files.filter(f => {
    const lower = f.toLowerCase();
    return lower.endsWith('.xlsx') || lower.endsWith('.csv') || 
           lower.includes('historial') || lower.includes('guest') || 
           lower.includes('reserva');
  });

  filtered.forEach(f => {
    const p = path.join(downloadsDir, f);
    const stat = fs.statSync(p);
    console.log(`- ${f} (${(stat.size / 1024 / 1024).toFixed(2)} MB, modificado el: ${stat.mtime.toISOString()})`);
  });
} catch (e) {
  console.error(e);
}
