# Handoff Report: Group Bookings and Multiple Units (Master/Child Bookings)

## 1. Observation

Direct read-only investigation across the Casa Mahana PMS codebase revealed the following exact database structures, routes, calculations, and frontend layouts:

1.  **Database schema (`server/db/schema.sql`):**
    *   Reservations are stored in the `reservas_hotel` table (starting at line 46).
    *   Individual folio transactions are stored in the `folio_hotel` table (starting at line 91), which has a foreign key referencing `reservas_hotel(id)`.
    *   Housekeeping units are defined in the `habitaciones` table (starting at line 1).

2.  **Database helpers and whitelisting (`server/db/database.js`):**
    *   The database uses **`better-sqlite3`** and operates in WAL mode (line 12).
    *   A whitelist of `VALID_TABLES` (lines 284–294) restricts the tables available for general CRUD operations (such as `findAll` and `create`).
    *   Initialization is synchronous, loading and executing `schema.sql` on startup (lines 20-22).

3.  **Pricing engine and calculations (`server/utils/calculations.js`):**
    *   Lines 30-86 define `calcReservation(data)`, which computes the `subtotal`, `impuesto_monto`, `monto_total`, `deposito_sugerido`, and `saldo_pendiente` based on fixed prices.
    *   Lines 89-155 define `calcReservationWithRates(planId, checkIn, checkOut, adultos, menores, mascotas)`, which queries `reglas_tarifa` for day-type rates (holiday, weekend, weekday) and returns a day-by-day price breakdown.
    *   Line 158-163 defines `calcNoches(checkIn, checkOut)` which calculates stays.

4.  **Backend endpoints (`server/routes/hotel.js`):**
    *   **Creation:** `POST /hotel/reservas` (lines 332-488) creates a single reservation, calculates totals, posts initial room nights and tax debits to the folio, and triggers pre-arrival notifications.
    *   **Modification:** `PUT /hotel/reservas/:id` (lines 494-555) validates room availability, conflicts, recalculates totals if pricing/dates change, and updates database columns.
    *   **Folio Transactions:** `POST /hotel/reservas/:id/folio` (lines 687-755) adds credits or debits, recalculates paid/pending balances, and triggers payment notifications.
    *   **Housekeeping Hook:** `PATCH /hotel/reservas/:id/status` (lines 593-645) implements state transitions (Hospedado, Check-Out) and automatically sets physical room cleaning states:
        *   `Hospedado` -> `estado_habitacion = 'Ocupada'`
        *   `Check-Out` -> `estado_habitacion = 'Vacía'`, `estado_limpieza = 'Sucia'`
        *   `Cancelada` / `No-Show` -> `estado_habitacion = 'Vacía'`

5.  **Frontend Reservation Creation (`src/pages/NuevaReserva.tsx`):**
    *   Lines 37-40 select category: `Estadía` or `Pasadía`.
    *   For `Pasadía` with multiple units (`selectedUnits.length > 1`), creation is handled in a non-atomic loop (lines 236-263):
        ```typescript
        for (const unitId of selectedUnits) {
          const payload = { ...form, habitacion_id: unitId, ... };
          const r = await api.post('/hotel/reservas', payload);
          ...
        }
        ```
        This triggers separate sequential backend requests without a database transaction or structured group linking columns.

6.  **Frontend Calendar (`src/pages/Calendario.tsx` and `src/components/RoomRow.tsx`):**
    *   The calendar fetches dates over a 14-day timeline (line 35).
    *   `RoomRow.tsx` (lines 134-147) renders reservation blocks inside their assigned room rows as absolute-positioned `<Link>` items.
    *   *Observation:* There is currently no support for HTML5 drag-and-drop handles, visual linking for grouped bookings, or simultaneous hover highlighting.

7.  **Frontend Details (`src/pages/ReservaDetalle.tsx`):**
    *   Displays reservation guest data, totals, documents, and individual folio transactions.
    *   *Observation:* It lacks a panel for displaying grouped reservations, consolidated statistics, or trigger buttons for massive check-in/out of linked bookings.

---

## 2. Logic Chain

1.  **Column Integration:** Adding `grupo_codigo` (TEXT), `es_maestra` (INTEGER), `parent_reserva_id` (INTEGER), and `facturacion_consolidada` (INTEGER) directly to the `reservas_hotel` schema in `schema.sql` gives the database native knowledge of master-child reservation relationships.
2.  **API Mount:** Creating a dedicated bulk endpoint `POST /api/v1/hotel/reservas/grupo` handles group bookings under a single `better-sqlite3` transaction block (`db.transaction()`). If any room is occupied or conflicts exist during the date range, the transaction throws an exception and rolls back completely, ensuring ACID compliance and avoiding partial bookings.
3.  **Folio Consolidation Logic:**
    *   Under Consolidated Billing (`facturacion_consolidada = 1`), room nights and tax charges of all child rooms are posted as debits directly to the **Master Reservation's folio** with descriptive labels (e.g. "Cargo Alojamiento FAM(3): [Plan] (4 noches)").
    *   The child reservations have their own financial sums (`subtotal`, `monto_total`, `saldo_pendiente`) set to `$0` in the database, representing that they are fully paid on the leader's account, which is clean and prevents double-billing.
    *   Under Separate Accounts (`facturacion_consolidada = 0`), each child room retains its own pricing totals and folio transactions.
