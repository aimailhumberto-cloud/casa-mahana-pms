# BRIEFING — 2026-05-21T16:29:00Z

## Mission
Audit and fix rate calculation discrepancies (making stay-based rates strictly per-person, fixing duplication of minors in group bookings), and implement a "Persona Extra" quick-charge folio button in ReservaDetalle.tsx.

## 🔒 My Identity
- Archetype: Project Orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\orchestrator_rate_fixes_try2
- Original parent: main agent
- Original parent conversation ID: 183d8d77-63e5-4b73-b2cd-c3fc15635397

## 🔒 My Workflow
- **Pattern**: Project Pattern
- **Scope document**: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\PROJECT.md
1. **Decompose**: Decomposed by specific files/boundaries: Calculations logic (server/utils/calculations.js, server/utils/calculations.test.js), Group Bookings duplication (src/pages/NuevaReserva.tsx), and "Persona Extra" quick charge UI (src/pages/ReservaDetalle.tsx).
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Explorer → Worker → Reviewer → test → gate
   - **Delegate (sub-orchestrator)**: N/A (simple scope, single loop fits)
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Decompose requirements and design implementation plan [done]
  2. Explore codebases and find precise lines to change [pending]
  3. Implement core rate calculations, guest duplication fixes, and "Persona Extra" button [pending]
  4. Verify changes with vitest suite and clean build [pending]
- **Current phase**: 1
- **Current focus**: 3. Implement core calculations and UI changes

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: 183d8d77-63e5-4b73-b2cd-c3fc15635397
- Updated: not yet

## Key Decisions Made
- Use Project Pattern directly because this is a focused set of rate calculations and UI changes that fits in a single iteration loop.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_rate_audit | teamwork_preview_explorer | Explore calculations, group booking duplication, and folio quick charge UI | completed | e190b767-8b85-477b-9b94-c44ce049d706 |
| worker_rate_fixes | teamwork_preview_worker | Implement rate calculations, guest duplication fixes, and Persona Extra button | completed | cfd3f642-fdbc-42fe-9395-b41530e979c1 |
| reviewer_rate_fixes_1 | teamwork_preview_reviewer | Review calculations and UI changes | completed | fcfbb892-1aeb-497b-bd5e-a9b5398272de |
| reviewer_rate_fixes_2 | teamwork_preview_reviewer | Review calculations and UI changes | completed | f23becbc-1551-4c69-b508-6f7223babffa |
| auditor_rate_fixes | teamwork_preview_auditor | Forensic integrity audit on all changes | completed | 389d43ff-2764-433d-8076-154defee96bf |

## Succession Status
- Succession required: yes
- Spawn count: 5 / 16
- Pending subagents: none

## Active Timers
- Heartbeat cron: 8b72ad84-e17e-4604-8ba7-896fe9e28c83/task-17
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\orchestrator_rate_fixes_try2\original_prompt.md — Copy of the original user prompt
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\orchestrator_rate_fixes_try2\BRIEFING.md — Persistent memory index
