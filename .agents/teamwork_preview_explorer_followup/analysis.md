# Codebase Exploration & Implementation Analysis Report
**Project**: Casa Mahana PMS (Property Management System)  
**Author**: Codebase Explorer  
**Date**: May 21, 2026  

---

## Executive Summary
This report presents a comprehensive codebase exploration and architectural analysis to prepare for the implementation of five crucial follow-up requirements in the **Casa Mahana PMS** project. The PMS operates on a modern React frontend + Node.js (Express) backend powered by a reliable SQLite (`better-sqlite3`) database. 

Each requirement has been mapped to its exact files, lines, and components, detailing how state and data flow are structured. A robust, concrete step-by-step implementation strategy is provided for each requirement, including schema migrations, API additions, and frontend component updates. Additionally, existing test coverage has been analyzed, showing how to execute and extend unit and integration testing using the Vitest framework.

---

## Index of Analyzed Requirements
1. **[R1] Quotes and Alternative Rates Filtering by `visible_web = 1`**
2. **[R2] Suggested Deposit Quick-Fill Buttons and Dynamic Synchronization**
3. **[R3] Integrated PayPal & Mandatory Payment Attachments (Internal Flow)**
4. **[R4] Resend Email Integration for Deliverability & Settings Panel Update**
5. **[R5] Multi-room Public Booking Widget with Shopping Cart & Public Group API**

---

## [R1] Quotes and Alternative Rates Filtering by `visible_web = 1`

### 1. Affected Files, Lines, and Components
- **Frontend File**: `src/pages/NuevaReserva.tsx`
  - Fetching plans: `useEffect` hook (lines 108–110).
  - Filtering logic: `filteredPlanes` inside `useMemo` (lines 280–285).
  - Alternative rates rendering: `otherPlanes` filtering and comparison display (lines 350–385).
- **Backend File**: `server/routes/hotel.js`
  - Plan retrieval endpoint: `GET /hotel/planes` (lines 37–51).

### 2. State and Handler Structure
- In `NuevaReserva.tsx`, plans are loaded from the backend using:
  ```typescript
  const [planes, setPlanes] = useState<Plan[]>([]);
  useEffect(() => {
    api.get('/hotel/planes').then(r => setPlanes(r.data));
  }, []);
  ```
- Filtering is handled in a `useMemo` hook that feeds the selection dropdown:
  ```typescript
  const filteredPlanes = useMemo(() => {
    return planes.filter(p => p.categoria === categoria);
  }, [planes, categoria]);
  ```
- The alternative rates comparison calculates prices dynamically for different plans by iterating over `filteredPlanes`:
  ```typescript
  const otherPlanes = filteredPlanes.filter(p => p.codigo !== form.plan_codigo);
  ```

### 3. Key Data Properties
- `planes_tarifa.visible_web`: Integer (`0` or `1`). Indicates whether a rate is published on the web booking widget. 
- In the DB schema (`server/db/database.js` lines 121–135), the column is defined as `visible_web INTEGER DEFAULT 1`.

### 4. Step-by-Step Implementation Strategy
1. **Frontend Update (`NuevaReserva.tsx`)**:
   Modify the `filteredPlanes` definition to check for `visible_web === 1`:
   ```typescript
   const filteredPlanes = useMemo(() => {
     return planes.filter(p => p.categoria === categoria && p.visible_web === 1);
   }, [planes, categoria]);
   ```
   *Rationale*: By filtering `filteredPlanes`, we simultaneously restrict the primary selection dropdown **and** filter the alternative rates comparison cards to only display web-visible rates. Internal PMS staff will still be able to view all rates in the main rates configuration screen, but the booking wizard will restrict quotes and alternatives to the web-visible subset as required.

---

## [R2] Suggested Deposit Quick-Fill Buttons and Dynamic Synchronization

### 1. Affected Files, Lines, and Components
- **Frontend File**: `src/pages/NuevaReserva.tsx`
  - Deposit state declarations: `useState` for `depositAmount` (line 122).
  - Dynamic calculations trigger: `useEffect` block for pricing cotización (lines 222–260).
  - Wizard UI: Step 4 "Registro de Abono" panel (lines 910–945).

### 2. State and Handler Structure
- `depositAmount` represents the current input value of the abono:
  ```typescript
  const [depositAmount, setDepositAmount] = useState('');
  ```
- Currently, when `cotizacion` calculations are retrieved from `/hotel/cotizar`, the suggested deposit is only populated if the input field is completely empty:
  ```typescript
  if (r.data.deposito_sugerido && !depositAmount) {
    setDepositAmount(r.data.deposito_sugerido.toFixed(2));
  }
  ```
  This creates a stale state: if a user changes the dates or room type, the `cotizacion` is re-calculated, but the `depositAmount` remains at its original value, leading to out-of-sync bookings.

