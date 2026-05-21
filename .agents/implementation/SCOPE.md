# Scope: PMS Reservation Approvals & Notification Lifecycle Implementation

## Architecture
- Module boundaries:
  - Frontend: `src/App.tsx`, `src/pages/Calendario.tsx`, `src/pages/Reservas.tsx`, `src/pages/Aprobaciones.tsx`, `src/components/InteractivePopover.tsx`, `src/components/ContextMenu.tsx`.
  - Backend: `server/routes/public.js` (widget reservation creation), `server/routes/hotel.js` (dashboard/PMS operations).
  - Database: SQLite database `data/casa-mahana.db` with schema in `server/db/schema.sql`.
  - Notifications: `server/notifications.js` handles email templates (Nodemailer) and WhatsApp REST placeholders/mocks.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | DB & Backend Alignment | Standardize default online booking state to `'Pendiente'`. Allow PATCH status validation to accept `'Pendiente'` and `'Confirmada'`. Refactor schema or backend logic as needed. | None | PLANNED |
| 2 | Front-End UI Upgrades | Implement premium styling for `'Pendiente'` in Calendario (dashed amber/gold border). Add Quick Actions (Aprobar/Rechazar) inside InteractivePopover and ContextMenu. Create dedicated Aprobaciones page (restricted to admin & receptionist). Add warning badge to Reservas table. Filter sidebar navigation to hide Aprobaciones for cleaning role. | M1 | PLANNED |
| 3 | Notifications Lifecycle | Refactor `server/notifications.js` to support all 7 notification lifecycles (Received/Pending, Approved/Confirmed, Payment Registered, Checked-In, Checked-Out, Cancelled, Pre-arrival Reminders) with proper templates and data mappings. | M1 | PLANNED |
| 4 | E2E Integration & Verification | Pass 100% of the published E2E test suite (Tiers 1-4) once `TEST_READY.md` is published by the testing track. | M1, M2, M3 | PLANNED |
| 5 | Adversarial Coverage Hardening | Run Challenger white-box coverage analysis and adversarial testing to find and fix remaining gaps (Tier 5). | M4 | PLANNED |

## Interface Contracts
- `POST /api/v1/public/reservar`: Starts with `estado = 'Pendiente'`. Triggers Notification 1.
- `PATCH /api/v1/hotel/reservas/:id/status`: Transitions between `'Pendiente'`, `'Confirmada'`, `'Hospedado'`, `'Check-Out'`, `'Cancelada'`. Triggers corresponding Notifications (2, 4, 5, 6).
- `POST /api/v1/hotel/reservas/:id/folio`: Triggers Notification 3.
