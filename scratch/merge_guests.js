const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const GUESTS_FILE = "C:\\Users\\Usuario\\Downloads\\guests.xlsx";
const RESERVATIONS_FILE = "C:\\Users\\Usuario\\Downloads\\reservations.xlsx";

if (!fs.existsSync(GUESTS_FILE)) {
  console.error("ERROR: No se encontró el archivo de huéspedes principal:", GUESTS_FILE);
  process.exit(1);
}

if (!fs.existsSync(RESERVATIONS_FILE)) {
  console.error("ERROR: No se encontró el archivo de nuevas reservaciones:", RESERVATIONS_FILE);
  process.exit(1);
}

// Helper to clean promotional suffixes from guest names
function cleanName(name) {
  if (!name) return '';
  let cleaned = String(name).trim();
  
  // Remove common promotional suffixes
  const suffixes = [
    /ofert[as]\s+simple/i,
    /mahana\s+experience/i,
    /tod[os]\s+incluid[os]/i,
    /todo\s+incluido/i,
    /experiencia\s+mahana/i
  ];
  
  suffixes.forEach(regex => {
    cleaned = cleaned.replace(regex, '');
  });
  
  // Clean multiple spaces and trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

// Split full name into first and last name
function splitFullName(fullName) {
  const name = cleanName(fullName);
  if (!name) return { first: '', last: '' };
  
  const parts = name.split(' ');
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  } else {
    // parts[0] is first name, rest is last name
    return { first: parts[0], last: parts.slice(1).join(' ') };
  }
}

