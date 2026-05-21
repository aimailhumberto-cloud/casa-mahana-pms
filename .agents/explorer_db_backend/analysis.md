# structured analysis of Reservation DB Schema & Backend Logic

This structured report analyzes the database schema and backend logic of the Casa Mahana PMS concerning reservation creation, status validation, and state transitions. It details current configurations, identifies key issues, and outlines a concrete fix strategy for transitioning online bookings to use `'Pendiente'` as the default status.

---

## 1. Table Schema Definition for `reservas`

The reservation table is named **`reservas_hotel`**. Its schema is defined in `server/db/schema.sql`.

* **File Path:** `server/db/schema.sql`
* **Line Range:** 68–112
* **Key Definition (Line 105):**
  ```sql
  estado TEXT DEFAULT 'Confirmada',
  ```
* **Analysis:**
  * While the SQLite column default is `'Confirmada'`, the application logic explicitly sets status values when reservations are created.
  * Internal reservations created by reception/staff (in `server/routes/hotel.js`, line 403) default to `'Confirmada'` unless specified otherwise.
  * Online reservations created via the public booking widget currently override this default with `'Por Aprobar'`.

---

## 2. Public Booking Endpoint (`POST /api/v1/public/reservar`)

Public bookings are processed by the public router in `server/routes/public.js`.

* **File Path:** `server/routes/public.js`
* **Line Range:** 178–256 (`router.post('/reservar', ... )`)
* **Key Line (Line 221):**
  ```javascript
  estado: 'Por Aprobar', fuente: 'Website',
  ```
* **Analysis:**
  * Currently, the booking handler explicitly sets `estado: 'Por Aprobar'` for all reservations created from the website.
  * **How to change it to default to `'Pendiente'`:**
    Modify `server/routes/public.js` line 221 to:
    ```javascript
    estado: 'Pendiente', fuente: 'Website',
    ```
  * **Benefits of transitioning to `'Pendiente'`:**
    * **UI/UX Consistency:** In the frontend (`src/pages/Reservas.tsx` and `src/pages/ReservaDetalle.tsx`), `'Pendiente'` is fully supported with specific color styling (`bg-yellow-100 text-yellow-700`) and is available in the dropdown filter. `'Por Aprobar'` has no associated styling, meaning it displays without a state badge and is impossible to filter.
    * **Progression Support:** The reservation detail view (`src/pages/ReservaDetalle.tsx` lines 145–148) includes a dedicated status transition button ("Confirmar") for reservations in `'Pendiente'` state. For `'Por Aprobar'` state, no actions are rendered, meaning a receptionist cannot easily advance or manage the booking without custom DB edits.

---

## 3. Validation & Handler for Status Transitions (`PATCH /api/v1/hotel/reservas/:id/status`)

This endpoint updates a reservation's state and automatically handles side-effects on room occupancy/cleaning and client notifications.

* **File Path:** `server/routes/hotel.js`
* **Line Range:** 520–548 (`router.patch('/hotel/reservas/:id/status', ... )`)
* **State Change Validation (Lines 523–525):**
  ```javascript
  const { estado } = req.body;
  const valid = ['Pendiente', 'Confirmada', 'Hospedado', 'Check-Out', 'Cancelada', 'No-Show'];
  if (!valid.includes(estado)) return err(res, 'VALIDATION_ERROR', `Estados válidos: ${valid.join(', ')}`);
  ```
* **Room Status Cascades (Lines 531–541):**
  * If `estado === 'Hospedado'`: Room is set to `estado_habitacion: 'Ocupada'`.
  * If `estado === 'Check-Out'`: Room is set to `estado_habitacion: 'Vacía'` and `estado_limpieza: 'Sucia'`.
  * If `estado === 'Cancelada' || estado === 'No-Show'`: Room is set to `estado_habitacion: 'Vacía'`.
  * For `'Pendiente'` and `'Confirmada'`, the room's current state is untouched since the guest has not checked-in yet.
* **Notification Side-Effects (Lines 544–547):**
  * Calls `notifications.notifyStatusChange(updated, existing.estado, estado, hab)` asynchronously to alert the customer via WhatsApp/Email.
