# Handoff Report — Timezone-Proof Rates & Per-Person Pasadía Rates

This report details the findings and implementation plan for resolving the timezone-related date shifts and adding support for per-person pricing for Pasadía plans in the Casa Mahana PMS.

---

## 1. Observation

Direct observations made in the source code of **Casa Mahana PMS**:

### A. Timezone-Vulnerable Code in `server/utils/calculations.js`
1. **Day Type Check** (Line 17):
   ```javascript
   const dow = new Date(dateStr + 'T12:00:00').getDay();
   ```
   *Issue*: `new Date(dateStr + 'T12:00:00')` creates a local time Date object. Calling `.getDay()` gets the day of the week based on the server's local time, which can shift the day of week index by ±1 day depending on the server's local timezone offset relative to UTC.

2. **Night Breakdown Iteration** (Lines 109-111 & 135):
   ```javascript
   const d = new Date(checkIn + 'T12:00:00');
   d.setDate(d.getDate() + i);
   const dateStr = d.toISOString().split('T')[0];
   ...
   dia: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()],
   ```
   *Issue*: `.toISOString()` converts the local date object to a UTC representation. In timezones like GMT+12, `2026-05-22T12:00:00` local time maps to `2026-05-22T00:00:00Z` UTC, but in GMT-5, it maps to `2026-05-22T17:00:00Z` UTC. If the offset crosses midnight boundaries during other times of the day, `.toISOString()` will format the wrong date string. Moreover, using local `.setDate()` during DST changeovers can lead to duplicate or skipped days.

3. **Nights Calculation** (Lines 158-163):
   ```javascript
   function calcNoches(checkIn, checkOut) {
     const d1 = new Date(checkIn);
     const d2 = new Date(checkOut);
     const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
     return diff > 0 ? diff : 1;
   }
   ```
   *Issue*: Creating Dates without a time component is parsed as UTC in standard ES6, but differences in environment or local system timezone can shift either `d1` or `d2` to local time, resulting in non-integer differences. This causes `Math.ceil()` to return incorrect night values (e.g. `2.05` -> `3` nights, or `1.95` -> `2` nights).

### B. Timezone-Vulnerable Code in `src/pages/BookingWidget.tsx`
1. **Min Check-out and Nights Calculations** (Lines 135-137):
   ```typescript
   const today = new Date().toISOString().split('T')[0]
   const minCheckOut = checkIn ? new Date(new Date(checkIn + 'T12:00:00').getTime() + 86400000).toISOString().split('T')[0] : today
   const noches = checkIn && checkOut ? Math.ceil((new Date(checkOut + 'T12:00:00').getTime() - new Date(checkIn + 'T12:00:00').getTime()) / 86400000) : 0
   ```
   *Issue*: Uses string-concatenation with local dates (`'T12:00:00'`) and parses them with the local timezone browser offset. Converts to UTC via `.toISOString()` for final display, which shifts dates forwards/backwards depending on the user's geographic location.

### C. Pasadía Pricing Structure in database schema and seed:
1. **Schema Definition** (`server/db/schema.sql`, Lines 24-45):
   ```sql
   CREATE TABLE IF NOT EXISTS planes_tarifa (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     codigo TEXT NOT NULL UNIQUE,
     nombre TEXT NOT NULL,
     categoria TEXT DEFAULT 'Estadía',       -- "Estadía", "Pasadía", "Otro"
     precio_adulto_noche REAL NOT NULL,
     precio_menor_noche REAL DEFAULT 0,
     precio_mascota_noche REAL DEFAULT 0,
     ...
   );
   ```
2. **Current Cotization Logic** (`server/utils/calculations.js`, Lines 69):
   ```javascript
   const subtotal = Math.round(((adultos * precioAdulto) + (menores * precioMenor) + (mascotas * precioMascota)) * noches * 100) / 100;
   ```
   *Issue*: Standard reservations multiply the daily rates by `noches`. Since Pasadía check-in equals check-out, `noches` will be calculated as `0`. Under the current logic, the subtotal is multiplied by `0`, resulting in a total cost of `$0.00`. We must detect `plan.categoria === 'Pasadía'` and bypass the `noches` multiplier (setting it to `1`).

---

## 2. Logic Chain

