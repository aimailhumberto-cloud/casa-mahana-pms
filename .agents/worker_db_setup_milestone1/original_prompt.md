## 2026-05-20T17:41:36Z

You are the Backend Implementer for Casa Mahana PMS. Your mission is to implement Milestones 1, 2, and 3 of the User Management and System Settings implementation, as detailed in the Explorer's plan (located at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_1\analysis.md).

Working Directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms
Your Working Agent Metadata Directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_db_setup_milestone1

## Scope of Work

### 1. Database Schema & Migration (Milestone 1)
- **`server/db/schema.sql`**: Add schema definitions for the system settings table `configuracion_sistema` (which should only allow a single row with ID=1) and the payment reversal audit table `reversiones_log`. Refer to `analysis.md` for exact field names and types.
- **`server/db/database.js`**:
  - In `getDb()`: Seed `configuracion_sistema` with default settings loaded from the standard environment variables (e.g. `process.env.SMTP_HOST`, `process.env.SMTP_PORT`, etc.) when the table is empty.
  - Add `'configuracion_sistema'` and `'reversiones_log'` to the `VALID_TABLES` whitelist array to allow generic CRUD.

### 2. Dynamic Notifications Module (Milestone 2)
- **`server/notifications.js`**: Refactor Nodemailer and WhatsApp hooks to fetch SMTP credentials and WhatsApp REST settings dynamically from the `configuracion_sistema` SQLite table at runtime.
  - Implement dynamic, lazy transporter instantiation. If credentials in the database change, automatically recreate and verify the transporter.
  - Ensure all outgoing notification functions (e.g. `sendEmail`, `sendWhatsApp`, check-in/out emails, booking approvals, payment logs) retrieve their active parameters from the DB settings row.

### 3. Backend REST APIs & Security Rules (Milestone 3)
- **`server/routes/auth.js`**: Refactor the `/login` route. Check if the user exists first, check the password hash, and if inactive (`activo !== 1`), immediately block them and return an HTTP 403 status with error code `USER_DEACTIVATED` and message `"Usuario desactivado, contacte al administrador"`.
- **`server/routes/admin.js`**: Append REST endpoints under the `/api/v1/admin` namespace:
  - User CRUD endpoints:
    - `GET /usuarios`: List all system users (return id, email, nombre, rol, activo, created_at).
    - `POST /usuarios`: Create a user. Securely hash their password using `hashPassword` from `server/auth.js` and save their role (`admin`, `receptionist`, `cleaning`, etc.) and active state.
    - `PUT /usuarios/:id`: Edit user details (email, password if provided, name, role, active status).
  - Settings and logs endpoints:
    - `GET /configuracion/sistema`: Fetch the system configuration settings row.
    - `PUT /configuracion/sistema`: Save/overwrite SMTP & WhatsApp credentials.
    - `GET /configuracion/logs`: List the notifications log history from `notificaciones_log` (supporting paging, limits, and channel/type filters).
    - `GET /configuracion/reversiones`: Fetch the reversal log history from `reversiones_log`.
- **`server/routes/hotel.js`**: Refactor the `/hotel/reservas/:id/folio/:folioId/reversar` endpoint. Extract `motivo` (or `reason`) from `req.body`, and write an audit record to the `reversiones_log` table inside the SQLite transaction.

## Verification Requirements
- Compile and build successfully: ensure no syntax or module import/export errors are introduced.
- Update your progress in `.agents/worker_db_setup_milestone1/progress.md`.
- Save a final report to `.agents/worker_db_setup_milestone1/handoff.md` with:
  - File changes made
  - Rationale for implementation choices
  - Verification method used
