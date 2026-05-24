## 2026-05-21T16:25:10Z
Audit and fix rate calculation discrepancies across both internal and client booking widgets (making stay-based rates strictly per-person, fixing duplication of minors in group bookings), and implement a "Persona Extra" quick-charge folio button in ReservaDetalle.tsx.

## 2026-05-21T16:45:00Z
Resuming from compaction. Remaining Bugs (Critical Path):
- Bug 1: Double-Negative Bypass
- Bug 2: Group Booking 0-Guest Lock/Leak
- Bug 3: Timezone Day-Shifting Bug
- Bug 4: ReferenceError in Stress Test Suite
- Bug 5: Jarring Screen Flash
- Bug 6: Backend Route 0-Adult Validation
