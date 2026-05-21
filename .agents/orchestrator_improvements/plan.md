# Plan: Casa Mahana PMS - Key Improvements & Corrections

This plan outlines the architecture, milestone decomposition, and interface contracts for implementing the new requirements under the May 21, 2026 follow-up.

## Architecture & Code Layout
The PMS is a full-stack React + Express + SQLite application.
- **Frontend Core Files to Modify**:
  - `src/pages/NuevaReserva.tsx` - Allow flexible abono amount, add "50% Sugerido" and "100% Total" buttons.
  - `src/pages/ReservaDetalle.tsx` - Integrate PayPal SDK on folio payments (Tarjeta / PayPal).
  - `src/pages/Calendario.tsx` - Integrate PayPal SDK on Quick Pay, and right-click contextual cleaning status menu on room headers.
  - `src/components/RoomRow.tsx` - Right-click click listener/trigger on left room header.
  - `src/pages/Saldos.tsx` - Commission (%) input and discount, enable/fix Reconciliar button for admins.
  - `src/pages/AdminHabitaciones.tsx` - Hide/disable write/upload actions if user is staff (role !== 'admin'). Detail photo upload catches.
  - `src/components/BookingWidget.tsx` - Client group booking widget, expand to 30 people + pets, cart multi-format selection, room assignment console, POST to bulk group booking API.
- **Backend Core Files to Modify**:
  - `server/routes/hotel.js` - Endpoint for saving cleaning status, saving cupón commission, and mass reconciliation logic.
  - `server/db/database.js` or `server/db/schema.sql` - Verify schema holds fields for commissions, cleaning status, etc.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Diagnostic | Scan files, analyze existing schemas and routes, run existing test suite, identify exact entry points. | None | DONE |
| 2 | Backend & DB Adaptations | Create/verify DB fields for commissions, implement cleaning status endpoint, third-party cupón commission persistence, and admin check. | M1 | DONE |
| 3 | Payments & Abonos UI | Flexible abono input and buttons in `NuevaReserva.tsx`, and PayPal SDK integrations in `ReservaDetalle.tsx` and `Calendario.tsx`. | M2 | DONE |
| 4 | Saldos & CxC UI | Commission (%) input on Saldos, Reconciliar button logic for admins, backend reconciliation integrations. | M2 | DONE |
| 5 | Cleanliness Context Menu | Room row headers right-click handler in `Calendario.tsx`/`RoomRow.tsx`, clean status backend sync. | M2 | DONE |
| 6 | Config Rooms & Upload Detailed Errors | Restrict staff access to AdminHabitaciones actions, propagate user prop, display detailed server error messages in upload/save blocks. | M2 | DONE |
| 7 | Client Group Booking Widget | Multi-unit cart selection, 30 max people + pets, free room assignment console, transaction multi-booking POST call. | M2 | DONE |
| 8 | E2E Testing & Verification | Add test suites, verify Vitest passing (63/63), run npm run build cleanly, run Forensic Audit. | All | IN_PROGRESS |

## Interface Contracts

### 1. Cleaning Status Update
- `PATCH /api/v1/hotel/habitaciones/:id/limpieza`
  - **Auth**: `requireAuth`
  - **Payload**:
    ```json
    {
      "estado_limpieza": "Limpia" | "Sucia" | "Inspeccionada"
    }
    ```

### 2. Conciliation with Commission
- `POST /api/v1/hotel/conciliar`
  - **Auth**: `requireAuth` (admin only)
  - **Payload**:
    ```json
    {
      "pago_ids": [1, 2, 3],
      "comision_porcentaje": 5.0
    }
    ```

### 3. Public Multi-booking Group Checkout
- `POST /api/v1/public/reservas/multi`
  - **Auth**: None (Public)
  - **Payload**:
    ```json
    {
      "grupo_codigo": "GRP-PUBLIC-12345",
      "facturacion_consolidada": 1,
      "reservas": [
        {
          "es_maestra": 1,
          "cliente": "Alice",
          "apellido": "Smith",
          "email": "alice@example.com",
          "habitacion_id": 3,
          "check_in": "2026-06-10",
          "check_out": "2026-06-12",
          "adultos": 2,
          "menores": 1,
          "mascotas": 1
        }
      ]
    }
    ```