* **Analysis & Fix Requirements:**
  * `'Pendiente'` is already part of the `valid` array of states. No validator update is needed in this endpoint because changing the public booking default to `'Pendiente'` naturally satisfies this constraint.

---

## 4. Other Places Handling or Validating `estado`

An exhaustive analysis of the codebase reveals several other places where reservation status is handled:

### A. Background Cron Jobs (`server/utils/scheduler.js`)
* **Line 24 & Line 39:** Query upcoming stays that are `'Confirmada'` to send check-in reminders.
* **Line 65 (Minor Bug Found):**
  ```javascript
  const expiredStays = db.prepare(
    "SELECT * FROM reservas_hotel WHERE check_out < ? AND estado = 'Check-In'"
  ).all(todayStr);
  ```
  * **Observation:** The cron job checks for expired stays using `estado = 'Check-In'`. However, the rest of the application uses `'Hospedado'` as the check-in status (both in transition routes and UI).
  * **Fix Strategy:** Propose updating `'Check-In'` to `'Hospedado'` in `server/utils/scheduler.js`.

### B. Unit Tests (`server/utils/scheduler.test.js`)
* **Line 93 & Line 106:** The test suite mocks database responses and asserts queries using the incorrect `'Check-In'` state.
* **Fix Strategy:** Propose updating these assertions to use `'Hospedado'` to match the application status name.

### C. CSV/Excel Imports (`server/import-cloudbeds.js`)
* **Lines 129–151 (`STATUS_MAP`):**
  Maps external statuses from Cloudbeds to PMS states. It already correctly maps unconfirmed/pending to `'Pendiente'`, and checked-in/in-house states to `'Hospedado'`.

### D. Frontend Pages & Components
* **`src/pages/Reservas.tsx` (Lines 8–15):** Maps color styling for `'Confirmada'`, `'Hospedado'`, `'Check-Out'`, `'Pendiente'`, `'Cancelada'`, and `'No-Show'`.
* **`src/pages/ReservaDetalle.tsx` (Lines 144–191):** Renders actionable buttons only for valid transitions:
  * `Pendiente` → displays "Confirmar" to go to `Confirmada`.
  * `Confirmada` → displays "Check-In" to go to `Hospedado`, or "Pendiente" to go back to `Pendiente`.
  * `Hospedado` → displays "Check-Out" to go to `Check-Out`.

---

## 5. Concrete Fix Strategy

To fully resolve the online booking default status and fix the discovered status inconsistency in background tasks, we propose the following three patches:

### Patch 1: Set Default Online Booking Status to `'Pendiente'`
Modify `server/routes/public.js` line 221 to replace `'Por Aprobar'` with `'Pendiente'`:
```diff
<<<<
      estado: 'Por Aprobar', fuente: 'Website',
====
      estado: 'Pendiente', fuente: 'Website',
>>>>
```

### Patch 2: Align Scheduler with PMS State Vocabulary
Correct `'Check-In'` to `'Hospedado'` in the scheduler's check for expired stays in `server/utils/scheduler.js` line 65:
```diff
<<<<
      "SELECT * FROM reservas_hotel WHERE check_out < ? AND estado = 'Check-In'"
====
      "SELECT * FROM reservas_hotel WHERE check_out < ? AND estado = 'Hospedado'"
>>>>
```

### Patch 3: Align Scheduler Tests with Correct State Vocabulary
Update vitest mocks in `server/utils/scheduler.test.js` lines 89, 93, and 106 to reference `'Hospedado'`:
```diff
<<<<
      { id: 201, cliente: 'Carlos', check_out: '2026-05-19', estado: 'Check-In' }
====
      { id: 201, cliente: 'Carlos', check_out: '2026-05-19', estado: 'Hospedado' }
>>>>
<<<<
      if (sql.includes("reservas_hotel WHERE check_out < ? AND estado = 'Check-In'")) {
====
      if (sql.includes("reservas_hotel WHERE check_out < ? AND estado = 'Hospedado'")) {
>>>>
<<<<
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("reservas_hotel WHERE check_out < ? AND estado = 'Check-In'"));
====
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining("reservas_hotel WHERE check_out < ? AND estado = 'Hospedado'"));
>>>>
```
