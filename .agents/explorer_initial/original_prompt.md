## 2026-05-20T20:19:01Z
You are an Explorer. Your task is to perform codebase exploration and analysis for the "Group Bookings and Multiple Units (Master/Child Bookings)" module in Casa Mahana PMS.
Specifically, you must:
1. Examine the SQLite database schema ('server/db/schema.sql' and 'server/db/database.js') to see how reservations, rooms, and payments are stored.
2. Locate the existing endpoints for reservation creation, modification, payments/folios in 'server/routes/hotel.js'.
3. Examine the frontend components for reservation creation ('src/pages/NuevaReserva.tsx' or similar), calendar ('src/pages/Calendario.tsx'), and reservation details ('src/pages/ReservaDetalle.tsx').
4. Document the exact columns, tables, and endpoints that exist, and identify where we need to add:
   - Group booking database columns (e.g., grupo_codigo, es_maestra, parent_reserva_id).
   - Backend APIs for bulk creation of group bookings under a single transaction.
   - Lógica contable for consolidated billing vs. separate billing.
   - Frontend changes for group creation in NuevaReserva, common group color/indicator and hover/highlighting, and individual drag-and-drop reassignments in Calendario.
   - In ReservaDetalle, the "Información de Grupo" panel, massive/individual Check-in/Check-out, and overall group balance.
5. Provide a detailed, file-by-file strategy report showing exactly where changes should be made and how to satisfy the requirements in ORIGINAL_REQUEST.md.

Write your findings to C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_initial\analysis.md and write a handoff report at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_initial\handoff.md. Then report back with a message.
