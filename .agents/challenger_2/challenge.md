# Adversarial Challenge Report: Group Bookings & Persona Extra Folio Action

## Challenge Summary

**Overall risk assessment**: **HIGH**

This review has surfaced critical validation bypasses in the frontend "Persona Extra" folio quick action and major guest count inconsistencies in the Group Booking flow. If exploited or encountered in real-world scenarios, these can lead to corrupt folio histories (negative values bypassing checks), bookings with invalid guest counts (0 guests), and severe out-of-sync discrepancies between frontend quotes and backend database records.

---

## Challenges

### [High] Challenge 1: Mathematical Product Bypass for Negatives in "Persona Extra"

- **Assumption challenged**: Standard HTML5 numeric inputs (`min="0"`) combined with a product-based validation (`totalAmount <= 0`) are sufficient to block negative pricing or durations from being posted to the folio.
- **Attack scenario**: 
  - A user opens the "Persona Extra" quick-action form.
  - Using manual typing or clipboard pasting, the user enters a negative rate for `precioPorNoche` (e.g., `-25.00`) and a negative duration for `noches` (e.g., `-2`).
  - Upon submission, the frontend calculates `totalAmount = parseFloat("-25.00") * parseInt("-2") = 50.00`.
  - The validation check `if (totalAmount <= 0)` evaluates to `50.00 <= 0` which is **false**.
  - The check passes, and the charge is successfully posted to the API `/hotel/reservas/${id}/folio` as a positive debit charge of `$50.00`.
  - The resulting folio entry displays the description: `Persona Extra: [Name] (-2 noches x $-25/noche)`.
- **Blast radius**: Financial inconsistency and corrupted audit histories on reservation folios. It allows users/receptionists to bypass negative amount blocks by inputting double-negative values.
- **Mitigation**: Validate individual inputs instead of only checking their product. Enforce that each field is strictly greater than 0:
  ```typescript
  const rate = parseFloat(personaExtraForm.precioPorNoche);
  const nights = parseInt(personaExtraForm.noches);
  if (isNaN(rate) || rate <= 0) {
    alert("El precio por noche debe ser mayor a 0.");
    return;
  }
  if (isNaN(nights) || nights <= 0) {
    alert("Las noches deben ser mayor a 0.");
    return;
  }
  ```

### [High] Challenge 2: Group Booking Guest Count Leakage & Zero-Guest Booking Submission

- **Assumption challenged**: Toggling checkboxes in `NuevaReserva.tsx` handles guest allocation securely, and that a reservation cannot be submitted with an invalid/zero count of guests.
- **Attack scenario**:
  - The user enters 2 adults, 1 minor, and 1 pet in the primary search configuration.
  - The user toggles "Is Group Booking" to **true**.
  - The user clicks Room A (first selected room). `roomConfigs[Room A]` gets initialized with the leader config: 2 adults, 1 minor, 1 pet.
  - The user clicks Room B (second selected room). `roomConfigs[Room B]` gets initialized with 0 adults, 0 minors, 0 pets.
  - The user unchecks Room A. Now Room B is the only selected room in `selectedGroupRooms`. However, since Room B was added second, its count remains `0` adults, `0` minors, `0` pets.
  - The user checks Room A again. Since `prev.length` (which was `[Room B]`) is 1, Room A is now treated as a subsequent room and is initialized with `0` adults, `0` minors, `0` pets.
  - The UI now shows `Assigned: 0/2 Adults, 0/1 Minors, 0/1 Pets`.
  - The frontend validation `canSubmit` only checks `selectedGroupRooms.length > 0` for groups. It does **not** check `allAssignedMatch` or if any room has at least 1 guest.
  - The user submits the booking. The payload is sent with `0` guests for all rooms.
  - The backend `/hotel/reservas/grupo` handler intercepts the `0` adults and forces it to `1` adult (`adultos: parseInt(adultos) || 1`).
  - However, this backend coercion creates an immediate divergence:
    1. For **consolidated billing**, child reservations are stored as `$0` subtotals, which means a reservation record is created in the database with `1` adult but a cost of `$0` (the frontend quote sent `$0`).
    2. For **separate billing**, the backend recalculates `_realTotals` with `1` adult, resulting in the user being charged for guests they did not expect based on the frontend quote.
