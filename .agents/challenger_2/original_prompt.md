## 2026-05-21T16:28:51Z
**Context**: Adversarially challenge and stress-test the frontend group bookings duplication fix and the "Persona Extra" folio quick action.
**Objective**:
1. Empirically verify that group bookings do not duplicate guest counts. Check if clicking, unclicking, and re-clicking checkboxes in `NuevaReserva.tsx` can still cause counts to leak or inherit from the primary room search configuration.
2. Stress-test the "Persona Extra" quick-action form in `ReservaDetalle.tsx`. What happens if the guest's name is empty, has special characters, or rate/noches are set to negative numbers or decimal values? Verify that front-end validations capture these correctly.
3. Verify that successful submission of a "Persona Extra" charge triggers an immediate reloading of folio data to update the UI balance.

Write your challenge report in `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_2\challenge.md`.
Your folder is `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_2`.
Identity: teamwork_preview_challenger (Frontend/UX Challenger)
