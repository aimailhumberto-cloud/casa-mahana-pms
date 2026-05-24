# Handoff Report — Pasadía Public Availability Investigation

This report documents the findings and a complete, step-by-step implementation strategy for adapting the public availability search API `/disponibilidad` and related calculations to support online Pasadías.

---

## 1. Observation

Direct observations from the codebase investigation:

1. **Database Schema (`server/db/schema.sql`)**:
   - `habitaciones` has a `categoria` column which defaults to `'Estadía'` and can be `'Pasadía'` (line 9).
   - `planes_tarifa` has a `categoria` column (line 29) which defaults to `'Estadía'` and can be `'Pasadía'` or `'Otro'`.
   - `reservas_hotel` stores reservations and includes `check_in`, `check_out`, `noches`, and pricing info.

2. **Public Availability Route (`server/routes/public.js`)**:
   - The `/disponibilidad` endpoint (lines 42–69) is hardcoded to query only room types where `categoria = 'Estadía'`:
     ```javascript
     const rooms = db.prepare("SELECT id, tipo, categoria, capacidad_min, capacidad_max FROM habitaciones WHERE activa = 1 AND categoria = 'Estadía'").all();
     ```
   - It performs validation enforcing that check-out is strictly after check-in (line 46):
     ```javascript
     if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'check_out debe ser posterior a check_in');
     ```
   - Overlap/conflict checks are coded assuming overnight stays (non-inclusive checkout):
     ```javascript
     const conflicts = db.prepare(`
       SELECT habitacion_id FROM reservas_hotel
       WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
         AND check_in < ? AND check_out > ?
     `).all(check_out, check_in).map(r => r.habitacion_id);
     ```

3. **Pricing Calculations Module (`server/utils/calculations.js`)**:
   - Dates are manipulated using local timezone parameters (line 17 of `getDayType` and lines 109-110 of `calcReservationWithRates`):
     ```javascript
     const dow = new Date(dateStr + 'T12:00:00').getDay();
     // ...
     const d = new Date(checkIn + 'T12:00:00');
     d.setDate(d.getDate() + i);
     const dateStr = d.toISOString().split('T')[0];
     ```
   - Noches calculation (lines 158-163):
     ```javascript
     function calcNoches(checkIn, checkOut) {
       const d1 = new Date(checkIn);
       const d2 = new Date(checkOut);
       const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
       return diff > 0 ? diff : 1;
     }
     ```

---

## 2. Logic Chain

1. **Filtering by Category**:
   - Since `/disponibilidad` only queries `categoria = 'Estadía'`, to support Pasadía availability, we must introduce a `categoria` query parameter (e.g., `req.query.categoria || 'Estadía'`) and filter rooms dynamically using this parameter.

2. **Validations for Pasadía**:
   - Overnight stays (`Estadía`) require check-out to be at least one day after check-in (`check_out > check_in`).
   - Day-passes (`Pasadía`) are single-day bookings where check-in and check-out can be on the same date (`check_in === check_out`, duration is 0 nights). Enforcing `check_out > check_in` for a Pasadía will cause validation errors.
   - Therefore, the validation must allow same-day check-in and check-out for Pasadías, validating only that `check_out >= check_in`.

3. **Verification of Booking Conflicts**:
   - For an overnight stay, the last day is for checkout only (non-inclusive of overnight stay). Hence, conflict is: `check_in < search_out AND check_out > search_in`.
   - For a Pasadía (day pass), the day itself is occupied and checkout is inclusive.
   - Two Pasadías on the same day conflict.
   - Therefore, if `categoria === 'Pasadía'`, the conflict query must find any reservation overlapping on the date range:
     `R.check_in <= search_out AND R.check_out >= search_in`.
   - If we search for a single date (e.g. `'2026-06-01'`), it will correctly conflict with any existing Pasadía on `'2026-06-01'`.

4. **Pricing and Nights calculations for Pasadías**:
   - In `calculations.js`, if the plan has `categoria === 'Pasadía'`:
     - The number of nights returned must be `0` (nights = 0).
     - However, the pricing loop needs to execute exactly once (for the day of the Pasadía).
     - The calculation formula for subtotal should be:
       `Total = (adults * precio_adulto) + (minors * precio_menor) + (pets * precio_mascota)`.
     - This corresponds to executing the pricing loop exactly once (`diasACalcular = 1`) and not multiplying by nights.

