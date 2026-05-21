# E2E Test Plan — Reservation Approvals & Notification Lifecycle

This document defines the comprehensive, requirement-driven, opaque-box E2E test plan for the Casa Mahana PMS Reservation Approvals and Notification Lifecycle. It ensures all state transitions, UI visualizations, access controls, automated messaging triggers, and housekeeping synchronizations work exactly as specified.

---

## 1. Test Architecture & Core Features

The test plan targets the following 6 core features:
*   **F1: Reservation State & Lifecycle Management:** Verify initial state set to `'Pendiente'` on online bookings, transition constraints, database changes, and calculations updates.
*   **F2: PMS UI Visualization & Actions:** Premium dashed amber/gold border style, popover/context actions, table badge alerts, and state update triggers.
*   **F3: Dedicated Approvals Interface:** The dedicated `"Aprobaciones"` tab, filtering, quick action buttons, and instantaneous refresh on actions.
*   **F4: Role-Based Access Control (RBAC):** Privileges restricted to `admin` and `receptionist`, blocked for `cleaning`, sidebar navigation filtering, and financial data masking.
*   **F5: Automated Notification Lifecycle (Email/WhatsApp):** All 7 notifications (Received, Confirmed, Payment, Welcome, Checkout Review, Cancelled, Reminders) and database logging in `notificaciones_log`.
*   **F6: Housekeeping/Room State Synchronization:** Auto-updating room state to `'Ocupada'` on check-in, `'Vacía'` & `'Sucia'` on check-out, `'Vacía'` on cancellation, and manual housekeeping updates.

---

## 2. Test Case Enumeration

### Tier 1: Feature Coverage (30 Test Cases)

