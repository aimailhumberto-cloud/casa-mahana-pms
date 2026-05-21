# Codebase Analysis and Implementation Plan: Group Bookings and Multiple Units

This document presents a comprehensive analysis and implementation strategy for the **Group Bookings and Multiple Units (Master/Child Bookings)** module in Casa Mahana PMS. It outlines the database migrations, backend transactional API design, accounting folio consolidation logic, frontend UI modifications, and integration testing strategy to implement this capability seamlessly.

---

## 1. Database Schema Support

To support group bookings (multiple rooms under a single transactional block), we must establish a master-child relationship between reservations in the SQLite database.

### 1.1 Column Extensions in `reservas_hotel`
We will add the following four columns to the `reservas_hotel` table in `server/db/schema.sql`:
1.  **`grupo_codigo`** (`TEXT`): A unique identifier common to all reservations belonging to the same group (e.g., `"GRP-20260520-X8J"`).
2.  **`es_maestra`** (`INTEGER DEFAULT 0`): A boolean flag (1 = Master, 0 = Child) identifying the primary reservation (Leader's room).
3.  **`parent_reserva_id`** (`INTEGER`): A self-referencing foreign key pointing to the `id` of the Master reservation.
4.  **`facturacion_consolidada`** (`INTEGER DEFAULT 1`): A boolean flag (1 = Consolidated Billing, 0 = Separate Accounts) specifying the accounting scheme.

### 1.2 Schema Modification Script
To apply these changes, the following SQL statements must be added to a migration or run dynamically during database setup in `server/db/database.js`:

```sql
-- Add group booking support columns to reservas_hotel
ALTER TABLE reservas_hotel ADD COLUMN grupo_codigo TEXT;
ALTER TABLE reservas_hotel ADD COLUMN es_maestra INTEGER DEFAULT 0;
ALTER TABLE reservas_hotel ADD COLUMN parent_reserva_id INTEGER REFERENCES reservas_hotel(id) ON DELETE SET NULL;
ALTER TABLE reservas_hotel ADD COLUMN facturacion_consolidada INTEGER DEFAULT 1;

-- Create index for group queries
CREATE INDEX IF NOT EXISTS idx_reservas_grupo ON reservas_hotel(grupo_codigo);
```

### 1.3 Database Whitelist Update
In `server/db/database.js`, the whitelist of tables is used for CRUD operations. Since we are modifying the existing `reservas_hotel` table (which is already whitelisted), no new tables need to be registered, but if we choose to create a dedicated log or helper table, it must be added to `VALID_TABLES`. The standard attributes mapping in `database.js` will automatically pick up the new columns upon execution.

---

## 2. Backend Group Booking API (`server/routes/hotel.js`)

We need a dedicated, transaction-safe backend endpoint to create all reservations in a group simultaneously. Partial creations (where room A is booked but room B fails due to collision) must be absolutely prevented.

### 2.1 API Endpoint: `POST /api/v1/hotel/reservas/grupo`
*   **Authentication:** Requires receptionist or administrator privileges (`requireAuth`).
*   **Request Body Structure:**
    ```json
    {
      "cliente": "John",
      "apellido": "Doe",
      "email": "johndoe@example.com",
      "whatsapp": "+5071234567",
      "nacionalidad": "Panamá",
      "check_in": "2026-06-01",
      "check_out": "2026-06-05",
      "plan_codigo": "mahana_exp",
      "fuente": "Teléfono",
      "notas": "Notas del grupo...",
      "facturacion_consolidada": 1,
      "habitaciones": [
        {
          "habitacion_id": 3,
          "adultos": 2,
          "menores": 0,
          "mascotas": 0,
          "cliente": "John",
          "apellido": "Doe"
        },
        {
          "habitacion_id": 5,
          "adultos": 2,
          "menores": 1,
          "mascotas": 0,
          "cliente": "Jane",
          "apellido": "Smith"
        }
      ]
    }
    ```

### 2.2 Transactional Backend Logic
We will use the **`better-sqlite3`** synchronous transaction wrapper (`db.transaction()`) to guarantee atomicity. Below is the proposed implementation pattern to be added to `server/routes/hotel.js`:

```javascript
router.post('/hotel/reservas/grupo', requireAuth, (req, res) => {
  const db = getDb();
  const data = req.body;

  if (!data.cliente || !data.apellido || !data.whatsapp || !data.check_in || !data.check_out || !data.plan_codigo) {
    return err(res, 'VALIDATION_ERROR', 'Campos obligatorios faltantes', 400);
  }
  if (!data.habitaciones || !Array.isArray(data.habitaciones) || data.habitaciones.length === 0) {
    return err(res, 'VALIDATION_ERROR', 'Debe seleccionar al menos una habitación', 400);
  }

  // Define the atomic database transaction
  const createGroupTransaction = db.transaction((groupData, userEmail) => {
    const checkIn = groupData.check_in;
    const checkOut = groupData.check_out;
    const planCodigo = groupData.plan_codigo;
    const facturacionConsolidada = groupData.facturacion_consolidada !== undefined ? groupData.facturacion_consolidada : 1;

    // Generate unique grupo_codigo: GRP-YYYYMMDD-[4 RANDOM ALPHANUMERIC CHARS]
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const grupoCodigo = `GRP-${todayStr}-${randomSuffix}`;

    // 1. Validate availability for ALL requested rooms
    for (const h of groupData.habitaciones) {
      const conflict = db.prepare(`
        SELECT id, cliente FROM reservas_hotel
        WHERE habitacion_id = ? AND estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
          AND check_in < ? AND check_out > ?
      `).get(h.habitacion_id, checkOut, checkIn);

      if (conflict) {
        throw new Error(`La habitación #${h.habitacion_id} ya está ocupada por ${conflict.cliente} en esas fechas.`);
      }
    }

    // Fetch the package details to obtain pricing rules
    const plan = db.prepare('SELECT * FROM planes_tarifa WHERE codigo = ?').get(planCodigo);
    if (!plan) throw new Error(`El plan de tarifa ${planCodigo} no existe.`);

    // 2. Create the Master Reservation (First room in the list)
    const masterRoom = groupData.habitaciones[0];
    const noches = calcNoches(checkIn, checkOut);

    const masterPayload = {
      cliente: groupData.cliente,
      apellido: groupData.apellido,
      email: groupData.email || '',
      whatsapp: groupData.whatsapp,
      nacionalidad: groupData.nacionalidad || '',
      check_in: checkIn,
      check_out: checkOut,
      noches: noches,
      hora_llegada: groupData.hora_llegada || '',
      habitacion_id: masterRoom.habitacion_id,
      tipo_habitacion: db.prepare('SELECT tipo FROM habitaciones WHERE id = ?').get(masterRoom.habitacion_id).tipo,
      adultos: masterRoom.adultos,
      menores: masterRoom.menores,
      mascotas: masterRoom.mascotas,
      plan_codigo: planCodigo,
      plan_nombre: plan.nombre,
      precio_adulto_noche: plan.precio_adulto_noche,
      precio_menor_noche: plan.precio_menor_noche,
      precio_mascota_noche: plan.precio_mascota_noche,
      productos_adicionales: 0,
      monto_pagado: 0,
      estado: 'Confirmada',
      fuente: groupData.fuente || 'Teléfono',
      notas: groupData.notas || '',
      created_by: userEmail,
      grupo_codigo: grupoCodigo,
      es_maestra: 1,
      parent_reserva_id: null,
      facturacion_consolidada: facturacionConsolidada
    };

    // Calculate Master Pricing Totals
    const masterTotals = calcReservationWithRates(plan.id, checkIn, checkOut, masterRoom.adultos, masterRoom.menores, masterRoom.mascotas);
    Object.assign(masterPayload, masterTotals);

    // Insert Master into database
    const insertStmt = db.prepare(`
      INSERT INTO reservas_hotel (
        cliente, apellido, email, whatsapp, nacionalidad, check_in, check_out, noches, hora_llegada,
        habitacion_id, tipo_habitacion, adultos, menores, mascotas, plan_codigo, plan_nombre,
        precio_adulto_noche, precio_menor_noche, precio_mascota_noche, subtotal, productos_adicionales,
        impuesto_pct, impuesto_monto, monto_total, deposito_sugerido, monto_pagado, saldo_pendiente,
        estado, fuente, notas, created_by, grupo_codigo, es_maestra, parent_reserva_id, facturacion_consolidada
      ) VALUES (
        @cliente, @apellido, @email, @whatsapp, @nacionalidad, @check_in, @check_out, @noches, @hora_llegada,
        @habitacion_id, @tipo_habitacion, @adultos, @menores, @mascotas, @plan_codigo, @plan_nombre,
        @precio_adulto_noche, @precio_menor_noche, @precio_mascota_noche, @subtotal, @productos_adicionales,
        @impuesto_pct, @impuesto_monto, @monto_total, @deposito_sugerido, @monto_pagado, @saldo_pendiente,
        @estado, @fuente, @notas, @created_by, @grupo_codigo, @es_maestra, @parent_reserva_id, @facturacion_consolidada
      )
    `);

    const masterResult = insertStmt.run(masterPayload);
    const masterId = masterResult.lastInsertRowid;

    // Create folio charges for the Master room
    const masterRoomName = db.prepare('SELECT nombre FROM habitaciones WHERE id = ?').get(masterRoom.habitacion_id).nombre;
    db.prepare(`
      INSERT INTO folio_hotel (reserva_id, concepto, tipo, monto, fecha)
      VALUES (?, ?, 'debito', ?, CURRENT_DATE)
    `).run(masterId, `Cargo Alojamiento: ${masterRoomName} - ${plan.nombre} (${noches} noches)`, masterPayload.subtotal);

    if (masterPayload.impuesto_monto > 0) {
      db.prepare(`
        INSERT INTO folio_hotel (reserva_id, concepto, tipo, monto, fecha)
        VALUES (?, 'Impuesto Turismo 10%', 'debito', ?, CURRENT_DATE)
      `).run(masterId, masterPayload.impuesto_monto);
    }

    // Cumulative variables for Consolidated Billing calculations
    let consolidatedSubtotal = masterPayload.subtotal;
    let consolidatedTaxes = masterPayload.impuesto_monto;
    let consolidatedTotal = masterPayload.monto_total;

    // 3. Create Child Reservations
    for (let i = 1; i < groupData.habitaciones.length; i++) {
      const childRoom = groupData.habitaciones[i];
      const childRoomObj = db.prepare('SELECT nombre, tipo FROM habitaciones WHERE id = ?').get(childRoom.habitacion_id);

      const childPayload = {
        cliente: childRoom.cliente || groupData.cliente,
        apellido: childRoom.apellido || groupData.apellido,
        email: childRoom.email || '',
        whatsapp: childRoom.whatsapp || groupData.whatsapp,
        nacionalidad: childRoom.nacionalidad || groupData.nacionalidad || '',
        check_in: checkIn,
        check_out: checkOut,
        noches: noches,
        hora_llegada: groupData.hora_llegada || '',
        habitacion_id: childRoom.habitacion_id,
        tipo_habitacion: childRoomObj.tipo,
        adultos: childRoom.adultos,
        menores: childRoom.menores,
        mascotas: childRoom.mascotas,
        plan_codigo: planCodigo,
        plan_nombre: plan.nombre,
        precio_adulto_noche: plan.precio_adulto_noche,
        precio_menor_noche: plan.precio_menor_noche,
        precio_mascota_noche: plan.precio_mascota_noche,
        productos_adicionales: 0,
        monto_pagado: 0,
        estado: 'Confirmada',
        fuente: groupData.fuente || 'Teléfono',
        notas: `[Parte del grupo ${grupoCodigo}]`,
        created_by: userEmail,
        grupo_codigo: grupoCodigo,
        es_maestra: 0,
        parent_reserva_id: masterId,
        facturacion_consolidada: facturacionConsolidada
      };

      const childTotals = calcReservationWithRates(plan.id, checkIn, checkOut, childRoom.adultos, childRoom.menores, childRoom.mascotas);
      
      if (facturacionConsolidada === 1) {
        // Under Consolidated Billing: Child reservation financials set to $0
        childPayload.subtotal = 0;
        childPayload.impuesto_pct = plan.lleva_impuesto === 0 ? 0 : 10;
        childPayload.impuesto_monto = 0;
        childPayload.monto_total = 0;
        childPayload.deposito_sugerido = 0;
        childPayload.saldo_pendiente = 0;

        consolidatedSubtotal += childTotals.subtotal;
        consolidatedTaxes += childTotals.impuesto_monto;
        consolidatedTotal += childTotals.monto_total;
      } else {
        // Under Separate Accounts: Child reservation handles its own financials
        Object.assign(childPayload, childTotals);
      }

      const childResult = insertStmt.run(childPayload);
      const childId = childResult.lastInsertRowid;

      if (facturacionConsolidada === 1) {
        // Post charges to MASTER folio
        db.prepare(`
          INSERT INTO folio_hotel (reserva_id, concepto, tipo, monto, fecha)
          VALUES (?, ?, 'debito', ?, CURRENT_DATE)
        `).run(masterId, `Cargo Alojamiento: ${childRoomObj.nombre} - ${plan.nombre} (Huésped: ${childPayload.cliente})`, childTotals.subtotal);

        if (childTotals.impuesto_monto > 0) {
          db.prepare(`
            INSERT INTO folio_hotel (reserva_id, concepto, tipo, monto, fecha)
            VALUES (?, ?, 'debito', ?, CURRENT_DATE)
          `).run(masterId, `Impuesto Turismo 10% [${childRoomObj.nombre}]`, childTotals.impuesto_monto);
        }
      } else {
        // Post charges to CHILD folio
        db.prepare(`
          INSERT INTO folio_hotel (reserva_id, concepto, tipo, monto, fecha)
          VALUES (?, ?, 'debito', ?, CURRENT_DATE)
        `).run(childId, `Cargo Alojamiento: ${childRoomObj.nombre} - ${plan.nombre} (${noches} noches)`, childTotals.subtotal);

        if (childTotals.impuesto_monto > 0) {
          db.prepare(`
            INSERT INTO folio_hotel (reserva_id, concepto, tipo, monto, fecha)
            VALUES (?, 'Impuesto Turismo 10%', 'debito', ?, CURRENT_DATE)
          `).run(childId, childTotals.impuesto_monto);
        }
      }
    }

    // 4. If Consolidated Billing: Update the Master Reservation's total financial sums
    if (facturacionConsolidada === 1) {
      db.prepare(`
        UPDATE reservas_hotel SET
          subtotal = ?,
          impuesto_monto = ?,
          monto_total = ?,
          deposito_sugerido = Math.round(? * 0.5 * 100) / 100,
          saldo_pendiente = ? - monto_pagado
        WHERE id = ?
      `).run(consolidatedSubtotal, consolidatedTaxes, consolidatedTotal, consolidatedTotal, consolidatedTotal, masterId);
    }

    return masterId;
  });

  try {
    const masterId = createGroupTransaction(data, req.user.nombre || req.user.email);
    return ok(res, { id: masterId, message: 'Grupo de reservas creado exitosamente' });
  } catch (error) {
    return err(res, 'TRANSACTION_FAILED', error.message, 500);
  }
});
```

---

## 3. Lógica Contable (Consolidated Billing vs. Separate Accounts)

The accounting scheme specifies where room nights and extra charges are recorded and billed.

### 3.1 Consolidated Billing (`facturacion_consolidada = 1`) — DEFAULT
*   **Room Charges:** Automatically charged to the **Master Reservation's folio** as debits with descriptions of each respective child room.
*   **Extra Charges (Spa, Restaurant, etc.):** When adding a folio entry to a child reservation (via `POST /hotel/reservas/:childId/folio`), the system will check if `parent_reserva_id` exists and consolidated billing is enabled. If so, it will redirect the debit charge directly to the Master's folio (labeled with the child's room number).
*   **Payments:** All payments/credits are recorded on the **Master Reservation's folio**. The total outstanding balance (`saldo_pendiente`) is recalculated on the Master booking. The child reservations have their own `subtotal = 0`, `monto_total = 0`, and `saldo_pendiente = 0` database columns to reflect they do not owe anything independently.

### 3.2 Separate Accounts (`facturacion_consolidada = 0`) — OPTIONAL
*   **Folios:** Each room (Master and Children) behaves like a standard independent reservation.
*   **Folio Entries:** Charges for room nights, taxes, and extras are logged on their respective individual folios.
*   **Payments:** Handled independently. Each guest pays for their own room, and their balances are resolved separately.

---

## 4. Front-End UI Modifications

We will refactor the frontend in `NuevaReserva.tsx`, `Calendario.tsx` (using `RoomRow.tsx`), and `ReservaDetalle.tsx`.

### 4.1 Reservation Creation (`src/pages/NuevaReserva.tsx`)
1.  **Toggle Switch:** Add a `¿Es Reserva de Grupo? 👥` toggle switch.
2.  **Multi-Room Selector:** When active, the room list selection enables checking multiple buttons (reusing and extending `selectedUnits` to support both `Estadía` and `Pasadía` room lists).
3.  **Billing Options:** Render a select dropdown containing:
    *   `Facturación Consolidada` (Charges aggregated to Leader's folio)
    *   `Cuentas Separadas` (Each room maintains its own folio)
4.  **Per-Room Guest Assignments:** Render a dynamic list of card components for each selected room. It will render fields for:
    *   **Guest Name & Surname** (pre-filled with the Leader's name by default)
    *   **Occupancy Details** (Adults, Children, Pets specific to that physical unit)
5.  **Cotization Recalculation:** The totals preview panel will compute the consolidated sum of all selected rooms.
6.  **Submit Handler:** Triggers `api.post('/hotel/reservas/grupo', payload)` to create the bookings in one safe transaction block.

### 4.2 Visual Grid & Interactions (`src/pages/Calendario.tsx` & `src/components/RoomRow.tsx`)
1.  **Visual Indicators on Reservation Bars:**
    *   Add a 👥 icon next to the guest's name if `reserva.grupo_codigo` is defined.
    *   Generate a stable, attractive border or shadow color from a hash of the `grupo_codigo` so that all members of the group share a subtle common color frame (e.g. green, orange, or purple left border line).
2.  **Hover Highlighting:**
    *   Introduce a global React state in `Calendario.tsx`: `const [activeGroupCode, setActiveGroupCode] = useState<string | null>(null);`.
    *   Pass `activeGroupCode` and `onHoverGroup` to the `RoomRow` component.
    *   In the reservation bar tag in `RoomRow.tsx`:
        *   `onMouseEnter` -> `if (res.grupo_codigo) onHoverGroup(res.grupo_codigo)`
        *   `onMouseLeave` -> `onHoverGroup(null)`
        *   Apply CSS dynamically: If `res.grupo_codigo && res.grupo_codigo === activeGroupCode`, add a prominent highlight class such as `ring-4 ring-offset-1 ring-blue-500 scale-[1.02] z-30 shadow-lg brightness-110 transition-all duration-150`.
3.  **Individual Drag-and-Drop Reassignments:**
    *   Add `draggable={true}` to the Link elements inside `RoomRow.tsx`.
    *   On `onDragStart`, save the individual reservation's ID: `e.dataTransfer.setData('text/plain', res.id.toString())`.
    *   In `RoomRow.tsx`, make the empty cells droppable targets:
        ```tsx
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
        onDrop={(e) => {
          e.preventDefault();
          const draggedResId = e.dataTransfer.getData('text/plain');
          if (draggedResId) {
            handleReassignRoom(Number(draggedResId), room.id);
          }
        }}
        ```
    *   In `Calendario.tsx`, the `handleReassignRoom(reservaId, newRoomId)` function will execute an API call:
        ```typescript
        const handleReassignRoom = async (reservaId: number, newRoomId: number) => {
          try {
            await api.put(`/hotel/reservas/${reservaId}`, { habitacion_id: newRoomId });
            load(); // reload the calendar
          } catch (err: any) {
            alert(err?.response?.data?.error?.message || "La habitación no está disponible en estas fechas.");
          }
        };
        ```
        This fulfills the user request of allowing individual reassignments of child units without affecting the check-in/out dates or other rooms in the group.

### 4.3 Group Management in `src/pages/ReservaDetalle.tsx`
If the booking belongs to a group (`reserva.grupo_codigo` is not null), a custom **"Panel de Grupo 👥"** will be displayed in the sidebar or main content area.

1.  **Linked Rooms List:** Show all rooms matching `reserva.grupo_codigo`, highlighting their assigned guest, physical room number, reservation state (Confirmed, Checked-In, Checked-Out), and individual balance.
2.  **Consolidated Statistics:** Display aggregated financial totals of the entire group:
    *   Consolidated Group Cost: `$X.XX`
    *   Total Payments Logged: `$Y.YY`
    *   Consolidated Outstanding Balance: `$Z.ZZ`
3.  **Massive (Batch) State Operations:** Add two prominent buttons:
    *   **Check-In Grupo:** Triggers sequential API patches to transition all eligible reservations in the group (`estado = 'Confirmada'`) to `'Hospedado'`.
    *   **Check-Out Grupo:** Triggers sequential API patches to transition all eligible reservations in the group (`estado = 'Hospedado'`) to `'Check-Out'`.

---

## 5. Verification and Testing Strategy

To guarantee the reliability of the group booking module, we will implement an integration test suite.

### 5.1 Proposed Test Suite (`server/routes/hotel.group.test.js`)
We will create a new integration test file `server/routes/hotel.group.test.js` using Vitest to assert the following:

1.  **Atomic Transaction Validation:**
    *   Try creating a group reservation with two available rooms. Assert that both are created successfully and share a matching `grupo_codigo`.
    *   Try creating a group reservation with three rooms where two are available and one is occupied on those dates. Assert that the backend throws a collision error, and verify that *none* of the reservations are created (confirming database rollback).
2.  **Consolidated Folio Accounting Check:**
    *   Create a group booking with Consolidated Billing.
    *   Assert that all nights and taxes debits are logged directly on the Master's folio.
    *   Assert that child reservations have a `monto_total` and `saldo_pendiente` of exactly `0` in the database.
3.  **Separate Accounts Accounting Check:**
    *   Create a group booking with Separate Accounts.
    *   Assert that each child reservation has its own nights/taxes debits posted to its own folio.
    *   Assert that child reservations hold their own `monto_total` and `saldo_pendiente` values.
4.  **Drag and Drop Reassignment Check:**
    *   Perform a mock reassignment by PUT-ing a new room ID to a child reservation.
    *   Assert that the physical unit changes, but its stay dates and all other rooms in the group remain unchanged.
