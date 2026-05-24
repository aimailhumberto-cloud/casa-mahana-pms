const sqlite = require('better-sqlite3');
const db = new sqlite('data/casa-mahana.db');
try {
  const rows = db.prepare("SELECT clave, valor FROM config_hotel WHERE clave LIKE 'paypal%'").all();
  console.log("Config keys starting with paypal from DB:");
  rows.forEach(r => {
    if (r.clave.includes('secret')) {
      console.log(`${r.clave}: [SECRET] Length: ${r.valor ? r.valor.length : 0}`);
    } else {
      console.log(`${r.clave}: ${r.valor}`);
    }
  });
} catch (err) {
  console.error("Error reading database:", err);
}

console.log("\nProcess Env variables starting with PAYPAL:");
Object.keys(process.env).forEach(key => {
  if (key.toUpperCase().startsWith('PAYPAL')) {
    if (key.toUpperCase().includes('SECRET')) {
      console.log(`${key}: [SECRET] Length: ${process.env[key] ? process.env[key].length : 0}`);
    } else {
      console.log(`${key}: ${process.env[key]}`);
    }
  }
});
