## 2026-05-24T18:58:17Z
You are a teamwork_preview_worker. Your working directory is C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_sec_layout.

Your mission is to implement:
1. Public Endpoint Security & Isolation Audit (R1):
   - Modify `server/routes/public.js` to protect `/reservas/:id/comprobante`. Require the guest's `email` (from request query or body) and match it against the reservation's email (case-insensitive and trimmed). Reject with `401 Unauthorized` if they don't match or if no email is provided.
   - Modify `server/routes/integrations.js` to validate a webhook secret (from query parameter `secret` or header `x-kommo-secret`) against the `kommo_webhook_secret` value in the database (`config_hotel` table) or `process.env.KOMMO_WEBHOOK_SECRET`. If a secret is configured, reject with `401 Unauthorized` if the client secret is invalid or missing.
   - Verify that all private hotel routes (e.g., `/api/v1/hotel/*` and `/api/v1/admin/*`) are protected by authentication/access control middleware (like `requireAuth`).
2. Mobile Viewport Layout Alignment (R2) in `src/pages/BookingWidget.tsx`:
   - Implement the responsive and mobile UX improvements as proposed in the Explorer's handoff:
     a) Experience toggle tabs: Shorten labels or hide the parenthetical suffix on extra small screens (`sm:inline` or similar text scaling) and reduce margins/paddings.
     b) Guest count selectors: Fix truncation ("0 mascc...") down to 320px width by making select texts shorter (e.g. displaying just the numbers "1", "2" with icons, or using simplified text) and scaling fonts/paddings.
     c) Shopping cart list: Make cart rows wrap or switch to a vertical layout (flex-col) on narrow screens so room names and prices don't overlap or get squished.
     d) Bottom validation panel: Add proper bottom padding (`pb-[320px] md:pb-48`) to Step 3 so the fixed floating panel does not cover form content, and make the 4-column stats grid wrap or stack (`grid-cols-2 sm:grid-cols-4`) to fit cleanly under 320px width.
3. Automated Tests:
   - Create a new integration test suite `server/routes/security.test.js` using Vitest to verify:
     - Public receipt upload `/api/v1/public/reservas/:id/comprobante` rejects unauthenticated attempts or mismatched emails, but succeeds with a matching email.
     - Webhook endpoint `/api/v1/public/integrations/kommo` rejects invalid secrets when a secret is configured.
     - Private endpoints like `/api/v1/hotel/reservas` reject requests without valid JWT auth (returning 401/403).
   - Ensure the new test file runs cleanly.
4. Verify build and all tests pass:
   - Run `npm run test` (to make sure all 73+ tests pass).
   - Run `npm run build` to make sure there are zero compilation or bundler errors.

Write your implementation report to C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\worker_sec_layout\handoff.md.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
