# Codebase Analysis Report — Casa Mahana PMS

## Executive Summary
Casa Mahana PMS is a comprehensive Property Management System for hotel properties. The application supports dual-mode reservations (`Estadía` and `Pasadía`), interactive calendar timelines, accounts receivable management (CxC), public online multi-room booking widget, and advanced features such as consolidated group billing, daily day-aware pricing (weekdays, weekends, holidays), and a four-eyes double-approval modification request workflow. 

This analysis is based on a read-only investigation of the entire codebase, including 7 frontend pages/components, 4 backend modules, the SQLite schema definitions, and the project's test suite.

---

## 1. Directory Structure and File Locations
The codebase follows a clear structure dividing the frontend (React + TS + Tailwind + Vite) and the backend (Node.js + Express + better-sqlite3):

| File Path / Component | Tier | Description |
| :--- | :--- | :--- |
| `src/pages/NuevaReserva.tsx` | Frontend | Handles manual booking creation, group bookings, guest capacity checks, and consolidated billing setup. |
| `src/pages/ReservaDetalle.tsx` | Frontend | Management console for a single booking: details, folio entries, document uploads, and change requests. |
| `src/pages/Calendario.tsx` | Frontend | Dashboard containing the timeline grid of rooms, reservations, and status management. |
| `src/components/RoomRow.tsx` | Frontend | Memoized component rendering single room timelines and managing drag-and-drop handles. |
| `src/pages/Saldos.tsx` | Frontend | Accounts Receivable and accounts reconciliation console (General pending guest balances vs CxC Terceros). |
| `src/pages/AdminHabitaciones.tsx` | Frontend | Management UI for CRUD on rooms, cleaning filters, and unit capacity bounds. |
| `src/pages/BookingWidget.tsx` | Frontend | Public-facing guest booking engine with cart, multi-room, and PayPal/manual payment support. |
| `server/routes/hotel.js` | Backend | Main API route hub handling availability, bookings, statuses, folio, and third-party reconciliations. |
| `server/db/database.js` | Backend | Initializes the SQLite database, performs migrations, and seeds default rooms/plans. |
| `server/db/schema.sql` | Backend | Relational SQLite database schema definitions, indices, and constraints. |
| `server/utils/calculations.js` | Backend | Computes dynamic day-aware pricing, subtotal breakdowns, taxes, and deposit suggestions. |

---

## 2. Frontend Components Architecture

### 2.1 NuevaReserva.tsx
- **Role**: Handles manual front-desk booking creation.
- **Key Mechanisms**:
  - Validates guest limits (`adultos` + `menores`) against the selected room's `capacidad_min` and `capacidad_max`.
  - Performs live pricing quotes by calling `GET /api/v1/hotel/cotizar`.
  - Supports group bookings by bundling multiple room reservations and assigning a consolidation flag (`facturacion_consolidada`).
  - Submits single bookings to `POST /api/v1/hotel/reservas` and group bookings to `POST /api/v1/hotel/reservas/grupo`.

### 2.2 ReservaDetalle.tsx
- **Role**: Operational hub for a reservation.
- **Key Mechanisms**:
  - Displays linked guest records, uploads/displays documents (IDs, payment receipts), and logs folio operations.
  - Implements the **double approval modification flow** via `POST /api/v1/hotel/reservas/:id/solicitar-cambio`.
  - Manages room status transitions using `PATCH /api/v1/hotel/reservas/:id/status`.
  - Allows adding extra debits (services/products) or credits (payments).

