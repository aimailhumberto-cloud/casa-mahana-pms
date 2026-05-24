# Plan: Rate Calculation Auditing & "Persona Extra" Folio Quick-Action

This plan outlines the milestones and tasks required to audit and fix rate calculations, avoid minor/guest duplication in group bookings, implement the "Persona Extra" button, and verify all changes.

## Architecture & Scope
1. **Core calculations**: `server/utils/calculations.js` must be updated to make adult rates per-person strictly (`adults * price` per night) in `calcReservation` and `calcReservationWithRates`.
2. **Frontend Guest Count Inheritance**: `src/pages/NuevaReserva.tsx` must initialize subsequent rooms' guest counts (especially minors) to 0.
3. **Persona Extra Quick Charge**: `src/pages/ReservaDetalle.tsx` needs a purple-styled glassmorphic "➕ Persona Extra" button and collapsable form that defaults to $25 per night, calculates `noches * price` (defaulting to 1 night if 0), and POSTs to `/api/v1/hotel/reservas/:id/folio` (or the mapped route).

## Milestones

| Milestone | Name | Description | Status |
|-----------|------|-------------|--------|
| M1 | Audit and Exploration | Explorer analyzes server-side calculations, NuevaReserva.tsx, and ReservaDetalle.tsx frontend | DONE |
| M2 | Per-Person Rate Calculations | Worker updates calculations engine and adapts backend tests | DONE |
| M3 | Group Booking Guest Count Fix | Worker fixes frontend guest count inheritance in subsequent group rooms | DONE |
| M4 | "Persona Extra" Button & Folio Action | Worker implements quick charge Folio UI form and integration in ReservaDetalle.tsx | DONE |
| M5 | Review and Challenge Verification | Reviewer checks frontend and backend, Challenger runs empirical tests | IN_PROGRESS |
| M6 | Forensic Integrity Audit | Forensic auditor checks compliance and integrity | IN_PROGRESS |

## Interface Contracts & Specs

### Folio Quick Charge API Call
- Endpoint: `POST /api/v1/hotel/reservas/:id/folio` (or matching `/hotel/reservas/:id/folio`)
- Payload:
  ```json
  {
    "monto": number,
    "concepto": string,
    "tipo": "debito",
    "metodo_pago": null,
    "referencia": ""
  }
  ```

## Verification Methods
- Vitest: `npm test` (verify 73/73 tests pass)
- Build: `npm run build` (verify zero TypeScript compilation errors)