### 3. Key Data Properties
- `cotizacion.deposito_sugerido`: The dynamically calculated 50% deposit amount based on the total stay price (from `/hotel/cotizar`).
- `cotizacion.monto_total`: The full total stay price (including taxes).

### 4. Step-by-Step Implementation Strategy
1. **Dynamic Resynchronization (`NuevaReserva.tsx`)**:
   Add a tracking state `isDepositDirty` (boolean) to determine if the user has manually entered a value.
   - When the dates, room, plan, or guests change, reset `isDepositDirty` to `false`.
   - When `cotizacion` updates and `isDepositDirty === false`, dynamically set the `depositAmount` to the new `cotizacion.deposito_sugerido.toFixed(2)`.
   - Set `isDepositDirty` to `true` as soon as the user fires an `onChange` event in the manual input.
2. **Add Quick-Fill Buttons (`NuevaReserva.tsx`)**:
   Locate the "Monto del abono" input field in Step 4 and place a series of quick-fill button helpers underneath it:
   ```tsx
   <div className="flex gap-2 mt-2">
     <button
       type="button"
       onClick={() => { setDepositAmount('0.00'); setIsDepositDirty(true); }}
       className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
     >
       0% (Sin abono)
     </button>
     <button
       type="button"
       onClick={() => { setDepositAmount(cotizacion.deposito_sugerido.toFixed(2)); setIsDepositDirty(true); }}
       className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-semibold rounded-lg transition"
     >
       50% (Sugerido: ${cotizacion.deposito_sugerido.toFixed(2)})
     </button>
     <button
       type="button"
       onClick={() => { setDepositAmount(cotizacion.monto_total.toFixed(2)); setIsDepositDirty(true); }}
       className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg transition"
     >
       100% (Pago Total: ${cotizacion.monto_total.toFixed(2)})
     </button>
   </div>
   ```

---

## [R3] Integrated PayPal & Mandatory Payment Attachments (Internal Flow)

### 1. Affected Files, Lines, and Components
- **Frontend File**: `src/pages/NuevaReserva.tsx`
  - Step 4 Wizard UI: "Registro de Abono" panel.
  - Form validation: `canSubmit` state (lines 553–554) and `handleSubmit` handler (lines 556–689).
- **Backend File**: `server/routes/public.js`
  - PayPal backend config and checkout API endpoints (lines 115–175).

### 2. State and Handler Structure
- `depositMetodo` represents the current selection in the payment method dropdown:
  ```typescript
  const [depositMetodo, setDepositMetodo] = useState('efectivo');
  ```
- `receiptFile` represents the transaction proof document attached to the form:
  ```typescript
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  ```
- If a document is present, `handleSubmit` uploads it in a sequential `FormData` API post immediately after the reservation record is created:
  ```typescript
  if (receiptFile) {
    const formData = new FormData();
    formData.append('archivo', receiptFile);
    formData.append('tipo', 'recibo');
    await api.post(`/hotel/reservas/${masterId}/documentos`, formData);
  }
  ```

### 3. Key Data Properties
- `metodo_pago`: Enum/String. Valid offline types requiring verification: `['transferencia', 'yappy', 'cuponera_oferta_simple', 'cuponera_pahoy']`.
- `depositAmount`: Float. Must be `> 0` for attachment validation to trigger.

### 4. Step-by-Step Implementation Strategy
1. **Mandatory Attachment Validation (`NuevaReserva.tsx`)**:
   Define the set of offline verification payment methods:
   ```typescript
   const OFFLINE_METHODS = ['transferencia', 'yappy', 'cuponera_oferta_simple', 'cuponera_pahoy'];
   ```
   Modify `canSubmit` or write a custom validator inside `handleSubmit`:
   ```typescript
   const depositVal = parseFloat(depositAmount) || 0;
   const isAttachmentMandatory = depositVal > 0 && OFFLINE_METHODS.includes(depositMetodo);
   
   if (isAttachmentMandatory && !receiptFile) {
     alert('⚠️ El comprobante de pago es obligatorio para depósitos vía Transferencia, Yappy o Cupones.');
     return;
   }
   ```
