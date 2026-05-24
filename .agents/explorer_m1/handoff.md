# Handoff Report — Explorer M1

## 1. Observation
- **Adult Calculation Logic**: In `server/utils/calculations.js`, line 52 to 61 and 163 to 172:
  ```javascript
  let precioAdulto = baseAdultosMonto;
  // Pasadía is per-person/entry, Estadía is per room/night
  if (categoria === 'Pasadía') {
    precioAdulto = baseAdultosMonto * adultos;
  }
  ```
  This indicates that for `Estadía` plans, `precioAdulto` acts as a flat room rate that ignores the number of adults in the room, whereas for `Pasadía` it multiplies by the number of adults.
- **Guest Inheritance**: In `src/pages/NuevaReserva.tsx`:
  - Lines 427-434 initialize rooms using:
    ```typescript
    adultos: curr[id]?.adultos || (prev.length === 0 ? form.adultos : 0),
    ```
    If `curr[id]?.adultos` is `0`, the falsy `||` evaluates back to the leader's form values.
  - Lines 1169-1175 fallback on render when the configuration is undefined:
    ```typescript
    const config = roomConfigs[roomId] || {
      ...
      adultos: form.adultos || 1,
      menores: form.menores || 0,
      mascotas: form.mascotas || 0,
      ...
    };
    ```
  - Lines 666-668 and 771-773 construct payloads and inherit values for any subsequent room:
    ```typescript
    adultos: config.adultos !== undefined ? Number(config.adultos) : Number(form.adultos),
    ```
- **Folio Summary and Payments**: In `src/pages/ReservaDetalle.tsx`, the Folio summary header is at lines 707-714, with the collapsible payments form toggle `showPago` at line 716. No quick-action button or form exists for registering an extra person. The `POST /hotel/reservas/:id/folio` endpoint accepts `monto`, `concepto`, and `tipo` ('debito' or 'credito') to append Folio ledger entries.
- **Tests Baseline**: Running `npm test` runs 73 tests inside 9 test files (using Vitest), all of which currently pass.

## 2. Logic Chain
- **For adult rate logic**: If a guest inputs 2 adults for an `Estadía` plan, the system currently charges the base night price once. To make it strictly per-person, `precioAdulto` must be computed as `baseAdultosMonto * adultos` for all categories.
- **For guest inheritance**: Subsequent rooms in a group booking must not inherit guest counts from the primary room. Therefore, the rendering configuration, toggle initialization, and submission payloads must check `index === 0` to apply primary form values, and fallback to `0` for subsequent rooms (`index > 0`). In addition, the falsy `||` in state toggle must be replaced by the nullish coalescing operator `??` to prevent resetting manually defined `0` values.
- **For "Persona Extra"**: Registering an extra person represents a charge, hence it requires a `debito` entry. Toggling a form that defaults `precioPorNoche` to `25` and `noches` to `reserva.noches`, calculating their product dynamically, and allowing text entry of the name satisfies the user requirement perfectly. This must be presented in a glassmorphic button and purple `bg-purple-50` collapsible card next to "Registrar Pago".
- **For test updates**: Because subtotals and totals are asserted across `server/utils/calculations.test.js` and `server/routes/group_bookings.test.js`, shifting adult calculations to per-person will alter stay subtotals, tourism taxes, master balances, and consolidated totals in these assertions. These must be updated in sync with the source file changes to prevent test breakages.

## 3. Caveats
- No other calculation files were found; all pricing logic flows through `server/utils/calculations.js`.
- It is assumed that $25/night is the only default value for extra persons and does not need to be loaded from a system configuration table.

## 4. Conclusion
The audit and exploration are complete. Concrete fix strategies and exact code diffs have been designed and documented inside `.agents/explorer_m1/analysis.md` for all targeted areas.

## 5. Verification Method
- Execute the test suite using `npm test` after the Implementer applies the changes.
- Ensure that the frontend page builds correctly under Vite with `npm run build`.
- Invalidation conditions: Any test failure or compiler error under Vite.

## 6. Remaining Work (For Implementer)
1. Modify `server/utils/calculations.js` to change adult rates to strictly `adultos * rate_per_night`.
2. Modify `src/pages/NuevaReserva.tsx` to fix React initialization, card fallbacks, and submission payloads for group rooms.
3. Modify `src/pages/ReservaDetalle.tsx` to implement the glassmorphic "➕ Persona Extra" button and collapsible form.
4. Update assertions in `server/utils/calculations.test.js` and `server/routes/group_bookings.test.js` to reflect new per-person pricing totals.
5. Run `npm test` to verify all tests pass cleanly.
