# Project: Casa Mahana PMS - Group Bookings and Multiple Units (Master/Child)

## Architecture
Casa Mahana PMS is a React + Express + SQLite full-stack application.
- **Frontend**: React 18 with TypeScript, Tailwind CSS, and Vite.
- **Backend**: Express.js REST API with JWT-based authentication and SQLite database via `better-sqlite3`.
- **Database**: SQLite database stored at `data/casa-mahana.db`.
- **Group Bookings Linking**: Reservations are linked using `grupo_codigo` (unique group string), `es_maestra` (boolean/integer flag for leader), `parent_reserva_id` (foreign key pointing to parent reservation id), and `facturacion_consolidada` (flag for consolidated billing).

## Code Layout
- `server/db/schema.sql` - SQLite database schema.
- `server/db/database.js` - SQLite connection, initialization, and seeding.
- `server/routes/hotel.js` - Reservation creation, folio payments, and status changes.
- `server/utils/calculations.js` - Financial calculation module.
- `src/pages/NuevaReserva.tsx` - Form for creating single and group bookings.
- `src/pages/Calendario.tsx` - Main calendar timeline.
- `src/components/RoomRow.tsx` - Calendar room row rendering reservation bars.
- `src/components/InteractivePopover.tsx` - Calendar popover quick actions.
- `src/pages/ReservaDetalle.tsx` - Detailed reservation view.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | DB Schema & Seeding | Add group columns (`grupo_codigo`, `es_maestra`, `parent_reserva_id`, `facturacion_consolidada`) and index `idx_reservas_grupo` in `schema.sql`. Update `database.js` to ensure the columns are present. | None | DONE |
| 2 | Backend API & Transactions | Implement `POST /api/v1/hotel/reservas/grupo` endpoint inside `server/routes/hotel.js` under a single SQLite transaction block, validating conflicts and performing rollbacks on overlap. | M1 | DONE |
| 3 | Consolidated Folio Accounting | Modify pricing engine in `calculations.js` and folio hooks in `hotel.js` to route child room/tax charges to the Master folio when consolidated billing is enabled. | M2 | DONE |
| 4 | Frontend UI: Group Booking Creation | Update `NuevaReserva.tsx` to add a group booking toggle, multi-room checkboxes/grid, guest configuration card inputs, and integration with the bulk API. | M2 | DONE |
| 5 | Frontend UI: Calendar Integration | Integrate 👥 indicators, color-hash borders, synchronized hover highlights, and HTML5 drag-and-drop physical unit reassignments in `Calendario.tsx` and `RoomRow.tsx`. | M3, M4 | DONE |
| 6 | Frontend UI: Group Detail Panel | Add group listing, consolidated group totals, and bulk Check-In/Check-Out buttons in `ReservaDetalle.tsx`. | M3, M4 | DONE |
| 7 | Testing & Clean Build | Implement integration and E2E tests in `server/routes/hotel.group.test.js` validating all requirements, and ensure `npm run build` and `npm run test` pass cleanly. | M5, M6 | DONE |

## Interface Contracts

### Group Booking Creation
- `POST /api/v1/hotel/reservas/grupo`
  - **Auth**: `requireAuth`
  - **Payload**:
    ```json
    {
      "grupo_codigo": "GRP-123456",
      "facturacion_consolidada": 1,
      "reservas": [
        {
          "es_maestra": 1,
          "cliente": "John",
          "apellido": "Doe",
          "email": "john@example.com",
          "habitacion_id": 1,
          "check_in": "2026-06-01",
          "check_out": "2026-06-05",
          "adultos": 2,
          "menores": 0,
          "mascotas": 0,
          "plan_codigo": "todo_incluido",
          "notas": "Líder del grupo"
        },
        {
          "es_maestra": 0,
          "cliente": "Jane",
          "apellido": "Doe",
          "email": "jane@example.com",
          "habitacion_id": 2,
          "check_in": "2026-06-01",
          "check_out": "2026-06-05",
          "adultos": 2,
          "menores": 0,
          "mascotas": 0,
          "plan_codigo": "todo_incluido"
        }
      ]
    }
    ```

### Group Retrieval
- `GET /api/v1/hotel/reservas?grupo_codigo=:codigo`
  - **Auth**: `requireAuth`
  - **Returns**: Array of all reservations belonging to the group.