- **Blast radius**: Out-of-sync financial states, database records containing reservations with 0/1 adult inconsistencies, and bypassing capacity controls.
- **Mitigation**:
  - Block submission in `NuevaReserva.tsx` if `allAssignedMatch` is false.
  - Ensure that the current "leader" room (always the first element in `selectedGroupRooms`) is dynamically updated to inherit the primary search guest count if the original leader room is unchecked.
  - Enforce backend validation in `/hotel/reservas/grupo` rejecting reservations with `0` adults with a `400 Bad Request`.

### [Medium] Challenge 3: Lack of Input Sanitization for Name in "Persona Extra"

- **Assumption challenged**: Guest names entered via the folio action form do not need validation since they are rendered via React which auto-escapes JSX.
- **Attack scenario**: A user inputs an arbitrary payload in the guest name input field, such as `<script>alert(1)</script>` or special SQL symbols. While React prevents direct HTML injection on the DOM, this unsanitized string is written directly to the database and could cause issues in non-React components (e.g., CSV exports, plain text emails, admin log consoles, PDF invoice generators, or database search queries).
- **Blast radius**: Potential stored XSS or data corruption depending on downstream systems consuming the database records.
- **Mitigation**: Apply a regex validation to `personaExtraForm.nombre` allowing only alphabetic characters, spaces, and standard accents/hyphens:
  ```typescript
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/;
  if (!nameRegex.test(personaExtraForm.nombre.trim())) {
    alert("El nombre de la persona extra contiene caracteres inválidos.");
    return;
  }
  ```

### [Low] Challenge 4: Jarring Page Flash (Loading Skeleton) on Folio Reload

- **Assumption challenged**: Calling the general `load()` function is a smooth way to reload data after adding a charge.
- **Attack scenario**: On successful submission of a "Persona Extra", the form closes and `load()` is executed. Because `load()` sets `setLoading(true)`, the entire detail page is replaced by a loading skeleton (`animate-pulse`). Once the GET request is resolved, the entire page mounts again. This creates a very jarring flicker/flash of the UI.
- **Blast radius**: Disruptive user experience.
- **Mitigation**: Refactor the loading state of `load()` to support a silent background update (e.g. `load(true)` which skips `setLoading(true)` but still updates the `reserva` state).

---

## Stress Test Results

| Scenario | Expected Behavior | Actual Behavior | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **Empty name in "Persona Extra"** | Rejects submission with alert message | Rejects submission with alert message | **PASS** |
| **Negative rate & positive nights** | Rejects submission (total <= 0) | Rejects submission with alert message | **PASS** |
| **Positive rate & negative nights** | Rejects submission (total <= 0) | Rejects submission with alert message | **PASS** |
| **Double-Negative rate and nights** | Rejects submission due to invalid components | Bypasses validation and submits positive debit charge | **FAIL** |
| **Decimal nights (e.g. 1.5)** | Truncates to integer or rejects decimal | Truncates to integer using `parseInt` | **PASS** (with caveats) |
| **Group room uncheck and re-check** | Recalculates guest assignment accurately | Leaks counts, initializes re-checked rooms to 0 | **FAIL** |
| **Submit 0 guests in group booking** | Rejects submission on frontend or backend | Submits successfully; backend coerces adults to 1, causing pricing mismatch | **FAIL** |
| **Immediate reload of folio balance** | Reloads balances upon successful charge registration | Triggers `load()`, which fetches fresh data but flashes loading skeleton | **PASS** (poor UX) |

---

## Unchallenged Areas

- **Payment Gateway Integration** — The system uses manual cash/transfer registry which is fully mocked or records manually; no live payment processor was challenged.
- **Session Timeout Concurrency** — Concurrency during session expiration while performing a group reservation booking was not evaluated.
