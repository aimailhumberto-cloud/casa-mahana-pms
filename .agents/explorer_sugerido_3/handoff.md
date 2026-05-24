# Handoff Report — Explorer 3 (Public Booking Widget & calculations)

This report details the read-only discovery, system constraints, exact logic design, and step-by-step implementation strategy for **"El Sugerido" Room Recommendation Engine**, **Pasadías (Day Pass) Flow**, **Cart Cleanup**, and the **Timezone-Proof UTC Math** refactor.

---

## 1. Observation

### A. Booking Wizard & Cart State
- **File Path**: `src/pages/BookingWidget.tsx`
  - Wizard steps are managed via local React state `const [step, setStep] = useState(1)` (line 74).
  - Cart is an array of `CartItem` elements managed by `const [cart, setCart] = useState<CartItem[]>([])` (line 97).
  - Step 3 guest allocation console (line 647) lets guests distribute themselves manually into chosen rooms. The total guest counts (`adultos`, `menores`, `mascotas`) are defined in state variables `adultosBuscados`, `menoresBuscados`, `mascotasBuscadas` from the search criteria.

### B. Backend Availability & Booking Creation
- **File Path**: `server/routes/public.js`
  - `/disponibilidad` (line 42) checks rooms with `categoria = 'Estadía'` strictly:
    ```javascript
    const rooms = db.prepare("SELECT id, tipo, categoria, capacidad_min, capacidad_max FROM habitaciones WHERE activa = 1 AND categoria = 'Estadía'").all();
    ```
  - Room conflicts are fetched using date range checks (line 51):
    ```javascript
    const conflicts = db.prepare(`
      SELECT habitacion_id FROM reservas_hotel
      WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
        AND check_in < ? AND check_out > ?
    `).all(check_out, check_in).map(r => r.habitacion_id);
    ```
  - Validation at line 46 throws an error if `check_out <= check_in`:
    ```javascript
    if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'check_out debe ser posterior a check_in');
    ```
  - Similar validation exists in `/reservar` (line 190) and `/reservas/multi` (line 363).

### C. Rate & Date Calculations
- **File Path**: `server/utils/calculations.js`
  - Night count at line 158 is calculated using local `new Date(...)` parsing, which is prone to local timezone drift depending on the server or browser's host timezone:
    ```javascript
    function calcNoches(checkIn, checkOut) {
      const d1 = new Date(checkIn);
      const d2 = new Date(checkOut);
      const diff = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
      return diff > 0 ? diff : 1;
    }
    ```
  - Day type (`getDayType`, line 11) also parses via local timezone:
    ```javascript
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay();
    ```

### D. Group Auto-Distribution Reference
- **File Path**: `src/pages/NuevaReserva.tsx`
  - PMS internal group booking handles auto-distribution at lines 460–534. It assigns 1 adult per room, fills remaining capacities up to maximums, assigns overflows to the leader room, and places pets up to 2 per room.

---

## 2. Logic Chain

1. **"El Sugerido" Optimal Allocation**:
   - To find the *minimum* number of rooms, the algorithm must systematically check combinations of size $N=1, 2, 3...$
   - To avoid combinatorial explosion ($O(2^M)$ for large $M$ flat rooms), identical rooms must be grouped by type (`Familiar`, `Doble`, `Estándar`, `Camping`). The combinations should be generated based on quantity count vectors.
   - For a given combination of types (e.g. `['Familiar', 'Camping']`), a backtracking algorithm distributes adults, minors, and pets. If a distribution satisfies all constraints (at least 1 adult/room, capacity limits, and pet limits), it is the optimal allocation.
   - High-capacity room types must be prioritized: `Familiar` (6) > `Doble` (4) > `Estándar` (3) > `Camping` (2). Sorting the type-count combinations by room count ascending, and then by cumulative type weights descending, guarantees that the most optimal room layout is evaluated first.

