## 2026-05-21T16:34:14Z

You are a Reviewer Specialist. Your working directory is C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\reviewer_rate_fixes_2.
Please review the changes made to correct the rate calculations, group bookings duplication, and implementation of the "Persona Extra" folio quick action.

Specifically, inspect:
1. `src/pages/NuevaReserva.tsx`: Ensure subsequent group rooms default to 0 guests (adults, minors, pets) instead of duplicating primary search form guest counts.
2. `src/pages/ReservaDetalle.tsx`: Ensure the "Persona Extra" quick-charge action button is added next to "Registrar Pago", toggles a purple collapsable form card, defaults to $25/night * nights (or 1 night if nights = 0), and allows editing of concept, price, nights, and total, has a reactive sync with manual override, submits payload to POST `/hotel/reservas/:id/folio` with `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }` and refreshes.
3. `server/utils/calculations.js`: Ensure stay-based adult rates are strictly per-person (adults * price).
4. Verify the test updates in `server/utils/calculations.test.js`, `server/routes/double_approval.test.js`, and `server/routes/group_bookings.test.js`.

Verify correctness, styling/UX conformance, robust input validation, and boundary conditions.
Run the Vitest test suite (`npm test -- --run`) and the production build (`npm run build`) to ensure there are no TypeScript, compilation, or test failures.
Write your detailed findings to `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\reviewer_rate_fixes_2\handoff.md` and message the orchestrator with your final verdict (APPROVE / REQUEST_CHANGES).
