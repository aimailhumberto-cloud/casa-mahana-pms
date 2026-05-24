# plan.md — Victory Audit Plan for Sugerido Milestone

This plan details the step-by-step verification process to perform a rigorous, independent victory audit on the Room Recommendation Engine ('El Sugerido'), Online Pasadías, Timezone-proof rate calculations, and Cart state cleanup.

## Phase A: Timeline & Provenance Audit
- [ ] **Step A.1**: Reconstruct the development timeline and sequence of activities from plans, logs, and Git status.
- [ ] **Step A.2**: Check file timestamps and modification history to detect any implausible or pre-fabricated development timelines.
- [ ] **Step A.3**: Verify that verification artifacts and test logs do not predate the code implementation.

## Phase B: Integrity & Forensic Verification
- [ ] **Step B.1**: Audit `server/utils/calculations.js` for time-zone calculations, checking for hardcoded results or facade implementations.
- [ ] **Step B.2**: Audit `server/routes/public.js` for Pasadía-handling logic, availability checking, and timezone booking blocks. Check for facade behaviors or bypasses.
- [ ] **Step B.3**: Audit `src/pages/BookingWidget.tsx` for:
  - 'El Sugerido' room recommendation solver (backtracking logic, weighting, recursion constraints, cap on combination generator).
  - Online Pasadías widget options and checkout flow integrations.
  - Strictly UTC date/time calculations.
  - Cart state cleanup hook (`useEffect`).
  - Verify no mock/bypass shortcuts.

## Phase C: Independent Test Execution & Compilation
- [ ] **Step C.1**: Execute type compilation checks using `npx tsc --noEmit` and verify there are no typescript compilation errors.
- [ ] **Step C.2**: Execute the canonical test command `npm run test` (or `vitest run`) independently and inspect individual test cases.
- [ ] **Step C.3**: Execute `npm run build` to confirm production Vite packaging compiles with no issues.
- [ ] **Step C.4**: Compare independent test/build outputs with team assertions and write the definitive Victory Audit Report.