### 2.3 Calendario.tsx & RoomRow.tsx
- **Role**: The main interactive visual timeline.
- **Key Mechanisms**:
  - **Calendario**: Queries `GET /api/v1/hotel/calendario?desde=...&hasta=...` and groups rooms dynamically by `categoria` (`Estadía` vs `Pasadía`) and then by `tipo` (e.g. `Familiar`, `Bohío`).
  - **RoomRow**: Uses a custom `React.memo` prop comparator to prevent costly re-renders of the dense grid:
    ```typescript
    export default memo(RoomRow, (prev, next) => {
      return (
        prev.room.id === next.room.id &&
        prev.room.estado_limpieza === next.room.estado_limpieza &&
        prev.room.estado_habitacion === next.room.estado_habitacion &&
        prev.days.length === next.days.length &&
        JSON.stringify(prev.reservations) === JSON.stringify(next.reservations)
      );
    });
    ```
  - Calculates reservation bar sizes, positions, and handles drag-and-drop actions.

### 2.4 Saldos.tsx
- **Role**: Accounts Receivable (CxC) tracking.
- **Key Mechanisms**:
  - Contains two primary view tabs: **Saldos Pendientes** (general guest balances) and **CxC Terceros** (third-party/coupon payments).
  - Isolates unreconciled credits that used payment methods like `'cuponera_oferta_simple'` (Oferta Simple), `'cuponera_pahoy'` (PaHoy), and `'al_cobro'` (Al Cobro).
  - Provides batch-selection and submits reconciliations via `POST /api/v1/hotel/saldos/reconciliar`.

### 2.5 AdminHabitaciones.tsx
- **Role**: CRUD interface for rooms.
- **Key Mechanisms**:
  - Supports adding, updating, and toggling rooms between `Estadía` and `Pasadía` categories.
  - Controls active room flags and cleaning statuses.

### 2.6 BookingWidget.tsx
- **Role**: Public booking page for guests.
- **Key Mechanisms**:
  - Renders a responsive multi-room selection cart with real-time validation.
  - Queries `GET /api/v1/public/disponibilidad` to show available rooms.
  - Integrates dual payment checkouts:
    1. **PayPal Sandbox/Live Integration**: Dynamic button rendering using SDK.
    2. **Offline Payment**: Handles bank transfers, Yappy, and coupons by logging the booking as `'Pendiente'` and prompting receipt uploads.
  - Submits the final cart to `POST /api/v1/public/reservas/multi`.

---

## 3. Backend Architecture and Business Logic

### 3.1 SQLite Database Schema Validation (`schema.sql`)
We verified the exact database structure for key entities:

1. **Room Cleaning Status**:
   - Stored in the `habitaciones` table:
     - `estado_limpieza TEXT DEFAULT 'Sucia'` (Enum: `'Sucia'`, `'Limpia'`, `'Inspeccionada'`).
     - `estado_habitacion TEXT DEFAULT 'Vacía'` (Enum: `'Vacía'`, `'Ocupada'`).
     - `activa INTEGER DEFAULT 1`.
2. **Third-Party Commissions & Payments**:
   - Stored as credits in the `folio_hotel` table.
   - Distinct third-party methods in the `metodo_pago` column: `'cuponera_oferta_simple'`, `'cuponera_pahoy'`, `'al_cobro'`.
   - Tracks accounting reconciliation state:
     - `reconciliado INTEGER DEFAULT 0` (1 = Reconciled).
     - `fecha_reconciliacion TEXT` (Date of financial reconciliation).
3. **Payment Logs**:
   - Logged in the `folio_hotel` table:
     - Fields: `id`, `reserva_id`, `tipo` (`'credito'` or `'debito'`), `concepto`, `monto`, `metodo_pago`, `referencia`, `registrado_por`, `fecha`, `reconciliado`, `fecha_reconciliacion`, `created_at`.
   - **Audit Logs for Reversions**: The `reversions_log` table preserves reversed actions:
     - Fields: `id`, `reserva_id`, `folio_id`, `monto`, `concepto_original`, `motivo`, `reversado_por`, `fecha`.
4. **Cupones (Coupons)**:
   - Handled directly within the standard `folio_hotel` payment logs under the payment methods matching the `'cuponera_*'` prefix. No separate database table exists for coupon storage.
