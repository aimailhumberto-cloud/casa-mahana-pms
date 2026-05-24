## 2026-05-21T13:26:46Z

You are the PMS Implementer subagent. Your task is to implement the timezone-proof rate calculations, online Pasadías, 'El Sugerido' room recommendation engine, and cart state cleanup in the Casa Mahana PMS project.

Your working directory is: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_sugerido

Please:
1. Initialize your BRIEFING.md and progress.md inside your working directory.
2. Read the following Explorer handoff files for complete plans and blueprints:
   - Rates & Calculations: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\handoff.md
   - Availability API: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_2\handoff.md
   - Frontend Booking Wizard: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_3\handoff.md
3. Execute the implementation:
   a. Backend Calculations:
      - Replace server/utils/calculations.js with the verified, timezone-proof, and category-aware implementation at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\proposed_calculations.js.
      - Replace server/utils/calculations.test.js with the updated Vitest test suite at C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\proposed_calculations.test.js.
   b. Backend Public Routing:
      - Modify server/routes/public.js to accept `categoria` (defaulting to 'Estadía') in the public /disponibilidad API, filter active rooms by category, and allow same-day check-in/check-out for Pasadías.
      - Check availability conflicts differently based on the category: for Pasadías, verify day-level conflict (check_in <= ? AND check_out >= ?) rather than overnight overlaps.
      - In /reservar and /reservas/multi, retrieve the category for the booked room type and perform matching same-day validations and day-level availability conflict checks.
   c. Frontend Booking Wizard (src/pages/BookingWidget.tsx):
      - Refactor minCheckOut and noches variables in BookingWidget.tsx to use strictly UTC-based date math, preventing local client timezone shifts.
      - Add Estadía vs Pasadía toggle tabs in Step 1. In Pasadía mode, force check-out to equal check-in, set nights to 0, and display all pricing as per person (/persona).
      - Implement the "El Sugerido" optimal room allocation backtrack solver at Step 2 based on the TypeScript code in C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_3\handoff.md.
      - Render "Nuestra Recomendación Inteligente (El Sugerido)" prominently at the top of Step 2, and add the "Aceptar Sugerido y Continuar" button which populates the cart, auto-distributes guests to those rooms, and redirects to Step 4.
      - Add the useEffect cleanup check that resets the cart state immediately if search parameters (dates, guests, category) are modified.
4. Verify your work:
   - Run the automated tests: `npm run test`
   - Run the production build: `npm run build`
   - Ensure both complete perfectly with zero errors or warnings.
5. Write your handoff.md report inside your working directory summarizing:
   - Verbatim files modified and command outputs.
   - Proof of successful test and build completion.
6. Send a message to the Project Orchestrator (Conversation ID: ff87ec31-9fe0-41d2-9327-1ac8dcd49815) when done.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