5. **Timezone Safety**:
   - Local Date objects (`new Date(dateStr)`) are subject to timezone offsets. If a server is running in UTC but the client is in UTC-5 (or vice versa), parsing the date without explicit timezone information or with partial time information (`T12:00:00`) can shift the day of the week, resulting in incorrect weekday vs. weekend pricing calculations.
   - Using strictly UTC-based date operations (`Date.UTC()`, `getUTCDay()`, `getUTCDate()`, `setUTCDate()`) guarantees that the dates are evaluated identically regardless of the host's server timezone.

---

## 3. Caveats

- We assume that only rooms/plans marked with `categoria = 'Pasadía'` in the database are searched/booked when the client selects "Pasadía".
- We assume that guests do not request multi-day Pasadías (i.e. check_in === check_out is the normal usage, though our conflict checking supports multi-day Pasadía ranges if requested).

---

## 4. Conclusion & Proposed Implementation Strategy

We propose a clear, step-by-step implementation strategy for the worker agent:

### Step 1: Update Date and Pricing Calculations (`server/utils/calculations.js`)

Replace timezone-dependent methods with strict UTC calculations and add Pasadía support.

**Proposed Changes to `server/utils/calculations.js`**:

1. **Refactor `getDayType`**:
   ```javascript
   function getDayType(dateStr) {
     const db = getDb();
     const festivo = db.prepare('SELECT id FROM dias_festivos WHERE fecha = ?').get(dateStr);
     if (festivo) return 'festivo';
     
     const [year, month, day] = dateStr.split('-').map(Number);
     const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
     if (dow === 5 || dow === 6) return 'fin_de_semana'; // Fri, Sat
     return 'entre_semana';
   }
   ```

2. **Refactor `calcNoches`**:
   ```javascript
   function calcNoches(checkIn, checkOut) {
     const [y1, m1, d1] = checkIn.split('-').map(Number);
     const [y2, m2, d2] = checkOut.split('-').map(Number);
     const utc1 = Date.UTC(y1, m1 - 1, d1);
     const utc2 = Date.UTC(y2, m2 - 1, d2);
     const diff = Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
     return diff > 0 ? diff : 1;
   }
   ```

3. **Update `calcReservation` to support Pasadías**:
   ```javascript
   function calcReservation(data) {
     const adultos = parseInt(data.adultos) || 1;
     const menores = parseInt(data.menores) || 0;
     const mascotas = parseInt(data.mascotas) || 0;
     const precioAdulto = parseFloat(data.precio_adulto_noche) || 0;
     const precioMenor = parseFloat(data.precio_menor_noche) || 0;
     const precioMascota = parseFloat(data.precio_mascota_noche) || 0;
     const extras = parseFloat(data.productos_adicionales) || 0;
     
     let plan = null;
     if (data.plan_id) {
       plan = findById('planes_tarifa', data.plan_id);
     } else if (data.plan_codigo) {
       const db = getDb();
       plan = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ?').get(data.plan_codigo);
     }

     const isPasadia = plan && plan.categoria === 'Pasadía';
     const noches = isPasadia ? 0 : (parseInt(data.noches) || 1);
     const factorMultiplicador = isPasadia ? 1 : noches;

     let impuestoPct = parseFloat(getConfig('impuesto_turismo_pct')) || 10;
     if (plan) {
       if (plan.lleva_impuesto === 0) {
         impuestoPct = 0;
       } else if (plan.impuesto_pct !== undefined && plan.impuesto_pct !== null) {
         impuestoPct = plan.impuesto_pct;
       }
     }

     if (data.impuesto_pct !== undefined && data.impuesto_pct !== null && data.impuesto_pct !== '') {
       impuestoPct = parseFloat(data.impuesto_pct);
     }
     if (data.lleva_impuesto === 0 || data.lleva_impuesto === '0' || data.lleva_impuesto === false) {
       impuestoPct = 0;
     }

     const depositoPct = parseFloat(getConfig('deposito_sugerido_pct')) || 50;

     const subtotal = Math.round(((adultos * precioAdulto) + (menores * precioMenor) + (mascotas * precioMascota)) * factorMultiplicador * 100) / 100;
     const impuestoMonto = Math.round((subtotal + extras) * (impuestoPct / 100) * 100) / 100;
     const montoTotal = Math.round((subtotal + extras + impuestoMonto) * 100) / 100;
     const depositoSugerido = Math.round(montoTotal * (depositoPct / 100) * 100) / 100;
     const montoPagado = parseFloat(data.monto_pagado) || 0;
     const saldoPendiente = Math.round((montoTotal - montoPagado) * 100) / 100;

     return {
       subtotal,
       productos_adicionales: extras,
       impuesto_pct: impuestoPct,
       impuesto_monto: impuestoMonto,
       monto_total: montoTotal,
       deposito_sugerido: depositoSugerido,
       monto_pagado: montoPagado,
       saldo_pendiente: saldoPendiente,
       noches
     };
   }
   ```

