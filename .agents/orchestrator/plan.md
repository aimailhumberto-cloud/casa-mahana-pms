# Implementation Plan — Group Bookings and Multiple Units (Master/Child Bookings)

This plan outlines the design and implementation steps for a comprehensive group bookings, multiple units allocation, consolidated billing, linked calendar visualizations, physical unit drag reassignments, massive operations, and automatic tests in Casa Mahana PMS.

## Architecture & Data Flow

```
[Receptionist / User UI]
       │  (Creates group booking with multiple selected units)
       ▼
[POST /api/v1/hotel/reservas/grupo]
       │
  [db.transaction()]
       ├── Validate dates and availability for all requested units
       ├── Generate unique 'grupo_codigo' (e.g. GRP-YYYYMMDD-XXXX)
       ├── Create Master reservation (with es_maestra = 1, facturacion_consolidada = 0 or 1)
       ├── Create Child reservations (with es_maestra = 0, parent_reserva_id = master.id)
       └── If facturacion_consolidada = 1:
             ├── Post room/tax debits of ALL rooms (master & children) to Master's folio
             └── Child reservations are saved with pricing/balance totals = $0
```

## Milestones & Work Items

### Milestone 1: Database Schema Modifications
- [ ] Add columns to `reservas_hotel` in `server/db/schema.sql`:
  - `grupo_codigo` TEXT
  - `es_maestra` INTEGER DEFAULT 0
  - `parent_reserva_id` INTEGER
  - `facturacion_consolidada` INTEGER DEFAULT 1
  - Foreign Key referencing `reservas_hotel(id)` for `parent_reserva_id`
  - Index `idx_reservas_grupo` ON `reservas_hotel(grupo_codigo)`
- [ ] Update migration/initialization in `server/db/database.js` to dynamically add these columns if they are not already present in the existing SQLite database.

### Milestone 2: Backend API & SQLite Transactions
- [ ] Implement `POST /api/v1/hotel/reservas/grupo` in `server/routes/hotel.js` inside a single `db.transaction()` wrapper:
  - Validate availability for all rooms and dates. If any overlaps exist, throw error and rollback completely.
  - Insert reservations, linking them via `grupo_codigo`, `es_maestra`, `parent_reserva_id`, and `facturacion_consolidada`.
  - Calculate totals dynamically using `calcReservation` or `calcReservationWithRates`.
- [ ] Support retrieval of group members via `GET /api/v1/hotel/reservas?grupo_codigo=XYZ`.

### Milestone 3: Consolidated Folio Accounting
- [ ] Update folio logic:
  - If `facturacion_consolidada = 1`, all room rate debits and taxes for children are written to the Master reservation's folio (labeled with the child's room number).
  - The children's reservation fields (`subtotal`, `impuesto_monto`, `monto_total`, `monto_pagado`, `saldo_pendiente`) are stored as `$0`.
  - If a payment/abono is posted, it goes to the Master folio and reduces the Master's consolidated `saldo_pendiente`.
  - If `facturacion_consolidada = 0`, children keep separate totals and separate folios.

### Milestone 4: Frontend UI - Group Creation
- [ ] Refactor `src/pages/NuevaReserva.tsx`:
  - Add interactive switch: *¿Es una reserva de grupo?*.
  - When active, allow multi-selection of units (checkboxes or grid) for the selected dates.
  - Render card input forms for each room (to specify individual occupant names, roles, adult/child counts, tariff plans).
  - Allow choosing "Facturación Consolidada" (default) or "Cuentas Separadas".
  - Execute API call to `POST /api/v1/hotel/reservas/grupo`. On success, redirect to the Master's detail page.

### Milestone 5: Frontend UI - Calendar Integration
- [ ] Refactor `src/components/RoomRow.tsx` and `src/pages/Calendario.tsx`:
  - Render a visual link 👥 indicator next to guest names for group bookings.
  - Render group borders using a common color hash (derived from `grupo_codigo`) with high-quality visual classes.
  - Track `activeGroupCode` state on mouse hover. Highlight all group blocks sharing the hovered `grupo_codigo` simultaneously.
  - Add standard HTML5 drag-and-drop handles onto reservation blocks. On dropping on a different RoomRow cell, invoke standard `PUT /hotel/reservas/:id` to swap the physical room row in the backend.

### Milestone 6: Frontend UI - Group Detail Panel
- [ ] Refactor `src/pages/ReservaDetalle.tsx`:
  - If the reservation has a `grupo_codigo`, render a "Panel de Grupo 👥".
  - List all room records, occupants, and check-in/out statuses in the group.
  - Add a consolidated balance block showing overall group cost, paid, and remaining balance.
  - Add massive check-in ("Check-In Grupo") and check-out ("Check-Out Grupo") action buttons.

### Milestone 7: Testing & Verification
- [ ] Create `server/routes/hotel.group.test.js` to automatically verify:
  - Creation of group stays (3 rooms) under Consolidated Billing.
  - Payment of consolidated balances on the Master account.
  - Creation of group pasadías (2 bohíos) under Separate Billing.
  - Physical room drag-and-drop reassignments in the backend.
- [ ] Run test suite (`npm run test`) and ensure production builds (`npm run build`) finish with zero errors.
