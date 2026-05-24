# Handoff Report

## 1. Observation

Direct observations made during the review of the Casa Mahana PMS frontend and backend:

### A. Persona Extra Validation Bypass & UX (in `C:\Users\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\src\\pages\\ReservaDetalle.tsx`):
1. **Mathematical Bypass**:
   ```typescript
   333:     const totalAmount = parseFloat(personaExtraForm.precioPorNoche) * parseInt(personaExtraForm.noches);
   ...
   338:     if (totalAmount <= 0) {
   339:       alert("El monto total debe ser mayor a 0.");
   340:       return;
   341:     }
   ```
2. **Page Loading Flash on Folio Reload**:
   ```typescript
   157:   const load = () => {
   158:     setLoading(true);
   ...
   461:   if (loading) return <div className="animate-pulse text-gray-400 p-8">Cargando...</div>;
   ```
   Calling `load()` sets `loading` to `true`, causing the entire page component to render the skeleton and flash while fetching.

### B. Group Booking Guest Count Leakage & Validation Lack (in `C:\Users\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\src\\pages\\NuevaReserva.tsx`):
1. **Guest Count Initialization on Toggle**:
   ```typescript
   429:             adultos: curr[id]?.adultos ?? (prev.length === 0 ? form.adultos : 0),
   430:             menores: curr[id]?.menores ?? (prev.length === 0 ? form.menores : 0),
   431:             mascotas: curr[id]?.mascotas ?? (prev.length === 0 ? form.mascotas : 0),
   ```
   Room configs initialized to 0 if they are subsequent rooms (when `prev.length > 0`). If the first room (leader) is deselected, subsequent rooms remain at 0, and re-selecting the first room also gets initialized to 0 because `prev.length > 0`.
2. **`canSubmit` lack of distribution validation**:
   ```typescript
   623:   const canSubmit = form.cliente && form.apellido && form.whatsapp && form.check_in && form.check_out && !dateError && !pastDateError
   624:     && (isGroup ? selectedGroupRooms.length > 0 : (form.plan_codigo && hasUnit && selectedRoomAvailable && !capacityError));
   ```
   Frontend `canSubmit` permits submission even if guest counts are out-of-sync or completely 0.

### C. Backend Coercion & Recalculation Discrepancies (in `C:\Users\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\server\\routes\\hotel.js`):
1. **Coercing 0 Adults to 1**:
   ```javascript
   428:           adultos: parseInt(adultos) || 1,
   ```
   When the frontend submits `0` adults, the backend forces it to `1`. In non-consolidated billing, this triggers price recalculations with 1 adult, differing from the frontend quote of `$0` or empty config.

### D. Broken Test Suite due to Unexported Helper (in `C:\Users\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\server\\utils\\calculations.stress.test.js` & `calculations.js`):
1. Running `npm test` yields:
   ```
   FAIL  server/utils/calculations.stress.test.js > Stress Test Suite for calculations.js > Edge Case: Timezone/Day-Shifting & Date formats > parseDateToUTC causes day shifting if local Date object is used in a positive offset timezone
   ReferenceError: parseDateToUTC is not defined
   ```
   This is because `parseDateToUTC` is called directly in the stress tests but is never exported in `server/utils/calculations.js` (see lines 207-214) or imported in `calculations.stress.test.js`.

---

## 2. Logic Chain

1. **Math Bypass Logic**: Since standard HTML5 numeric inputs (`min="0"`) can be bypassed by pasting or typing, receptionists can enter negative numbers. If both `precioPorNoche` and `noches` are negative (e.g. `-25` and `-2`), their product is positive (`50`). Because the frontend only checks the product (`totalAmount <= 0`), the check evaluates to `50 <= 0` (false), allowing the form to submit a positive charge of `$50.00` with negative components in the description.
2. **Guest Count Leakage Logic**: When a user unselects the original leader room in a group booking, the remaining room (which was initialized with `0` guests because it was added second) does not get updated to inherit the primary configuration. If they check the original leader room again, it also gets initialized with `0` guests. This allows the total assigned counts to remain `0` while `canSubmit` is true.
3. **Database & Quoting Discrepancy**: Because the frontend allows submitting `0` guest counts, the payload is sent as `0`. The backend intercepts `0` and falls back to `1` adult (`parseInt(adultos) || 1`). For separate billing groups, the backend recalculates pricing for `1` adult, resulting in a higher total charge than what was quoted or displayed on the frontend.
4. **Test Failures**: Vitest executes the tests in `server/utils/calculations.stress.test.js`. When the test invokes `parseDateToUTC`, the JavaScript runtime throws a `ReferenceError` because the symbol is not in the scope of the test file, leading to 3 test failures.

---

## 3. Caveats

- **Network Restrictions**: Since we are operating in `CODE_ONLY` network mode, we did not perform integration checks targeting external webhooks or email delivery.
- **Mock DB State**: Tests were executed using the pre-configured SQLite databases which mock standard PMS state. Real-world performance under heavy production SQLite lock-ups was not verified.

---

## 4. Conclusion

The PMS codebase has a **HIGH** risk profile regarding booking consistency and folio integrity:
- Users can record invalid entries using negative values bypassing checks.
- Group bookings can easily be submitted with 0-guest counts resulting in inconsistent financial calculations and backend coercion discrepancies.
- The calculations stress test suite is broken due to a simple missing export in `calculations.js`.

---

## 5. Verification Method

To verify these findings:
1. **Broken Test Suite**: Run `npx vitest run server/utils/calculations.stress.test.js` from the workspace root. It will immediately fail with `ReferenceError: parseDateToUTC is not defined`.
2. **Double-Negative Bypass**: Review the `submitPersonaExtra` handler in `ReservaDetalle.tsx`. Enter a negative rate and negative nights. Multiply them to verify they yield a positive value that bypasses the `<= 0` check.
3. **Group Booking Leak**: Select two rooms, uncheck the first, re-check it, and observe that guest counts are permanently lost/leaked to 0 for all selected rooms, while the "Continuar" submit button remains active.
