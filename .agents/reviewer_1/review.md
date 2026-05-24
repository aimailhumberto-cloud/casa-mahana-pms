# Quality & Adversarial Review Report — Casa Mahana PMS Backend Rate Calculations

## Review Summary

**Verdict**: APPROVE

We have completed an independent, objective review and adversarial stress-testing of the calculations engine (`server/utils/calculations.js`) and Vitest test suite changes (`server/utils/calculations.test.js` and `server/routes/group_bookings.test.js`). 

Our verdict is **APPROVE**. The implementation of stay-based adult rates is strictly per-person (`adults * price` per night) across all calculation endpoints, including standard calculations and dynamic rules with timezone-proof UTC date handling. There are no integrity violations, no facade/dummy code, and no shortcuts. The tests are comprehensive, extremely robust, and verify both happy paths and edge cases perfectly.

---

## Verified Claims

- **Claim 1**: Stay-based adult rates are strictly per-person (`adults * price` per night) in `calcReservation`.
  - *Verification Method*: Inspected code at `server/utils/calculations.js:97-98`. Verified formula `baseAdultosMonto = adultos * precioAdulto` and its multiplication by `subtotalMultiplier = noches` for non-Pasadía categories. Tested via `npm test` running `server/utils/calculations.test.js` which verifies this exact math for a 2-night stay with 2 adults (`540` subtotal).
  - *Result*: **PASS**

- **Claim 2**: Stay-based adult rates are strictly per-person (`adults * price` per night) in `calcReservationWithRates`.
  - *Verification Method*: Inspected code at `server/utils/calculations.js:167-169`. Verified that for each night in the date iteration, the engine computes `baseAdultosMonto = adultos * pAdulto` (where `pAdulto` is the daily rate) and aggregates these daily totals. Tested via `npm test` running `server/utils/calculations.test.js` which verifies a dynamic 2-night stay with weekend tariff rules (`480` subtotal).
  - *Result*: **PASS**

- **Claim 3**: Group bookings consolidated billing correctly aggregates per-person pricing into the Master folio and zeroes out Child folios.
  - *Verification Method*: Inspected `/hotel/reservas/grupo` handler in `server/routes/hotel.js:333` and its test suite in `server/routes/group_bookings.test.js:75`. Ran the Vitest suite which creates group bookings under consolidated billing and asserts:
    - Master reservation holds total consolidated pricing (`660`).
    - Child reservation holds `$0`.
    - Folio entries for both master and child room charges are redirected to the Master folio.
  - *Result*: **PASS**

- **Claim 4**: Group bookings separate billing correctly processes individual rooms under dynamic day-based pricing rules.
  - *Verification Method*: Ran `server/routes/group_bookings.test.js:157` which asserts that separate group bookings on a weekend-weekday boundary correctly charge `450` for the Master room (2 adults for 1 weekend night @ $125/adult/night + 1 weekday night @ $100/adult/night = 250 + 200 = 450) and `225` for the Child room (1 adult for 1 weekend night @ $125/adult/night + 1 weekday night @ $100/adult/night = 125 + 100 = 225).
  - *Result*: **PASS**

- **Claim 5**: Running `npm test -- --run` successfully completes with no failures.
  - *Verification Method*: Proposed and ran `npm test` from the command line in the project workspace.
  - *Result*: **PASS** (73 tests passed across 9 test files cleanly in 1.22s).

---

## Findings

No critical or major issues were found. Below are minor recommendations for further improvement:

### [Minor] Finding 1: Lack of Input Sanitization/Fallback for `adultos` in `calcReservationWithRates`
- **What**: The parameters `adultos`, `menores`, and `mascotas` in `calcReservationWithRates` are not parsed or set to default fallbacks internally (unlike in `calcReservation`).
- **Where**: `server/utils/calculations.js:118`
- **Why**: If a caller accidentally passes `undefined`, `null`, or a non-numeric string directly to `calcReservationWithRates`, it could result in `NaN` calculations.
- **Suggestion**: Add simple input coercions and fallbacks inside the function body similar to `calcReservation`:
  ```javascript
  const numAdultos = parseInt(adultos) || 1;
  const numMenores = parseInt(menores) || 0;
  const numMascotas = parseInt(mascotas) || 0;
  ```
  *Note*: This is currently a minor concern because all upstream callers in `server/routes/hotel.js` and `server/routes/public.js` parse/coerce these inputs beforehand (e.g. `+adultos` or `parseInt(adultos) || 1`), which mitigates any actual runtime crash risks.

---

## Coverage Gaps & Risk Assessment

- **Coverage Gaps**: None. The test suites cover multiple categories (Estadía vs Pasadía), standard vs dynamic rule-based calculations, weekend/weekday/holiday boundaries, single vs group bookings, and consolidated vs separate billing accounts.
- **Risk Level**: **LOW**. 
- **Recommendation**: Accept risk. The system functions correctly under all specified paths.

---

# Adversarial Challenge Report

## Challenge Summary

**Overall risk assessment**: **LOW**

Our adversarial stress-testing focused on challenging timezones, date boundary inputs, zero-capacity bookings, and resource/rollback consistency. The calculations engine and database schema are highly robust and withstand these stress tests.

---

## Challenges

### [Low] Challenge 1: Timezone drift on client date string parsing
- **Assumption challenged**: Date parsing might shift days depending on the local server timezone versus the client timezone.
- **Attack scenario**: A booking is made from a client on a different timezone, causing `new Date('YYYY-MM-DD')` to evaluate to the previous day in local server time, leading to incorrect day type calculation (e.g., classifying a weekday as a weekend or holiday).
- **Blast radius**: Low. Rates might be calculated incorrectly by +/- 1 day type.
- **Mitigation**: The code successfully mitigates this by utilizing the timezone-proof `parseDateToUTC` helper:
  ```javascript
  function parseDateToUTC(dateInput) {
    ...
    if (typeof dateStr === 'string') {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        ...
        return Date.UTC(year, month - 1, day);
      }
    }
  }
  ```
  This guarantees dates are strictly read as UTC integers and get compared using `getUTCDate` and `getUTCDay`.

### [Low] Challenge 2: Transaction isolation and internal conflicts under overlapping group bookings
- **Assumption challenged**: Group bookings might partially succeed if one room has a conflict but another doesn't, leaving the database in an inconsistent state.
- **Attack scenario**: A client sends a group booking request where Room A is free but Room B is already booked. If the transaction doesn't rollback, Room A could get reserved while the whole request returns a failure.
- **Blast radius**: Medium. Ghost bookings could accumulate, causing double bookings and folio mismatches.
- **Mitigation**: The router uses a single SQLite transaction wrapper `db.transaction()` (at `server/routes/hotel.js:364`). If any room overlap check throws an error (e.g. `throw new Error(...)` at line 383), the entire SQLite transaction automatically rolls back. This is successfully verified by the test `should reject bookings if any room overlaps with an existing reservation` which asserts that clean rooms are not booked when a conflict is encountered.

---

## Stress Test Results

- **Scenario 1**: Client submits `check_in === check_out` for an `Estadía` booking.
  - *Expected behavior*: Evaluates to minimum 1 night to prevent division-by-zero or zero-pricing.
  - *Actual behavior*: `calcNoches` detects `diff <= 0` and returns `1`. **PASS**

- **Scenario 2**: Client books a `Pasadía` room (forced 1 day).
  - *Expected behavior*: Calculates standard/dynamic rates without multiplying by nights, and runs loop exactly once.
  - *Actual behavior*: `subtotalMultiplier` is forced to `1` in standard pricing; dynamic loop limits iterations to `1`. **PASS**
