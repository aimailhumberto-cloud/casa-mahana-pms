## 2026-05-21T16:32:51Z

You are the Rate Fixes Worker. Your working directory is C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_rate_fixes.
Please implement the changes outlined in the implementation plan at `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\orchestrator_rate_fixes_try2\plan.md`.

Specifically:
1. In `src/pages/NuevaReserva.tsx`, find the auto-cotizar `useEffect` blocks where `config.adultos`, `config.menores`, and `config.mascotas` fall back to `form.adultos`, `form.menores`, and `form.mascotas`. Modify these checks so that they only inherit from `form` if the room is the leader room (first room in `selectedGroupRooms`). If it is a subsequent room, they must default to `0` instead of inheriting from the search form.
2. In `src/pages/ReservaDetalle.tsx`, under the Folio summary, update the "➕ Persona Extra" button and the collapsable card form:
   - Enhance the `personaExtraForm` state and the initialization `useEffect` to include `concepto` and `monto` (as strings). Precompute default total amount (`25 * noches`, defaulting to 1 night if `noches` is 0) and pre-fill concept as `"Persona Extra - Cargo al Folio (X noches)"`.
   - Add a `useEffect` that updates `monto` and `concepto` whenever the price per night or nights input changes, allowing manual override.
   - Update the submit handler `submitPersonaExtra` to send a POST request with `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }` to `/hotel/reservas/${id}/folio` and then load/refresh reservation details.
   - Update the form card HTML/JSX block to render all inputs as editable, specifically: `concepto`, `precioPorNoche`, `noches`, and `monto` (Total).
3. Run the Vitest tests using `npm test -- --run` and run `npm run build` to confirm everything is clean and working.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Please save your changes to the files, verify by running tests and build, write your handoff report to `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_rate_fixes\handoff.md`, and send a message to the orchestrator with the outcome.
