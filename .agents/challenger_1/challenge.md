# Adversarial Math Challenge Report

**Target File**: `server/utils/calculations.js`
**Target Test Suites**: `server/utils/calculations.test.js` and `server/utils/calculations.stress.test.js`
**Reviewer**: Math Challenger (`teamwork_preview_challenger`)

---

## Challenge Summary

**Overall risk assessment**: **HIGH**

Although the basic happy-path calculations for per-person stay rates are correct, the math engine contains severe logical discrepancies, lack of input validation, and a critical timezone-shifting vulnerability. Furthermore, the Vitest stress test suite is currently **broken** and fails to execute due to referencing non-exported helper functions.

---

## Challenges

### 🔴 [Critical] Challenge 1: Broken Stress Test Suite (`ReferenceError`)

- **Assumption challenged**: The test suite `calculations.stress.test.js` is fully executable and provides valid test coverage.
- **Attack scenario**: Running `npm test` fails and crashes during the execution of `calculations.stress.test.js` because it attempts to reference `parseDateToUTC`, which is a private helper inside `calculations.js` and is not exported.
  - Verbatim error from Vitest:
    ```
    FAIL  server/utils/calculations.stress.test.js > Stress Test Suite for calculations.js > Edge Case: Timezone/Day-Shifting & Date formats > parseDateToUTC causes day shifting if local Date object is used in a positive offset timezone
    ReferenceError: parseDateToUTC is not defined
     ❯ server/utils/calculations.stress.test.js:270:25
    ```
- **Blast radius**: The entire test suite cannot be completed successfully; CI/CD pipeline and local tests fail completely. This blocks automated testing of the math engine.
- **Mitigation**: Export `parseDateToUTC` in `calculations.js` (e.g. `module.exports = { ..., parseDateToUTC }`) or rewrite the stress tests to test timezone shifting indirectly via public functions like `calcNoches` or `getDayType`.

---

### 🟠 [High] Challenge 2: Timezone Shifts via Local Date Parsing

- **Assumption challenged**: Date parsing is perfectly timezone-proof and robust.
- **Attack scenario**:
  - `parseDateToUTC` falls back to `new Date(dateInput)` for slash-separated dates (like `'2026/05/22'`) or whenever `dateInput instanceof Date` is true.
  - This parses the date relative to the system's local timezone.
  - If the server runs in a positive timezone offset (e.g. UTC+10), the local date `2026-05-22 00:00:00` translates to `2026-05-21 14:00:00 UTC`.
  - The UTC components returned (`getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`) will be `2026-05-21`, shifting the reservation check-in date backward by one full day!
- **Blast radius**: Customers may be charged weekday rates instead of weekend rates (or vice versa), and room bookings could overlap or shift in unexpected ways, leading to overbooking or incorrect pricing.
- **Mitigation**: Standardize all date inputs to `YYYY-MM-DD` and use strict parsing (e.g., splitting by `-` or `/` and creating `Date.UTC(year, month - 1, day)`) instead of falling back to the local `new Date()` parser.

---

### 🟡 [Medium] Challenge 3: Inconsistent 0-Adult Validation

- **Assumption challenged**: Both pricing engines (`calcReservation` and `calcReservationWithRates`) compute pricing consistently for identical inputs.
- **Attack scenario**:
  - `calcReservation` has a default guard: `const adultos = parseInt(data.adultos) || 1;` which forces 0 adults to 1.
  - `calcReservationWithRates` has no such guard: `const baseAdultosMonto = adultos * pAdulto;` which allows 0 adults and charges $0 for base adults.
- **Blast radius**: A reservation with 0 adults could be created via `calcReservationWithRates` under dynamic booking, while being calculated as 1 adult in `calcReservation`, resulting in billing discrepancies and illogical booking states.
- **Mitigation**: Unify the inputs validation so both engines handle guest counts identically (e.g. enforcing minimum 1 adult or consistently allowing 0).

---

### 🟡 [Medium] Challenge 4: Missing Input Validation for Negative and Non-Numeric Quantities

- **Assumption challenged**: The math engine is robust against invalid user inputs.
- **Attack scenario**:
  - If negative guests (e.g., `-2` adults, `-1` minor), negative nights, or negative prices are passed, the engine calculates a negative subtotal and total (e.g. -$810).
  - If non-numeric strings are passed to `calcReservationWithRates` (e.g., `'abc'` adults), it results in `NaN` values for the subtotal and total without throwing any error.
- **Blast radius**: Financial exploitation (negative pricing tricks) and downstream database insert/update errors when encountering `NaN` values.
- **Mitigation**: Sanitize all numeric inputs by wrapping them in `Math.max(0, ...)` and defaulting any `NaN` values to standard fallbacks.

---

## Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Pass / Fail |
|---|---|---|---|
| **0 adults input in `calcReservation`** | Falls back to 1 adult | Falls back to 1 adult | **PASS** |
| **0 adults input in `calcReservationWithRates`** | Falls back to 1 adult | Allows 0 adults ($0 base rate) | **FAIL (Discrepancy)** |
| **Negative guests/nights/prices** | Validation or boundary limits ($\ge 0$) | Computes negative totals | **FAIL (Vulnerability)** |
| **Non-numeric guest counts** | Fallback to default (1 or 0) | Computes `NaN` totals | **FAIL (Vulnerability)** |
| **Local Date object in positive timezone** | Timezone robustness | Shifts date by -1 day | **FAIL (Timezone Bug)** |
| **Slash-separated date '2026/05/22'** | Timezone robustness | Shifts date depending on local timezone | **FAIL (Timezone Bug)** |

---

## Unchallenged Areas

- **Impuesto and Depósito Percentages logic** — Reason not challenged: Out of scope; these are verified to retrieve from configuration or plan properties correctly and scale subtotal properly.
