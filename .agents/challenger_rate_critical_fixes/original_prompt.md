## 2026-05-21T16:54:27Z

**Context**: Stress-test and challenge the 6 PMS bug fixes to verify empirical correctness, mathematical robustness, and UX safety.

**Objective**:
Adversarially challenge and verify the 6 critical path PMS bug fixes:
1. Test Bug 1: Verify that negative prices/nights individually trigger validation alerts and cannot bypass checks via double-negatives. Verify that special character script injection in `concepto` is correctly blocked by the safe regex whitelisting.
2. Test Bug 2: Verify that unchecking the leader room in NuevaReserva.tsx properly promotes the next room in line to leader and copies the search config guest counts safely, without locking.
3. Test Bug 3: Verify that slash-separated dates (e.g. "2026/05/22") parse to UTC identically to hyphen-separated dates, without local timezone offsets or positive/negative shifts. Verify that guest counts and rates are clamped correctly to positive bounds.
4. Test Bug 4: Stress-test `calculations.stress.test.js` under Vitest and check that no ESM/CJS mixed ReferenceErrors occur.
5. Test Bug 5: Verify that the Folio "Persona Extra" charge reloads the page silent list data smoothly, without jarring visual flashes or reloading skeleton screens.
6. Test Bug 6: Verify that the backend route explicitly rejects any room in a group reservation payload with 0 adults, returning 400 Bad Request.

Run Vitest to verify all tests execute legitimately and assert boundary cases correctly.

**Output Requirements**:
Write your challenge report in `C:\\Users\\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\.agents\\challenger_rate_critical_fixes\\challenge.md` summarizing:
- Detailed stress-testing outcomes for each bug area.
- UX and mathematical edge cases verified.
- Confirmation of no day-shifting timezone or calculation leak.

**Identity & Working Directory**:
- Type: teamwork_preview_challenger
- Role: Math & UX Challenger
- Working Directory: C:\\Users\\Usuario\\.gemini\\antigravity\\scratch\\casa-mahana-pms\\.agents\\challenger_rate_critical_fixes
