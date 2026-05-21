## 2026-05-20T20:24:00Z
You are a Worker specializing in React and Frontend Development. Your task is to implement Milestone 4 (Frontend UI - Group Booking Creation), Milestone 5 (Frontend UI - Calendar Integration), and Milestone 6 (Frontend UI - Group Detail Panel) for the "Group Bookings and Multiple Units (Master/Child Bookings)" module in Casa Mahana PMS.

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Specifically, you must:
1. Refactor src/pages/NuevaReserva.tsx:
   - Add a state for `isGroup` (boolean) with a visual toggle switch/checkbox: "¿Es una reserva de grupo? 👥".
   - When `isGroup` is true:
     - Enable multi-selection of rooms (e.g. clicking multiple checkboxes or buttons in the available rooms list, maintaining a list of `selectedRooms` instead of a single room).
     - Render a configuration card form for EACH selected room. In each card, allow typing: "Nombre del Huésped", "Apellido", "Adultos", "Menores", "Mascotas", and selecting their individual rate plan (plan_codigo) or default to the primary booking details.
     - Add a dropdown select for Billing Scheme: "Facturación Consolidada" (default, facturacion_consolidada = 1) vs "Cuentas Separadas" (facturacion_consolidada = 0).
     - When clicking submit: Send all data in the structured format required by POST /api/v1/hotel/reservas/grupo:
       ```json
       {
         "cliente": "Líder Nombre",
         "apellido": "Líder Apellido",
         "email": "lider@example.com",
         ...
         "facturacion_consolidada": 1,
         "reservas": [
           { "cliente": "Líder", "apellido": "Líder", "habitacion_id": 101, ... },
           { "cliente": "Invitado 1", "apellido": "Invitado 1", "habitacion_id": 102, ... }
         ]
       }
       ```
       Upon success, redirect the user to the Master reservation's detail page (`/hotel/reservas/${masterId}`).

2. Refactor src/components/RoomRow.tsx and src/pages/Calendario.tsx for Calendar Integration:
   - **👥 Group Indicators**: On the reservation bar in `RoomRow.tsx` (or wherever reservation blocks are rendered), display a 👥 icon next to the guest name if `reserva.grupo_codigo` exists.
   - **Stable Color Borders**: Generate a sutil pastel border color based on a hash function of `grupo_codigo` so that all members of the same group share a common visual border color.
   - **Synchronized Hover Highlights**:
     - Keep track of `activeGroupCode` in `Calendario.tsx`'s state. Pass `activeGroupCode` and `setActiveGroupCode` (or `onHoverGroup` callback) down to `RoomRow.tsx`.
     - In the reservation block element inside `RoomRow.tsx`, add `onMouseEnter` to set the hovered group code, and `onMouseLeave` to clear it.
     - If the reservation has `grupo_codigo` and it matches `activeGroupCode`, apply a prominent CSS class (e.g. Tailwind outline/ring classes like `ring-4 ring-blue-500 scale-[1.02] z-30 shadow-lg brightness-110 duration-150`) to highlight all group rooms simultaneously!
   - **Drag-and-Drop Room Reassignments**:
     - Make the reservation block elements draggable (`draggable={true}` and `onDragStart` setting the reservation ID).
     - Make the empty grid cells in `RoomRow.tsx` droppable targets (`onDragOver` allowing drops and `onDrop` capturing the dragged reservation ID and target physical room ID).
     - When dropped, execute a `PUT /hotel/reservas/:id` updating only the `habitacion_id` to the target room's ID. This will physically reassign the room row in the backend while leaving dates and other group rooms untouched, and reload the calendar.

3. Refactor src/pages/ReservaDetalle.tsx:
   - If the reservation belongs to a group (`grupo_codigo` is defined):
     - Display a "Panel de Grupo 👥" in the sidebar or main content.
     - Fetch and list all reservation records belonging to that group (using `api.get('/hotel/reservas?grupo_codigo=' + grupo_codigo)`).
     - For each room in the list, display Room Name/Number, Occupant Name, and current Reservation Status (Confirmed, Checked-In, Checked-Out).
     - Show **Consolidated Statistics**: Sum of all group's total cost, aggregate paid payments, and consolidated pending balance.
     - Implement **Massive (Batch) State Operations**:
       - Add a "Check-In Grupo" button: loops and calls `PATCH /hotel/reservas/:id/status` to transition all eligible group rooms to `'Hospedado'`.
       - Add a "Check-Out Grupo" button: loops and calls `PATCH /hotel/reservas/:id/status` to transition all eligible group rooms to `'Check-Out'`.
       - Update visual stats in real-time.

Ensure the entire PMS compiles perfectly (`npm run build`) and runs without linter or TypeScript errors. Update your progress.md and write a handoff report at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_frontend\handoff.md when you are finished. Then send a message back.
