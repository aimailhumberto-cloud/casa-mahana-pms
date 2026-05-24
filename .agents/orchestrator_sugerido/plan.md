# Plan: Room Recommendation Engine 'El Sugerido', online Pasadías, timezone-proof rate calculations, and cart cleanup

This plan lays out the steps to implement the milestone's requirements.

## Decomposed Steps

### Step 1: Exploration and Requirements Analysis
- Dispatch Explorer subagents to inspect the following files:
  - `server/utils/calculations.js` (pricing and date calculations)
  - `server/routes/public.js` (public availability search API `/disponibilidad`)
  - `src/pages/BookingWidget.tsx` (public booking wizard)
  - `server/utils/calculations.test.js` (existing calculation unit tests)
- Analyze the room capacity rules, categories (`Pasadía` vs standard categories), weekday vs weekend rate calculations, and how cart state is managed in the frontend.

### Step 2: Implementation of Timezone-Proof Date & Rate Calculations
- Modify `server/utils/calculations.js` and `src/pages/BookingWidget.tsx` (or other calculation scripts) to use UTC-based Date methods strictly.
- Ensure that weekday vs weekend rate logic (`entre_semana` vs `fin_de_semana`) is timezone-independent.
- Verify that reservations spanning weekdays and weekends are computed exactly with correct nightly breakdowns.

### Step 3: Implementation of Online Pasadías
- Expand public availability endpoint `/api/v1/public/disponibilidad` (in `server/routes/public.js`) to accept a category parameter or dynamically check. When searching for Pasadía, filter rooms where `categoria = 'Pasadía'` (e.g. Bohíos, Salón, Restaurante) and verify availability for that single day.
- Support per-person pricing for Pasadías in `server/utils/calculations.js` where `Total = (adults * precio_adulto) + (minors * precio_menor) + (pets * precio_mascota)`.
- Update `BookingWidget.tsx` to include a clean toggle (🏨 Estadía vs ☀️ Pasadía) at Step 1, single date input under Pasadía, per-person pricing labels, and correct calculations.

### Step 4: Auto-Recomendación Inteligente ("El Sugerido")
- Implement the optimal room allocation algorithm in `BookingWidget.tsx` (or a helper/utility file).
- The algorithm must:
  - Group guest count into the minimum number of available rooms possible.
  - Respect capacities: `capacidad_min <= (adults + minors) <= capacidad_max`.
  - Require at least 1 adult per room.
  - Appropriately distribute pets.
  - Prioritize higher capacity rooms (Familiar -> Doble -> Estándar -> Camping).
- Display this recommended combination prominently at the top of Step 2 as "Nuestra Recomendación Inteligente (El Sugerido)".
- Implement the "Aceptar Sugerido y Continuar" button which populates the cart, auto-distributes guests, and navigates straight to Step 4.

### Step 5: Cart Management and Navigation Cleanup
- In `BookingWidget.tsx`, reset the cart state when returning to Step 1 or changing dates/search criteria.

### Step 6: Verification & Testing
- Add Vitest test suite assertions in `server/utils/calculations.test.js` covering Pasadía calculations and timezone-safe date math.
- Run `npm test` and verify that all test suites pass perfectly.
- Run `npm run build` to verify the frontend and backend build seamlessly without any linter or TypeScript issues.
- Dispatch Reviewers and a Forensic Auditor to guarantee correctness, robustness, and compliance.