2. **Pasadía Support**:
   - A single-day booking has `check_in === check_out` (nights = 0, but count as 1 day of occupancy).
   - If `categoria === 'Pasadía'`, the backend route `/disponibilidad` and creation endpoints must bypass the `check_out <= check_in` check, and allow `check_in === check_out`.
   - The conflict check for Pasadía must check for exact day matches: `check_in = ?` instead of the standard overlapping date range, as there are no "nights" to split.
   - For Pasadías, pricing is strictly per person. In `calculations.js`, the subtotal formula for one day matches the nightly rate for 1 night, making it naturally compatible if `calcNoches` returns `1` when `check_in === check_out`.

3. **Cart Cleanup**:
   - Storing a stale cart when search criteria changes (dates, guests, category) causes out-of-bounds capacity selections and corrupted transaction totals.
   - A React `useEffect` inside `BookingWidget.tsx` that monitors all Step 1 search parameters and triggers `setCart([])` ensures complete state sanitation.

4. **Timezone-Proof calculations**:
   - The string date parsing must use `Date.UTC(...)` or append `T00:00:00Z` to guarantee parser consistency.
   - Weekdays (`getUTCDay()`), holidays, and date iteration in backend loops must use UTC setters/getters.

---

## 3. Caveats

- **Overnight vs Day-Pass overlap**: The physical rooms are strictly partitioned via the `categoria` column inside the `habitaciones` database table (e.g. `Bohío` rooms are strictly `'Pasadía'`, while `Familiar` rooms are strictly `'Estadía'`). The analysis assumes that an overnight stay will never be booked in a Bohío, and a Day-Pass will never be booked in a Familiar hotel room.
- **Max pets per room**: As established in the internal PMS auto-distributor, a maximum of 2 pets per room is assumed unless a room type specifies otherwise.

---

## 4. Conclusion

The PMS is fully structured to support these features once:
1. `BookingWidget.tsx` implements the progressive count-combination suggestion engine for Step 2.
2. `/disponibilidad` and `/reservar` endpoints are parameterized to accept `categoria` and toggle conflict-checking.
3. Date operations are refactored to UTC.

---

## 5. Verification Method

- **Automated Tests**: Execute `npm test` or `jest` in the backend root once modifications are made. Ensure to add test assertions in `server/utils/calculations.test.js` checking:
  - Day type resolution for mixed weekday/weekend spans with UTC methods.
  - Per-person pricing calculation on Pasadía codes.
- **Frontend Inspections**:
  - Search for a Pasadía on `2026-06-01` with 3 adults, verify it checks availability for `'Pasadía'` rooms, successfully handles `check_out === check_in`, and renders "/persona".
  - Change search parameters in Step 1, verify the shopping cart resets instantly.
  - Search with 5 adults, verify that clicking "Aceptar Sugerido" at the top of Step 2 successfully adds 1 Familiar room (or Doble + Camping) to the cart and navigates straight to Step 4.

---

## 6. Remaining Work & Implementation Proposals

### A. Proposed Frontend "El Sugerido" Algorithm (to be inserted in `BookingWidget.tsx`)

This is the optimized, non-explosive count-combination allocation solver:

