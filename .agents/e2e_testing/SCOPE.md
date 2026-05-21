# Scope: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\e2e_testing\SCOPE.md

## Architecture
We are designing and implementing a comprehensive, requirement-driven, opaque-box E2E test suite.
- Main target functions/APIs to test:
  1. `POST /api/v1/public/reservar` - Public booking widgets (creates bookings via `POST /reservar` in `estado = 'Pendiente'`).
  2. `PATCH /api/v1/hotel/reservas/:id/status` - Status changes (`Confirmada`, `Hospedado`, `Check-Out`, `Cancelada`).
  3. `POST /api/v1/hotel/reservas/:id/folio` - Payment folio recording.
- Key properties to verify:
  - Reservation state transitions (`Pendiente` -> `Confirmada` -> `Hospedado` -> `Check-Out`).
  - Access controls: approvals/rejections and the Approvals tab are restricted to `admin` and `receptionist`, blocked for `cleaning`.
  - Notification triggers: Verify that appropriate notification hooks are fired when actions occur (using mocks/spies or checking the database logs/notificaciones_log).
  - Housekeeping/room status effects:
    - Checked-in (`Hospedado`) -> Room status set to `'Ocupada'`.
    - Checked-out (`Check-Out`) -> Room status set to `'Vacía'` and `'Sucia'`.
    - Cancelled (`Cancelada`) -> Room status set to `'Vacía'`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Plan & Infrastructure Design | Research requirements, design `TEST_INFRA.md` with 4 Tiers of testing, and define test cases. | None | PLANNED |
| 2 | Write E2E Tests | Implement Vitest-based E2E tests targeting public reserving, status patching, payment folio, and notifications logging. | M1 | PLANNED |
| 3 | E2E Test Execution & Verification | Run the test suite using `npm run test` or directly via vitest, and ensure all tests compile and pass. | M2 | PLANNED |
| 4 | Publish TEST_READY.md | Create and publish `TEST_READY.md` containing the coverage summary and feature checklists, and notify the Project Orchestrator. | M3 | PLANNED |

## Interface Contracts
### Public Booking Verification
- `POST /api/v1/public/reservar`:
  - Input: Customer data, check-in, check-out, adult/child occupancy, room category, rate plan.
  - Action: Creates a reservation with `estado = 'Pendiente'`.
  - Output: Reservation object, HTTP 201.
  - Notification Trigger: Immediately triggers Notification 1 (Received / Pending).

### Reservation Status Change
- `PATCH /api/v1/hotel/reservas/:id/status` (REST internal, roles `admin` & `receptionist` only):
  - Input: `{ estado: 'Confirmada' | 'Cancelada' | 'Hospedado' | 'Check-Out' }`.
  - Actions:
    - Sets `estado` to requested value.
    - If `'Confirmada'`, triggers Notification 2 (Approved/Confirmed).
    - If `'Hospedado'`, triggers Notification 4 (Checked-In/Welcome) and sets room state to `'Ocupada'`.
    - If `'Check-Out'`, triggers Notification 5 (Checked-Out/Review Link) and sets room state to `'Vacía'` & `'Sucia'`.
    - If `'Cancelada'`/`'No-Show'`, triggers Notification 6 (Cancelled) and sets room state to `'Vacía'`.
  - Output: Updated reservation, HTTP 200.

### Payment folio recording
- `POST /api/v1/hotel/reservas/:id/folio` (REST internal):
  - Action: Adds credit details, calculates outstanding balances.
  - Notification Trigger: Immediately triggers Notification 3 (Payment Registered).
