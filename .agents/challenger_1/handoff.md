# Handoff Report

## 1. Observation

- **Exact File Paths**:
  - Implementation File: `server/utils/calculations.js`
  - Test Suite 1: `server/utils/calculations.test.js`
  - Test Suite 2: `server/utils/calculations.stress.test.js`
  - Report File: `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_1\challenge.md`
- **Tool Commands & Verbatim Test Errors**:
  Command executed: `npm test`
  Output from test suite:
  ```
  FAIL  server/utils/calculations.stress.test.js > Stress Test Suite for calculations.js > Edge Case: Timezone/Day-Shifting & Date formats > parseDateToUTC causes day shifting if local Date object is used in a positive offset timezone
  ReferenceError: parseDateToUTC is not defined
   ❯ server/utils/calculations.stress.test.js:270:25
      268|       const d = new Date(Date.UTC(2026, 4, 21, 14, 0, 0)); // represen…
      269|       // If this Date is passed to parseDateToUTC:
      270|       const timestamp = parseDateToUTC(d);
         |                         ^
      271|       // It returns Date.UTC(2026, 4, 21), which represents 2026-05-21.
  ```
- **Code Observations in `server/utils/calculations.js`**:
  - `parseDateToUTC` (line 10) is a helper function that parses date inputs. It is **not** exported in `module.exports` (line 207).
  - In `calcReservation` (line 55):
    `const adultos = parseInt(data.adultos) || 1;`
  - In `calcReservationWithRates` (line 167):
    `const baseAdultosMonto = adultos * pAdulto;` (no default fallback or minimum check for adults is done here).
  - In `parseDateToUTC` (line 26):
    `const d = new Date(dateInput);`
    `return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());`
    This fallback parses local time and then extracts UTC components, which changes the day in positive timezone offsets.

---

## 2. Logic Chain

- **Step 1**: The stress test suite `calculations.stress.test.js` calls `parseDateToUTC(d)` directly at line 270. However, `calculations.js` does not include `parseDateToUTC` in its `module.exports`. Therefore, running the tests throws a `ReferenceError` and halts the test run.
- **Step 2**: In `calculations.js`, the standard reservation pricing uses `parseInt(data.adultos) || 1` (forcing 0 adults to 1) while the day-based rates pricing does not use a guard, directly doing `adultos * pAdulto` (allowing 0 adults). This creates an inconsistency where identical reservation inputs yield different pricing depending on which function is invoked.
- **Step 3**: `parseDateToUTC` has a fallback execution of `new Date(dateInput)` when parsing non-standard strings (like `'2026/05/22'`) or local Date objects. In positive timezone offsets (like UTC+10), parsing `new Date('2026/05/22')` yields local 2026-05-22 00:00:00, which is UTC 2026-05-21 14:00:00. Extracting the UTC date component returns `21` instead of `22`, thereby shifting the booking start date back by 1 day.
- **Step 4**: The pricing calculation logic accepts any numeric inputs without range validation. This permits negative guest counts (`-2`), negative nights (`-3`), or negative rates, producing negative totals (e.g. subtotal of -$810). Additionally, passing string values like `'invalid'` results in a subtotal of `NaN` without any error throwing.

---

## 3. Caveats

- **Timezone Testing Scope**: The timezone day-shifting behavior was verified through code inspection and simulated test logic. The system timezone during the execution of this agent run is UTC-5 (`-05:00`), so the day shift was not directly observed on this host, but is mathematically guaranteed to happen in positive offset timezones (e.g. UTC+1 to UTC+14) under the current fallback parsing logic.
- **Implementation Code Constraints**: Per the system guidelines, I have strictly operated in review-only mode and have not made any modifications to `calculations.js` or `calculations.stress.test.js`.

---

## 4. Conclusion

The mathematical engine in `server/utils/calculations.js` is **not** perfectly timezone-proof or robust against adversarial inputs.
- The `calculations.stress.test.js` suite is currently **broken** and fails the entire build pipeline due to a `ReferenceError`.
- Date calculations suffer from timezone day-shifting bugs when parsing non-ISO strings or native Date objects.
- Inconsistent validations permit $0 pricing for 0 adults in rate-based calculations while blocking it in standard calculations.
- Lack of range and type validation allows negative pricing exploits and `NaN` leakage.

Actionable solutions are documented in detail inside the challenge report at `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_1\challenge.md`.

---

## 5. Verification Method

To verify these findings:
1. Run `npm test` in `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms`.
   - **Expected Result**: The test suite fails and throws:
     `ReferenceError: parseDateToUTC is not defined`
2. Inspect the exported module list in `server/utils/calculations.js` lines 207-214:
   - **Expected Result**: `parseDateToUTC` is missing from `module.exports`.
3. Inspect `server/utils/calculations.js` lines 55 and 167:
   - **Expected Result**: Line 55 uses `|| 1` fallback, line 167 does not, demonstrating the adult validation discrepancy.
