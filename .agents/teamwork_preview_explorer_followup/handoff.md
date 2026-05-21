# Handoff Report — Codebase Exploration and Requirements Analysis

## 1. Observation
- **R1 (visible_web Filtering)**: 
  - Observed in `src/pages/NuevaReserva.tsx` (lines 280–285):
    ```typescript
    const filteredPlanes = useMemo(() => {
      return planes.filter(p => p.categoria === categoria);
    }, [planes, categoria]);
    ```
  - Identified database schema definition for `visible_web` inside `server/db/database.js` (lines 121–135) as `visible_web INTEGER DEFAULT 1`.

- **R2 (Abono Quick-Fills & Sync)**:
  - Observed in `src/pages/NuevaReserva.tsx` (lines 222–260) the dynamic initialization of `depositAmount`:
    ```typescript
    if (r.data.deposito_sugerido && !depositAmount) {
      setDepositAmount(r.data.deposito_sugerido.toFixed(2));
    }
    ```
  - State declaration observed at line 122: `const [depositAmount, setDepositAmount] = useState('');`.

- **R3 (PayPal & Offline Attachments in PMS)**:
  - Observed form submission validation logic in `src/pages/NuevaReserva.tsx` (lines 550–680), and file attachments uploaded via `FormData` to `/hotel/reservas/${masterId}/documentos`.
  - Observed PayPal endpoint patterns in `server/routes/public.js` (lines 115–175) using standard `/paypal/create-order` and `/paypal/capture-order`.

- **R4 (Resend Integration)**:
  - Observed Nodemailer transport builder in `server/notifications.js` (lines 45–80):
    ```javascript
    function getTransporter() {
      const config = getSystemConfig();
      const host = config.smtp_host;
      const port = parseInt(config.smtp_port || '587');
      ...
    ```
  - Observed settings API in `server/routes/admin.js` (lines 535–595) reading and writing `configuracion_sistema` table via dynamic column mapping.

- **R5 (Shopping Cart & Group Bookings)**:
  - Observed single-room state flow mapping in `src/pages/BookingWidget.tsx` (Step 2 and Step 3).
  - Observed secure internal group booking transaction endpoint `/hotel/reservas/grupo` in `server/routes/hotel.js` (lines 333–638).

- **Tests and Execution Framework**:
  - Observed Vitest configuration in `package.json` (line 9): `"test": "vitest run"`.
  - Found calculation tests in `server/utils/calculations.test.js` and group bookings test in `server/routes/group_bookings.test.js`.

---

## 2. Logic Chain
1. **R1 Analysis**:
   - Because `filteredPlanes` inside `NuevaReserva.tsx` regulates the available rates in both the drop-down selector and the dynamic alternatives rate grid, filtering it with `p.visible_web === 1` will instantly restrict the entire interface to web-visible rates.
2. **R2 Analysis**:
   - Because `!depositAmount` check blocks updates if any character is entered, a change in dates or room types does not update the suggested abono, leaving it out-of-sync. Introducing a dirty flag (`isDepositDirty`) allows auto-syncing while preserving manual entries. Quick-fill buttons direct-set the state and set the dirty flag.
3. **R3 Analysis**:
   - Because offline validation needs to ensure compliance, checking that `receiptFile` is present when `depositAmount > 0` and the selected payment method is in `['transferencia', 'yappy', 'cuponera_oferta_simple', 'cuponera_pahoy']` cleanly addresses the mandatory upload requirement. Porting `PayPalButtons` into the UI replaces the standard submit button, assuring transactional integrity.
4. **R4 Analysis**:
   - Because external dependency additions might violate workspace security guidelines or offline-sandbox stability, implementing the Resend integration via a direct, native HTTP request to the `https://api.resend.com/emails` REST API endpoint using the standard Node.js `https` module is robust, high-performance, and has zero dependencies.
5. **R5 Analysis**:
   - Because public guests want to book multiple rooms of potentially different types in a single payment, introducing a frontend `cart` array (`CartItem[]`) and a new unauthenticated transaction endpoint `/api/v1/public/reservar/grupo` (reproducing `/hotel/reservas/grupo` transaction mechanics) will allow safe multi-room group checkouts.

---

## 3. Caveats
- We did not execute the test suite via PowerShell because this is a read-only investigation. All logic chain assertions were verified through direct, static trace analysis of file lines.

---

## 4. Conclusion
The PMS codebase is fully mapped, clean, and structurally designed to support all five requirements. Implementation plans are detailed, safe, and fully integrated with existing SQLite and React architectures. 

---

## 5. Verification Method
1. **Tests Verification**:
   Run the backend verification suite using the command:
   ```bash
   npm run test
   ```
2. **File Inspection**:
   Inspect the comprehensive blueprint documentation created at:
   `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\teamwork_preview_explorer_followup\analysis.md`
