import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PMS_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PMS_ROOT, 'data', 'casa-mahana.db');
const WIDGET_PATH = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assert(description, condition, details = '') {
  total++;
  if (condition) {
    passed++;
    console.log(`  [PASS] ${description}`);
  } else {
    failed++;
    failures.push({ description, details });
    console.error(`  [FAIL] ${description} -> ${details}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARSER IMPLEMENTATION EXTRACTED DIRECTLY FROM BookingWidget.tsx
// ─────────────────────────────────────────────────────────────────────────────
function parseBookingSearchParamsFromUrl(urlString) {
  const url = new URL(urlString, 'https://reservas.casamahana.com');
  const params = url.searchParams;

  // 1. category: decodeURIComponent. If present and equals 'Pasadía' or 'Estadía', set categoria.
  const rawCat = params.get('category');
  let categoria = null;
  if (rawCat) {
    const decoded = decodeURIComponent(rawCat).trim();
    if (decoded.localeCompare('Pasadía', undefined, { sensitivity: 'accent' }) === 0 || decoded.toLowerCase() === 'pasadia' || decoded.toLowerCase() === 'pasadía') {
      categoria = 'Pasadía';
    } else if (decoded.localeCompare('Estadía', undefined, { sensitivity: 'accent' }) === 0 || decoded.toLowerCase() === 'estadia' || decoded.toLowerCase() === 'estadía') {
      categoria = 'Estadía';
    }
  }

  // 2. plan: requested plan code
  const rawPlan = params.get('plan');
  const plan = rawPlan ? decodeURIComponent(rawPlan).trim() : null;

  // If category was not provided in the URL: infer category from plan
  let finalCategoria = 'Estadía';
  if (categoria) {
    finalCategoria = categoria;
  } else if (plan) {
    if (plan.startsWith('pasadia_')) {
      finalCategoria = 'Pasadía';
    } else {
      finalCategoria = 'Estadía';
    }
  }

  // 3. date or check_in: if present, set checkIn
  const rawDate = params.get('date') || params.get('check_in');
  let checkIn = rawDate ? decodeURIComponent(rawDate).trim() : '';
  let checkOut = '';

  if (checkIn) {
    if (finalCategoria === 'Pasadía') {
      checkOut = checkIn;
    } else {
      const rawCheckOut = params.get('check_out');
      if (rawCheckOut) {
        checkOut = decodeURIComponent(rawCheckOut).trim();
      } else {
        const [y, m, d] = checkIn.split('-').map(Number);
        if (y && m && d) {
          const dt = new Date(Date.UTC(y, m - 1, d));
          dt.setUTCDate(dt.getUTCDate() + 1);
          checkOut = dt.toISOString().split('T')[0];
        }
      }
    }
  } else {
    const rawCheckOut = params.get('check_out');
    if (rawCheckOut) {
      checkOut = decodeURIComponent(rawCheckOut).trim();
    }
  }

  // 4. guests or adults: parse integer. If valid number > 0, set adultos = parsed
  const rawGuests = params.get('guests') || params.get('adults');
  let adultos = 1;
  if (rawGuests) {
    const parsed = parseInt(rawGuests, 10);
    if (!isNaN(parsed) && parsed > 0) {
      adultos = parsed;
    }
  }

  return {
    categoria: finalCategoria,
    requestedPlanCode: plan,
    checkIn,
    checkOut,
    adultos,
  };
}

async function runChallengerStressTests() {
  console.log('================================================================');
  console.log(' CHALLENGER 1 — EMPIRICAL INTEGRATION & STRESS TEST SUITE       ');
  console.log('================================================================');

  // ── TEST SUITE 1: Direct SQLite Database Inspection ────────────────────────
  console.log('\n--- Suite 1: SQLite Database Verification (data/casa-mahana.db) ---');
  const db = new Database(DB_PATH, { readonly: true });

  const activePlans = db.prepare(`
    SELECT codigo, nombre, categoria, precio_adulto_noche, precio_menor_noche, visible_web, activo, lleva_impuesto, impuesto_pct
    FROM planes_tarifa
    WHERE activo = 1 AND visible_web = 1
  `).all();

  console.log(`Found ${activePlans.length} active web-visible plans in database:`);
  activePlans.forEach(p => console.log(`  - [${p.codigo}] ${p.nombre} (${p.categoria}): $${p.precio_adulto_noche}/adult, tax: ${p.lleva_impuesto ? (p.impuesto_pct || 10) + '%' : '0%'}`));

  const escapePlan = activePlans.find(p => p.codigo === 'escape_mahana');
  assert('DB Plan: escape_mahana exists with activo=1 and visible_web=1', !!escapePlan);
  assert('DB Plan: escape_mahana rate is exactly $16.50', escapePlan?.precio_adulto_noche === 16.50, `Found: ${escapePlan?.precio_adulto_noche}`);
  assert('DB Plan: escape_mahana category is Estadía', escapePlan?.categoria === 'Estadía', `Found: ${escapePlan?.categoria}`);
  assert('DB Plan: escape_mahana tax is 0% (lleva_impuesto=0)', escapePlan?.lleva_impuesto === 0);

  const todoIncluidoPlan = activePlans.find(p => p.codigo === 'todo_incluido');
  assert('DB Plan: todo_incluido exists with activo=1 and visible_web=1', !!todoIncluidoPlan);
  assert('DB Plan: todo_incluido rate is canonical $66.00', todoIncluidoPlan?.precio_adulto_noche === 66.00, `Found: ${todoIncluidoPlan?.precio_adulto_noche}`);
  assert('DB Plan: todo_incluido tax is 10%', todoIncluidoPlan?.lleva_impuesto === 1 && (todoIncluidoPlan?.impuesto_pct === 10 || todoIncluidoPlan?.impuesto_pct === null));

  const mahanaExpPlan = activePlans.find(p => p.codigo === 'mahana_exp');
  assert('DB Plan: mahana_exp exists with activo=1 and visible_web=1', !!mahanaExpPlan);
  assert('DB Plan: mahana_exp rate is canonical $49.50', mahanaExpPlan?.precio_adulto_noche === 49.50, `Found: ${mahanaExpPlan?.precio_adulto_noche}`);
  assert('DB Plan: mahana_exp tax is 10%', mahanaExpPlan?.lleva_impuesto === 1);

  const pasadiaComidasPlan = activePlans.find(p => p.codigo === 'pasadia_comidas');
  assert('DB Plan: pasadia_comidas exists with activo=1 and visible_web=1', !!pasadiaComidasPlan);
  assert('DB Plan: pasadia_comidas rate is canonical $35.00', pasadiaComidasPlan?.precio_adulto_noche === 35.00, `Found: ${pasadiaComidasPlan?.precio_adulto_noche}`);
  assert('DB Plan: pasadia_comidas category is Pasadía', pasadiaComidasPlan?.categoria === 'Pasadía', `Found: ${pasadiaComidasPlan?.categoria}`);

  const pasadiaEntradaPlan = activePlans.find(p => p.codigo === 'pasadia_entrada');
  assert('DB Plan: pasadia_entrada exists with activo=1 and visible_web=1', !!pasadiaEntradaPlan);
  assert('DB Plan: pasadia_entrada rate is canonical $5.50', pasadiaEntradaPlan?.precio_adulto_noche === 5.50, `Found: ${pasadiaEntradaPlan?.precio_adulto_noche}`);
  assert('DB Plan: pasadia_entrada category is Pasadía', pasadiaEntradaPlan?.categoria === 'Pasadía', `Found: ${pasadiaEntradaPlan?.categoria}`);

  // Holidays check
  const festivos = db.prepare('SELECT COUNT(*) as count FROM dias_festivos').get();
  assert('DB Holidays: Panamanian holidays table populated', festivos.count > 0, `Count: ${festivos.count}`);

  // Rate rules check
  const reglas = db.prepare('SELECT COUNT(*) as count FROM reglas_tarifa WHERE activo = 1').get();
  assert('DB Rules: Rate rules table populated with day-type tiers', reglas.count > 0, `Count: ${reglas.count}`);

  db.close();

  // ── TEST SUITE 2: Parameter Ingestion & Edge Cases (BookingWidget.tsx) ──────
  console.log('\n--- Suite 2: Parameter Ingestion Stress Testing ---');

  // Edge case 1: Empty parameters
  const emptyRes = parseBookingSearchParamsFromUrl('/reservar');
  assert('Empty params: default category is Estadía', emptyRes.categoria === 'Estadía');
  assert('Empty params: requestedPlanCode is null', emptyRes.requestedPlanCode === null);
  assert('Empty params: checkIn is empty', emptyRes.checkIn === '');
  assert('Empty params: checkOut is empty', emptyRes.checkOut === '');
  assert('Empty params: default adults is 1', emptyRes.adultos === 1);

  // Edge case 2: Missing category inference
  const inf1 = parseBookingSearchParamsFromUrl('/reservar?plan=pasadia_comidas');
  assert('Missing category inferred as Pasadía for pasadia_comidas', inf1.categoria === 'Pasadía');

  const inf2 = parseBookingSearchParamsFromUrl('/reservar?plan=pasadia_entrada');
  assert('Missing category inferred as Pasadía for pasadia_entrada', inf2.categoria === 'Pasadía');

  const inf3 = parseBookingSearchParamsFromUrl('/reservar?plan=todo_incluido');
  assert('Missing category inferred as Estadía for todo_incluido', inf3.categoria === 'Estadía');

  const inf4 = parseBookingSearchParamsFromUrl('/reservar?plan=escape_mahana');
  assert('Missing category inferred as Estadía for escape_mahana', inf4.categoria === 'Estadía');

  const inf5 = parseBookingSearchParamsFromUrl('/reservar?plan=unknown_plan');
  assert('Missing category defaults to Estadía for unknown_plan', inf5.categoria === 'Estadía');

  // Edge case 3: Invalid guest values
  const g1 = parseBookingSearchParamsFromUrl('/reservar?guests=-1');
  assert('Invalid guests: negative guests (-1) fallbacks to 1', g1.adultos === 1, `Got ${g1.adultos}`);

  const g2 = parseBookingSearchParamsFromUrl('/reservar?guests=0');
  assert('Invalid guests: zero guests (0) fallbacks to 1', g2.adultos === 1, `Got ${g2.adultos}`);

  const g3 = parseBookingSearchParamsFromUrl('/reservar?guests=abc');
  assert('Invalid guests: non-numeric guests ("abc") fallbacks to 1', g3.adultos === 1, `Got ${g3.adultos}`);

  const g4 = parseBookingSearchParamsFromUrl('/reservar?guests=1.5');
  assert('Invalid guests: float guests ("1.5") truncates to 1', g4.adultos === 1, `Got ${g4.adultos}`);

  const g5 = parseBookingSearchParamsFromUrl('/reservar?adults=-999');
  assert('Invalid adults alias: negative adults (-999) fallbacks to 1', g5.adultos === 1, `Got ${g5.adultos}`);

  const g6 = parseBookingSearchParamsFromUrl('/reservar?adults=foo');
  assert('Invalid adults alias: non-numeric adults ("foo") fallbacks to 1', g6.adultos === 1, `Got ${g6.adultos}`);

  const g7 = parseBookingSearchParamsFromUrl('/reservar?guests=&adults=4');
  assert('Guest alias precedence: adults=4 ingested when guests empty', g7.adultos === 4, `Got ${g7.adultos}`);

  // Edge case 4: Pasadía checkout locking vs Estadía multi-day calculation
  const pLock1 = parseBookingSearchParamsFromUrl('/reservar?plan=pasadia_comidas&date=2026-11-15');
  assert('Pasadía date handoff: checkOut locked to checkIn', pLock1.checkOut === '2026-11-15' && pLock1.checkIn === '2026-11-15', `Got checkIn=${pLock1.checkIn}, checkOut=${pLock1.checkOut}`);

  const pLock2 = parseBookingSearchParamsFromUrl('/reservar?plan=pasadia_comidas&date=2026-11-15&check_out=2026-11-20');
  assert('Pasadía date lock: checkOut strictly locked to checkIn even with conflicting check_out in URL', pLock2.checkOut === '2026-11-15', `Got ${pLock2.checkOut}`);

  const pLock3 = parseBookingSearchParamsFromUrl('/reservar?category=Pasad%C3%ADa&check_in=2026-12-01&check_out=2026-12-05');
  assert('Explicit Pasadía category: checkOut strictly locked to checkIn', pLock3.checkOut === '2026-12-01', `Got ${pLock3.checkOut}`);

  const estMulti1 = parseBookingSearchParamsFromUrl('/reservar?plan=todo_incluido&date=2026-11-15');
  assert('Estadía single date: checkOut auto-calculated as checkIn + 1 day', estMulti1.checkOut === '2026-11-16', `Got ${estMulti1.checkOut}`);

  const estMulti2 = parseBookingSearchParamsFromUrl('/reservar?plan=todo_incluido&date=2026-11-15&check_out=2026-11-18');
  assert('Estadía explicit check_out: preserved when provided', estMulti2.checkOut === '2026-11-18', `Got ${estMulti2.checkOut}`);

  // Edge case 5: Date boundary rollovers (UTC arithmetic)
  const rollMonth = parseBookingSearchParamsFromUrl('/reservar?category=Estadía&date=2026-10-31');
  assert('Date rollover: month end (2026-10-31) rolls to next month (2026-11-01)', rollMonth.checkOut === '2026-11-01', `Got ${rollMonth.checkOut}`);

  const rollYear = parseBookingSearchParamsFromUrl('/reservar?category=Estadía&date=2026-12-31');
  assert('Date rollover: year end (2026-12-31) rolls to next year (2027-01-01)', rollYear.checkOut === '2027-01-01', `Got ${rollYear.checkOut}`);

  const rollLeap = parseBookingSearchParamsFromUrl('/reservar?category=Estadía&date=2028-02-28');
  assert('Date rollover: leap year (2028-02-28) rolls to 2028-02-29', rollLeap.checkOut === '2028-02-29', `Got ${rollLeap.checkOut}`);

  // Edge case 6: Accented and encoded category inputs
  const c1 = parseBookingSearchParamsFromUrl('/reservar?category=Estad%C3%ADa');
  assert('Category parse: URL-encoded "Estad%C3%ADa" resolves to "Estadía"', c1.categoria === 'Estadía');

  const c2 = parseBookingSearchParamsFromUrl('/reservar?category=Pasad%C3%ADa');
  assert('Category parse: URL-encoded "Pasad%C3%ADa" resolves to "Pasadía"', c2.categoria === 'Pasadía');

  const c3 = parseBookingSearchParamsFromUrl('/reservar?category=pasadia');
  assert('Category parse: lowercase unaccented "pasadia" resolves to "Pasadía"', c3.categoria === 'Pasadía');

  const c4 = parseBookingSearchParamsFromUrl('/reservar?category=estadia');
  assert('Category parse: lowercase unaccented "estadia" resolves to "Estadía"', c4.categoria === 'Estadía');

  // Edge case 7: Adversarial plan injection strings
  const adv1 = parseBookingSearchParamsFromUrl('/reservar?plan=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
  assert('Adversarial plan: XSS payload handled safely as string without crash', adv1.requestedPlanCode === '<script>alert(1)</script>');

  // ── TEST SUITE 3: Public API Live Endpoints & Pricing Logic ─────────────────
  console.log('\n--- Suite 3: Public API Pricing Engine Verification ---');

  // We test the calculation engine directly and via public router logic
  const { calcReservationWithRates, calcNoches } = require(path.join(PMS_ROOT, 'server', 'utils', 'calculations.js'));
  const { getDb } = require(path.join(PMS_ROOT, 'server', 'db', 'database.js'));
  const testDb = getDb();

  // 3.1 Verify GET /planes logic
  const allWebPlans = testDb.prepare("SELECT * FROM planes_tarifa WHERE activo = 1 AND visible_web = 1").all();
  const expectedCodes = ['escape_mahana', 'todo_incluido', 'mahana_exp', 'pasadia_comidas', 'pasadia_entrada'];
  for (const code of expectedCodes) {
    const match = allWebPlans.find(p => p.codigo === code);
    assert(`Public planes contains canonical plan "${code}"`, !!match);
  }

  // 3.2 Canonical Weekday Pricing (entre_semana: Wednesday 2026-11-18)
  const wedDate = '2026-11-18';
  const thuDate = '2026-11-19';

  // Plan 1: escape_mahana on regular weekday (2 adults, 1 night)
  const escPlanDb = testDb.prepare("SELECT id FROM planes_tarifa WHERE codigo = 'escape_mahana'").get();
  const escCot = calcReservationWithRates(escPlanDb.id, wedDate, thuDate, 2, 0, 0);
  assert('Weekday Cotizar escape_mahana: subtotal is $33.00 (2 * $16.50)', escCot.subtotal === 33.00, `Got ${escCot.subtotal}`);
  assert('Weekday Cotizar escape_mahana: impuesto_monto is $0.00 (exempt tax)', escCot.impuesto_monto === 0.00, `Got ${escCot.impuesto_monto}`);
  assert('Weekday Cotizar escape_mahana: monto_total is $33.00', escCot.monto_total === 33.00, `Got ${escCot.monto_total}`);
  assert('Weekday Cotizar escape_mahana: deposito_sugerido is $16.50 (50%)', escCot.deposito_sugerido === 16.50, `Got ${escCot.deposito_sugerido}`);

  // Plan 2: todo_incluido on regular weekday (4 adults, 2 nights: 2026-11-17 to 2026-11-19)
  const todoPlanDb = testDb.prepare("SELECT id FROM planes_tarifa WHERE codigo = 'todo_incluido'").get();
  const todoCot = calcReservationWithRates(todoPlanDb.id, '2026-11-17', '2026-11-19', 4, 0, 0);
  assert('Weekday Cotizar todo_incluido: subtotal is $528.00 (4 * $66 * 2)', todoCot.subtotal === 528.00, `Got ${todoCot.subtotal}`);
  assert('Weekday Cotizar todo_incluido: impuesto_monto is $52.80 (10% tax)', todoCot.impuesto_monto === 52.80, `Got ${todoCot.impuesto_monto}`);
  assert('Weekday Cotizar todo_incluido: monto_total is $580.80', todoCot.monto_total === 580.80, `Got ${todoCot.monto_total}`);

  // Plan 3: mahana_exp on regular weekday (2 adults, 1 night)
  const expPlanDb = testDb.prepare("SELECT id FROM planes_tarifa WHERE codigo = 'mahana_exp'").get();
  const expCot = calcReservationWithRates(expPlanDb.id, wedDate, thuDate, 2, 0, 0);
  assert('Weekday Cotizar mahana_exp: subtotal is $99.00 (2 * $49.50)', expCot.subtotal === 99.00, `Got ${expCot.subtotal}`);
  assert('Weekday Cotizar mahana_exp: impuesto_monto is $9.90 (10% tax)', expCot.impuesto_monto === 9.90, `Got ${expCot.impuesto_monto}`);
  assert('Weekday Cotizar mahana_exp: monto_total is $108.90', expCot.monto_total === 108.90, `Got ${expCot.monto_total}`);

  // Plan 4: pasadia_comidas (1 adult, 1 day: check_in === check_out)
  const pas1PlanDb = testDb.prepare("SELECT id FROM planes_tarifa WHERE codigo = 'pasadia_comidas'").get();
  const pas1Cot = calcReservationWithRates(pas1PlanDb.id, wedDate, wedDate, 1, 0, 0);
  assert('Cotizar pasadia_comidas (1 adult): subtotal is $35.00', pas1Cot.subtotal === 35.00, `Got ${pas1Cot.subtotal}`);
  assert('Cotizar pasadia_comidas (1 adult): impuesto_monto is $3.50 (10% tax)', pas1Cot.impuesto_monto === 3.50, `Got ${pas1Cot.impuesto_monto}`);
  assert('Cotizar pasadia_comidas (1 adult): monto_total is $38.50', pas1Cot.monto_total === 38.50, `Got ${pas1Cot.monto_total}`);

  // Plan 5: pasadia_entrada (2 adults, 1 day)
  const pas2PlanDb = testDb.prepare("SELECT id FROM planes_tarifa WHERE codigo = 'pasadia_entrada'").get();
  const pas2Cot = calcReservationWithRates(pas2PlanDb.id, wedDate, wedDate, 2, 0, 0);
  assert('Cotizar pasadia_entrada (2 adults): subtotal is $11.00 (2 * $5.50)', pas2Cot.subtotal === 11.00, `Got ${pas2Cot.subtotal}`);
  assert('Cotizar pasadia_entrada (2 adults): impuesto_monto is $1.10 (10% tax)', pas2Cot.impuesto_monto === 1.10, `Got ${pas2Cot.impuesto_monto}`);
  assert('Cotizar pasadia_entrada (2 adults): monto_total is $12.10', pas2Cot.monto_total === 12.10, `Got ${pas2Cot.monto_total}`);

  // 3.3 Holiday Dynamic Pricing (festivo: 2026-11-10 Primer Grito de Independencia)
  const holDate = '2026-11-10';
  const holNext = '2026-11-11';
  const holTodo = calcReservationWithRates(todoPlanDb.id, holDate, holNext, 1, 0, 0);
  assert('Holiday Cotizar todo_incluido: holiday rate $99.00 applied', holTodo.subtotal === 99.00, `Got ${holTodo.subtotal}`);

  const holEsc = calcReservationWithRates(escPlanDb.id, holDate, holNext, 2, 0, 0);
  assert('Holiday Cotizar escape_mahana: holiday rate $24.75 applied (2 * $24.75 = $49.50)', holEsc.subtotal === 49.50, `Got ${holEsc.subtotal}`);

  // 3.4 Weekend Dynamic Pricing (fin_de_semana: Friday 2026-11-20 to Saturday 2026-11-21)
  const friDate = '2026-11-20';
  const satDate = '2026-11-21';
  const wkndTodo = calcReservationWithRates(todoPlanDb.id, friDate, satDate, 1, 0, 0);
  assert('Weekend Cotizar todo_incluido: weekend rate $82.50 applied', wkndTodo.subtotal === 82.50, `Got ${wkndTodo.subtotal}`);

  // 3.5 Adversarial calculation bounds
  const advCot1 = calcReservationWithRates(todoPlanDb.id, wedDate, thuDate, -5, 0, 0);
  assert('Adversarial calculation: negative adults (-5) clamped to 1 adult ($66.00 subtotal)', advCot1.subtotal === 66.00, `Got ${advCot1.subtotal}`);

  const advCot2 = calcReservationWithRates(todoPlanDb.id, wedDate, thuDate, 'invalid', 0, 0);
  assert('Adversarial calculation: string adults ("invalid") clamped to 1 adult ($66.00 subtotal)', advCot2.subtotal === 66.00, `Got ${advCot2.subtotal}`);

  const advCot3 = calcReservationWithRates(todoPlanDb.id, wedDate, thuDate, 0, 0, 0);
  assert('Adversarial calculation: zero adults (0) clamped to 1 adult ($66.00 subtotal)', advCot3.subtotal === 66.00, `Got ${advCot3.subtotal}`);

  // ── TEST SUITE 4: BookingWidget.tsx Static Integrity Checks ─────────────────
  console.log('\n--- Suite 4: BookingWidget.tsx Navigation & Tracking Inspection ---');
  const widgetContent = fs.readFileSync(WIDGET_PATH, 'utf-8');

  // Return navigation checks
  const hasLogoReturn = /<a[^>]*href=["']https:\/\/www\.casamahana\.com["'][^>]*>[\s\S]*?<img[^>]*src=["']\/logo\.png["']/i.test(widgetContent);
  assert('Return navigation: Brand logo is wrapped in <a> linking to https://www.casamahana.com', hasLogoReturn);

  const hasBackAction = /<a[^>]*href=["']https:\/\/www\.casamahana\.com["'][^>]*>[\s\S]*?Volver al sitio web/i.test(widgetContent);
  assert('Return navigation: Discreet "← Volver al sitio web" header button links to https://www.casamahana.com', hasBackAction);

  // GA4 event dispatch checks
  const hasGtagPurchase = widgetContent.includes("window.gtag('event', 'purchase', payload)");
  assert('GA4 tracking: window.gtag("event", "purchase", payload) is present', hasGtagPurchase);

  const hasTransactionId = widgetContent.includes("transaction_id: String(bookingId)");
  assert('GA4 tracking: transaction_id mapped from booking confirmation', hasTransactionId);

  const hasUtmForwarding = widgetContent.includes("utm_source: attribution.utm_source") &&
                           widgetContent.includes("utm_medium: attribution.utm_medium") &&
                           widgetContent.includes("utm_campaign: attribution.utm_campaign");
  assert('GA4 tracking: UTM attribution forward-propagated to purchase event', hasUtmForwarding);

  // Trailing slash routing check in App.tsx
  const appPath = path.join(PMS_ROOT, 'src', 'App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const hasTrailingSlash = appContent.includes("location.pathname === '/reservar'") && appContent.includes("location.pathname === '/reservar/'");
  assert('Routing: App.tsx routes both /reservar and /reservar/ without auth gate', hasTrailingSlash);

  // ── SUMMARY & REPORT ────────────────────────────────────────────────────────
  console.log('\n================================================================');
  console.log(` SUMMARY OF CHALLENGER 1 EMPIRICAL RESULTS`);
  console.log('================================================================');
  console.log(` Total Checks:  ${total}`);
  console.log(` Passed:        ${passed}`);
  console.log(` Failed:        ${failed}`);
  console.log(` Success Rate:  ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.error('\nFAILURES RECORDED:');
    failures.forEach((f, idx) => {
      console.error(`  ${idx + 1}. ${f.description}: ${f.details}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL CHALLENGER EMPIRICAL STRESS TESTS PASSED WITH 100% SUCCESS!');
  }
}

runChallengerStressTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
