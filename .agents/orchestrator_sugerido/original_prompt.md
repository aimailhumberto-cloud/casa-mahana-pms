## 2026-05-21T13:23:58Z

Implement an automated guest room recommendation engine ("El Sugerido") in the public booking widget, support online per-person "Pasadías" (day pass) reservations, fix weekday/weekend rate calculation timezone shifts, and ensure proper cart state management upon navigation fallbacks.

Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms
Integrity mode: development

## Requirements

### R1. Auto-Recomendación Inteligente de Habitaciones ("El Sugerido")
- **Optimal Room Allocation**: When a user searches for availability in `BookingWidget.tsx` (Step 1) with `A` adults, `M` minors, and `P` pets, the widget must run an algorithm that suggests a combination of available rooms that accommodates everyone using the **minimum number of rooms possible** (to maximize occupancy and average revenue per room).
- **Physical Capacity & Constraints**:
  - The combination must respect each room's physical capacity: `capacidad_min <= (adults + minors) <= capacidad_max`.
  - Every suggested room must have at least 1 adult (`adults >= 1`).
  - Pets must be distributed correctly based on room type rules (e.g., Camping allows pets, others may allow them too).
  - To achieve the minimum room count, the algorithm should prioritize high-capacity rooms first (e.g., Familiar (cap 6), Doble (cap 4), Estándar (cap 3), Camping (cap 2)).
- **UI/UX Integration**:
  - Present this recommended combination prominently at the top of Step 2 (Habitaciones) as "Nuestra Recomendación Inteligente (El Sugerido)".
  - Provide a one-click button: **"Aceptar Sugerido y Continuar"**.
  - Clicking this button must:
    1. Populate the `cart` with the recommended rooms.
    2. Auto-distribute the adults, minors, and pets into each room as computed by the algorithm.
    3. Navigate the guest directly to Step 4 (Summary & Guest Info), completely bypassing Step 2 (Manual selection) and Step 3 (Manual guest distribution console).
  - Guests can still choose to decline or ignore "El Sugerido" and manually select rooms and distribute guests as they did previously.

### R2. Reservas de Pasadías en Línea para Clientes
- **Separate Search Tab**: Add a clean toggle or tab at the top of Step 1: **🏨 Estadía (Overnight)** vs **☀️ Pasadía (Day Pass)**.
  - Under "Pasadía", the date selection shows a single date input (Check-in = Check-out, nights = 0).
  - Guest selector label changes from "Adultos" to "Personas".
- **Backend Category Filter**:
  - The backend endpoint `/api/v1/public/disponibilidad` must accept a category query param or handle it dynamically. If searching for Pasadía, it must filter rooms where `categoria = 'Pasadía'` (e.g. Bohíos, Salón, Restaurante).
  - The endpoint should check conflicts for that single date (where reservations occupy the room on that day).
- **Per-Person Pricing**:
  - For Pasadía bookings, rates are priced strictly **per person** (rather than per night).
  - The reservation total calculation for a Pasadía plan (e.g., `pasadia_entrada`, `pasadia_comidas`) must calculate:
    `Total = (adults * precio_adulto) + (minors * precio_menor) + (pets * precio_mascota)`.
  - In `BookingWidget.tsx`, the UI must display prices with "/persona" instead of "/noche" when booking a Pasadía.

### R3. Corrección Matemática de Tarifas (Timezone-Proof)
- **Zero Timezone Offsets**: Refactor date breakdown and weekday vs weekend calculations in both `server/utils/calculations.js` and `BookingWidget.tsx` to use strictly **UTC-based Date methods** (`Date.UTC()`, `getUTCDate()`, `setUTCDate()`, `getUTCDay()`).
- **Mixed-Tariff Reservations**: Verify that reservations spanning both weekdays (entre_semana) and weekends (fin_de_semana) calculate the price correctly for each specific night without any day-shifting or timezone discrepancies.

### R4. Gestión de Estado y Reinicio de Carrito
- **Cleanup on Back Action**: If the guest returns to Step 1 (e.g., clicking "Cambiar fechas" or going backward) or changes the dates/search criteria, the widget must automatically clear the shopping `cart` state. This prevents invalid room selections and stale totals from carrying over to a new search.

---

## Acceptance Criteria

### Auto-Recomendación ("El Sugerido")
- [ ] If a group of 6 adults searches, the engine automatically recommends 1 Familiar room (capacity 6) rather than 2 Dobles or a combination of Doble + Estándar, as 1 room is the absolute minimum.
- [ ] Clicking "Aceptar Sugerido" fills the cart, sets guest distribution correctly, and redirects directly to the guest information summary (Step 4), skipping manual steps.

### Pasadías
- [ ] Toggling "Pasadía" updates the search layout to a single date selector and searches only rooms with `categoria = 'Pasadía'`.
- [ ] Pasadía total price represents `(adults * precio_adulto) + (minors * precio_menor) + (pets * precio_mascota)`. Prices are displayed as `/persona`.

### Date & Rate Calculations
- [ ] All date-related day-type checks (dias_festivos, fin_de_semana, entre_semana) are immune to timezone offsets and work identically across local, UTC, and custom server timezones.
- [ ] Reservations spanning multiple days with mixed week/weekend rates are correctly priced and listed in the night breakdown.

### Cart Resets
- [ ] Back-navigation or changing date/guest search inputs completely resets the shopping cart.

---

## Verification Plan

### Automated Tests
- Run `npm test` to ensure vitest test suites pass cleanly.
- Add test assertions in `server/utils/calculations.test.js` verifying Pasadía per-person calculations and timezone-safe date math.

### Build Verification
- Execute `npm run build` to verify that all TypeScript types, React components, and build pipelines succeed without warnings or errors.