2. **PayPal Integration in Wizard (`NuevaReserva.tsx`)**:
   Implement a `PayPalButtons` component in `NuevaReserva.tsx` mirroring the structure inside `BookingWidget.tsx`.
   - If `depositMetodo === 'paypal'` and `parseFloat(depositAmount) > 0`, fetch PayPal credentials using `api.get('/public/paypal-config')`.
   - Dynamic UI Switch: Hide the standard "Confirmar Reserva" submit button. In its place, render the interactive `PayPalButtons` component.
   - Upon successful payment in the PayPal overlay, trigger the `onSuccess(orderId)` callback:
     - Set the payment reference text to `PayPal Order: ${orderId}`.
     - Automatically execute `handleSubmit()` immediately, sending `paypal_order_id` in the API payload to complete the reservation record.

---

## [R4] Resend Email Integration for Deliverability & Settings Panel

### 1. Affected Files, Lines, and Components
- **Backend Core**: `server/notifications.js`
  - SMTP transport initializer: `getTransporter()` (lines 45–80).
  - Main email dispatcher: `sendEmail(to, subject, html)` (lines 632–660).
- **Backend Schema & Routes**:
  - `server/db/database.js`: System settings seed and migration (lines 282–321).
  - `server/routes/admin.js`: Settings CRUD endpoint `PUT /configuracion/sistema` (lines 535–595) and SMTP diagnostics `POST /configuracion/test-smtp` (lines 598–706).
- **Frontend File**: `src/pages/Configuracion.tsx`
  - Settings fields: state variables (lines 112–130) and render layout (lines 640–752).

### 2. State and Handler Structure
- System settings are stored in `configuracion_sistema` table and returned as a single row in the settings panel.
- On saving, the frontend fires a single `PUT /admin/configuracion/sistema` payload containing the configuration parameters.

### 3. Key Database Fields
We need to add two new fields to support direct Resend integration:
- `email_provider`: String/Text (`'smtp'` or `'resend'`). Defaults to `'smtp'`.
- `resend_api_key`: String/Text. Holds the authorization token for the Resend REST API.

### 4. Step-by-Step Implementation Strategy
1. **Schema Migration (`server/db/database.js`)**:
   Add columns dynamically during system startup inside the `better-sqlite3` database initialization section:
   ```javascript
   const sysCols = db.prepare('PRAGMA table_info(configuracion_sistema)').all().map(c => c.name);
   if (!sysCols.includes('email_provider')) {
     db.exec("ALTER TABLE configuracion_sistema ADD COLUMN email_provider TEXT DEFAULT 'smtp'");
   }
   if (!sysCols.includes('resend_api_key')) {
     db.exec("ALTER TABLE configuracion_sistema ADD COLUMN resend_api_key TEXT");
   }
   ```
2. **Backend API Endpoint Update (`server/routes/admin.js`)**:
   Update `allowed` fields in `PUT /configuracion/sistema` to include `email_provider` and `resend_api_key`:
   ```javascript
   const allowed = [
     'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from',
     'admin_email', 'notifications_enabled', 'wa_api_url', 'wa_api_token',
     'wa_from_number', 'wa_enabled', 'hotel_telefono', 'hotel_politica_cancelacion',
     'hotel_politica_reembolso', 'hotel_direccion', 'email_provider', 'resend_api_key'
   ];
   ```
3. **Email Dispatcher Update (`server/notifications.js`)**:
   Inject Resend delivery logic in `sendEmail` if the provider is set to `'resend'`:
   ```javascript
   async function sendEmail(to, subject, html) {
     const config = getSystemConfig();
     if (config.notifications_enabled !== 1) return { sent: false, reason: 'disabled' };
     
     const from = config.smtp_from || 'reservas@casamahana.com';
     
     if (config.email_provider === 'resend') {
       if (!config.resend_api_key) return { sent: false, reason: 'Resend API key missing' };
       return await sendResendEmailDirect(config.resend_api_key, from, to, subject, html, config.admin_email);
     }
     
     // Fallback to standard Nodemailer SMTP
     const t = getTransporter();
     ...
   }
   ```
   Implement `sendResendEmailDirect` using Node's native `https` module to perform a direct POST request to `https://api.resend.com/emails` with the Resend API key injected into the headers. This avoids external dependencies and respects execution speed.
4. **Settings UI Update (`src/pages/Configuracion.tsx`)**:
   - Add state variables: `emailProvider` and `resendApiKey`.
   - Update `loadConfig` and `handleSaveConfig` to sync the new properties.
   - Render a "Proveedor de Correo" dropdown containing "SMTP Tradicional" and "Resend API".
   - Using conditional rendering: if "Resend API" is selected, hide host, port, user, and password inputs, replacing them with a secure "Resend API Key" input.

---

## [R5] Multi-room Public Booking Widget with Shopping Cart & Public Group API

### 1. Affected Files, Lines, and Components
- **Frontend File**: `src/pages/BookingWidget.tsx`
  - Complete Wizard Flow: Step 2 "Room Type", Step 3 "Plan Selection", Step 4 "Summary", Step 5 "Payment".
