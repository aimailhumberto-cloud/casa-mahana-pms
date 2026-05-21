# Handoff Report — Explorer DB & Backend Analysis

This handoff report summarizes the read-only investigation on the Casa Mahana PMS database schema, reservation creation logic, state transitions, and background task flows.

---

## 1. Observation

Direct observations and citations from the codebase:

1. **Table Schema (`reservas_hotel`):**
   * File path: `server/db/schema.sql` (Line 105)
   * Verbatim column code: `estado TEXT DEFAULT 'Confirmada',`
2. **Public Booking Route (`POST /reservar`):**
   * File path: `server/routes/public.js` (Line 221)
   * Verbatim assignment code: `estado: 'Por Aprobar', fuente: 'Website',`
3. **Hotel Status Transition Route (`PATCH /hotel/reservas/:id/status`):**
   * File path: `server/routes/hotel.js` (Line 524)
   * Verbatim state validation code: `const valid = ['Pendiente', 'Confirmada', 'Hospedado', 'Check-Out', 'Cancelada', 'No-Show'];`
   * Side-effects (Lines 533–540) update the room state (`estado_habitacion`) only when transitioning to `'Hospedado'`, `'Check-Out'`, `'Cancelada'`, or `'No-Show'`.
4. **Stay Expiration Task & Test Inconsistency:**
   * File path: `server/utils/scheduler.js` (Line 65)
     Verbatim code: `SELECT * FROM reservas_hotel WHERE check_out < ? AND estado = 'Check-In'`
   * File path: `server/utils/scheduler.test.js` (Lines 89, 93, 106)
     Verbatim code includes `'Check-In'` in the mock reservation, prepare statement pattern matching, and assertion.
5. **UI Color Mapping & Page Filtering:**
   * File path: `src/pages/Reservas.tsx` (Lines 8–15)
     Verbatim code defines colors for `Confirmada`, `Hospedado`, `Check-Out`, `Pendiente`, `Cancelada`, and `No-Show`.
   * File path: `src/pages/ReservaDetalle.tsx` (Lines 145–148)
     Renders status action buttons specifically for `'Pendiente'`.

---

## 2. Logic Chain

1. **Online Bookings Default is Unsupported:**
   * The route `POST /api/v1/public/reservar` currently sets the state of newly created reservations to `'Por Aprobar'` (`server/routes/public.js` line 221).
   * However, the frontend (`src/pages/Reservas.tsx` and `src/pages/ReservaDetalle.tsx`) has no color coding, filtering criteria, or action buttons to handle `'Por Aprobar'` reservations.
   * Since `'Pendiente'` is a fully-supported state in both the frontend (rendering a warning state and providing a "Confirmar" action button) and the transition validator list, making `'Pendiente'` the default status for public online bookings resolves all UI anomalies and enables receptionists to confirm bookings natively.
2. **Discovered Background Stay Expiration Inconsistency:**
   * In `server/utils/scheduler.js` (line 65), the automatic checker for expired stays searches for reservations where `estado = 'Check-In'`.
   * Yet, the active stay status in the application logic (`server/routes/hotel.js` line 534, `src/pages/Reservas.tsx` line 10, etc.) is `'Hospedado'`. No reservations ever enter the `'Check-In'` state, rendering this cron task inactive.
   * Therefore, changing this check (and its matching tests in `server/utils/scheduler.test.js`) to `'Hospedado'` restores correct cron job execution.

---

## 3. Caveats

* No direct modification was performed in this workspace as the Explorer role is read-only.
* We assumed that the intent of `'Por Aprobar'` was to have a preliminary review phase, but because it was never wired up to the UI or standard progression lists, `'Pendiente'` is the correct drop-in replacement that accomplishes this goal.

---

## 4. Conclusion

The PMS is fully designed to handle `'Pendiente'` as the starting state for online bookings, which can then transition via `PATCH /hotel/reservas/:id/status` to `Confirmada` -> `Hospedado` -> `Check-Out`. Transitioning the hardcoded website status from `'Por Aprobar'` to `'Pendiente'` aligns the backend with the frontend.
Furthermore, the stay expiration check in the background scheduler must be updated from `'Check-In'` to `'Hospedado'` to execute as intended.

---

## 5. Verification Method

To verify these findings and eventually their corrections, execute the following commands in the project directory:

1. **Verify Code Locations:**
   Inspect files and lines listed in Section 1 to confirm current implementation details.
2. **Verify Tests:**
   Run the project test suite using `npm run test` or `npx vitest run`. The current Vitest mocks will pass with the existing scheduler codebase. Once the scheduler is updated from `'Check-In'` to `'Hospedado'`, the corresponding assertions in `server/utils/scheduler.test.js` must be updated, and re-running `npm run test` must show all tests passing.
3. **Widget Booking Verification:**
   Generate a new online reservation using the widget. Query the DB using SQLite command line or route GET requests, and verify the `estado` column for that new record is set to `'Pendiente'`.
