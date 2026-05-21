# DB & Backend Alignment — Handoff Report

## 1. Observation

During our read-only investigation, we analyzed the following file paths, specific code blocks, database files, schemas, and configurations:

### 1.1 Booking Creation & Default State
- **File Path**: `server/routes/public.js` (Lines 178–256)
  - Public online bookings are created via `POST /reservar`.
  - Inside the request handler, the status is explicitly set to `'Pendiente'` at line 221:
    ```javascript
    estado: 'Pendiente', fuente: 'Website',
    ```
  - **Identified Business Logic Bug**: On line 253, a premature confirmation email/message is dispatched to the guest immediately on booking creation, even though the status is set to `'Pendiente'` and the user response explicitly states that the booking is under review:
    ```javascript
    notifications.notifyReservationConfirmed(fullReserva, hab).catch(e => console.log('Notif error:', e.message));
    ```

### 1.2 Status Update Endpoint & Room Management
- **File Path**: `server/routes/hotel.js` (Lines 520–548)
  - The route handler for changing a reservation's status is `PATCH /hotel/reservas/:id/status`.
  - It validates the target status against a list of acceptable values:
    ```javascript
    const valid = ['Pendiente', 'Confirmada', 'Hospedado', 'Check-Out', 'Cancelada', 'No-Show'];
    ```
  - It automatically triggers room status updates inside this block:
    ```javascript
    // Auto-update room status
    if (existing.habitacion_id) {
      if (estado === 'Hospedado') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Ocupada' });
      } else if (estado === 'Check-Out') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía', estado_limpieza: 'Sucia' });
      } else if (estado === 'Cancelada' || estado === 'No-Show') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía' });
      }
    }
    ```
  - **Identified Bugs / Gaps**:
    1. **Lack of Transition Validation**: The endpoint allows arbitrary state transitions without any sequential state-machine checks (e.g. going directly from `Pendiente` to `Check-Out`, or moving out of terminal states like `Cancelada` or `Check-Out` back to others).
    2. **Missing Revert Logic**: When reverting an active check-in (`Hospedado`) back to `Confirmada` or `Pendiente`, the room occupancy status is not reset, leaving the room stuck in the `'Ocupada'` state despite the guest not being checked in.

### 1.3 Database Schema & Defaults
- **File Path**: `server/db/schema.sql` (Line 105)
  - The SQLite table definition for `reservas_hotel` currently hardcodes the default state to `'Confirmada'`:
    ```sql
    estado TEXT DEFAULT 'Confirmada',
    ```
  - **Identified Gap**: If a booking is inserted without an explicit state at the database level, it defaults to `'Confirmada'` rather than `'Pendiente'`, which creates a safety risk for third-party scripts, DB migrations, or direct insertions.

### 1.4 modular route documentation discrepancies
- **File Path**: `server/server.js` (Line 173)
  - Inside the `/api/v1/schema` endpoint, the documentation lists:
    ```javascript
    { method: 'PATCH', path: '/hotel/reservas/:id/estado', description: 'Change status', auth: 'write', body: { estado: 'Confirmada|Check-In|Check-Out|Cancelada|No-Show|Por Aprobar' } }
    ```
  - **Discrepancy**: The actual implemented route is `/hotel/reservas/:id/status` (not `/estado`), and the status names are `'Pendiente'` (not `'Por Aprobar'`) and `'Hospedado'` (not `'Check-In'`).

---

## 2. Logic Chain

1. **Premature Confirmation**:
   - `server/routes/public.js` sets the new booking's state to `'Pendiente'` (Pending) to signify that it requires manual/deposit review.
   - However, immediately after creation, it invokes `notifications.notifyReservationConfirmed`.
   - In `server/notifications.js`, `notifyReservationConfirmed` fires an email titled `✅ ¡Reserva Confirmada!`.
   - *Reasoning*: This leaks a premature "Confirmed" status to the customer, violating the review flow and contradicting the endpoint's successful response string. The email should be suppressed on public pending creation, and sent only when the reservation status is transitioned to `'Confirmada'` (handled automatically via `notifications.notifyStatusChange`).

2. **Database Defaults**:
   - `schema.sql` defines `estado TEXT DEFAULT 'Confirmada'`.
   - *Reasoning*: Aligning database defaults with the business requirement ensures all new bookings safely default to `'Pendiente'` unless explicitly overridden. Staff bookings in `server/routes/hotel.js` explicitly default to `'Confirmada'` at the route handler level, keeping their immediate-confirmation behavior intact.

3. **Transition Sequencing**:
   - In `src/pages/ReservaDetalle.tsx`, the UI progression is structured around: `Pendiente` ➔ `Confirmada` ➔ `Hospedado` ➔ `Check-Out`.
   - *Reasoning*: Restricting status transitions in the backend protects the system's integrity. Standard users should only transition bookings along this sequential path or to cancel states (`Cancelada`, `No-Show`). However, administrators should bypass this validation to allow manual adjustments in case of operational mistakes.