try {
  console.log("Cargando archivo principal: guests.xlsx...");
  const guestsWorkbook = XLSX.readFile(GUESTS_FILE);
  const guestsSheetName = guestsWorkbook.SheetNames[0];
  const guestsSheet = guestsWorkbook.Sheets[guestsSheetName];
  // Parse with raw rows
  const originalGuests = XLSX.utils.sheet_to_json(guestsSheet);
  console.log(`Cargados ${originalGuests.length} huéspedes del archivo principal.`);

  console.log("\nCargando archivo de nuevas reservas: reservations.xlsx...");
  const resWorkbook = XLSX.readFile(RESERVATIONS_FILE, { sheetStubs: true, cellFormula: true });
  const resSheetName = resWorkbook.SheetNames[0];
  const resSheet = resWorkbook.Sheets[resSheetName];
  const newReservations = XLSX.utils.sheet_to_json(resSheet);
  console.log(`Cargadas ${newReservations.length} reservaciones para procesar.`);

  // Create a map of existing guests by email for quick lookup
  const guestsMapByEmail = new Map();
  const guestsMapByName = new Map();

  originalGuests.forEach((guest, index) => {
    const email = guest['Correo electrónico'] ? String(guest['Correo electrónico']).trim().toLowerCase() : '';
    const cleanFirstName = cleanName(guest['Nombre']);
    const cleanLastName = cleanName(guest['Apellido']);
    const fullName = `${cleanFirstName} ${cleanLastName}`.trim().toLowerCase();

    if (email) {
      guestsMapByEmail.set(email, guest);
    }
    if (fullName) {
      guestsMapByName.set(fullName, guest);
    }
  });

  let newGuestsAdded = 0;
  let existingGuestsUpdated = 0;

  // Process each reservation
  newReservations.forEach((res, index) => {
    const rawName = res['Nombre'] || '';
    if (!rawName || rawName === 'Nombre' || String(rawName).trim() === '') return;

    const cleanedName = cleanName(rawName);
    const { first, last } = splitFullName(rawName);
    const fullNameLower = `${first} ${last}`.trim().toLowerCase();

    const rawEmail = res['Correo electrónico'] || '';
    const email = String(rawEmail).trim().toLowerCase();
    const phone = res['Teléfono'] ? String(res['Teléfono']).trim() : '';
    
    // Financial and stay data
    const noches = parseInt(res['Noches']) || 0;
    const totalIngresos = parseFloat(res['Total general']) || parseFloat(res['Monto pagado']) || 0;
    const checkIn = res['Fecha del check-in'] || '';
    const ciudad = res['Ciudad'] ? String(res['Ciudad']).trim() : '';
    const pais = res['País'] ? String(res['País']).trim() : '';

    // Check if guest exists by email or full name
    let existingGuest = null;
    if (email) {
      existingGuest = guestsMapByEmail.get(email);
    }
    if (!existingGuest && fullNameLower) {
      existingGuest = guestsMapByName.get(fullNameLower);
    }

    if (existingGuest) {
      // Update existing guest metrics
      existingGuest['Total de las reservas'] = (parseInt(existingGuest['Total de las reservas']) || 0) + 1;
      existingGuest['Noches de estadía'] = (parseInt(existingGuest['Noches de estadía']) || 0) + noches;
      existingGuest['Total de ingresos'] = (parseFloat(existingGuest['Total de ingresos']) || 0) + totalIngresos;
      
      // Update phone if blank or keep more complete one
      if (phone && (!existingGuest['Teléfono'] || String(existingGuest['Teléfono']).trim() === '-')) {
        existingGuest['Teléfono'] = phone;
      }
      // Update email if it was blank
      if (email && (!existingGuest['Correo electrónico'] || String(existingGuest['Correo electrónico']).trim() === '')) {
        existingGuest['Correo electrónico'] = email;
      }
      
      // Update city/country if blank
      if (ciudad && !existingGuest['Ciudad']) existingGuest['Ciudad'] = ciudad;
      if (pais && !existingGuest['País']) existingGuest['País'] = pais;

      // Update last stay date if newer (simple comparison)
      if (checkIn && (!existingGuest['Última estadía'] || checkIn > existingGuest['Última estadía'])) {
        existingGuest['Última estadía'] = checkIn;
      }
      
      existingGuestsUpdated++;
    } else {
      // Create a new guest entry matching the exact column schema of guests.xlsx
      const newGuest = {
        'Nombre': first,
        'Apellido': last,
        'Correo electrónico': email,
        'Teléfono': phone,
        'Dirección': res['Dirección'] || '',
        'Apartamento, suite, piso, etc.': res['Apartamento, suite, piso, etc.'] || '',
        'Ciudad': ciudad,
        'País': pais,
        'Provincia': res['Estado'] || '',
        'Código postal': res['Código postal'] || '',
        'Total de las reservas': 1,
        'Noches de estadía': noches,
        'Total de ingresos': totalIngresos,
        'Última estadía': checkIn,
        'Huésped habitual': 'No',
        'Estado del huésped (Casa Mahana)': ''
      };

      originalGuests.push(newGuest);
      
      // Add to maps to prevent duplicate adds within the reservation list itself
      if (email) {
        guestsMapByEmail.set(email, newGuest);
      }
      if (fullNameLower) {
        guestsMapByName.set(fullNameLower, newGuest);
      }
      
      newGuestsAdded++;
    }
  });

  console.log(`\nProceso de fusión completado:`);
  console.log(`- Huéspedes existentes actualizados/acumulados: ${existingGuestsUpdated}`);
  console.log(`- Nuevos huéspedes agregados: ${newGuestsAdded}`);
  console.log(`- Total de huéspedes resultantes en la lista unificada: ${originalGuests.length}`);

  // Create a new worksheet from the merged array
  console.log("\nGuardando los datos fusionados en guests.xlsx...");
  const newSheet = XLSX.utils.json_to_sheet(originalGuests);
  const newWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, guestsSheetName);
  
  // Overwrite the original guests.xlsx file
  XLSX.writeFile(newWorkbook, GUESTS_FILE);
  console.log("¡Archivo guests.xlsx guardado y actualizado con éxito!");

} catch (e) {
  console.error("Error durante el proceso de fusión:", e);
}
