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
    const existing = db.prepare('SELECT id FROM planes_tarifa WHERE codigo = ?').get('promo_hab_gratis');
    
    if (existing) {
      console.log(`Plan 'promo_hab_gratis' already exists (ID: ${existing.id}). Updating values...`);
      db.prepare(`
        UPDATE planes_tarifa 
        SET nombre = ?, descripcion = ?, precio_adulto_noche = ?, precio_menor_noche = ?, precio_mascota_noche = ?, 
            incluye = ?, horario = ?, extras_disponibles = ?, tipos_aplicables = ?, visible_web = 1, lleva_impuesto = 0, impuesto_pct = 0
        WHERE codigo = ?
      `).run(
        'Habitación Gratis (Promo)',
        'Hospedaje gratis abonando consumible mínimo ($30 en semana / $40 en fin de semana).',
        15, 10, 0,
        JSON.stringify(["Habitación Gratis", "Piscina", "WiFi", "Acceso Playa", "Crédito Consumible en Restaurante"]),
        'Check-in 3:00 PM / Check-out 11:00 AM',
        JSON.stringify(["Desayuno adicional $12", "Almuerzo $15", "Cena $18"]),
        JSON.stringify(["Doble", "Estándar"]),
        'promo_hab_gratis'
      );
      
      const planId = existing.id;
      // Delete existing rules for this plan to prevent duplicates
      db.prepare('DELETE FROM reglas_tarifa WHERE plan_id = ?').run(planId);
      
      // Insert new rules
      const insertRule = db.prepare('INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota, activo) VALUES (?, ?, ?, ?, ?, 1)');
      insertRule.run(planId, 'entre_semana', 15, 10, 0);
      insertRule.run(planId, 'fin_de_semana', 20, 10, 0);
      insertRule.run(planId, 'festivo', 20, 10, 0);
      
      console.log(`Rules updated successfully for plan ID ${planId}.`);
    } else {
      console.log(`Plan 'promo_hab_gratis' not found. Creating new plan...`);
      
      const info = db.prepare(`
        INSERT INTO planes_tarifa (codigo, nombre, descripcion, categoria, precio_adulto_noche, precio_menor_noche, precio_mascota_noche, incluye, horario, extras_disponibles, tipos_aplicables, visible_web, lleva_impuesto, impuesto_pct, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 1)
      `).run(
        'promo_hab_gratis',
        'Habitación Gratis (Promo)',
        'Hospedaje gratis abonando consumible mínimo ($30 en semana / $40 en fin de semana).',
        'Estadía',
        15, 10, 0,
        JSON.stringify(["Habitación Gratis", "Piscina", "WiFi", "Acceso Playa", "Crédito Consumible en Restaurante"]),
        'Check-in 3:00 PM / Check-out 11:00 AM',
        JSON.stringify(["Desayuno adicional $12", "Almuerzo $15", "Cena $18"]),
        JSON.stringify(["Doble", "Estándar"])
      );
      
      const planId = info.lastInsertRowid;
      console.log(`Plan 'promo_hab_gratis' created with ID: ${planId}. Inserting rate rules...`);
      
      const insertRule = db.prepare('INSERT INTO reglas_tarifa (plan_id, tipo_dia, precio_adulto, precio_menor, precio_mascota, activo) VALUES (?, ?, ?, ?, ?, 1)');
      insertRule.run(planId, 'entre_semana', 15, 10, 0);
      insertRule.run(planId, 'fin_de_semana', 20, 10, 0);
      insertRule.run(planId, 'festivo', 20, 10, 0);
      
      console.log(`Plan and rules created successfully.`);
    }
    
    db.close();
  } catch (error) {
    console.error(`Error processing database ${dbFile}:`, error);
  }
});
