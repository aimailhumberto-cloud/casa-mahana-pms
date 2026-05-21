# Implementation Plan: PMS Follow-up Requirements

This plan details the implementation steps for the five follow-up requirements in the Casa Mahana PMS.

## Scope of Work

### R1. Quotes and Alternative Rates Filtering
- **File**: `src/pages/NuevaReserva.tsx`
- **Changes**: Filter the `filteredPlanes` memo hook with `p.visible_web === 1`.
- **Verification**: Verify that only rates with `visible_web === 1` are shown in the dropdown and alternative rates grid.

### R2. Dynamic Deposit Sync & Quick Fills
- **File**: `src/pages/NuevaReserva.tsx`
- **Changes**: 
  - Add `isDepositDirty` state to track manual edits.
  - Reset `isDepositDirty` on dates/room/plan changes.
  - Automatically update `depositAmount` with `cotizacion.deposito_sugerido` if `isDepositDirty` is false.
  - Add three quick-fill buttons ("0%", "50%", "100%") to dynamically fill the input field.
- **Verification**: Change inputs in the reservation form and verify that the suggested deposit updates dynamically, and that the quick-fill buttons work.

### R3. PayPal & Mandatory Payment Attachments (Internal Flow)
- **File**: `src/pages/NuevaReserva.tsx`, `server/routes/public.js` (for reference)
- **Changes**:
  - In Step 4 "Registro de Abono":
    - If `depositMetodo === 'paypal'` or `depositMetodo === 'tarjeta'` and `depositAmount > 0`, integrate PayPal buttons in the PMS booking wizard.
    - Prevent direct submit, force successful PayPal capture, then proceed automatically with the reservation creation using the order ID.
    - For other payment methods (`['transferencia', 'yappy', 'cuponera_oferta_simple', 'cuponera_pahoy']`) where `depositAmount > 0`, validate that a `receiptFile` (attachment) has been uploaded. If not, block submission with an alert warning.
- **Verification**: Try submitting without attachment for offline methods (should fail), and check the rendering/flow of PayPal buttons.

### R4. Resend Email Integration
- **Files**: `server/db/database.js`, `server/routes/admin.js`, `server/notifications.js`, `src/pages/Configuracion.tsx`
- **Changes**:
  - **Database**: Add `email_provider` (default 'smtp') and `resend_api_key` columns dynamically to `configuracion_sistema` table during seeding/initialization in `database.js`.
  - **Admin API**: Include these new fields in the allowed settings payload inside `server/routes/admin.js` for both SMTP configuration and email sending.
  - **Notifications**: Refactor `sendEmail` in `server/notifications.js` to dispatch using the Resend REST API (via native Node `https` module) if `email_provider === 'resend'`.
  - **UI Settings**: Update `src/pages/Configuracion.tsx` to let admins toggle between "SMTP Standard" and "Resend API", configure `resend_api_key`, and hide SMTP inputs when Resend is selected.
- **Verification**: Verify configuration is saved to database. Add/run integration tests verifying Resend dispatch path.

### R5. Multi-room Public Booking Widget (Shopping Cart & Group API)
- **Files**: `src/pages/BookingWidget.tsx`, `server/routes/public.js`
- **Changes**:
  - **Frontend UI**:
    - Update public guest selector to support up to 30 people.
    - Re-engineer booking wizard step 2 and step 3 to support a shopping cart.
    - Maintain a list of `CartItem[]` representing selected rooms, plans, guests, and cotizaciones.
    - Offer a post-selection dialog: "Add another room" (returns to Step 2) or "Proceed to Checkout" (goes to Step 4 summary).
    - Summarize all cart items in Step 4 with a consolidated total and minimum deposit.
    - Implement a single group booking API call on checkout.
  - **Backend API**:
    - Create a public unauthenticated `/api/v1/public/reservar/grupo` endpoint in `server/routes/public.js`.
    - Extract group booking logic inside a single transaction: resolve room types to actual IDs, validate availability/dates, insert multiple reservations in `reservas_hotel` with `parent_reserva_id` and a shared `grupo_codigo`, and create consolidated folios.
- **Verification**: Test the booking widget end-to-end to verify multi-room cart booking and SQLite data integrity.

---

## Execution Steps & Subagents

1. **Step 1: Code modification & Implementation** (Worker subagent)
   - Assign all implementation tasks (R1 - R5) to `teamwork_preview_worker`.
   - The worker will modify the files, run incremental builds, and implement the necessary logic.
   - The worker must run tests (`npm run test`) and production build (`npm run build`) to verify all works.
2. **Step 2: Review and Verification** (Reviewer subagent)
   - Spawn a `teamwork_preview_reviewer` to review the modifications.
   - The reviewer will test correctness, robustness, and check for lints or build problems.
3. **Step 3: Forensic Audit** (Auditor subagent)
   - Spawn the `teamwork_preview_auditor` to verify code integrity and ensure no cheat/fake implementations exist.
4. **Step 4: Final Synthesis & Handoff** (Orchestrator)
   - Aggregate all results and present the final completion report.