| Test ID | Feature | Test Case Name | Preconditions | Input / Actions | Expected Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-1.1.1** | F1 | Web Booking Initial State | Room is available, correct details provided | POST `/api/v1/public/reservar` | Reservation created in SQLite with `estado = 'Pendiente'`. Returns HTTP 201. |
| **TC-1.1.2** | F1 | Status Change: Approve Pending | Reservation in `'Pendiente'` state | PATCH `/api/v1/hotel/reservas/:id/status` with `{ estado: 'Confirmada' }` | Reservation `estado` changes to `'Confirmada'`. Returns HTTP 200. |
| **TC-1.1.3** | F1 | Status Change: Check-In Confirmed | Reservation in `'Confirmada'` state | PATCH `/api/v1/hotel/reservas/:id/status` with `{ estado: 'Hospedado' }` | Reservation `estado` changes to `'Hospedado'`. Returns HTTP 200. |
| **TC-1.1.4** | F1 | Status Change: Check-Out Hospedado | Reservation in `'Hospedado'` state | PATCH `/api/v1/hotel/reservas/:id/status` with `{ estado: 'Check-Out' }` | Reservation `estado` changes to `'Check-Out'`. Returns HTTP 200. |
| **TC-1.1.5** | F1 | Status Change: Reject Pending | Reservation in `'Pendiente'` state | PATCH `/api/v1/hotel/reservas/:id/status` with `{ estado: 'Cancelada' }` | Reservation `estado` changes to `'Cancelada'`. Returns HTTP 200. |
| **TC-1.2.1** | F2 | Calendar Grid Pending Render | A reservation exists with `'Pendiente'` status | Load `/calendario` page | Grid item has premium styling classes: `border-2 border-dashed border-amber-500` or equivalent. |
| **TC-1.2.2** | F2 | Popover Details and Quick Actions | A reservation exists with `'Pendiente'` status | Hover over the pending booking cell | Popover drawer appears with quick action buttons: `"Aprobar"` and `"Rechazar"`. |
| **TC-1.2.3** | F2 | Context Menu Quick Actions | A reservation exists with `'Pendiente'` status | Right-click the pending booking cell | Context menu opens displaying `"Aprobar Reserva"` and `"Rechazar Reserva"` actions. |
| **TC-1.2.4** | F2 | Table Pending Warning Badge | At least one reservation has status `'Pendiente'` | Navigate to `/reservas` | Amber alert warning banner rendered above filters: `"Tienes X reservas de aprobación"`. |
| **TC-1.2.5** | F2 | Table Warning Badge Quick Filter | Table warning badge is visible | Click `"Revisar Ahora"` button in the badge | The table auto-filters to show only reservations in the `'Pendiente'` status. |
| **TC-1.3.1** | F3 | Dedicated Approvals View Access | Logged in as Admin/Receptionist | Navigate to `/reservas/aprobaciones` | Page renders successfully, displaying the pending approvals queue. |
| **TC-1.3.2** | F3 | Approvals List Integrity | Active bookings in `'Pendiente'`, `'Confirmada'`, `'Cancelada'` states | Load approvals list page | ONLY reservations with status `'Pendiente'` are listed. |
| **TC-1.3.3** | F3 | One-Click Approve in Tab | A reservation exists with status `'Pendiente'` | Click `"Aprobar"` action in Approvals list | Status changes to `'Confirmada'` in DB, card disappears, list instantly re-renders. |
| **TC-1.3.4** | F3 | One-Click Reject in Tab | A reservation exists with status `'Pendiente'` | Click `"Rechazar"` action in Approvals list | Status changes to `'Cancelada'` in DB, card disappears, list instantly re-renders. |
| **TC-1.3.5** | F3 | Empty Approvals Queue State | No reservations in `'Pendiente'` state | Navigate to `/reservas/aprobaciones` | Renders a premium empty state: `"No hay reservas pendientes de aprobación."` |
| **TC-1.4.1** | F4 | RBAC: Admin Full Privileges | Logged in as `admin` role | Perform state changes, access approvals tab | Full access granted, no UI components blocked. |
| **TC-1.4.2** | F4 | RBAC: Receptionist Full Privileges | Logged in as `receptionist` role | Perform state changes, access approvals tab | Full access granted, approvals actions operate successfully. |
| **TC-1.4.3** | F4 | RBAC: Housekeeper Sidebar Masking | Logged in as `cleaning` role | Inspect sidebar navigation options | `"Aprobaciones"` page and standard `"Reservas"` list options are omitted from layout. |
| **TC-1.4.4** | F4 | RBAC: Housekeeper API Endpoint Blocking| Logged in as `cleaning` role | Directly call PATCH `/api/v1/hotel/reservas/:id/status` | Backend rejects request and returns HTTP 403 Forbidden. |
| **TC-1.4.5** | F4 | RBAC: Housekeeper Financial Data Hiding| Logged in as `cleaning` role | Hover over calendar cell or view details | Total cost, paid deposits, and outstanding balance fields are hidden or masked. |
| **TC-1.5.1** | F5 | Notification 1: Received Booking | POST booking created via public API | Inspect SQLite `notificaciones_log` | Log entry recorded: `tipo = 'recibida'`, `canal = 'email'`/`'whatsapp'`. |
| **TC-1.5.2** | F5 | Notification 2: Approved Confirmation | Transition pending reservation to `'Confirmada'` | Inspect SQLite `notificaciones_log` | Log entry recorded: `tipo = 'confirmacion'`, containing check-in policies and room details. |
| **TC-1.5.3** | F5 | Notification 3: Payment Folio | Add credit entry via POST `/folio` | Inspect SQLite `notificaciones_log` | Log entry recorded: `tipo = 'pago'`, showing amount paid and outstanding balance. |
| **TC-1.5.4** | F5 | Notification 4: Checked-In Welcome | Transition reservation to `'Hospedado'` | Inspect SQLite `notificaciones_log` | Log entry recorded: `tipo = 'bienvenida'`, containing WiFi details and house rules. |
| **TC-1.5.5** | F5 | Notification 5: Checked-Out Review | Transition reservation to `'Check-Out'` | Inspect SQLite `notificaciones_log` | Log entry recorded: `tipo = 'checkout'`, containing Onyx Mahana review system links. |
| **TC-1.6.1** | F6 | Check-In Room State Sync | Reservation assigned to Room A | Transition reservation to `'Hospedado'` | Room A `estado_habitacion` changes to `'Ocupada'` in SQLite. |
| **TC-1.6.2** | F6 | Check-Out Room State Sync | Reservation assigned to Room A | Transition reservation to `'Check-Out'` | Room A `estado_habitacion` set to `'Vacía'` and `estado_limpieza` set to `'Sucia'`. |
| **TC-1.6.3** | F6 | Cancellation Room Release Sync | Reservation assigned to Room A | Transition reservation to `'Cancelada'` | Room A `estado_habitacion` set to `'Vacía'`. |
| **TC-1.6.4** | F6 | Context Housekeeping: Dirty -> Clean | Room A is set to `'Sucia'` | Right-click Room A empty cell -> `"Marcar Limpia"` | Room A `estado_limpieza` updated to `'Limpia'` in SQLite. |
| **TC-1.6.5** | F6 | Room State Seeding & Properties | DB initial clean boot | Run database seeder | Seeding generates room entities with default properties (`estado_limpieza = 'Sucia'`). |

