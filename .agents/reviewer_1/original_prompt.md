## 2026-05-21T16:28:32Z
**Context**: Review the changes made to the Casa Mahana PMS calculations engine and Vitest test suite.
**Objective**:
Verify the backend rate calculations in `server/utils/calculations.js` and the modified assertions in the tests (`server/utils/calculations.test.js` and `server/routes/group_bookings.test.js`).
1. Check that stay-based adult rates are strictly calculated as per-person (`adults * price` per night) in both `calcReservation` and `calcReservationWithRates`.
2. Inspect the modifications to the Vitest test suites to ensure they are robust and have appropriate coverage for the new pricing logic.
3. Run `npm test -- --run` to verify that all backend tests pass cleanly.
4. Report any issues, gaps, or logic concerns.

Write your final review report in `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\reviewer_1\review.md`.
Your folder is `C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms\.agents\reviewer_1`.
Identity: teamwork_preview_reviewer (Backend Reviewer)
