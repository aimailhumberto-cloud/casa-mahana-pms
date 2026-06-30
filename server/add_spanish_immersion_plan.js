const Database = require('better-sqlite3');
const path = require('path');

const dbFiles = [
  'casa-mahana.db',
  'casa-mahana-test.db'
];

dbFiles.forEach(dbFile => {
  const dbPath = path.join(__dirname, '..', 'data', dbFile);
  console.log(`Processing database: ${dbPath}`);
  
  try {
    const db = new Database(dbPath);
    
    // Check if plan already exists
    const existing = db.prepare('SELECT id FROM planes_tarifa WHERE codigo = ?').get('spanish_immersion');
    
    if (existing) {
      console.log(`Plan 'spanish_immersion' already exists (ID: ${existing.id}). Updating values...`);
      db.prepare(`
        UPDATE planes_tarifa 
        SET nombre = ?, descripcion = ?, precio_adulto_noche = ?, precio_menor_noche = ?, precio_mascota_noche = ?, 
            incluye = ?, horario = ?, extras_disponibles = ?, tipos_aplicables = ?, visible_web = 1, lleva_impuesto = 0, impuesto_pct = 0
        WHERE codigo = ?
      `).run(
        'Spanish Immersion Retreat (2 Weeks)',
        'Retiro de inmersión en español de 2 semanas con hospedaje, alimentación completa y actividades guiadas.',
        175, 0, 0,
        JSON.stringify(["Hospedaje 14 Noches", "Pensión Completa", "30h Clases Español", "5 Salidas de Campo", "Tours de Aventura", "Shuttle Tocumen"]),
        'Check-in 3:00 PM / Check-out 11:00 AM',
        JSON.stringify(["Habitación Individual +$600"]),
        JSON.stringify(["Doble", "Estándar"]),
        'spanish_immersion'
      );
      
      const planId = existing.id;
      db.prepare('DELETE FROM reglas_tarifa WHERE plan_id = ?').run(planId);
      
      const insertRule = db.prepare('INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota, activo) VALUES (?, ?, ?, ?, ?, 1)');
      insertRule.run(planId, 'entre_semana', 175, 0, 0);
      insertRule.run(planId, 'fin_de_semana', 175, 0, 0);
      insertRule.run(planId, 'festivo', 175, 0, 0);
      
      console.log(`Rules updated successfully for plan ID ${planId}.`);
    } else {
      console.log(`Plan 'spanish_immersion' not found. Creating new plan...`);
      
      const info = db.prepare(`
        INSERT INTO planes_tarifa (codigo, nombre, descripcion, categoria, precio_adulto_noche, precio_menor_noche, precio_mascota_noche, incluye, horario, extras_disponibles, tipos_aplicables, visible_web, lleva_impuesto, impuesto_pct, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 1)
      `).run(
        'spanish_immersion',
        'Spanish Immersion Retreat (2 Weeks)',
        'Retiro de inmersión en español de 2 semanas con hospedaje, alimentación completa y actividades guiadas.',
        'Estadía',
        175, 0, 0,
        JSON.stringify(["Hospedaje 14 Noches", "Pensión Completa", "30h Clases Español", "5 Salidas de Campo", "Tours de Aventura", "Shuttle Tocumen"]),
        'Check-in 3:00 PM / Check-out 11:00 AM',
        JSON.stringify(["Habitación Individual +$600"]),
        JSON.stringify(["Doble", "Estándar"])
      );
      
      const planId = info.lastInsertRowid;
      console.log(`Plan 'spanish_immersion' created with ID: ${planId}. Inserting rate rules...`);
      
      const insertRule = db.prepare('INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota, activo) VALUES (?, ?, ?, ?, ?, 1)');
      insertRule.run(planId, 'entre_semana', 175, 0, 0);
      insertRule.run(planId, 'fin_de_semana', 175, 0, 0);
      insertRule.run(planId, 'festivo', 175, 0, 0);
      
      console.log(`Plan and rules created successfully.`);
    }
    
    db.close();
  } catch (error) {
    console.error(`Error processing database ${dbFile}:`, error);
  }
});