---

### Tier 2: Boundary & Corner Cases (30 Test Cases)

| Test ID | Feature | Test Case Name | Preconditions | Input / Actions | Expected Output |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-2.1.1** | F1 | Double Approval Request | Reservation is already `'Confirmada'` | PATCH `/status` with `{ estado: 'Confirmada' }` | Request processed successfully (HTTP 200) without repeating notification logs. |
| **TC-2.1.2** | F1 | Check-In Bypass from Pending | Reservation is in `'Pendiente'` state | PATCH `/status` with `{ estado: 'Hospedado' }` | Request rejected. State machine blocks direct transition from pending to hospedado. |
| **TC-2.1.3** | F1 | Retroactive Date Creation | Public booking widget form filled | Inject `check_in` date as yesterday | Form rejected with validation error (cannot book in the past). Returns HTTP 400. |
| **TC-2.1.4** | F1 | Checkout of Confirmed Reservation | Reservation is in `'Confirmada'` state | PATCH `/status` with `{ estado: 'Check-Out' }` | Rejected. State machine enforces that check-out requires prior check-in. |
| **TC-2.1.5** | F1 | Cancel post Checked-Out | Reservation is in `'Check-Out'` state | PATCH `/status` with `{ estado: 'Cancelada' }` | Rejected. State machine blocks changing state of finalized bookings. |
| **TC-2.2.1** | F2 | Visual Stack: Multiple Overlaps | Two pending bookings request same dates | Load calendar grid | Visually renders both cleanly; overlap markers or warnings trigger to indicate clash. |
| **TC-2.2.2** | F2 | Popover Viewport Edge Placement | Hovering item on bottom-right edge | Move mouse to trigger popover | Popover client coordinates offset so it remains fully visible on screen. |
| **TC-2.2.3** | F2 | Context menu non-cell clicks | Load calendar grid page | Right-click outside room row grids | Context menu is ignored or displays standard browser actions without errors. |
| **TC-2.2.4** | F2 | Zero Pending Badge Alert | No reservations in `'Pendiente'` state | Load `/reservas` table page | No warning alerts or badges appear in the view. |
| **TC-2.2.5** | F2 | SQL Injection / XSS in Search Bar | Logged in as admin, on reservations | Input `'; DROP TABLE reservas;--` or `<script>` | Input is sanitized, search processes safely without crashes or DB breaches. |
| **TC-2.3.1** | F3 | Concurrent Approvals Resolution | Two admin tabs open on approvals | Admin A approves; Admin B rejects same booking | Second request returns error `"Reserva ya procesada"`. Database integrity maintained. |
| **TC-2.3.2** | F3 | Approvals Pagination Limit | Exactly 51 pending reservations exist | Load `/reservas/aprobaciones` | Pagination controller appears. First page shows 50 cards, page 2 shows 1. |
| **TC-2.3.3** | F3 | Approve without Room Assignment | Reservation created without `habitacion_id` | Click `"Aprobar"` | Approval blocked with error: `"Debe asignar una habitación antes de aprobar."` |
| **TC-2.3.4** | F3 | Revert Confirmed to Pending | Reservation in `'Confirmada'` state | PATCH `/status` with `{ estado: 'Pendiente' }` | Rejected. State machine forbids moving backward to pending review. |
| **TC-2.3.5** | F3 | Rapid Click Approvals | A reservation exists with `'Pendiente'` state | Double click `"Aprobar"` button very quickly | Only one request completes successfully; secondary click returns HTTP 409 or is ignored. |
| **TC-2.4.1** | F4 | Token Expired Approvals Action | Logged in admin, token expires | Click `"Aprobar"` on a pending booking | Action rejected, redirects user to login page with alert. Returns HTTP 401. |
| **TC-2.4.2** | F4 | Cleaning User Parameter Tampering | Logged in as `cleaning`, has valid JWT | Manually send status PATCH to server | Express middleware rejects with HTTP 403 Forbidden. |
| **TC-2.4.3** | F4 | Masking Financial Data in API queries | Logged in as `cleaning` | GET `/api/v1/hotel/reservas/:id` | Financial fields (`subtotal`, `saldo_pendiente`) are deleted/masked in JSON output. |
| **TC-2.4.4** | F4 | Deactivated Staff Member Block | Staff JWT is active, admin sets `activo = 0` | Request dashboard data with old JWT | Server rejects request immediately. Returns HTTP 401 Unauthorized. |
| **TC-2.4.5** | F4 | Unauthorized Webhook Access | Unauthenticated request sent | POST webhook configurations | Middleware rejects and returns HTTP 401. |
| **TC-2.5.1** | F5 | Guest Booking with Empty Contact Info | Guest leaves email and phone blank | Create booking | DB created, notifications logged as `"skipped (no destination details provided)"`. |
| **TC-2.5.2** | F5 | SMTP Service Offline Resilience | SMTP server goes down/crashes | Transition reservation state | Transaction completes, state is saved, notification logs as `"failed (SMTP offline)"`. |
| **TC-2.5.3** | F5 | WhatsApp API Timeout Resilience | WhatsApp REST hook times out (>5s) | Transition reservation state | Status update completes; REST request times out and logs `"failed (gateway timeout)"`. |
| **TC-2.5.4** | F5 | Year Boundary Chron Reminders | Reservation check-in is Jan 1st | Run reminder cron on Dec 31st | Date string parser handles year transitions correctly and triggers 1-day reminders. |
| **TC-2.5.5** | F5 | Balance calculation on payment receipt | Total = $200, Deposit paid = $50 | Add credit entry of $50 | Notification reports remaining balance of $150 and suggested deposit of $50 met. |
| **TC-2.6.1** | F6 | Check-In on Dirty Room Warning | Room A has `estado_limpieza = 'Sucia'` | Transition reservation to `'Hospedado'` | Check-in completes, room set to `'Ocupada'`, UI displays a soft warning: `"Cuarto Sucio"`. |
| **TC-2.6.2** | F6 | Multi-Room Reservation Sync | Shared booking covering multiple rooms | Transition reservation to `'Hospedado'` | All associated rooms update their `estado_habitacion` to `'Ocupada'` in SQLite. |
| **TC-2.6.3** | F6 | Double Check-Out Cleanliness Lock | Reservation is in `'Check-Out'` state | Manually mark room as `'Limpia'` via grid | Allowed. Cleanliness states are changeable when room status is vacant (`'Vacía'`). |
| **TC-2.6.4** | F6 | Out of Service Room Lock | Room A has `activa = 0` (maintenance) | Try allocating a booking to Room A | Rejects request with error: `"Habitación fuera de servicio"`. Returns HTTP 400. |
| **TC-2.6.5** | F6 | Manual Cleanliness Lifecycle | Room A is `'Sucia'` | Right-click: Sucia -> Limpia -> Inspeccionada | Validates correct transitions and SQLite updates for `estado_limpieza`. |

