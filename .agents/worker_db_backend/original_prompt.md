## 2026-05-20T20:20:46Z

You are a Worker specializing in Database and Backend Development. Your task is to implement Milestone 1 (Database Schema Extensions), Milestone 2 (Backend Group Booking API), and Milestone 3 (Consolidated Folio Accounting) for the "Group Bookings and Multiple Units (Master/Child Bookings)" module in Casa Mahana PMS.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Specifically, you must:
1. Examine C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\db\schema.sql and update the `reservas_hotel` CREATE TABLE definition to include:
   - `grupo_codigo TEXT`
   - `es_maestra INTEGER DEFAULT 0`
   - `parent_reserva_id INTEGER REFERENCES reservas_hotel(id) ON DELETE SET NULL`
   - `facturacion_consolidada INTEGER DEFAULT 1`
   And add an index:
   - `CREATE INDEX IF NOT EXISTS idx_reservas_grupo ON reservas_hotel(grupo_codigo);`

2. Examine C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\db\database.js. Update the database initialization / seeding code to make sure these 4 new columns are dynamically added to the existing `reservas_hotel` table in SQLite using safe column existence checks (e.g. PRAGMA table_info) or safe try-catch ALTER statements, ensuring the system boots and seeds properly without errors.

3. Examine C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\server\routes\hotel.js.
   - Implement the `POST /hotel/reservas/grupo` endpoint to create a group booking under a single `db.transaction()` block:
     - Perform strict date and room availability checks for ALL rooms in the group. If any overlaps exist, throw an Error so that SQLite rolls back the entire transaction.
     - Generate a unique group code like `GRP-YYYYMMDD-[4 RANDOM ALPHANUMERIC CHARS]`.
     - Assign `es_maestra = 1` for the leader/first room, and `es_maestra = 0` and `parent_reserva_id = master_id` for child rooms.
     - Calculate pricing and totals dynamically using `calcReservation` or `calcReservationWithRates`.
     - If `facturacion_consolidada === 1` (default):
       - All child room nights and tax debits must be written directly to the Master's folio (with a clear concept description referencing the child room number/guest name).
       - Child reservations must be stored with `$0` pricing columns (subtotal, impuesto_monto, monto_total, saldo_pendiente) in the database.
       - Master reservation's totals must be updated to represent the aggregate totals (sum of master and children).
     - If `facturacion_consolidada === 0` (separate accounts):
       - Each room retains its own pricing totals and writes nights/taxes to its own folio.
   - Refactor `GET /hotel/reservas` or the search router to support filtering by `grupo_codigo` if query parameters include it.
   - Update `POST /hotel/reservas/:id/folio` to support consolidated billing:
     - If adding a folio entry (debit or payment) to a child reservation, if the child's `parent_reserva_id` exists and `facturacion_consolidada === 1`, redirect the folio charge/payment directly to the Master's folio, updating the Master's overall balance.

Run backend builds and verify the backend does not throw syntax or module loading errors. Do not write frontend changes yet. Update your progress.md and write a handoff report at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_db_backend\handoff.md when you are finished. Then send a message back.