```typescript
interface RoomAllocation {
  tipo: string;
  adultos: number;
  menores: number;
  mascotas: number;
}

const ROOM_CAPACITIES: Record<string, { min: number; max: number }> = {
  'Familiar': { min: 2, max: 6 },
  'Doble': { min: 2, max: 4 },
  'Estándar': { min: 2, max: 3 },
  'Camping': { min: 1, max: 2 }
};

function solveDistribution(
  rooms: string[],
  adults: number,
  minors: number,
  pets: number
): RoomAllocation[] | null {
  const result: RoomAllocation[] = [];

  function backtrack(
    idx: number,
    remAdults: number,
    remMinors: number,
    remPets: number
  ): boolean {
    if (idx === rooms.length) {
      return remAdults === 0 && remMinors === 0 && remPets === 0;
    }

    const tipo = rooms[idx];
    const cap = ROOM_CAPACITIES[tipo] || { min: 1, max: 4 };

    // At least 1 adult per room
    const minAdults = 1;
    const maxAdults = Math.min(remAdults, cap.max);

    for (let a = minAdults; a <= maxAdults; a++) {
      const minMinors = Math.max(0, cap.min - a);
      const maxMinors = Math.min(remMinors, cap.max - a);

      for (let m = minMinors; m <= maxMinors; m++) {
        // Distribute pets up to 2 per room
        const maxPets = Math.min(remPets, 2);
        for (let p = 0; p <= maxPets; p++) {
          result.push({ tipo, adultos: a, menores: m, mascotas: p });
          if (backtrack(idx + 1, remAdults - a, remMinors - m, remPets - p)) {
            return true;
          }
          result.pop();
        }
      }
    }
    return false;
  }

  if (backtrack(0, adults, minors, pets)) {
    return result;
  }
  return null;
}

export function findElSugerido(
  adults: number,
  minors: number,
  pets: number,
  availableTypes: { tipo: string; disponibles: number }[]
): RoomAllocation[] | null {
  const typeOrder = ['Familiar', 'Doble', 'Estándar', 'Camping'];
  const availableMap: Record<string, number> = {};
  
  availableTypes.forEach(rt => {
    if (typeOrder.includes(rt.tipo)) {
      availableMap[rt.tipo] = rt.disponibles;
    }
  });

  const results: string[][] = [];

  function generateCombos(typeIdx: number, currentCombo: string[]) {
    if (typeIdx === typeOrder.length) {
      if (currentCombo.length > 0) results.push([...currentCombo]);
      return;
    }

    const type = typeOrder[typeIdx];
    const maxQty = availableMap[type] || 0;

    for (let qty = 0; qty <= maxQty; qty++) {
      const added = Array(qty).fill(type);
      generateCombos(typeIdx + 1, [...currentCombo, ...added]);
    }
  }

  generateCombos(0, []);

  // Sort combinations by size (ascending), then by capacity weight (descending)
  const weights: Record<string, number> = {
    'Familiar': 1000,
    'Doble': 100,
    'Estándar': 10,
    'Camping': 1
  };

  results.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    const wA = a.reduce((sum, r) => sum + weights[r], 0);
    const wB = b.reduce((sum, r) => sum + weights[r], 0);
    return wB - wA;
  });

  // Evaluate from best to worst
  for (const combo of results) {
    const allocation = solveDistribution(combo, adults, minors, pets);
    if (allocation) return allocation;
  }

  return null;
}
```

### B. Proposed Backend Changes (to be inserted in `server/routes/public.js`)

Modify `/disponibilidad` to accept `categoria` and check single-day conflicts correctly:

```javascript
router.get('/disponibilidad', (req, res) => {
  try {
    const { check_in, check_out, categoria = 'Estadía' } = req.query;
    if (!check_in || !check_out) return err(res, 'VALIDATION_ERROR', 'check_in y check_out requeridos');
    
    if (categoria === 'Estadía') {
      if (check_out <= check_in) return err(res, 'VALIDATION_ERROR', 'check_out debe ser posterior a check_in');
    } else {
      if (check_out < check_in) return err(res, 'VALIDATION_ERROR', 'check_out no puede ser anterior a check_in');
    }

    const db = getDb();
    const rooms = db.prepare("SELECT id, tipo, categoria, capacidad_min, capacidad_max FROM habitaciones WHERE activa = 1 AND categoria = ?").all(categoria);

    // Dynamic conflict checking based on booking category
    let conflicts;
    if (categoria === 'Pasadía') {
      conflicts = db.prepare(`
        SELECT habitacion_id FROM reservas_hotel
        WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
          AND check_in = ?
      `).all(check_in).map(r => r.habitacion_id);
    } else {
      conflicts = db.prepare(`
        SELECT habitacion_id FROM reservas_hotel
        WHERE estado NOT IN ('Cancelada', 'No-Show', 'Check-Out')
          AND check_in < ? AND check_out > ?
      `).all(check_out, check_in).map(r => r.habitacion_id);
    }

    const types = {};
    for (const room of rooms) {
      const available = !conflicts.includes(room.id);
      if (!types[room.tipo]) {
        types[room.tipo] = { tipo: room.tipo, categoria: room.categoria, capacidad_min: room.capacidad_min, capacidad_max: room.capacidad_max, total: 0, disponibles: 0 };
      }
      types[room.tipo].total++;
      if (available) types[room.tipo].disponibles++;
    }
    const result = Object.values(types).filter(t => t.disponibles > 0);
    ok(res, { check_in, check_out, tipos_disponibles: result });
  } catch (e) { console.error(e); err(res, 'SERVER_ERROR', 'Error verificando disponibilidad', 500); }
});
```

