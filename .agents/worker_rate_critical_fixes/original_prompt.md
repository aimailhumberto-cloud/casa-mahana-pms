## 2026-05-21T16:50:47Z
**Context**: We need to apply 6 critical path bug fixes to calculations, group bookings, Folio action validations, and test suites in the Casa Mahana PMS.

**Objective**:
Apply the following 6 precise bug fixes across the codebase:

1. **Bug 1: Double-Negative Bypass**
   - File: `src/pages/ReservaDetalle.tsx`
   - Method: `submitPersonaExtra` (around lines 364–399)
   - Action: Individually validate `parseFloat(personaExtraForm.precioPorNoche) > 0` and `parseInt(personaExtraForm.noches) > 0` rather than just checking the calculated amount. If either is <= 0 or NaN, return an alert and abort.
   - Validation: Also sanitize the `concepto` string against the safe regex `/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\\s'().-]+$/`. If it contains invalid characters, return an alert and abort.

2. **Bug 2: Group Booking 0-Guest Lock/Leak**
   - File: `src/pages/NuevaReserva.tsx`
   - Method: `toggleGroupRoom` (around lines 413–440)
   - Action: When the current group leader room (`prev[0] === id`) is unchecked (removed), identify the next room in line (`next[0]`) as the new leader. If its guest counts are currently empty/0 (i.e. `adultos === 0`), copy the primary search form's guest counts and details (`form.cliente`, `form.apellido`, `form.adultos`, `form.menores`, `form.mascotas`, `form.plan_codigo`) to this new leader room in the `roomConfigs` state.

3. **Bug 3: Timezone Day-Shifting Bug & Calculations Clamping**
   - File: `server/utils/calculations.js`
   - Method: `parseDateToUTC` (around lines 11–28)
   - Action: At the start of string checks, replace all slashes with hyphens (e.g., `dateInput.replace(/\\//g, '-')`) before split-parsing. This ensures UTC-based parsing rather than falling back to local `new Date()`.
   - Method: `calcReservation` and `calcReservationWithRates`
   - Action: Clamp numeric inputs to positive numbers using `Math.max` (e.g. `Math.max(1, ...)` for adults and nights, and `Math.max(0, ...)` for prices, minors, pets, additional products, and paid amounts).

4. **Bug 4: ReferenceError in Stress Test Suite**
   - File: `server/utils/calculations.stress.test.js`
   - Action: Rewrite all CommonJS `require()` imports to ES modules `import` syntax at the top of the file to fix ReferenceError under modern Vitest.
   - Action: Update assertions to respect the new clamped defaults (forcing adults >= 1 and nights >= 1). For example, negative guests/prices/nights should now assert subtotal/total of 0, and 0-adult counts should assert at least 1 adult count.
   - Action: Add a new test verifying timezone safety for slash-separated dates (verifying `parseDateToUTC('2026/05/22')` yields the exact same timestamp as `parseDateToUTC('2026-05-22')`).

5. **Bug 5: Jarring Screen Flash**
   - File: `src/pages/ReservaDetalle.tsx`
   - Method: `load` (around lines 190–208)
   - Action: Add an optional `silent?: boolean` parameter. If `silent` is true, completely bypass setting `loading(true)` (and skip setting `loading(false)` on finish).
   - Method: `submitPersonaExtra`
   - Action: Invoke `load(true)` on successful folio charge creation to reload reservation data silently without triggering a jarring loading skeleton.

6. **Bug 6: Backend Route 0-Adult Validation**
   - File: `server/routes/hotel.js`
   - Method: `POST /hotel/reservas/grupo` handler (around lines 333–638)
   - Action: Loop through the `reservas` payload *before* starting the database transaction. Verify `adultos >= 1` for every single room in the payload. If any room violates this, immediately return a `400 Bad Request` with `err(res, 'VALIDATION_ERROR', 'Cada habitación debe tener al menos 1 adulto')` (or standard route helper equivalent) and abort.

**Execution Verification**:
- Run `npm test -- --run` to verify that all Vitest tests pass cleanly.
- Run `npm run build` to verify that the entire project compiles successfully with zero TypeScript or bundling errors.

**MANDATORY INTEGRITY WARNING**:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

**Output Requirements**:
Write a comprehensive implementation and handoff report in `C:\\Users\\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\.agents\\worker_rate_critical_fixes\\handoff.md` summarizing:
- Files modified and the precise changes.
- Successful Vitest test suite run output (tests count and status).
- Production build success confirmation.