4. **Update `calcReservationWithRates`**:
   ```javascript
   function calcReservationWithRates(planId, checkIn, checkOut, adultos, menores, mascotas) {
     const db = getDb();
     const plan = findById('planes_tarifa', planId);
     const isPasadia = plan && plan.categoria === 'Pasadía';
     
     const noches = isPasadia ? 0 : calcNoches(checkIn, checkOut);
     const diasACalcular = isPasadia ? 1 : noches;

     let impuestoPct = parseFloat(getConfig('impuesto_turismo_pct')) || 10;
     if (plan) {
       if (plan.lleva_impuesto === 0) {
         impuestoPct = 0;
       } else if (plan.impuesto_pct !== undefined && plan.impuesto_pct !== null) {
         impuestoPct = plan.impuesto_pct;
       }
     }

     const depositoPct = parseFloat(getConfig('deposito_sugerido_pct')) || 50;

     const desglose = [];
     let subtotal = 0;

     const [year, month, day] = checkIn.split('-').map(Number);

     for (let i = 0; i < diasACalcular; i++) {
       const d = new Date(Date.UTC(year, month - 1, day + i));
       const dateStr = d.toISOString().split('T')[0];
       const dow = d.getUTCDay();
       const tipoDia = getDayType(dateStr);
       const rate = getRateForDay(planId, tipoDia);

       let pAdulto, pMenor, pMascota;
       if (rate) {
         pAdulto = rate.precio_adulto;
         pMenor = rate.precio_menor;
         pMascota = rate.precio_mascota;
       } else {
         pAdulto = plan ? plan.precio_adulto_noche : 0;
         pMenor = plan ? plan.precio_menor_noche : 0;
         pMascota = plan ? plan.precio_mascota_noche : 0;
       }

       const nightTotal = Math.round(((adultos * pAdulto) + (menores * pMenor) + (mascotas * pMascota)) * 100) / 100;
       subtotal += nightTotal;

       const festivo = db.prepare('SELECT nombre FROM dias_festivos WHERE fecha = ?').get(dateStr);

       desglose.push({
         fecha: dateStr,
         dia: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dow],
         tipo_dia: tipoDia,
         festivo_nombre: festivo?.nombre || null,
         precio_adulto: pAdulto,
         precio_menor: pMenor,
         precio_mascota: pMascota,
         total_noche: nightTotal
       });
     }

     subtotal = Math.round(subtotal * 100) / 100;
     const impuestoMonto = Math.round(subtotal * (impuestoPct / 100) * 100) / 100;
     const montoTotal = Math.round((subtotal + impuestoMonto) * 100) / 100;
     const depositoSugerido = Math.round(montoTotal * (depositoPct / 100) * 100) / 100;

     return {
       subtotal, impuesto_pct: impuestoPct, impuesto_monto: impuestoMonto,
       monto_total: montoTotal, deposito_sugerido: depositoSugerido,
       desglose, noches
     };
   }
   ```

---

### Step 2: Adapt `/disponibilidad` and Booking Routes in Public Router (`server/routes/public.js`)

Branch validation and conflict queries depending on whether the search is for a Pasadía or Estadía.

**Proposed Changes to `server/routes/public.js`**:

