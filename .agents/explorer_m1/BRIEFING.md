# BRIEFING — 2026-05-21T16:26:00Z

## Mission
Audit calculation rates, frontend guest inheritance, and design the "Persona Extra" Folio UI action.

## 🔒 My Identity
- Archetype: explorer
- Roles: Read-only investigator, auditor
- Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_m1
- Original parent: 2657f1ca-b3bd-4e65-a2ad-e7a9b3232eab
- Milestone: Audit and Design Fixes for Calculations, Guest Inheritance, and Folio UI Actions

## 🔒 Key Constraints
- Read-only investigation — do NOT implement changes in source code
- CODE_ONLY network mode: no external requests, no curl/wget/http targeting external URLs

## Current Parent
- Conversation ID: db56e804-9ae6-4c63-a8ab-2452b1182f86
- Updated: 2026-05-21T16:26:00Z

## Investigation State
- **Explored paths**:
  - `server/utils/calculations.js`
  - `server/utils/calculations.test.js`
  - `server/routes/group_bookings.test.js`
  - `src/pages/NuevaReserva.tsx`
  - `src/pages/ReservaDetalle.tsx`
- **Key findings**:
  - `calculations.js` misses multiplying `baseAdultosMonto` by `adultos` for standard Estadías, treating it as a flat rate.
  - `NuevaReserva.tsx` has UI rendering fallbacks and submission payloads that default all room configurations to primary search values (due to `||` logic and missing index distinctions).
  - `ReservaDetalle.tsx` is ready to house a glassmorphic "➕ Persona Extra" button and purple card that calculates amounts dynamically and submits to `/hotel/reservas/:id/folio` as a `debito` transaction.
- **Unexplored areas**: None. Audit is fully comprehensive.

## Key Decisions Made
- Formulate precise, machine-applicable `.patch` format proposals inside the `analysis.md` report.
- Distinguish between primary room (`index === 0`) and subsequent rooms (`index > 0`) when handling React guest initialization and fallback state.
- Create a beautiful glassmorphic button and a purple `bg-purple-50` collapsible card for `ReservaDetalle.tsx` that defaults to $25/night and uses the reservation's actual `noches` as a base multiplier.

## Artifact Index
- `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_m1\analysis.md` — Detailed audit and exploration report containing code diffs and recommendations.
- `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_m1\handoff.md` — Structured 5-component handoff report for the Implementer.
- `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_m1\progress.md` — Liveness/heartbeat file.
