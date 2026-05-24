# Handoff Report — Rate, Guest Initialization, and Folio Audit

## 1. Observation
We observed the following exact files, lines, and commands:

1. **Rate Calculations**:
   - **Path**: `server/utils/calculations.js`
   - **Line 97 (in calcReservation)**:
     ```javascript
     const baseAdultosMonto = adultos * precioAdulto;
     ```
   - **Line 167 (in calcReservationWithRates)**:
     ```javascript
     const baseAdultosMonto = adultos * pAdulto;
     ```
   - No other logic exists in `server/utils/calculations.js` that calculates adult rates. They are entirely per-person.

2. **Group Guest Inheritance**:
   - **Path**: `src/pages/NuevaReserva.tsx`
   - **Lines 273–275 (in auto-cotizar useEffect)**:
     ```typescript
     const adults = config.adultos !== undefined ? config.adultos : form.adultos;
     const minors = config.menores !== undefined ? config.menores : form.menores;
     const pets = config.mascotas !== undefined ? config.mascotas : form.mascotas;
     ```
   - **Lines 310–312 (in alternative quotes useEffect)**:
     ```typescript
     const adults = config.adultos !== undefined ? config.adultos : form.adultos;
     const minors = config.menores !== undefined ? config.menores : form.menores;
     const pets = config.mascotas !== undefined ? config.mascotas : form.mascotas;
     ```

3. **"➕ Persona Extra" Button and Form**:
   - **Path**: `src/pages/ReservaDetalle.tsx`
   - **Lines 763–769 (in layout)**:
     ```typescript
     <button
       type="button"
       onClick={() => setShowPersonaExtra(!showPersonaExtra)}
       className="flex items-center gap-1 text-sm text-purple-700 bg-purple-100/60 hover:bg-purple-200/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-purple-200/50 transition font-medium shadow-sm font-sans"
     >
       ➕ Persona Extra
     </button>
     ```
   - **Lines 928–1004 (form card markup)**: Shows a card styled as `bg-purple-50` with fields for `nombre`, `precioPorNoche`, and `noches`, but is missing editable concept and editable total amount inputs, and currently does not pass the full exact payload to the API.
   - **Lines 331–362 (submitPersonaExtra)**: Currently sends `{ monto: totalAmount, concepto: ..., tipo: 'debito' }` to `/hotel/reservas/:id/folio` rather than the required `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }`.

4. **Testing Suite**:
   - Command run: `npm test -- --run`
   - Command Output:
     ```
     Test Files  10 passed (10)
     Tests  86 passed (86)
     ```

---

## 2. Logic Chain
1. **Adult Rates Per-Person**: Since both `calcReservation` and `calcReservationWithRates` multiply the price of the adult by the number of adults (Observation 1), all stay-based and day-based adult calculations are already strictly per-person. There is no flat stay/room pricing logic present for adults in calculations.
2. **Subsequent Room Inheritance**: Subsequent rooms should initialize and remain at 0 guests by default unless manually adjusted. While `toggleGroupRoom` correctly sets them to 0 in state, if `roomConfigs[roomId]` is not fully defined (meaning its keys are `undefined`), the calculation fallback logic in auto-cotizar `useEffect` (Observation 2) overrides this and inherits the guest counts from the primary search `form.adultos`. By introducing a conditional check for the primary room (index 0) in the fallback, we can prevent subsequent rooms from inheriting search form counts.
3. **Folio Form Gaps**: The existing extra person action in `ReservaDetalle.tsx` has some foundations but differs from the user's requirements (Observation 3). To align it, the form needs to be modified so that `concepto` and `monto` are fully editable inputs in state and in the DOM, pre-filling concept as `"Persona Extra - Cargo al Folio (X noches)"` and sending a complete `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }` payload to the API.

---

## 3. Caveats
- Timezone/Day-shifting vulnerabilities were noted in `parseDateToUTC` in `calculations.stress.test.js` when positive offset local Dates are used, but they do not impact the core stay-based rate logic.

---

## 4. Conclusion
1. Stay-based adult rates in calculations are already strictly per-person; no flat stay/room rate logic for adults needs to be removed.
2. Guest count inheritance in subsequent rooms is resolved by modifying the auto-cotizar `useEffect` fallbacks in `NuevaReserva.tsx` to conditionally target only the primary room.
3. The "➕ Persona Extra" action form in `ReservaDetalle.tsx` should be modified to make both the `concepto` and `monto` inputs fully editable, pre-filling `concepto` based on nights, and submitting a payload of `{ monto, concepto, tipo: 'debito', metodo_pago: null, referencia: '' }`.

---

## 5. Verification Method
- **Run Tests**: Execute `npm test -- --run` to ensure all 86 unit and integration tests continue to pass.
- **Inspect Files**: Check `src/pages/NuevaReserva.tsx`, `src/pages/ReservaDetalle.tsx`, and `server/utils/calculations.js` to verify their implementations against this report's before/after blocks.