- **Backend File**: `server/routes/public.js`
  - Target for new group booking API handler.

### 2. State and Handler Structure
- Currently, `BookingWidget.tsx` is strictly structured as a single-room wizard that handles one `selectedType` and one `selectedPlan` in states.
- Handlers are geared toward sending a single JSON payload to `POST /api/v1/public/reservar`.

### 3. Key Data Properties
- `reservas`: Array. An array of booking records, each containing dates (`check_in`/`check_out`), requested room type (`tipo_habitacion`), selected rates plan (`plan_codigo`), guest counts (`adultos`/`menores`), and calculated totals.

### 4. Step-by-Step Implementation Strategy
1. **Define a Shopping Cart State (`BookingWidget.tsx`)**:
   Add a unified cart collection state to accumulate room choices:
   ```typescript
   type CartItem = {
     id: string; // generated UUID/Timestamp for list rendering key
     tipo_habitacion: string;
     plan: Plan;
     adultos: number;
     menores: number;
     cotizacion: Cotizacion;
   };
   const [cart, setCart] = useState<CartItem[]>([]);
   ```
2. **Revise the Booking Wizard UI Flow (`BookingWidget.tsx`)**:
   - **Step 1 (Dates)**: Stays identical. Dates must be consistent across the group booking cart to guarantee accurate availability checks.
   - **Step 2 & 3 (Room & Experience)**: Choose the room and plan.
   - **Modal Transition (Success confirmation)**: After choosing a plan in Step 3, instead of auto-advancing, display a prompt:
     - Button A: *"Agregar otra habitación"* -> Adds selection to `cart` and redirects the UI back to Step 2 to add another room type.
     - Button B: *"Proceder a los Datos y Pago"* -> Adds selection to `cart` and advances the UI directly to Step 4.
   - **Step 4 (Summary)**: Render the complete shopping cart contents. Show individual room cards with their selected rates and guests, accompanied by a consolidated invoice summing up all subtotals, taxes, and total costs.
   - **Step 5 (Payment)**: Dynamically calculate the consolidated minimum deposit amount (sum of `cotizacion.deposito_minimo` for all items in the cart) and pass it to PayPal or the offline attachment handler.
3. **Public Group Booking Backend API (`server/routes/public.js`)**:
   Create a public unauthenticated version of the consolidated group booking endpoint `POST /reservar/grupo`:
   - Accepts the `reservas` array.
   - Executes inside a safe database transaction block:
     - Performs availability queries for the requested room types (resolving room type queries to actual room IDs).
     - Validates check-in dates and verifies capacity rules.
     - Creates reservation records in `reservas_hotel`, setting `parent_reserva_id` and linking them with a generated `grupo_codigo`.
     - Enforces consolidated folio debits and credits under the master reservation record.
     - Fires async email/WhatsApp notifications for the group.

---

## Existing Test Infrastructure and Execution

### 1. Test Discovery
The Casa Mahana project uses **Vitest** for all backend unit and E2E integration tests. Tests are located across key server modules and routes:
- **Unit Tests**:
  - `server/utils/calculations.test.js`: Verifies holiday detection, calendar day rate matching, tax additions, and suggested deposit ratios.
  - `server/utils/cxc_reversals.test.js`: Validates double-entry accounting reversions.
  - `server/utils/scheduler.test.js`: Confirms background notification reminders.
- **Integration & E2E Tests**:
  - `server/tests/e2e.test.js`: Full simulated client-side booking flows, check-ins, and checkout validations.
  - `server/routes/group_bookings.test.js`: Verifies transaction isolation, overlapping dates blocking, and master/child folio sync for group bookings.
  - `server/routes/double_approval.test.js` & `server/routes/admin.test.js`: Access control, role permissions, and double approval check workflows.

### 2. Test Execution
Tests can be executed by running the following command in the workspace directory:
```bash
npm run test
```
*Note*: Running tests automatically configures `NODE_ENV=test` inside the script package, executing the entire suite in single-run mode via `vitest run`. Tests spin up an in-memory SQLite database dynamically to run assertions in complete isolation without affecting actual workspace database files.

---

## Conclusion
The Casa Mahana PMS is structurally prepared for all five enhancements. R1, R2, and R3 are front-end heavy changes inside `NuevaReserva.tsx` that will significantly improve usability and financial safety. R4 will solve email delivery issues through a modern API implementation with Resend. R5 completes the public booking engine by letting users book multiple rooms in a single transaction.

The proposed modifications adhere strictly to the database schemas and modular architecture, ensuring clean, performant, and testable code.