---

### Tier 3: Cross-Feature Combination Pairwise (6 Test Cases)

#### TC-3.1: Happy Path Approval Integration (F1 + F2 + F3 + F5 + F6)
*   **Preconditions:** SQLite initialized, Room A is vacant/clean, rate plans loaded.
*   **Actions:**
    1.  Create a public booking for Room A via `POST /api/v1/public/reservar`.
    2.  Verify status is `'Pendiente'` in database.
    3.  Verify Notification 1 (Pending Receipt) is created in `notificaciones_log`.
    4.  Verify visual calendar bar displays dashed gold border.
    5.  Navigate to `/reservas/aprobaciones` as Admin and click `"Aprobar"`.
*   **Expected Output:**
    *   Reservation transitions to `'Confirmada'` in DB.
    *   Notification 2 (Approved/Confirmed) log recorded in `notificaciones_log`.
    *   Visual calendar bar updates instantly to solid blue border/background.
    *   Room A `estado_habitacion` remains `'Vacía'` (not yet occupied).

#### TC-3.2: Checked-In Integration (F1 + F2 + F5 + F6)
*   **Preconditions:** Reservation is `'Confirmada'`, Room A is `'Vacía'` & `'Limpia'`.
*   **Actions:**
    1.  Log in as Receptionist and hover over Room A booking on calendar.
    2.  Click `"Check-In"` quick action button in the popover drawer.
*   **Expected Output:**
    *   Reservation `estado` transitions to `'Hospedado'`.
    *   Room A `estado_habitacion` updates to `'Ocupada'` in SQLite.
    *   Notification 4 (Checked-In/Welcome) log containing WiFi details is recorded in the database.
    *   Calendar visual indicator changes instantly to solid green.