4. **Stale Room Occupancy**:
   - If a booking status is updated to `Hospedado`, the room is set to `'Ocupada'`.
   - If the booking status is changed back to `Confirmada` or `Pendiente`, the current handler does not match these states.
   - *Reasoning*: Because these states are not matched in the room update block, `estado_habitacion` stays `'Ocupada'`, preventing other reservations or cleanups. Including these states in the vacation check (`estado_habitacion: 'Vacía'`) ensures correct room occupancy tracking.

---

## 3. Caveats

- **Existing Database Migrations**: SQLite does not natively support simple `ALTER TABLE` operations to change column defaults. The default column update in `schema.sql` will apply successfully to all new database initializations. For existing databases, the application-level defaults in `server/routes/public.js` (`'Pendiente'`) and `server/routes/hotel.js` (`'Confirmada'`) are already fully defined and handle inserts safely.
- **Notification Settings**: The notifications module relies on environment variables (`NOTIFICATIONS_ENABLED`). Testing notifications directly requires mock variables or active services.

---

## 4. Conclusion & Action Plan

To fully align the database and backend logic with the business requirements, we recommend implementing the following targeted changes:

1. **Update SQL Schema**: Change the default value of the `estado` column in `server/db/schema.sql` to `'Pendiente'`.
2. **Silence Premature Public Booking Confirmations**: Remove `notifyReservationConfirmed` from the public booking creation endpoint in `server/routes/public.js`. Firing the notification will happen upon transition to `'Confirmada'`.
3. **Implement State Machine in Backend PATCH**: Protect status transitions using a sequence state machine in `server/routes/hotel.js`, allowing administrators to override restrictions if necessary.
4. **Fix Stale Room States**: Ensure that transitioning back to `Confirmada` or `Pendiente` correctly vacates the room in the database.
5. **Align OpenAPI/Schema Docs**: Update the discovery endpoint in `server/server.js` to match the actual route `/status` and correct enum statuses.

---

## 5. Proposed Code Modifications

Here are the precise, drop-in replacement snippets for the implementation stage:

### 5.1 `server/db/schema.sql` (Line 105)

**Before:**
```sql
  -- Estado
  estado TEXT DEFAULT 'Confirmada',
```

**After:**
```sql
  -- Estado
  estado TEXT DEFAULT 'Pendiente',
```

---

### 5.2 `server/routes/public.js` (Lines 250-254)

**Before:**
```javascript
    // Fire notifications for web booking (async)
    const fullReserva = findById('reservas_hotel', reserva.id);
    const hab = fullReserva.habitacion_id ? findById('habitaciones', fullReserva.habitacion_id) : null;
    notifications.notifyReservationConfirmed(fullReserva, hab).catch(e => console.log('Notif error:', e.message));
    notifications.notifyAdminNewBooking(fullReserva, hab).catch(e => console.log('Admin notif error:', e.message));
```

**After:**
```javascript
    // Fire notifications for web booking (async)
    const fullReserva = findById('reservas_hotel', reserva.id);
    const hab = fullReserva.habitacion_id ? findById('habitaciones', fullReserva.habitacion_id) : null;
    
    // DO NOT send a premature "Confirmed" email to guests when the public booking starts as "Pendiente".
    // The guest will receive confirmation once the status is updated to 'Confirmada' by the staff.
    notifications.notifyAdminNewBooking(fullReserva, hab).catch(e => console.log('Admin notif error:', e.message));
```

---

### 5.3 `server/routes/hotel.js` (Lines 520-548)

**Before:**
```javascript
// Status change (Check-in / Check-out)
router.patch('/hotel/reservas/:id/status', requireAuth, requireRole('admin', 'receptionist'), (req, res) => {
  try {
    const { estado } = req.body;
    const valid = ['Pendiente', 'Confirmada', 'Hospedado', 'Check-Out', 'Cancelada', 'No-Show'];
    if (!valid.includes(estado)) return err(res, 'VALIDATION_ERROR', `Estados válidos: ${valid.join(', ')}`);

    const existing = findById('reservas_hotel', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);

    const updated = update('reservas_hotel', req.params.id, { estado });

    // Auto-update room status
    if (existing.habitacion_id) {
      if (estado === 'Hospedado') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Ocupada' });
      } else if (estado === 'Check-Out') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía', estado_limpieza: 'Sucia' });
      } else if (estado === 'Cancelada' || estado === 'No-Show') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía' });
      }
    }

    ok(res, updated);

    // Fire notification (async, non-blocking)
    const hab = existing.habitacion_id ? findById('habitaciones', existing.habitacion_id) : null;
    notifications.notifyStatusChange(updated, existing.estado, estado, hab).catch(e => console.log('Notif error:', e.message));
  } catch (e) { err(res, 'SERVER_ERROR', 'Error cambiando estado', 500); }
});
```