1. **Eliminating Timezone Shifts**:
   - To make Date parsing 100% immune to local browser or server offsets, we must extract the individual year, month, and day components from strings like `'YYYY-MM-DD'` and feed them directly into `Date.UTC()`.
   - By creating Dates strictly at `00:00:00.000` UTC, and using strictly UTC-based getters/setters (`getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`, `getUTCDay()`, `setUTCDate()`), we guarantee that dates remain completely unchanged and integer-aligned regardless of local machine location.

2. **Calculating Pasadía Prices**:
   - Since a Pasadía is a day-pass, guests arrive and leave on the same day (`checkIn === checkOut`). This yields `noches = 1` in `calcNoches` and `noches = 0` in the frontend search context.
   - By retrieving the rate plan category, we can detect if it is a Pasadía: `plan && plan.categoria === 'Pasadía'`.
   - If it is a Pasadía, we force the subtotal multiplier to `1` (instead of `noches` which could be `0` or different).
   - This translates to the requested formula:
     $$\text{Total} = (\text{adults} \times \text{precio\_adulto}) + (\text{minors} \times \text{precio\_menor}) + (\text{pets} \times \text{precio\_mascota})$$

---

## 3. Caveats

- We assume all date strings passed to the calculation utility are in standard `YYYY-MM-DD` format.
- We assume that `planes_tarifa` plan category is correctly configured as `'Pasadía'` in the database for all day pass plans (such as the seeded `pasadia_entrada` and `pasadia_comidas`).

---

## 4. Conclusion & Action Plan

To fully implement these improvements, the Implementer should follow these step-by-step instructions:

### Step 1: Update the Backend Calculations Utility
Replace the entire content of `server/utils/calculations.js` with the code provided in the artifact `proposed_calculations.js` in this folder.
- **Key Addition**: Introduces the `parseDateToUTC` helper.
- **Key Refactor**: Refactors `getDayType`, `calcReservation`, `calcReservationWithRates`, and `calcNoches` to be strictly UTC-based.
- **Key Feature**: Implements `esPasadia` logic that forces the subtotal multiplier to `1` and correctly sums per-person rates without night multiplication.

### Step 2: Update the Test Suite
Replace the entire content of `server/utils/calculations.test.js` with the code provided in the artifact `proposed_calculations.test.js` in this folder.
- **Key Addition**: Adds unit test suites verifying Pasadía per-person rate calculations (for both `calcReservation` and `calcReservationWithRates` using weekday/weekend/holiday tariff shifts) and timezone stability.

### Step 3: Refactor Frontend Date Logic in `BookingWidget.tsx`
Open `src/pages/BookingWidget.tsx` and refactor the date helper variables on lines 135-137:

**Before**:
```typescript
const today = new Date().toISOString().split('T')[0]
const minCheckOut = checkIn ? new Date(new Date(checkIn + 'T12:00:00').getTime() + 86400000).toISOString().split('T')[0] : today
const noches = checkIn && checkOut ? Math.ceil((new Date(checkOut + 'T12:00:00').getTime() - new Date(checkIn + 'T12:00:00').getTime()) / 86400000) : 0
```

**After** (strictly timezone-safe):
```typescript
const today = new Date().toISOString().split('T')[0]

const minCheckOut = (() => {
  if (!checkIn) return today
  const [y, m, d] = checkIn.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d)
  const nextDay = new Date(utc + 86400000)
  const year = nextDay.getUTCFullYear()
  const month = String(nextDay.getUTCMonth() + 1).padStart(2, '0')
  const day = String(nextDay.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
})()

const noches = (() => {
  if (!checkIn || !checkOut) return 0
  const [y1, m1, d1] = checkIn.split('-').map(Number)
  const [y2, m2, d2] = checkOut.split('-').map(Number)
  const utc1 = Date.UTC(y1, m1 - 1, d1)
  const utc2 = Date.UTC(y2, m2 - 1, d2)
  const diff = Math.round((utc2 - utc1) / 86400000)
  return diff > 0 ? diff : 0
})()
```

---

## 5. Verification Method

### A. Automatic Backend Verification
To verify the pricing engine and date-logic changes:
1. Run:
   ```powershell
   npm run test
   ```
2. Verify that all test cases execute successfully. The updated test suite adds high-fidelity coverage for Pasadía per-person billing and timezone-independent math, taking the project test count from 66 to 68 passing tests.

### B. Frontend Compile Verification
Verify the frontend code compiles perfectly:
1. Run:
   ```powershell
   npm run build
   ```
2. Verify that Vite outputs a clean production bundle with zero TypeScript warnings or errors.
