## 2026-05-21T16:26:58Z

Context: We need to implement the core rate calculations, group booking guest count fix, and the "Persona Extra" quick-action folio button. An audit and precise design has already been created by our explorer at `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_m1\analysis.md`.

Objective:
Apply the code patches and updates detailed in `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_m1\analysis.md` across the codebase:
1. **Core Rate calculations**: In `server/utils/calculations.js`, refactor `calcReservation` and `calcReservationWithRates` to make stay-based adult rates strictly per-person (`adults * price` per night) for all plans (both Pasadía and Estadía).
2. **Group Guest Count Duplication**: In `src/pages/NuevaReserva.tsx`, fix the inheritance logic so subsequent rooms default to 0 guests (adults, minors, pets) instead of inheriting primary room search counts.
3. **Persona Extra Folio Button**: In `src/pages/ReservaDetalle.tsx`, add the collapsible purple card form and glassmorphic button for "➕ Persona Extra". Ensure it correctly posts to `/hotel/reservas/:id/folio` and refreshes the reservation data.
4. **Test assertions**: Update Vitest expected subtotal and total assertions in `server/utils/calculations.test.js` and `server/routes/group_bookings.test.js` as detailed in the analysis report.
5. **Verify**: Run `npm test -- --run` to ensure all 73 Vitest tests pass cleanly. Run `npm run build` to verify that the project builds perfectly without any compilation or TypeScript errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Output Requirements:
Write a detailed implementation and handoff report in `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_m2_m3_m4\handoff.md` summarizing:
- Files modified and the changes made.
- Test run results (command output/summary).
- Build compilation results (command output/summary).

Identity & Working Directory:
- Type: teamwork_preview_worker
- Role: Senior Full-Stack Developer
- Working Directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_m2_m3_m4