**After:**
```javascript
// Status change (Check-in / Check-out)
router.patch('/hotel/reservas/:id/status', requireAuth, requireRole('admin', 'receptionist'), (req, res) => {
  try {
    const { estado } = req.body;
    const valid = ['Pendiente', 'Confirmada', 'Hospedado', 'Check-Out', 'Cancelada', 'No-Show'];
    if (!valid.includes(estado)) return err(res, 'VALIDATION_ERROR', `Estados válidos: ${valid.join(', ')}`);

    const existing = findById('reservas_hotel', req.params.id);
    if (!existing) return err(res, 'NOT_FOUND', 'Reserva no encontrada', 404);

    // ── Enforce State Machine Transitions ──
    const ALLOWED_TRANSITIONS = {
      'Pendiente': ['Confirmada', 'Cancelada'],
      'Confirmada': ['Pendiente', 'Hospedado', 'Cancelada', 'No-Show'],
      'Hospedado': ['Check-Out', 'Confirmada', 'Cancelada'],
      'Check-Out': [], // Terminal state
      'Cancelada': [], // Terminal state
      'No-Show': []    // Terminal state
    };

    const fromStatus = existing.estado;
    const toStatus = estado;

    if (fromStatus !== toStatus) {
      // Admins are allowed to bypass the state machine rules to make operational corrections
      if (req.user.rol !== 'admin') {
        const allowed = ALLOWED_TRANSITIONS[fromStatus];
        if (!allowed || !allowed.includes(toStatus)) {
          return err(res, 'INVALID_TRANSITION', `No se permite cambiar el estado de la reserva de '${fromStatus}' a '${toStatus}'`);
        }
      }
    }

    const updated = update('reservas_hotel', req.params.id, { estado });

    // ── Auto-update Room Occupancy/Cleaning Status ──
    if (existing.habitacion_id) {
      if (estado === 'Hospedado') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Ocupada' });
      } else if (estado === 'Check-Out') {
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía', estado_limpieza: 'Sucia' });
      } else if (['Pendiente', 'Confirmada', 'Cancelada', 'No-Show'].includes(estado)) {
        // Correcting room status if reverted from Checked-In or Cancelled
        update('habitaciones', existing.habitacion_id, { estado_habitacion: 'Vacía' });
      }
    }

    ok(res, updated);

    // Fire notification (async, non-blocking)
    const hab = existing.habitacion_id ? findById('habitaciones', existing.habitacion_id) : null;
    notifications.notifyStatusChange(updated, existing.estado, estado, hab).catch(e => console.log('Notif error:', e.message));
  } catch (e) { err(res, 'SERVER_ERROR', 'Error cambiando estado', 500); }
});
```

---

### 5.4 `server/server.js` (Line 173)

**Before:**
```javascript
          { method: 'PATCH', path: '/hotel/reservas/:id/estado', description: 'Change status', auth: 'write', body: { estado: 'Confirmada|Check-In|Check-Out|Cancelada|No-Show|Por Aprobar' } }
```

**After:**
```javascript
          { method: 'PATCH', path: '/hotel/reservas/:id/status', description: 'Change status', auth: 'write', body: { estado: 'Pendiente|Confirmada|Hospedado|Check-Out|Cancelada|No-Show' } }
```

---

## 6. Verification Method

To independently verify these changes during the implementation stage:

### 6.1 Automated Verification
Run the standard test suites to confirm that core calculations and schedulers continue to perform successfully:
```bash
npm run test
```

### 6.2 Manual/API Verification
1. **Public Booking Default**:
   - Send a `POST` request to `/api/v1/public/reservar` with a valid body.
   - Inspect the returned reservation ID. Use SQLite database browser or the `GET /api/v1/hotel/reservas/:id` endpoint to verify that `estado` is `'Pendiente'`.
   - Confirm that the email SMTP logger does not report sending a "Confirmada" email, only the admin notification.

2. **State Machine Verification (Staff Role)**:
   - Log in as a staff member (receptionist role).
   - Attempt to `PATCH` a `'Pendiente'` booking directly to `'Hospedado'` or `'Check-Out'`.
   - Verify that the API rejects the request with a `400 Bad Request` or specific error code and the payload:
     ```json
     { "success": false, "error": { "code": "INVALID_TRANSITION", "message": "..." } }
     ```
   - Attempt to revert a terminal state like `'Check-Out'` back to `'Hospedado'`. Verify that the API rejects the request.

3. **State Machine Verification (Admin Role)**:
   - Log in as an administrator (`admin` role).
   - Attempt to revert a `'Check-Out'` or `'Cancelada'` booking to `'Confirmada'` or `'Hospedado'`.
   - Verify that the transition completes successfully (bypassing restriction).

4. **Room Occupancy Revert Verification**:
   - Verify that a reservation is in state `'Hospedado'` and its associated room's status (`estado_habitacion`) is `'Ocupada'`.
   - Revert the reservation status to `'Confirmada'`.
   - Query the room endpoint (`GET /api/v1/hotel/habitaciones`) and verify that `estado_habitacion` has reverted to `'Vacía'`.
