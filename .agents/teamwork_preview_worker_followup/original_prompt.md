## 2026-05-21T10:16:35Z
Please implement the following five follow-up requirements in the Casa Mahana PMS project.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Here are the specific requirements to implement:

### R1. Quotes and alternative rates filtering by visible_web = 1
- **File**: `src/pages/NuevaReserva.tsx`
- **Changes**: Modify `filteredPlanes` inside the `useMemo` hook (lines 280-285) to filter by `p.visible_web === 1`. Ensure this filters out any rate plan whose `visible_web` property is not 1.

### R2. Suggested deposit quick fill buttons and dynamic initialization
- **File**: `src/pages/NuevaReserva.tsx`
- **Changes**:
  - Add a boolean state `isDepositDirty` (or equivalent tracking mechanism) to track if the user has manually changed the deposit amount.
  - Reset `isDepositDirty` to false whenever dates, room selection, plan selection, or guest counts change.
  - When the pricing `cotizacion` is updated from the server: if `isDepositDirty` is false, automatically update the `depositAmount` input value to `cotizacion.deposito_sugerido`.
  - Set `isDepositDirty` to true when the user types in the input field.
  - Add three quick-fill buttons underneath the "Monto del abono" input field in Step 4:
    - "0% (Sin abono)" -> sets depositAmount to '0.00' and isDepositDirty to true.
    - "50% (Sugerido: $X)" -> sets depositAmount to the suggested deposit and isDepositDirty to true.
    - "100% (Pago Total: $Y)" -> sets depositAmount to the total stay price and isDepositDirty to true.

### R3. Integrated PayPal & mandatory payment attachments for internal booking flow
- **File**: `src/pages/NuevaReserva.tsx`
- **Changes**:
  - If `depositMetodo` is 'paypal' or 'tarjeta' (or matching keys) and the `depositAmount > 0`, integrate the interactive PayPal buttons in Step 4, mirroring how it is done in `BookingWidget.tsx`. Fetch PayPal credentials using `/api/v1/public/paypal-config`.
  - Block the default booking submission button, render the PayPal buttons instead.
  - Once PayPal payment is captured successfully, automatically proceed to save the reservation, including the `paypal_order_id` or similar reference in the payload.
  - For all other payment methods (e.g. transfer, yappy, efectivo, cupones) where `depositAmount > 0`: enforce that a payment receipt/attachment (`receiptFile`) has been uploaded. If not uploaded, block the booking submission and show a clear error validation message/alert.

### R4. Resend integration for email deliverability
- **Files**:
  - `server/db/database.js` (Schema migration): Ensure the database table `configuracion_sistema` contains `email_provider` (TEXT, default 'smtp') and `resend_api_key` (TEXT) columns. Add them if they do not exist.
  - `server/routes/admin.js` (Settings update & retrieval): Allow saving and returning the two new fields `email_provider` and `resend_api_key` inside the settings API routes.
  - `server/notifications.js` (Mail sending): In `sendEmail(to, subject, html)`, check if `config.email_provider === 'resend'`. If it is, send the email using a direct, native HTTP request (via Node's native `https` module to perform a POST request to `https://api.resend.com/emails`) using the saved `resend_api_key` in headers. Make sure no external packages are introduced, keeping the execution clean and lightweight.
  - `src/pages/Configuracion.tsx` (Settings UI):
    - Update state, save, and load logic to include `email_provider` and `resend_api_key`.
    - Render a select/dropdown to let the admin select between "SMTP Standard" and "Resend API".
    - If "Resend API" is selected, hide the typical SMTP fields (host, port, user, pass) and display a secure input field for "Resend API Key".

### R5. Multi-room public booking widget with shopping cart & API
- **Files**:
  - `src/pages/BookingWidget.tsx`:
    - Redesign the public widget selector to allow selecting up to 30 guests.
    - Convert the single-room selection into a "Cart/Multi-room Selection" flow. The customer selects a room type and rate plan. After confirming, show a prompt/modal: "Add another room" (returns to room selector step) or "Proceed to Checkout" (advances to summary).
    - Maintain a list of `CartItem[]` representing the selected rooms, rates, guests, and cotizaciones in cart state.
    - In Step 4 (Summary), render a list of all selected rooms with their individual prices, and display a consolidated total/minimum deposit.
    - In Step 5 (Payment), calculate the total minimum deposit (sum of individual room minimum deposits) and process the payment.
  - `server/routes/public.js`:
    - Create a public unauthenticated `/api/v1/public/reservar/grupo` endpoint.
    - This endpoint should execute under a single SQLite transaction block (rollback on error/availability failure), resolve room types to actual physical room IDs, validate availability for all rooms in the group, insert multiple reservation records (linking them with `parent_reserva_id`, `es_maestra`, and `grupo_codigo`), and set up consolidated accounting folios.