4.  **Frontend Creation Upgrade:**
    *   In `NuevaReserva.tsx`, introducing a toggle for `¿Es Reserva de Grupo?` and enabling multi-selection allows selecting multiple units.
    *   Rendering a card list for each selected room allows individual name and occupancy configuration.
    *   Submitting calls the new bulk transactional endpoint `POST /api/v1/hotel/reservas/grupo`.
5.  **Calendar visual linking & Highlight:**
    *   Adding a 👥 icon next to guest names on reservation bars in `RoomRow.tsx` immediately identifies group members.
    *   Hashing the `grupo_codigo` to render a pastel-colored border provides clean visual association.
    *   Adding an `activeGroupCode` and `onHoverGroup` callback in `Calendario.tsx` enables simultaneous hover highlighting: when one reservation is hovered, all members sharing the same `grupo_codigo` light up with high-contrast Tailwind outline classes.
6.  **Drag-and-Drop Reassignment:**
    *   Adding `draggable={true}` on reservation blocks in `RoomRow.tsx` and handling `onDrop` on grid cells allows dragging.
    *   When dropped, calling the standard `PUT /hotel/reservas/:id` with the new `habitacion_id` validates availability and updates the physical room assignment in the backend, keeping dates, prices, and other group rooms perfectly untouched.
7.  **Group Operations in Details Page:**
    *   In `ReservaDetalle.tsx`, fetching all rooms sharing `grupo_codigo` allows displaying a "Panel de Grupo 👥".
    *   Consolidating statistics allows rendering the group's total cost, paid, and outstanding balance.
    *   Adding bulk "Check-In Grupo" and "Check-Out Grupo" buttons loops through all group reservations, sequential patching status, which automates reception workflows.

---

## 3. Caveats

*   **Pasadía Date Logic:** In `NuevaReserva.tsx`, day-pass bookings auto-set `check_out = check_in + 1 day` to handle a single full day of occupancy. When dragging and dropping a day-pass, we must verify that this 1-day offset is maintained.
*   **Extra Folio Debits:** Under consolidated billing, general payments must be recorded on the Master's folio. If child rooms try to log extra debits (like spa or restaurant), the backend transaction must intercept them and redirect them to the Master's folio (linked to the child's room label) to keep accounts unified.
*   **Housekeeping States:** Massive Check-In/Check-Out will trigger the standard status hooks in sequence, which is perfect and guarantees that all rooms in the group transition their housekeeping cleaning states (`Ocupada`, `Sucia`) automatically.

---

## 4. Conclusion

The "Group Bookings and Multiple Units" module can be implemented securely and cleanly without adding heavy packages. The finalized strategy is:

1.  **Schema Migration:** Alter `reservas_hotel` to add `grupo_codigo` (TEXT), `es_maestra` (INTEGER), `parent_reserva_id` (INTEGER), and `facturacion_consolidada` (INTEGER), with a custom query index `idx_reservas_grupo`.
2.  **API Transactional Endpoint:** Implement `POST /api/v1/hotel/reservas/grupo` inside `server/routes/hotel.js` utilizing `better-sqlite3`'s transaction. Check room conflicts and record initial folio debits on the Master's folio (if consolidated) or separate folios (if separate accounts).
3.  **Accounting Consolidation Hook:** In `POST /hotel/reservas/:id/folio`, redirect child charges under consolidated billing to the Master's folio.
4.  **Creation UI:** Introduce `isGroup` switch, multi-room click selection, card form per room, and bulk endpoint execution in `NuevaReserva.tsx`.
5.  **Calendar Highlights:** Display 👥 icon, pastel borders, mouse hover synchronization in `RoomRow.tsx` and `Calendario.tsx`.
6.  **Drag-and-Drop Reassignments:** Implement HTML5 drag on reservation Link and drop on RoomRow cells, executing standard `PUT /hotel/reservas/:id` to swap physical units.
7.  **Group Detail Panel:** Display group member list, consolidated stats, and bulk Check-In/Check-Out buttons in `ReservaDetalle.tsx`.
8.  **Test Integration:** Add `server/routes/hotel.group.test.js` to verify atomicity, consolidated billing folios, separate accounts, and drag reassignments.

---

## 5. Verification Method

### 5.1 Automated Testing Verification
Create and execute the Vitest suite at `server/routes/hotel.group.test.js`:
```bash
# Run the integration test suite
npm run test server/routes/hotel.group.test.js
```
The tests must assert that:
1.  Creating a group with an occupied room fails the entire transaction and leaves database tables empty (no partial creations).
2.  Under consolidated billing, child folios are empty, and the Master folio records all charges.
3.  Reassigning a single child room's physical ID executes successfully and does not alter stay dates.

### 5.2 Manual UI Scenarios
1.  **Bulk Creation:** In `NuevaReserva.tsx`, activate group switch, select rooms `DOB(1)` and `DOB(2)`. Set billing to Consolidated. Click Submit. Confirm you are navigated to the Master's reservation detail screen, where both room charges are listed on the folio.
2.  **Hover Highlight:** Go to the `Calendario` page. Hover the cursor over the reservation bar of `DOB(1)`. Verify that both `DOB(1)` and `DOB(2)`'s bars receive a high-contrast highlighted ring simultaneously.
3.  **Drag Reassignment:** Drag the reservation bar of `DOB(2)` and drop it onto `DOB(3)`. Verify that the bar moves to `DOB(3)` while keeping the same dates.
4.  **Bulk Actions:** In `ReservaDetalle.tsx`, click "Check-In Grupo". Verify both reservations in the group transition to `'Hospedado'` status.
