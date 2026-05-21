## 2026-05-20T16:50:10Z

You are the teamwork_preview_worker subagent (identity: worker_milestone2_retry1).
Your working directory is: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_milestone2\
Your parent conversation ID is: 160c8cf9-4552-4e72-933a-c6c5c5a7f954

Your mission is to implement a comprehensive, requirement-driven, opaque-box E2E test suite in Vitest for the Reservation Approvals and Notification Lifecycle at Casa Mahana PMS.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please perform these tasks:
1. Initialize your BRIEFING.md and update progress.md.
2. Refactor C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\db\database.js:
   - If `process.env.NODE_ENV === 'test'`, the database file must be 'casa-mahana-test.db' instead of 'casa-mahana.db'.
   - Add and export a `resetDb` function that closes the cached connection (sets `db = null` and calls `db.close()`) so that tests can safely delete the file.
3. Refactor C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\server.js:
   - Export `{ app, server }` by assigning `const server = app.listen(PORT, ...)` at the end of the file and adding `module.exports = { app, server };`.
4. Refactor C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\routes\public.js:
   - In `POST /reservar` (around line 221), set the initial `estado` to 'Pendiente' instead of 'Por Aprobar' to normalize reservation statuses across the system.
5. Refactor C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\notifications.js:
   - Ensure the notification triggers are logged in the database by calling the `logNotification` helper inside every notification function (`notifyReservationConfirmed`, `notifyStatusChange`, `notifyPaymentReceived`, `notifyReminder`, and `notifyAdminNewBooking`). You should import `getDb` to obtain the database instance.
6. Create a robust and comprehensive E2E test suite at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\tests\e2e.test.js using Vitest.
   - Configure environment variables at the top of the test file:
     ```javascript
     process.env.PORT = '3299';
     process.env.NODE_ENV = 'test';
     process.env.NOTIFICATIONS_ENABLED = 'true';
     ```
   - Import the running server:
     ```javascript
     const { app, server } = require('../server');
     const { getDb, resetDb } = require('../db/database');
     ```
   - Ensure the database is clean before each test suite run by closing connections, unlinking 'data/casa-mahana-test.db', and calling `getDb()` to trigger clean seed execution.
   - Mock nodemailer transporters using `vi.mock('nodemailer', ...)` to prevent actual emails from being sent.
   - Intercept outgoing HTTP/HTTPS calls using Vitest mocks to prevent real WhatsApp API webhooks from firing.
   - Implement the test cases representing Tiers 1-4 from C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\TEST_INFRA.md:
     - **Tier 1: Feature Coverage**
       - Public `POST /api/v1/public/reservar` sets reservation in `'Pendiente'` state and logs a `'recibida'` notification in `notificaciones_log`.
       - Admin/Receptionist status PATCH successfully changes pending booking to `'Confirmada'` and logs a `'confirmacion'` notification.
       - folio payment recording updates paid and outstanding balances, and logs a `'pago'` notification.
       - receptionist check-in updates state to `'Hospedado'`, updates room status to `'Ocupada'`, and logs a `'bienvenida'` notification.
       - receptionist check-out updates state to `'Check-Out'`, sets room status to `'Vacía'` and `'Sucia'`, and logs a `'checkout'` notification.
       - RBAC privileges: admin and receptionist allowed to execute status updates, cleaning staff rejected with HTTP 403.
     - **Tier 2: Boundary/Corner Cases**
       - Direct transition bypass block (check-in directly from pending review).
       - Invalid checkout block (check-out from confirmed without hospedar).
       - Date in the past booking rejected with HTTP 400.
       - Deactivated staff JWT access block.
     - **Tier 3: Pairwise Combinations**
       - Happy path integration flow (book -> pending -> approve -> confirmed -> payment -> check-in -> check-out).
     - **Tier 4: Real-world workloads**
       - Concurrency allocations: concurrent booking requests on the same room dates are properly serialized with only one succeeding.
7. Run the test suite via `npm run test` or by calling `vitest run` directly. Verify that the build is stable and 100% of the tests pass.
8. Document all steps taken and results in C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_milestone2\handoff.md and report back to your parent orchestrator.