1. **Refactor `/disponibilidad`**:
   ```javascript
   router.get('/disponibilidad', (req, res) => {
     try {
       const { check_in, check_out } = req.query;
       const categoria = req.query.categoria || 'Estadía'; // Default to Estadía

       if (!check_in || !check_out) return err(res, 'VALIDATION_ERROR', 'check_in y check_out requeridos');
       
       if (categoria === 'Pasadía') {
         if (check_out < check_in) return err(res, 'VALIDATION_ERROR', 'check_out no puede ser anterior a check_in');
       } else {
         if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'check_out debe ser posterior a check_in');
       }

       const db = getDb();
       
       // Filter rooms dynamically by active = 1 AND categoria
       const rooms = db.prepare("SELECT id, tipo, categoria, capacidad_min, capacidad_max FROM habitaciones WHERE activa = 1 AND categoria = ?").all(categoria);

       // Branch conflict query
       let conflicts;
       if (categoria === 'Pasadía') {
         // Check inclusive overlaps
         conflicts = db.prepare(`
           SELECT habitacion_id FROM reservas_hotel
           WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
             AND check_in <= ? AND check_out >= ?
         `).all(check_out, check_in).map(r => r.habitacion_id);
       } else {
         // Check standard overnight overlaps
         conflicts = db.prepare(`
           SELECT habitacion_id FROM reservas_hotel
           WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
             AND check_in < ? AND check_out > ?
         `).all(check_out, check_in).map(r => r.habitacion_id);
       }

       const types = {};
       for (const room of rooms) {
         const available = !conflicts.includes(room.id);
         if (!types[room.tipo]) {
           types[room.tipo] = { 
             tipo: room.tipo, 
             categoria: room.categoria, 
             capacidad_min: room.capacidad_min, 
             capacidad_max: room.capacidad_max, 
             total: 0, 
             disponibles: 0 
           };
         }
         types[room.tipo].total++;
         if (available) types[room.tipo].disponibles++;
       }

       const result = Object.values(types).filter(t => t.disponibles > 0);
       ok(res, { check_in, check_out, tipos_disponibles: result });
     } catch (e) { 
       console.error(e); 
       err(res, 'SERVER_ERROR', 'Error verificando disponibilidad', 500); 
     }
   });
   ```

2. **Adapt `/reservar` and `/reservas/multi` availability checks**:
   In `server/routes/public.js`, fetch the category of the room type dynamically when querying `habitaciones` to correctly determine if we are booking a Pasadía:
   ```javascript
   // Under /reservar
   const rooms = db.prepare("SELECT id, categoria FROM habitaciones WHERE tipo = ? AND activa = 1").all(tipo_habitacion);
   if (rooms.length === 0) return err(res, 'NOT_FOUND', 'Tipo de habitación no encontrado');
   const isPasadia = rooms[0].categoria === 'Pasadía';

   if (isPasadia) {
     if (check_out < check_in) return err(res, 'VALIDATION_ERROR', 'Check-out no puede ser anterior a check_in');
   } else {
     if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'Check-out debe ser posterior a check_in');
   }

   // Branch conflict check in /reservar
   const conflicts = isPasadia
     ? db.prepare(`
         SELECT habitacion_id FROM reservas_hotel
         WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
           AND check_in <= ? AND check_out >= ?
       `).all(check_out, check_in).map(r => r.habitacion_id)
     : db.prepare(`
         SELECT habitacion_id FROM reservas_hotel
         WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
           AND check_in < ? AND check_out > ?
       `).all(check_out, check_in).map(r => r.habitacion_id);
   ```

   Do the same check for each room in `/reservas/multi`.

---

## 5. Verification Method

To verify the changes, run:

1. **Verify general test suite passes**:
   ```bash
   npm run test
   ```
2. **Add unit test cases in `server/utils/calculations.test.js`**:
   Verify timezone correctness and Pasadía rate calculations (0 nights, correct per-person rate, correct weekday/weekend shift behavior).
3. **Manual Validation Conditions**:
   - Searching `/disponibilidad` with `categoria=Pasadía` and `check_in === check_out` must return available Bohío/Salón/Restaurante units.
   - Booking a Pasadía unit on date `D` must block subsequent searches for that unit on the same date `D`.