#### TC-3.3: Checked-Out & Review Integration (F1 + F2 + F5 + F6)
*   **Preconditions:** Reservation is `'Hospedado'`, Room A is `'Ocupada'`, outstanding balance is zero.
*   **Actions:**
    1.  Log in as receptionist and click `"Check-Out"` in Popover quick actions.
*   **Expected Output:**
    *   Reservation `estado` transitions to `'Check-Out'`.
    *   Room A `estado_habitacion` updates to `'Vacía'` and `estado_limpieza` is set to `'Sucia'` in SQLite.
    *   Notification 5 (Checked-Out/Review Link) log is recorded in `notificaciones_log`.
    *   Calendar visual indicator updates to solid gray.

#### TC-3.4: RBAC Security Block Combination (F4 + F1 + F3 + F6)
*   **Preconditions:** Active pending reservation exists for Room A.
*   **Actions:**
    1.  Log in as `cleaning` staff user.
    2.  Attempt to fetch `/reservas/aprobaciones` page.
    3.  Attempt to send direct API request: `PATCH /api/v1/hotel/reservas/:id/status` with `{ estado: 'Confirmada' }`.
*   **Expected Output:**
    *   Page navigation yields redirect or blank view.
    *   API response returns HTTP 403 Forbidden.
    *   SQLite records are completely unchanged (state remains `'Pendiente'`, Room A remains vacant).

#### TC-3.5: No-Show Room Release Lifecycle (F1 + F5 + F6)
*   **Preconditions:** Confirmed reservation exists for Room A today.
*   **Actions:**
    1.  Log in as Admin and transition state to `'No-Show'` via right-click context menu.
*   **Expected Output:**
    *   Reservation transitions to `'No-Show'` in DB.
    *   Room A `estado_habitacion` set to `'Vacía'`.
    *   Notification 6 (Cancelled) log is written to `notificaciones_log`.

#### TC-3.6: Pre-Arrival Reminder Filter (F5 + F1)
*   **Preconditions:** Three reservations set for tomorrow: Res 1 (`'Confirmada'`), Res 2 (`'Pendiente'`), Res 3 (`'Cancelada'`).
*   **Actions:**
    1.  Invoke the background scheduler routine `checkAndSendReminders()`.
*   **Expected Output:**
    *   Notification 7 (1-day pre-arrival reminder) is sent ONLY to Res 1.
    *   Res 2 and Res 3 do not receive any emails or WhatsApp logs (skipped).

---

### Tier 4: Real-World Workloads/Scenarios (5 Test Cases)

#### TC-4.1: End-to-End Guest Journey (Happy Path)
*   **Description:** Simulates the entire lifecycle of a customer stay, from online reservation to checkout.
*   **Actions & Assertions:**
    1.  **Creation:** Public user submits booking form via `POST /api/v1/public/reservar`.
        *   *Assert:* HTTP 201. SQLite `estado = 'Pendiente'`. `notificaciones_log` has Notification 1.
    2.  **Visual check:** Staff loads calendar.
        *   *Assert:* Pending booking renders with premium amber dashed border.
    3.  **Approval:** Admin goes to Approvals tab and clicks `"Aprobar"`.
        *   *Assert:* SQLite `estado = 'Confirmada'`. `notificaciones_log` has Notification 2. Card removed from approvals tab.
    4.  **Payment:** Guest deposits 50% suggestion. Admin records payment via POST `/folio`.
        *   *Assert:* `monto_pagado` updates, `saldo_pendiente` reduces. `notificaciones_log` has Notification 3.
    5.  **Reminder:** cron executes scheduler task 1 day before arrival.
        *   *Assert:* `notificaciones_log` records Notification 7.
    6.  **Check-In:** Guest arrives. Receptionist triggers `"Check-In"`.
        *   *Assert:* SQLite `estado = 'Hospedado'`. Room state set to `'Ocupada'`. `notificaciones_log` has Notification 4.
    7.  **Check-Out:** Guest departs. Receptionist triggers `"Check-Out"`.
        *   *Assert:* SQLite `estado = 'Check-Out'`. Room set to `'Vacía'` & `'Sucia'`. `notificaciones_log` has Notification 5.

#### TC-4.2: Booking Rejection & Resource Recovery
*   **Description:** A guest reserves a room, but the booking is rejected by staff due to invalid verification.
*   **Actions & Assertions:**
    1.  Guest creates booking for Room A.
        *   *Assert:* Room A availability is blocked for subsequent public search queries during pending state.
    2.  Admin views Approvals tab, sees the pending card, and clicks `"Rechazar"`.
        *   *Assert:* DB transitions state to `'Cancelada'`. Room A availability is immediately freed up.
    3.  Inspect notifications logging.
        *   *Assert:* Notification 6 (Cancellation Receipt) logged.
    4.  Run public search again for those exact dates.
        *   *Assert:* Room A is returned as available for public cotizar.

