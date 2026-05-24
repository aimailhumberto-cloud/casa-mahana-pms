const { calcNoches, calcReservation, getDayType, getRateForDay, calcReservationWithRates } = require('./server/utils/calculations');

console.log("=== EMPIRICAL MATH VERIFICATION ===");

// 1. Verify 0-adult discrepancy
console.log("\n1. 0-Adult Discrepancy:");
const res1 = calcReservation({
  adultos: 0,
  menores: 2,
  mascotas: 0,
  noches: 2,
  precio_adulto_noche: 100,
  precio_menor_noche: 50,
  precio_mascota_noche: 20,
  impuesto_pct: 10
});
console.log("calcReservation subtotal with 0 adults (forces 1 adult):", res1.subtotal); // Expected: 400

try {
  // Let's call calcReservationWithRates with 0 adults
  // We need to mock database or just run it if database is initialized. Let's see if it works.
  const database = require('./server/db/database');
  const db = database.getDb();
  
  const res2 = calcReservationWithRates(1, '2026-05-24', '2026-05-25', 0, 2, 0);
  console.log("calcReservationWithRates subtotal with 0 adults:", res2.subtotal); // Expected: 100
} catch (e) {
  console.log("calcReservationWithRates failed due to database or other error:", e.message);
}

// 2. Verify negative and invalid inputs
console.log("\n2. Negative/Invalid Inputs:");
const resNegative = calcReservation({
  adultos: -2,
  menores: -1,
  mascotas: -1,
  noches: -3,
  precio_adulto_noche: -100,
  precio_menor_noche: -50,
  precio_mascota_noche: -20,
  productos_adicionales: -50,
  impuesto_pct: 10
});
console.log("calcReservation with negative values (subtotal, total):", resNegative.subtotal, resNegative.monto_total);

// 3. Verify NaN outputs
console.log("\n3. NaN Outputs:");
try {
  const resNaN = calcReservationWithRates(1, '2026-05-24', '2026-05-25', 'invalid_adults', 2, 0);
  console.log("calcReservationWithRates with non-numeric adults (subtotal, total):", resNaN.subtotal, resNaN.monto_total);
} catch (e) {
  console.log("calcReservationWithRates with non-numeric adults failed:", e.message);
}

// 4. Verify timezone shifts in parseDateToUTC using a custom simulation
// Since parseDateToUTC is not exported, we can check how calcNoches or getDayType behaves.
console.log("\n4. Timezone/Day-Shifting via getDayType or calcNoches:");
// Let's check how '2026/05/22' (slash format) behaves.
// Depending on the local timezone of this machine, '2026/05/22' might shift.
// In UTC-5 (current timezone), new Date('2026/05/22') represents local May 22 00:00:00.
// UTC components: 2026-05-22 05:00:00 UTC -> Day is 22.
// Let's simulate a positive timezone or look at the code of parseDateToUTC.
console.log("calcNoches('2026/05/22', '2026/05-23') is:");
try {
  console.log(calcNoches('2026/05/22', '2026/05/23'));
} catch (e) {
  console.log("Error:", e.message);
}

console.log("\n=== END OF VERIFICATION ===");
