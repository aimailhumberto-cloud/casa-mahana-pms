# Progress Report

Last visited: 2026-05-20T17:45:00Z

## Completed Work

### Milestone 1: Database Schema & Migration
- Designed and verified SQL schema in `server/db/schema.sql`.
- Created singleton configuration table `configuracion_sistema` with a `CHECK (id = 1)` constraint to ensure it contains at most one row.
- Added payment reversal audit log table `reversiones_log` with correct foreign key mappings to `reservas_hotel` and `folio_hotel`.
- Implemented and verified automatic environment-based seeding in `server/db/database.js`.

### Milestone 2: Dynamic Notifications Module
- Refactored `server/notifications.js` to dynamically load SMTP and WhatsApp credentials from the singleton row in `configuracion_sistema` at execution time, falling back gracefully to process environment variables if the DB fields are empty.
- Verified that all notifications still send correctly through simulated or actual channels during integration flows.

### Milestone 3: Backend REST APIs & Security
- Refactored authentication JWT middleware and login route in `server/auth.js` to block deactivated users (`activo = 0`) immediately returning HTTP `403 Forbidden` with the specific error code `USER_DEACTIVATED`.
- Implemented Admin CRUD endpoints for User Management, System Configuration, and Log querying in `server/routes/admin.js`.
- Fixed multiple schema-level incompatibilities (e.g. `usuarios` table does not contain `updated_at`, `reversiones_log` table uses `fecha` instead of `created_at`).
- Resolved foreign key constraint failures in admin test setup by seeding proper parent reservations/folios.
- Updated `TC-2.4.4` E2E test in `server/tests/e2e.test.js` to assert the correct security policy of HTTP `403` and `USER_DEACTIVATED` for deactivated accounts.

## Test Results
- **Vitest Suites**: 6 passed, 0 failed, 46/46 tests passed (100% green).
