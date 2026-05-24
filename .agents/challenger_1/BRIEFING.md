# BRIEFING — 2026-05-21T11:29:48-05:00

## Mission
Adversarially challenge the mathematical calculations engine in server/utils/calculations.js and verify stay-based calculations, edge cases, and Vitest test suites.

## 🔒 My Identity
- Archetype: Empirical Challenger
- Roles: critic, specialist
- Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_1
- Original parent: 2657f1ca-b3bd-4e65-a2ad-e7a9b3232eab
- Milestone: Verify calculations engine
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Run verification code empirically to search for bugs
- Do not trust the worker's claims or logs
- Report findings to C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_1\challenge.md

## Current Parent
- Conversation ID: 2657f1ca-b3bd-4e65-a2ad-e7a9b3232eab
- Updated: 2026-05-21T11:29:48-05:00

## Review Scope
- **Files to review**: `server/utils/calculations.js`, associated Vitest test files.
- **Interface contracts**: `PROJECT.md` or other system specs.
- **Review criteria**: Correctness of pricing, per-person rates for Pasadía and Estadía, edge case robustness (0/negative/non-numeric values), timezone proofing.

## Key Decisions Made
- Analyzed `server/utils/calculations.js`, `server/utils/calculations.test.js`, and `server/utils/calculations.stress.test.js`.
- Discovered that the stress test suite `calculations.stress.test.js` is broken due to ReferenceErrors.
- Identified timezone day-shifting vulnerability in `parseDateToUTC` for local Date objects and slash-separated dates.
- Verified 0-adult discrepancy between standard and rates-based cotización engines.
- Identified validation gaps allowing negative and NaN calculations.
- Wrote detailed adversarial challenge report at `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_1\challenge.md`.

## Attack Surface
- **Hypotheses tested**: Timezone-proofing of `parseDateToUTC`, per-person price multiplier for Pasadía vs Estadía, edge-case bounds (0 adults, negative and non-numeric inputs).
- **Vulnerabilities found**: 
  1. Broken stress test suite (ReferenceError for `parseDateToUTC`).
  2. Timezone day-shifting via local Date fallback and slash-separated date parsing.
  3. Inconsistent 0-adult behavior between `calcReservation` and `calcReservationWithRates`.
  4. Lack of input validation/sanitization, resulting in negative totals and `NaN` leakage.
- **Untested angles**: Holiday matching format discrepancies in sqlite databases (beyond typical YYYY-MM-DD format).

## Artifact Index
- C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\challenger_1\challenge.md — Detailed adversarial math review report.
