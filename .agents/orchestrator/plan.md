# Implementation Plan: PMS Public Security & Mobile Responsiveness

This plan details the implementation steps for public endpoint security and mobile responsiveness improvements in the Casa Mahana PMS Booking Widget.

## Scope of Work

### R1. Public Endpoint Security & Isolation Audit
- **Files**: `server/server.js`, `server/routes/*.js` (specifically `public.js`, `hotel.js`, `admin.js`, etc.)
- **Changes**:
  - Audit all public route endpoints (e.g., `/api/v1/public/*`) to ensure they do not expose administrative actions, database configurations, API keys, or financial stats.
  - Verify that `requireAuth` or appropriate role-based access control (RBAC) middleware is correctly and securely applied to all private hotel routes (e.g., `/api/v1/hotel/*` and `/api/v1/admin/*`).
  - Verify that unauthenticated users cannot manipulate reservation states, access other guests' data, or query administrative configurations.
- **Verification**: Write integration tests verifying that trying to access private endpoints without a valid JWT token returns a 401/403 status.

### R2. Mobile Viewport Layout Alignment (UI/UX)
- **Files**: `src/pages/BookingWidget.tsx` and related styles.
- **Changes**:
  - **Experience Toggle Tab**: Shorten or wrap labels on small screens to prevent overcrowding. Apply responsive flex/grid layouts.
  - **Guest Counts Truncation**: Adjust layouts, paddings, and font sizes, or stack selections vertically to prevent text truncation (e.g., "0 mascc...") down to 320px viewport width.
  - **Bottom Floating Validation Panel & Cart Lists**: Ensure the panel and multi-room cart lists fit perfectly and do not overflow or overlap on viewport widths down to 320px. Stack buttons or minimize unnecessary vertical padding on small viewports.
- **Verification**: Run build checks (`npm run build`) and use tests or manual validation logs.

---

## Execution Steps & Subagents

1. **Step 1: Explore & Analyze Codebase** (Explorer subagent)
   - Spawn a `teamwork_preview_explorer` to inspect the public routes, private routes, authentication middleware, and layout styles in the React frontend.
2. **Step 2: Implementation & Fixes** (Worker subagent)
   - Spawn a `teamwork_preview_worker` to secure private routes, fix the mobile layout in the booking widget, and run builds and tests.
3. **Step 3: Review & Verification** (Reviewer subagent)
   - Spawn a `teamwork_preview_reviewer` to review the modifications.
4. **Step 4: Forensic Audit** (Auditor subagent)
   - Spawn a `teamwork_preview_auditor` to verify integrity and ensure no cheat/fake implementations.
5. **Step 5: Final Synthesis & Handoff** (Orchestrator)
   - Compile all handoffs, verify build/test status, and report completion to the Sentinel.
