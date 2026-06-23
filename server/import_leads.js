const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const { getDb } = require('./db/database');

const CSV_PATH = 'C:\\Users\\Usuario\\Downloads\\Casa Mahana — Seguimiento de Leads - Leads.csv';

function runImport() {
  console.log(`Reading CSV file from: ${CSV_PATH}...`);
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Error: File not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const csvData = fs.readFileSync(CSV_PATH, 'utf8');
  const parsed = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true
  });

  console.log(`Parsed ${parsed.data.length} rows from CSV.`);
  const db = getDb();

  const insertLead = db.prepare(`
    INSERT INTO leads_clientes (nombre, apellido, email, telefono, notas, estado, atendido, fecha_seguimiento, oferta_mejora, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertQuote = db.prepare(`
    INSERT INTO cotizaciones_custom (
      lead_id, check_in, check_out, noches, adultos, menores, mascotas,
      plan_codigo, habitaciones_seleccionadas, items_adicionales,
      subtotal, descuento, descuento_tipo, impuesto_pct, impuesto_monto,
      monto_total, deposito_sugerido, notas, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Clear existing CRM data first to avoid duplicates
  db.exec('DELETE FROM cotizaciones_custom');
  db.exec('DELETE FROM leads_clientes');

  // Run everything inside an SQLite transaction
  const importTx = db.transaction((rows) => {
    let importedLeads = 0;
    let importedQuotes = 0;

    for (const row of rows) {
      const fullname = (row['Nombre del cliente'] || '').trim();
      if (!fullname) {
        console.log('Skipping row without client name:', row);
        continue;
      }

      // Split first name and last name
      let nombre = fullname;
      let apellido = '';
      const spaceIdx = fullname.indexOf(' ');
      if (spaceIdx > 0) {
        nombre = fullname.substring(0, spaceIdx);
        apellido = fullname.substring(spaceIdx + 1);
      }

      const email = (row['Email'] || '').trim();
      const telefono = (row['Teléfono'] || '').trim();
      const notasOriginales = (row['Notas'] || '').trim();
      const empresa = (row['Empresa / Organización'] || '').trim();
      const origen = (row['Origen del lead'] || '').trim();
      const servicio = (row['Servicio de interés'] || '').trim();
      const invitadosStr = (row['Nº invitados (aprox.)'] || '').trim();

      // Compile notes
      let notasArr = [];
      if (empresa) notasArr.push(`Empresa: ${empresa}`);
      if (origen) notasArr.push(`Origen: ${origen}`);
      if (servicio) notasArr.push(`Servicio: ${servicio}`);
      if (invitadosStr) notasArr.push(`Huéspedes: ${invitadosStr}`);
      if (notasOriginales) notasArr.push(`Notas: ${notasOriginales}`);
      const notas = notasArr.join(' | ');

      // Map state
      const rawEstado = (row['Estado'] || '').trim().toLowerCase();
      let estado = 'Borrador';
      if (rawEstado.includes('negociación') || rawEstado.includes('negociacion')) {
        estado = 'En Negociación';
      } else if (rawEstado.includes('cotizado')) {
        estado = 'Enviada';
      } else if (rawEstado.includes('aceptado') || rawEstado.includes('ganado') || rawEstado.includes('aceptada')) {
        estado = 'Aceptada';
      } else if (rawEstado.includes('rechazado') || rawEstado.includes('perdido') || rawEstado.includes('rechazada')) {
        estado = 'Rechazada';
      }

      // Date parsing (contact date)
      const dateContactRaw = (row['Fecha contacto'] || '').trim();
      let createdDate = new Date().toISOString();
      if (dateContactRaw) {
        const parts = dateContactRaw.split('/');
        if (parts.length === 3) {
          // DD/MM/YYYY -> YYYY-MM-DD
          createdDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T12:00:00.000Z`;
        }
      }

      // Parse próximo seguimiento date
      const dateSeguimientoRaw = (row['Próximo seguimiento'] || '').trim();
      let fechaSeguimiento = '';
      if (dateSeguimientoRaw) {
        const parts = dateSeguimientoRaw.split('/');
        if (parts.length === 3) {
          fechaSeguimiento = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      // Insert Lead
      const leadRes = insertLead.run(
        nombre,
        apellido,
        email,
        telefono,
        notas,
        estado,
        1, // Marked as attended since they are historical records
        fechaSeguimiento,
        0, // oferta_mejora
        createdDate,
        createdDate
      );
      const leadId = leadRes.lastInsertRowid;
      importedLeads++;

      // Check if quote should be created (if budget/presupuesto is present)
      const presupuestoStr = (row['Presupuesto estimado (B/.)'] || '').trim();
      if (presupuestoStr) {
        // Parse budget: remove '.' thousands separators and convert
        const cleanPresupuesto = presupuestoStr.replace(/\./g, '').replace(/,/g, '.');
        const montoTotal = parseFloat(cleanPresupuesto) || 0;

        if (montoTotal > 0) {
          // Parse guests count
          let adultos = 1;
          let menores = 0;

          const adultMatch = invitadosStr.match(/(\d+)\s*adulto/i);
          if (adultMatch) {
            adultos = parseInt(adultMatch[1]) || 1;
          } else {
            // fallback: check if it has only a number at start
            const numMatch = invitadosStr.match(/^(\d+)/);
            if (numMatch) {
              adultos = parseInt(numMatch[1]) || 1;
            }
          }

          const menorMatch = invitadosStr.match(/(\d+)\s*menor/i);
          if (menorMatch) {
            menores = parseInt(menorMatch[1]) || 0;
          }

          // Event date
          const dateEventRaw = (row['Fecha del evento (si aplica)'] || '').trim();
          let eventDate = createdDate.substring(0, 10); // YYYY-MM-DD
          if (dateEventRaw) {
            const parts = dateEventRaw.split('/');
            if (parts.length === 3) {
              eventDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }

          const isPasadia = servicio.toLowerCase().includes('pasadía') || servicio.toLowerCase().includes('pasadia');
          const planCodigo = isPasadia ? 'pasadia' : 'tarifa_base';
          const noches = isPasadia ? 0 : 1;

          // Calculate check_out date
          let checkOutDate = eventDate;
          if (!isPasadia) {
            try {
              const dt = new Date(eventDate + 'T12:00:00');
              dt.setDate(dt.getDate() + 1);
              checkOutDate = dt.toISOString().substring(0, 10);
            } catch (e) {}
          }

          const subtotal = montoTotal / 1.10;
          const impuestoMonto = montoTotal - subtotal;
          const depositoSugerido = montoTotal * 0.50;

          insertQuote.run(
            leadId,
            eventDate,
            checkOutDate,
            noches,
            adultos,
            menores,
            0, // mascotas
            planCodigo,
            '[]', // habitaciones_seleccionadas
            '[]', // items_adicionales
            subtotal,
            0, // descuento
            'fijo', // descuento_tipo
            10, // impuesto_pct
            impuestoMonto,
            montoTotal,
            depositoSugerido,
            `Importado de CSV - Servicio: ${servicio || 'No indicado'}`,
            createdDate
          );
          importedQuotes++;
        }
      }
    }
    return { importedLeads, importedQuotes };
  });

  try {
    const result = importTx(parsed.data);
    console.log(`Successfully imported ${result.importedLeads} leads and created ${result.importedQuotes} base quotations.`);
  } catch (err) {
    console.error('Failed to run import transaction:', err);
  }
}

runImport();
