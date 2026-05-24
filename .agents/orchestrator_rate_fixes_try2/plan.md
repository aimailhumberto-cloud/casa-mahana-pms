# Implementation Plan: PMS Rate Calculations, Group Booking Initialization, and Folio Quick Actions

This document details the step-by-step implementation plan to address the user request regarding PMS rate fixes.

## 1. Core Rate Calculation (Strictly Per-Person Stay Rates)
- **Files**: `server/utils/calculations.js`
- **Goal**: Ensure stay-based adult rates are strictly calculated per person (i.e. `adults * price` per night) in both `calcReservation` and `calcReservationWithRates`, removing any flat room/stay rate logic for adults.
- **Analysis**: The calculation engine already computes `adultos * precioAdulto` and `adultos * pAdulto` respectively. No flat room/stay rates exist for adults.

## 2. Group Booking Guest Count Inheritance (No Redundant Duplication)
- **Files**: `src/pages/NuevaReserva.tsx`
- **Goal**: Avoid duplicating search counts (especially minors) into subsequent rooms of a group booking. Ensure subsequent rooms in a group booking initialize guest counts to 0 by default instead of inheriting from the search form.
- **Modifications**:
  - In `src/pages/NuevaReserva.tsx`, locate both fallback blocks in the auto-cotizar `useEffect` (lines 273-275 and 310-312).
  - Modify them to conditionally check if `roomId === selectedGroupRooms[0]`. Only the primary room should fall back to `form.*`; subsequent rooms should default to `0` if `config.*` is undefined.
  - Verification: Live pricing for subsequent rooms without manual guests set will cotizar with `0` guests by default.

## 3. "Persona Extra" Quick-Action Button in Folio UI
- **Files**: `src/pages/ReservaDetalle.tsx`
- **Goal**: Under the Folio summary, add a clean glassmorphic "➕ Persona Extra" action button next to "Registrar Pago". Clicking it toggles a collapsable form card (styled in purple, eg. `bg-purple-50`) that defaults the price per night to $25 and automatically calculates the total amount based on the reservation's nights. Allow the user to adjust the price per night, total amount, and concept (pre-filled as "Persona Extra - Cargo al Folio (X noches)"). Submitting must send a POST request with `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }` to `/hotel/reservas/:id/folio` and refresh the reservation data reactively.
- **Modifications**:
  - Update `personaExtraForm` state to include `precioPorNoche`, `noches`, `monto`, and `concepto`.
  - Update the initialization `useEffect` to precompute default total `monto` (`25 * noches`) and pre-fill `concepto` to `"Persona Extra - Cargo al Folio (X noches)"` based on reservation nights (defaulting to 1 night if nights is 0).
  - Add a state sync `useEffect` that automatically updates the pre-filled concept and computed total amount when the user changes `precioPorNoche` or `noches`, while still allowing manual overrides.
  - Update `submitPersonaExtra` handler to validate `monto` and `concepto`, then make a `POST` request with `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }`.
  - Replace the form card HTML block (`{showPersonaExtra && ...}`) with editable fields for `concepto`, `precioPorNoche`, `noches`, and `monto` (Total).

## 4. Verification
- **Run Tests**: Execute `npm test -- --run` to ensure all 86 unit/integration tests continue to pass.
- **Build**: Run `npm run build` to verify there are zero TypeScript compiler or Vite build errors.