5. **Admin and Staff Roles**:
   - Table `usuarios` defines accounts and privileges:
     - Fields: `id`, `email`, `password_hash`, `nombre`, `rol` (`'admin'` or `'staff'`), `activo` (1 = Active).
   - Role-based authorization is enforced in routes using:
     - `requireAuth` (verifies valid JWT signature).
     - `requireRole('admin', ...)` (asserts specific role string on `req.user.rol`).

### 3.2 Main PMS Backend Routes (`server/routes/hotel.js`)
- **Group Bookings (`POST /api/v1/hotel/reservas/grupo`)**:
  - Enforces strict concurrency/overlap checks inside a **single database transaction**.
  - Implements **consolidated billing** if `facturacion_consolidada === 1`. The subtotal, tax, and total are consolidated onto the master booking. The individual room debits and tax entries are recorded as folio lines referencing the master booking ID, while child bookings have their totals and folio lines set to zero.
- **Reservation Status Management (`PATCH /api/v1/hotel/reservas/:id/status`)**:
  - Implements a strict **State Machine**:
    ```
    Pendiente  ───────►  Confirmada  ───────►  Hospedado  ───────►  Check-Out (Terminal)
        │                     │                     │
        ▼                     ▼                     ▼
    Cancelada             Cancelada /           Cancelada /
    (Terminal)             No-Show              Check-In Reversal
                         (Terminal)
    ```
  - Receptionists cannot violate allowed transitions; Admin role bypasses strict progression to handle operational errors.
  - **Auto-Room Status Updates**:
    - `'Hospedado'` sets room to `estado_habitacion = 'Ocupada'`.
    - `'Check-Out'` sets room to `estado_habitacion = 'Vacía'` and `estado_limpieza = 'Sucia'`.
- **Double Approval Modification Request (`POST /api/v1/hotel/reservas/:id/solicitar-cambio`)**:
  - When staff requests a modification, the reservation's state updates to `'Cambio Pendiente de Aprobación'`, protecting it from other actions.
  - A record is written to `solicitudes_modificacion` containing the requesting user, reason, target transaction ID, and stringified JSON blobs of `snapshot_datos` and `datos_anteriores`.
- **Reversing Folio Transactions (`POST /api/v1/hotel/reservas/:id/folio/:folioId/reversar`)**:
  - Admins can reverse credits or debits.
  - Reversing a credit (payment) creates a compensating debit, updates the total paid, and adjusts outstanding balance.
  - Reversing a debit (charge) creates a compensating credit, adjusts additional product totals, and recalculates the tax dynamically.
  - Logs the event to the `reversiones_log` table.

### 3.3 Dynamic Pricing Calculations (`server/utils/calculations.js`)
- **Day-Aware Rate Selection**:
  - Function `getDayType(dateStr)` evaluates dates:
    1. First checks `dias_festivos` table (Holidays like Año Nuevo, Carnaval, etc.).
    2. Then evaluates weekday vs weekend: Friday and Saturday are `'fin_de_semana'`; Sunday through Thursday are `'entre_semana'`.
  - Function `calcReservationWithRates` computes nightly costs by querying `reglas_tarifa` for the resolved day type. If no specific daily rate rule exists, it falls back to the default plan rate. Renders an exact per-night breakdown.

---

## 4. Test Suite and Build Health
We verified the cleanliness of the build system and the test framework:

1. **Test Execution (`npm run test`)**:
   - Running the Vitest test runner executes 61 passing unit/E2E tests across 8 test suites.
   - Covers:
     - Basic booking creations (TC-1.1.1)
     - State machine approvals & check-in/out transitions (TC-1.1.2 to TC-1.1.4)
     - Reversals and payment balance updates (TC-1.5.3)
     - RBAC security blocks (TC-1.4.3)
     - Boundary validation & corner cases (TC-2.1.2)
     - Deactivated user session locks (TC-2.4.4)
     - High concurrency overlaps (TC-4.3)
2. **Build Execution (`npm run build`)**:
   - Bundles the frontend with Vite cleanly under the `dist/` directory.
   - Outputs optimized HTML, CSS (68.45 kB), and JS assets (606.44 kB).
