## 2026-05-21T16:28:32Z
**Context**: Review the frontend updates in the Casa Mahana PMS.
**Objective**:
Verify the frontend code changes made in `src/pages/NuevaReserva.tsx` and `src/pages/ReservaDetalle.tsx`.
1. Inspect `src/pages/NuevaReserva.tsx` to verify that when adding subsequent rooms in a group booking, guest counts (adults, minors, pets) are defaulted to 0 and do not duplicate from the search form.
2. Inspect `src/pages/ReservaDetalle.tsx` to verify that the "Persona Extra" glassmorphic button and collapsible card are styled correctly in purple, have appropriate field validation, default rate to $25/night, calculate the total amount correctly (`noches * price`), and invoke `api.post` with the required parameters to register the charge.
3. Run `npm run build` to ensure the entire React frontend compiles cleanly with TypeScript with zero errors or warnings.
4. Report any visual bugs, typing issues, or user experience concerns.

Write your final review report in `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\reviewer_2\review.md`.
Your folder is `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\reviewer_2`.
Identity: teamwork_preview_reviewer (Frontend Reviewer)