*Note: Repeat the same single-day exception checks for conflicts in `/reservar` and `/reservas/multi` creation routes.*

### C. Proposed Timezone-Proof Calculations (to be replaced in `server/utils/calculations.js`)

```javascript
// Timezone-proof day type checks using UTC Date parsing
function getDayType(dateStr) {
  const db = getDb();
  const festivo = db.prepare('SELECT id FROM dias_festivos WHERE fecha = ?').get(dateStr);
  if (festivo) return 'festivo';
  
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  const d = new Date(Date.UTC(year, month, day));
  const dow = d.getUTCDay();
  
  if (dow === 5 || dow === 6) return 'fin_de_semana'; // Viernes y Sábado
  return 'entre_semana';
}

function calcNoches(checkIn, checkOut) {
  const d1 = new Date(checkIn + 'T00:00:00Z');
  const d2 = new Date(checkOut + 'T00:00:00Z');
  const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1; // Pasadía has 0 night difference but occupies 1 day
}

function calcReservationWithRates(planId, checkIn, checkOut, adultos, menores, mascotas) {
  const db = getDb();
  const noches = calcNoches(checkIn, checkOut);
  const plan = findById('planes_tarifa', planId);
  if (!plan) throw new Error('Plan no encontrado');

  const baseAdulto = plan.precio_adulto_noche;
  const baseMenor = plan.precio_menor_noche || 0;
  const baseMascota = plan.precio_mascota_noche || 0;

  let subtotal = 0;
  const desglose_tarifas = [];

  for (let i = 0; i < noches; i++) {
    const parts = checkIn.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    const d = new Date(Date.UTC(year, month, day));
    d.setUTCDate(d.getUTCDate() + i);
    const currentDateStr = d.toISOString().split('T')[0];
    const tipoDia = getDayType(currentDateStr);

    const regla = db.prepare('SELECT * FROM reglas_tarifa WHERE plan_id = ? AND tipo_dia = ? AND activo = 1').get(plan.id, tipoDia);

    const pAdulto = regla ? regla.precio_adulto : baseAdulto;
    const pMenor = regla ? regla.precio_menor : baseMenor;
    const pMascota = regla ? regla.precio_mascota : baseMascota;

    const totalNoche = Math.round(((adultos * pAdulto) + (menores * pMenor) + (mascotas * pMascota)) * 100) / 100;
    subtotal += totalNoche;

    desglose_tarifas.push({
      fecha: currentDateStr,
      tipo_dia: tipoDia,
      precio_adulto: pAdulto,
      precio_menor: pMenor,
      precio_mascota: pMascota,
      monto_noche: totalNoche
    });
  }

  const llevaImpuesto = plan.lleva_impuesto !== undefined ? plan.lleva_impuesto : 1;
  const impuestoPct = llevaImpuesto ? (plan.impuesto_pct !== undefined ? plan.impuesto_pct : 10) : 0;
  const impuestoMonto = Math.round(subtotal * (impuestoPct / 100) * 100) / 100;
  const montoTotal = Math.round((subtotal + impuestoMonto) * 100) / 100;
  
  const depositoSugeridoPct = parseFloat(getConfig('deposito_sugerido_pct')) || 50;
  const depositoSugerido = Math.round(montoTotal * (depositoSugeridoPct / 100) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    impuesto_pct: impuestoPct,
    impuesto_monto: impuestoMonto,
    monto_total: montoTotal,
    deposito_sugerido: depositoSugerido,
    desglose_tarifas
  };
}
```