#### TC-4.3: High-Concurrency Allocation Conflict
*   **Description:** Simulates multiple users attempting to reserve the last available family room simultaneously.
*   **Actions & Assertions:**
    1.  Only 1 Familiar room remains available.
    2.  User A and User B concurrently dispatch booking requests for that room on overlapping dates.
    3.  *Assert:* SQLite transaction locks are correct. One request completes with HTTP 201 (state set to `'Pendiente'`), and the second request is safely rejected with HTTP 400 and error code `NO_AVAILABILITY`.
    4.  Load calendar grid.
        *   *Assert:* Only the successful booking is rendered on the room timeline.

#### TC-4.4: Shift Change front Desk Payment Reconciliation
*   **Description:** Receptionist A registers a partial payment for check-in; shift changes, Receptionist B completes check-out and processes remainder.
*   **Actions & Assertions:**
    1.  Confirmed guest arrives. Total stay is $300.
    2.  Receptionist A records $150 cash payment.
        *   *Assert:* DB `monto_pagado = 150`, `saldo_pendiente = 150`.
    3.  Guest checks in. State set to `'Hospedado'`.
    4.  Shift changes. Receptionist B takes over.
    5.  Guest checks out. Receptionist B opens popover, clicks `"Registrar Pago"`, inserts remaining $150 credit.
        *   *Assert:* DB `monto_pagado = 300`, `saldo_pendiente = 0`.
    6.  Receptionist B clicks `"Check-Out"`.
        *   *Assert:* State set to `'Check-Out'`. Room set to `'Vacía'` and `'Sucia'`.

#### TC-4.5: Housekeeper Daily Cleaning Cycle
*   **Description:** Traces the lifecycle of a room from dirty check-out to being declared ready for guests.
*   **Actions & Assertions:**
    1.  Guest checks out from Room A.
        *   *Assert:* SQLite records Room A `estado_habitacion = 'Vacía'` and `estado_limpieza = 'Sucia'`.
    2.  Cleaning staff logs in to dashboard, loads calendar.
        *   *Assert:* Omit approvals options. Room A is visually highlighted with a dirty indicator.
    3.  Housekeeper cleans the room. Right-clicks the cell, selects `"Marcar Limpia"`.
        *   *Assert:* SQLite Room A `estado_limpieza = 'Limpia'`.
    4.  Supervisor inspects Room A. Right-clicks the cell, selects `"Inspeccionada"`.
        *   *Assert:* SQLite Room A `estado_limpieza = 'Inspeccionada'`. Room A is officially ready for the next check-in.

---

## 3. Test Environment & Mocking Strategy

To verify this test plan in an automated NodeJS environment with **Vitest**, the following infrastructure design must be implemented:

### 3.1 Test Database Isolation
*   Create a test database at `data/casa-mahana-test.db`.
*   During test execution, set environment variable `NODE_ENV=test` to redirect SQLite path configuration.
*   Run the database initialization and seed script prior to test execution.

### 3.2 Notification Spies & Interceptors
*   **Email Mocking:** Create a spy/mock on the Nodemailer SMTP transporter. Instead of sending outbound messages to a real mail server, intercept the payloads and assert that the generated HTML body matches the gold-themed templates, including correct guest names, invoice totals, and booking IDs.
*   **WhatsApp API Mocking:** Mock the HTTPS outgoing POST requests to the WhatsApp REST endpoint (`WA_API_URL`). Intercept payloads and verify parameters, including recipient phone numbers and message strings.

### 3.3 Scheduler Cron Overrides
*   Override the daily scheduler triggering mechanism. During tests, invoke calculations manually using `checkAndSendReminders()` and `checkExpiredStays()` rather than waiting for cron timers.

---

## 4. Execution & Verification Instructions

### 4.1 Running the Automated Test Suite
To run the E2E tests, the following commands should be executed:
```powershell
# Set test environment and run the vitest suite
$env:NODE_ENV="test"
$env:NOTIFICATIONS_ENABLED="true"
npm run test
```

### 4.2 Code Compilation & Verification
The application must compile flawlessly under the build tool:
```powershell
npm run build
```
Verify that no TypeScript compiling exceptions, linter errors, or bundler breaks occur.
