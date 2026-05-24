# Comprehensive Code Audit & Design Fixes

## 1. Executive Summary
This report details the findings and precise fix blueprints for the Casa Mahana PMS application to resolve stay-based adult rate calculation discrepancies, group reservation guest count duplication in the React frontend, and introduce a "Persona Extra" quick charge action in the Folio UI.

---

## 2. Part 1: Adult Rate Calculation Shift
### Current Bug
The calculations engine in `server/utils/calculations.js` treats adult rates differently based on the `categoria` parameter. For `Pasadía` plans, adult rates are per-person (`baseAdultosMonto * adultos`). However, for `Estadía` plans, the rates are flat room-based (solely `baseAdultosMonto` per night regardless of the number of adults in the room).

### Key Files and Line Ranges
- **File**: `server/utils/calculations.js`
- **Line Range**: 52-61 and 163-172

### Recommended Code Changes
Treat all adult rate calculations strictly as per-person (i.e. `adultos * precio_por_noche`).

#### Diff Patch for `calcReservation`
```javascript
// Before
  let precioAdulto = baseAdultosMonto;
  // Pasadía is per-person/entry, Estadía is per room/night
  if (categoria === 'Pasadía') {
    precioAdulto = baseAdultosMonto * adultos;
  }

// After
  // Treat all adult rates as strictly per-person (adults * price per night)
  let precioAdulto = baseAdultosMonto * adultos;
```

#### Diff Patch for `calcReservationWithRates`
```javascript
// Before
    let precioAdulto = baseAdultosMonto;
    // Pasadía is per-person/entry, Estadía is per room/night
    if (categoria === 'Pasadía') {
      precioAdulto = baseAdultosMonto * adultos;
    }

// After
    // Treat all adult rates as strictly per-person (adults * price per night)
    let precioAdulto = baseAdultosMonto * adultos;
```

---

## 3. Part 2: Group Guest Count Inheritance
### Current Bug
In `src/pages/NuevaReserva.tsx`, subsequent rooms added to a group booking inherit the primary/first room's guest counts (adults, minors, and pets) instead of defaulting to zero.
This bug manifests in three places:
1. **`toggleGroupRoom` handler**: The `||` operator treats `0` as falsy, resetting guest values to primary form values when rooms are selected/re-selected.
2. **UI Card fallbacks**: If `roomConfigs[roomId]` is undefined, rendering defaults to primary search values.
3. **Payload submission**: If sub-room configuration fields are undefined, the payload builder falls back to primary form values.

### Key Files and Line Ranges
- **File**: `src/pages/NuevaReserva.tsx`
- **Line Ranges**: 427-434, 666-668, 771-773, and 1169-1175

### Recommended Code Changes

#### 1. In `toggleGroupRoom` handler (Line 427-434)
Use the nullish coalescing operator `??` to allow `0` counts to be stored without falling back to the leader room's count:
```typescript
          [id]: {
            cliente: curr[id]?.cliente || (prev.length === 0 ? form.cliente : ''),
            apellido: curr[id]?.apellido || (prev.length === 0 ? form.apellido : ''),
            adultos: curr[id]?.adultos ?? (prev.length === 0 ? form.adultos : 0),
            menores: curr[id]?.menores ?? (prev.length === 0 ? form.menores : 0),
            mascotas: curr[id]?.mascotas ?? (prev.length === 0 ? form.mascotas : 0),
            plan_codigo: curr[id]?.plan_codigo || form.plan_codigo || ''
          }
```

#### 2. In PayPal and normal booking submissions (Lines 666-668 and 771-773)
Ensure the fallback only applies to the primary room (`idx === 0`). Subsequent rooms default to `0`:
```typescript
          adultos: config.adultos !== undefined ? Number(config.adultos) : (idx === 0 ? Number(form.adultos) : 0),
          menores: config.menores !== undefined ? Number(config.menores) : (idx === 0 ? Number(form.menores) : 0),
          mascotas: config.mascotas !== undefined ? Number(config.mascotas) : (idx === 0 ? Number(form.mascotas) : 0),
```

