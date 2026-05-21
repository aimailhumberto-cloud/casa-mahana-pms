# Progress — Group Bookings and Multiple Units (Master/Child Bookings)

Last visited: 2026-05-20T15:21:00-05:00

## Current Status
- Initialized briefing and original prompt copy.
- Starting Step 5: Investigate the relevant codebase.

## Plan
- [ ] Step 1: Examine schema.sql and update `reservas_hotel` table and add group index.
- [ ] Step 2: Examine database.js and implement dynamic column updates (PRAGMA or ALTER).
- [ ] Step 3: Implement `POST /hotel/reservas/grupo` with transactions, availability checks, unique group code, pricing calculation, consolidated billing folio logic.
- [ ] Step 4: Refactor `GET /hotel/reservas` search router to support filtering by `grupo_codigo`.
- [ ] Step 5: Update `POST /hotel/reservas/:id/folio` to support consolidated billing redirection.
- [ ] Step 6: Verify backend build and test suite, check for errors.
- [ ] Step 7: Draft Handoff Report.
