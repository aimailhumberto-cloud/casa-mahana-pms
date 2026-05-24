# BRIEFING — 2026-05-21T13:26:00Z

## Mission
Investigate backend and rate calculations in Casa Mahana PMS for timezone-proof rates and per-person Pasadía rates.

## 🔒 My Identity
- Archetype: Explorer 1 (Read-only Investigator)
- Roles: Read-only Investigator, Synthesizer, Report Writer
- Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1
- Original parent: ff87ec31-9fe0-41d2-9327-1ac8dcd49815
- Milestone: Timezone-proof and Pasadía Rate Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement code changes.
- CODE_ONLY network mode (no external services/HTTP).
- Strictly write to my own directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1

## Current Parent
- Conversation ID: ff87ec31-9fe0-41d2-9327-1ac8dcd49815
- Updated: 2026-05-21T13:26:00Z

## Investigation State
- **Explored paths**:
  - `server/utils/calculations.js` (Backend pricing engine)
  - `server/utils/calculations.test.js` (Pricing test suites)
  - `src/pages/BookingWidget.tsx` (Public client booking widget)
  - `server/db/schema.sql` (Database schema definitions)
  - `server/db/database.js` (Database initial seeding and migrations)
- **Key findings**:
  - **Timezone Vulnerability**: Found that `calculations.js` and `BookingWidget.tsx` use local Date parsing like `new Date(checkIn + 'T12:00:00')` and local `.getDay()`, which causes date shifts and double/skipped days depending on the server or browser's timezone.
  - **Pasadía Per-Person Rates**: Pasadía plans have a `categoria = 'Pasadía'` in `planes_tarifa`. When executing their cotizations, we must bypass the nights multiplier (forcing it to 1 since Pasadía check-in equals check-out) and sum per-person rates directly.
- **Unexplored areas**: None, the entire requested scope has been successfully explored and resolved.

## Key Decisions Made
- Created a robust UTC parsing helper `parseDateToUTC()` to cleanly deserialize `YYYY-MM-DD` strings without local context.
- Modified `calcReservation` and `calcReservationWithRates` to dynamically apply a 1x multiplier when the plan category is `Pasadía`, while fully preserving all other parameters and fields for perfect backward compatibility.

## Artifact Index
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\original_prompt.md — Dispatch prompt record
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\proposed_calculations.js — Proposed timezone-safe and Pasadía-compliant calculations utility
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\explorer_sugerido_1\proposed_calculations.test.js — Proposed expanded vitest suite covering the new features