#### 3. In the UI Room card configuration fallback (Lines 1169-1175)
Initialize subsequent cards' configurations with `0` guest counts instead of inheriting primary ones:
```typescript
                const config = roomConfigs[roomId] || {
                  cliente: index === 0 ? form.cliente : '',
                  apellido: index === 0 ? form.apellido : '',
                  adultos: index === 0 ? (form.adultos || 1) : 0,
                  menores: index === 0 ? (form.menores || 0) : 0,
                  mascotas: index === 0 ? (form.mascotas || 0) : 0,
                  plan_codigo: form.plan_codigo || ''
                };
```

---

## 4. Part 3: Folio UI Actions ("Persona Extra")
### Objective
Create a quick-charge UI action to register a "Persona Extra" on the Folio. The button must be glassmorphic and toggle a collapsible purple card that defaults to $25/night, calculates total cost dynamically (nights * rate), and posts a `debito` transaction to the `/hotel/reservas/:id/folio` endpoint.

### Key Files and Line Ranges
- **File**: `src/pages/ReservaDetalle.tsx`
- **Line Ranges**: 112 (States), 237 (Effects), 310 (Handlers), 707-714 (Header Button), and 865 (Collapsible Form)

### Recommended Code Changes

#### 1. States and Sync Effect
Add these hooks inside `ReservaDetalle` component:
```typescript
  // Extra Person Charge form states
  const [showPersonaExtra, setShowPersonaExtra] = useState(false);
  const [personaExtraForm, setPersonaExtraForm] = useState({
    nombre: '',
    precioPorNoche: '25',
    noches: '1'
  });
  const [personaExtraLoading, setPersonaExtraLoading] = useState(false);

  // Synchronize nights default for persona extra
  useEffect(() => {
    if (reserva?.noches) {
      setPersonaExtraForm(prev => ({
        ...prev,
        noches: reserva.noches.toString()
      }));
    }
  }, [reserva]);
```

#### 2. Form Submission Handler
```typescript
  const submitPersonaExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmount = parseFloat(personaExtraForm.precioPorNoche) * parseInt(personaExtraForm.noches);
    if (!personaExtraForm.nombre.trim()) {
      alert("Por favor, ingrese el nombre de la persona extra.");
      return;
    }
    if (totalAmount <= 0) {
      alert("El monto total debe ser mayor a 0.");
      return;
    }
    setPersonaExtraLoading(true);
    try {
      await api.post(`/hotel/reservas/${id}/folio`, {
        monto: totalAmount,
        concepto: `Persona Extra: ${personaExtraForm.nombre.trim()} (${personaExtraForm.noches} noches x $${personaExtraForm.precioPorNoche}/noche)`,
        tipo: 'debito'
      });
      // Reset form and close
      setPersonaExtraForm({
        nombre: '',
        precioPorNoche: '25',
        noches: reserva?.noches?.toString() || '1'
      });
      setShowPersonaExtra(false);
      load();
    } catch (err: any) {
      alert(err.message || "Error al registrar persona extra");
    } finally {
      setPersonaExtraLoading(false);
    }
  };
```

#### 3. Folio Header Layout Integration (Glassmorphic Button)
Around line 707-714:
```typescript
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 font-sans">Resumen de Cuenta (Folio)</h3>
              {!isClosed && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPersonaExtra(!showPersonaExtra)}
                    className="flex items-center gap-1 text-sm text-purple-700 bg-purple-100/60 hover:bg-purple-200/60 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-purple-200/50 transition font-medium shadow-sm font-sans"
                  >
                    ➕ Persona Extra
                  </button>
                  <button onClick={() => setShowPago(!showPago)} className="flex items-center gap-1 text-sm text-ocean-600 hover:text-ocean-700 font-sans font-medium">
                    <Plus size={16} /> Registrar Pago
                  </button>
                </div>
              )}
            </div>
```

