## 2026-05-20T19:17:13Z

You are the Backend & DB Developer for the Double Approval (4-eyes) Workflow in Casa Mahana PMS.
Your working directory is: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_backend/

Your mission is to implement Milestones 1 & 2 of the Double Approval workflow.
Read these files first:
1. ORIGINAL_REQUEST.md
2. C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_initial\handoff.md (initial explorer analysis)
3. server/db/schema.sql
4. server/db/database.js
5. server/routes/admin.js
6. server/routes/hotel.js

Tasks:
1. Add the SQLite table definition for `solicitudes_modificacion` to `server/db/schema.sql`.
   Ensure you capture:
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `reserva_id` INTEGER NOT NULL (references reservas_hotel(id) ON DELETE CASCADE)
   - `tipo_modificacion` TEXT NOT NULL ('editar_pago' or 'editar_reserva')
   - `transaccion_original_id` INTEGER (references folio_hotel(id) ON DELETE SET NULL, nullable)
   - `estado` TEXT DEFAULT 'Pendiente' ('Pendiente', 'Aprobado', 'Rechazado')
   - `usuario_solicitante` TEXT NOT NULL
   - `justificacion` TEXT NOT NULL
   - `snapshot_datos` TEXT NOT NULL (JSON proposed changes)
   - `datos_anteriores` TEXT NOT NULL (JSON original field values for Before vs After comparison)
   - `procesado_por` TEXT
   - `fecha_procesamiento` TEXT
   - `comentarios_admin` TEXT
   - `created_at` TEXT DEFAULT (datetime('now'))
   Ensure you add indices:
   - idx_solicitudes_reserva ON solicitudes_modificacion(reserva_id)
   - idx_solicitudes_estado ON solicitudes_modificacion(estado)
2. Register `'solicitudes_modificacion'` in the `VALID_TABLES` whitelist array in `server/db/database.js`.
3. Build backend endpoints (secured by authentications/RBAC matching existing code, e.g. using requireAuth/requireRole):
   - POST /api/v1/hotel/reservas/:id/solicitar-cambio
     - For all authenticated roles.
     - Payload: `{ tipo_modificacion, transaccion_original_id?, justificacion, snapshot_datos }`.
     - It must fetch original field values from `reservas_hotel` (if tipo is 'editar_reserva') or `folio_hotel` (if tipo is 'editar_pago') and save them as `datos_anteriores` JSON.
     - Saves the request in `solicitudes_modificacion` with state `'Pendiente'`.
     - When a reservation change is requested, it should update the reservation state or set `estado = 'Cambio Pendiente de Aprobación'` so that the receptionist UI displays it. Wait! The user requirements say:
       "Una vez enviada, la solicitud debe reflejarse en la reserva como 'Cambio Pendiente de Aprobación' para evitar duplicados." Wait, is there a state field or does it override the current estado? It says: "reflejarse en la reserva como 'Cambio Pendiente de Aprobación'". We should either update `estado` of the reservation to `'Cambio Pendiente de Aprobación'` in `reservas_hotel`, or have a separate field, but let's see how `reservas_hotel` handles `estado`. Let's look at `schema.sql` line 70 for `reservas_hotel`. It has `estado TEXT DEFAULT 'Pendiente'`. Updating the `estado` to `'Cambio Pendiente de Aprobación'` is the cleanest way, and when approved/rejected, we restore the original `estado`! So keep a copy of the original `estado` in `datos_anteriores` so we can restore it!
   - GET /api/v1/admin/solicitudes-modificacion
     - Restricted to admin.
     - Join reservation details (cliente, apellido, plan_nombre) for UI context.
   - POST /api/v1/admin/solicitudes-modificacion/:id/procesar
     - Restricted to admin.
     - Payload: `{ accion: 'aprobar' | 'rechazar', comentarios_admin? }`.
     - Must run inside a 100% ACID better-sqlite3 database transaction (`db.transaction()`).
     - **If approved:** Apply the `snapshot_datos` changes.
       - If `tipo_modificacion === 'editar_pago'`:
         - Modify the payment in `folio_hotel`.
         - Recalculate payment totals (`monto_pagado` and `saldo_pendiente`) in `reservas_hotel` for that reservation.
       - If `tipo_modificacion === 'editar_reserva'`:
         - Modify reservation details in `reservas_hotel` (check_in, check_out, noches, subtotal, etc., recalculating totals with `calcReservation` or `calcReservationWithRates` helper).
       - Update request status to `'Aprobado'`.
     - **If rejected:** Keep original records unchanged; update status to `'Rechazado'` and save `comentarios_admin`. Restore the original reservation `estado` (if it was `'Cambio Pendiente de Aprobación'`).
4. Verify by running the server build or checking for compile errors (if any).
