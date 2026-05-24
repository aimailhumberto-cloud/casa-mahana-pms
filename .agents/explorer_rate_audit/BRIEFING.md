# BRIEFING — 2026-05-21T16:32:45-05:00

## Mission
Audit the PMS codebase for stay-based adult rates calculations, group booking guest count inheritance, adding an extra person action, and verifying the Vitest test suite.

## 🔒 My Identity
- Archetype: Explorer
- Roles: Read-only investigator, synthesis and reporting
- Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_rate_audit
- Original parent: 8b72ad84-e17e-4604-8ba7-896fe9e28c83
- Milestone: explorer_rate_audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Report exact files and lines of code
- Do not modify source code or tests

## Current Parent
- Conversation ID: 8b72ad84-e17e-4604-8ba7-896fe9e28c83
- Updated: not yet

## Investigation State
- **Explored paths**: `server/utils/calculations.js`, `server/utils/calculations.test.js`, `server/utils/calculations.stress.test.js`, `src/pages/NuevaReserva.tsx`, `src/pages/ReservaDetalle.tsx`, `server/db/schema.sql`
- **Key findings**:
  - Stay-based adult rates are already strictly per-person. No flat rate logic exists for adults in the backend calculations.
  - Subsequent rooms in group bookings inherit guest counts during calculation due to fallback in the auto-cotizar `useEffect` of `NuevaReserva.tsx`. This can be corrected with a primary room check.
  - The "➕ Persona Extra" card has three gaps in `ReservaDetalle.tsx`: Concept is not editable, Total amount is not editable, and payload is missing fields.
- **Unexplored areas**: None. The audit is complete.

## Key Decisions Made
- Initializing the read-only exploration workspace and setting up briefing, progress, and prompt files.
- Running the full Vitest test suite (`npm test -- --run`) which passed completely with 86 tests.

## Artifact Index
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_rate_audit\original_prompt.md — Original dispatch prompt
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_rate_audit\BRIEFING.md — Current status briefing
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_rate_audit\progress.md — Liveness progress heartbeat
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_rate_audit\analysis.md — Detailed analysis report
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_rate_audit\handoff.md — 5-component handoff report