#### 4. Collapsible Purple Card Form Layout
Insert below the `{showPago && (...)}` block (around line 865):
```typescript
            {showPersonaExtra && (
              <form onSubmit={submitPersonaExtra} className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4 space-y-3">
                <div className="flex items-center gap-2 text-purple-800 font-bold text-sm mb-1 font-sans">
                  <span>➕ Registrar Persona Extra</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-xs text-purple-700 font-medium font-sans">Nombre de la Persona Extra *</label>
                    <input
                      type="text"
                      value={personaExtraForm.nombre}
                      onChange={e => setPersonaExtraForm(p => ({ ...p, nombre: e.target.value }))}
                      required
                      className="input bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-200 w-full"
                      placeholder="Nombre Completo"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:col-span-2">
                    <div>
                      <label className="text-xs text-purple-700 font-medium font-sans">Precio por noche *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={personaExtraForm.precioPorNoche}
                        onChange={e => setPersonaExtraForm(p => ({ ...p, precioPorNoche: e.target.value }))}
                        required
                        className="input bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-200 w-full"
                        placeholder="25.00"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-purple-700 font-medium font-sans">Noches *</label>
                      <input
                        type="number"
                        min="1"
                        value={personaExtraForm.noches}
                        onChange={e => setPersonaExtraForm(p => ({ ...p, noches: e.target.value }))}
                        required
                        className="input bg-white border-purple-200 focus:border-purple-400 focus:ring-purple-200 w-full"
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="bg-white/60 rounded-lg p-2.5 flex justify-between items-center text-xs border border-purple-200/50">
                  <span className="text-purple-900 font-semibold font-sans">Monto Total a Cargar:</span>
                  <span className="font-bold text-purple-950 text-base font-mono">
                    ${((parseFloat(personaExtraForm.precioPorNoche) || 0) * (parseInt(personaExtraForm.noches) || 0)).toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-2 justify-end">
                  <button
                    type="submit"
                    disabled={personaExtraLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50 font-medium shadow-sm shadow-purple-100 font-sans"
                  >
                    {personaExtraLoading ? 'Cargando...' : 'Cargar Cargo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPersonaExtra(false);
                      setPersonaExtraForm({
                        nombre: '',
                        precioPorNoche: '25',
                        noches: reserva?.noches?.toString() || '1'
                      });
                    }}
                    className="px-4 py-2 text-purple-700 hover:text-purple-900 hover:bg-purple-100/50 rounded-lg text-sm transition font-sans"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
```

---

## 5. Part 4: Required Test Assertion Updates
The shift to per-person calculations modifies expected stay pricing subtotals and balances throughout the test suites.

### 1. `server/utils/calculations.test.js`
- **Line 140**: Expect subtotal to be `540` instead of `340` (since `2 adults * $100/night * 2 nights = $400`, plus `1 minor * $50/night * 2 nights = $100` and `1 pet * $20/night * 2 nights = $40`).
- **Line 142**: Expect impuesto_monto to be `54` instead of `34`.
- **Line 145**: Expect monto_total to be `594` instead of `374`.
- **Line 147**: Expect deposito_sugerido to be `297` instead of `187`.
- **Line 149**: Expect saldo_pendiente to be `594` instead of `374`.
- **Line 227**: Expect subtotal to be `480` instead of `240` (2 adults * $120/night * 2 nights).
- **Line 228**: Expect impuesto_monto to be `48` instead of `24`.
- **Line 229**: Expect monto_total to be `528` instead of `264`.
- **Line 233**: Expect desglose `total_noche` to be `240` instead of `120`.

### 2. `server/routes/group_bookings.test.js`
- **Line 137**: Expect consolidated subtotal to be `600` instead of `400` (Master: 2 adults * $100 * 2 nights = $400; Child: 1 adult * $100 * 2 nights = $200).
- **Line 138**: Expect impuesto_monto to be `60` instead of `40`.
- **Line 139**: Expect monto_total to be `660` instead of `440`.
- **Line 140**: Expect saldo_pendiente to be `660` instead of `440`.
- **Lines 151-152**: Expect Lead Group room cost to be `400` instead of `200`, and tax to be `40` instead of `20`.
- **Line 208**: Expect separate master subtotal to be `450` instead of `225` (2 adults * (Saturday weekend rate $125 + Sunday weekday rate $100)).
- **Line 209**: Expect separate master impuesto_monto to be `45` instead of `22.5`.
- **Line 210**: Expect separate master monto_total to be `495` instead of `247.5`.
- **Line 307**: Expect consolidation master additions total to be `715` instead of `495`.
- **Line 308**: Expect consolidation master additions pending to be `715` instead of `495`.
- **Line 348**: Expect consolidation payment pending to be `515` instead of `295`.
