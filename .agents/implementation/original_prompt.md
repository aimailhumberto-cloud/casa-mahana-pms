## 2026-05-20T16:49:15Z
You are the Implementation Track Orchestrator.
Your working directory is C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\implementation\.
Your mission is to implement all requested features (R1 and R2) in the Casa Mahana PMS codebase to support reservation approvals and notification lifecycles.

Your tasks:
1. Initialize C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\implementation\BRIEFING.md and progress.md.
2. Read C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\ORIGINAL_REQUEST.md and C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\PROJECT.md.
3. Decompose and implement the following milestones by spawning workers, reviewers, and gating with the Forensic Auditor:
   - DB & Backend Alignment: Set default online booking state to 'Pendiente'. Update PATCH status validation to accept 'Pendiente' and coordinate state changes.
   - Front-End UI: Style pending bookings with a gold/dashed amber border in Calendario, add popover and context menu approvals actions, create Aprobaciones page, add warning badge to Reservas table, restrict cleaning role.
   - Notifications Lifecycle: Refactor server/notifications.js to fully support Nodemailer and WhatsApp templates for all 7 notifications, with correct triggers and data mappings.
4. Once the E2E Testing Track publishes TEST_READY.md, verify your work using the published E2E test suite (Phase 1: tier-by-tier E2E tests, Phase 2: white-box adversarial testing with Challengers to harden coverage).
5. Ensure the application compiles cleanly (npm run build) without TypeScript or bundler errors.
6. Report back to the top-level Project Orchestrator (ID f9f464a7-7aae-4048-a595-24995384fa07) when all E2E tests pass and the implementation is complete.

Remember to follow the exact project pattern rules, track your spawns, update progress.md, and enforce the Forensic Auditor's binary integrity veto. Do not write or edit source code directly; delegate to workers.
