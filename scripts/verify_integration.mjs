#!/usr/bin/env node
/**
 * Casa Mahana Website & PMS Integration Verification Suite
 * 
 * Verifies Requirements R1 - R5 and Acceptance Criteria:
 * - Tier 1 (R1): Booking Widget Query Parameter Ingestion & URL Handoff
 * - Tier 2 (R2): Plan and Pricing Consistency ("PMS Manda")
 * - Tier 3 (R3): GA4 Cross-Domain Conversion & UTM Attribution Tracking
 * - Tier 4 (R4): Return Navigation to Public Website
 * - Tier 5 (R5): Integration Roadmap & Custom Domain Documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PMS_ROOT = path.resolve(__dirname, '..');
const SCRATCH_ROOT = path.resolve(PMS_ROOT, '..');
const WEBPAGE_ROOT = path.resolve(SCRATCH_ROOT, 'webpage-mahana');

// Test Runner State
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function recordTest(tier, id, description, passed, details = null) {
  totalTests++;
  if (passed) {
    passedTests++;
  } else {
    failedTests++;
  }
  results.push({ tier, id, description, passed, details });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`  [${statusStr}] ${id}: ${description}`);
  if (!passed && details) {
    console.log(`         Detail: ${details}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE PARSER IMPLEMENTATION (Authoritative specification for R1 handoff)
// ─────────────────────────────────────────────────────────────────────────────
export function parseBookingUrlParams(searchParamsOrUrl) {
  let search = '';
  if (typeof searchParamsOrUrl === 'string') {
    const qIndex = searchParamsOrUrl.indexOf('?');
    search = qIndex !== -1 ? searchParamsOrUrl.slice(qIndex) : searchParamsOrUrl;
  }
  const params = new URLSearchParams(search);

  const rawPlan = params.get('plan') || '';
  const rawCategory = params.get('category') || params.get('categoria') || '';
  const rawGuests = params.get('guests') || params.get('adults') || params.get('adultos');
  const rawDate = params.get('date') || params.get('check_in') || params.get('checkIn');
  const rawCheckOut = params.get('check_out') || params.get('checkOut');

  // Attribution
  const utm_source = params.get('utm_source') || '';
  const utm_medium = params.get('utm_medium') || '';
  const utm_campaign = params.get('utm_campaign') || '';
  const utm_term = params.get('utm_term') || '';
  const utm_content = params.get('utm_content') || '';
  const gclid = params.get('gclid') || '';
  const fbclid = params.get('fbclid') || '';
  const ref = params.get('ref') || '';

  // Infer category if missing
  let category = 'Estadía';
  if (rawCategory) {
    const norm = rawCategory.trim().toLowerCase();
    if (norm === 'pasadía' || norm === 'pasadia') {
      category = 'Pasadía';
    } else {
      category = 'Estadía';
    }
  } else if (rawPlan) {
    const p = rawPlan.trim().toLowerCase();
    if (p.startsWith('pasadia') || p === 'pasadia_comidas' || p === 'pasadia_entrada') {
      category = 'Pasadía';
    } else {
      category = 'Estadía';
    }
  }

  // Parse guests
  let adults = 1;
  if (rawGuests) {
    const parsed = parseInt(rawGuests, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      adults = parsed;
    }
  }

  // Parse dates
  let checkIn = '';
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    checkIn = rawDate;
  }

  let checkOut = '';
  if (rawCheckOut && /^\d{4}-\d{2}-\d{2}$/.test(rawCheckOut)) {
    checkOut = rawCheckOut;
  } else if (checkIn) {
    if (category === 'Pasadía') {
      checkOut = checkIn;
    } else {
      const d = new Date(`${checkIn}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      checkOut = d.toISOString().split('T')[0];
    }
  }

  return {
    plan: rawPlan,
    category,
    adults,
    checkIn,
    checkOut,
    attribution: {
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      gclid,
      fbclid,
      ref
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 1: QUERY PARAMETER INGESTION & URL HANDOFF (R1)
// ─────────────────────────────────────────────────────────────────────────────
function runTier1Tests() {
  console.log('\n--- Tier 1: Query Parameter Ingestion & URL Handoff (R1) ---');

  // TC-1.1: Standard Estadía handoff
  const r1 = parseBookingUrlParams('/reservar?plan=todo_incluido&guests=4&date=2026-11-01&category=Estad%C3%ADa');
  recordTest('Tier 1', 'TC-1.1', 'Ingest Estadía parameters (plan=todo_incluido, guests=4, date=2026-11-01, category=Estadía)',
    r1.plan === 'todo_incluido' && r1.category === 'Estadía' && r1.adults === 4 && r1.checkIn === '2026-11-01' && r1.checkOut === '2026-11-02',
    `Received: plan=${r1.plan}, category=${r1.category}, adults=${r1.adults}, checkIn=${r1.checkIn}, checkOut=${r1.checkOut}`
  );

  // TC-1.2: Standard Pasadía handoff
  const r2 = parseBookingUrlParams('/reservar?plan=pasadia_comidas&category=Pasad%C3%ADa&date=2026-11-05');
  recordTest('Tier 1', 'TC-1.2', 'Ingest Pasadía parameters (plan=pasadia_comidas, checkOut synced to checkIn)',
    r2.plan === 'pasadia_comidas' && r2.category === 'Pasadía' && r2.checkIn === '2026-11-05' && r2.checkOut === '2026-11-05',
    `Received: plan=${r2.plan}, category=${r2.category}, checkIn=${r2.checkIn}, checkOut=${r2.checkOut}`
  );

  // TC-1.3: Category inference for pasadia_comidas
  const r3 = parseBookingUrlParams('/reservar?plan=pasadia_comidas&date=2026-11-10');
  recordTest('Tier 1', 'TC-1.3', 'Infer category="Pasadía" when omitted for plan=pasadia_comidas',
    r3.category === 'Pasadía' && r3.checkOut === '2026-11-10',
    `Received: category=${r3.category}, checkOut=${r3.checkOut}`
  );

  // TC-1.4: Category inference for pasadia_entrada
  const r4 = parseBookingUrlParams('/reservar?plan=pasadia_entrada');
  recordTest('Tier 1', 'TC-1.4', 'Infer category="Pasadía" when omitted for plan=pasadia_entrada',
    r4.category === 'Pasadía',
    `Received: category=${r4.category}`
  );

  // TC-1.5: Category inference for escape_mahana
  const r5 = parseBookingUrlParams('/reservar?plan=escape_mahana&date=2026-11-20');
  recordTest('Tier 1', 'TC-1.5', 'Infer category="Estadía" when omitted for plan=escape_mahana',
    r5.category === 'Estadía' && r5.checkOut === '2026-11-21',
    `Received: category=${r5.category}, checkOut=${r5.checkOut}`
  );

  // TC-1.6: Category inference for todo_incluido
  const r6 = parseBookingUrlParams('/reservar?plan=todo_incluido');
  recordTest('Tier 1', 'TC-1.6', 'Infer category="Estadía" when omitted for plan=todo_incluido',
    r6.category === 'Estadía',
    `Received: category=${r6.category}`
  );

  // TC-1.7: Category inference for mahana_exp
  const r7 = parseBookingUrlParams('/reservar?plan=mahana_exp');
  recordTest('Tier 1', 'TC-1.7', 'Infer category="Estadía" when omitted for plan=mahana_exp',
    r7.category === 'Estadía',
    `Received: category=${r7.category}`
  );

  // TC-1.8: Date alias mapping (check_in -> checkIn)
  const r8 = parseBookingUrlParams('/reservar?plan=todo_incluido&check_in=2026-12-15');
  recordTest('Tier 1', 'TC-1.8', 'Map check_in alias to checkIn',
    r8.checkIn === '2026-12-15' && r8.checkOut === '2026-12-16',
    `Received: checkIn=${r8.checkIn}, checkOut=${r8.checkOut}`
  );

  // TC-1.9: Guest alias mapping (adults -> adults)
  const r9 = parseBookingUrlParams('/reservar?plan=todo_incluido&adults=3');
  recordTest('Tier 1', 'TC-1.9', 'Map adults alias to adults count',
    r9.adults === 3,
    `Received: adults=${r9.adults}`
  );

  // TC-1.10: Explicit check_out override
  const r10 = parseBookingUrlParams('/reservar?date=2026-11-01&check_out=2026-11-10');
  recordTest('Tier 1', 'TC-1.10', 'Preserve explicit check_out parameter when present',
    r10.checkIn === '2026-11-01' && r10.checkOut === '2026-11-10',
    `Received: checkIn=${r10.checkIn}, checkOut=${r10.checkOut}`
  );

  // TC-1.11: Boundary and adversarial inputs (negative or invalid guests sanitized)
  const r11 = parseBookingUrlParams('/reservar?guests=-5&date=not-a-date');
  recordTest('Tier 1', 'TC-1.11', 'Sanitize negative guests to fallback 1 and reject invalid date',
    r11.adults === 1 && r11.checkIn === '',
    `Received: adults=${r11.adults}, checkIn=${r11.checkIn}`
  );

  // TC-1.12: URL parameter unencoded and encoded accents
  const r12 = parseBookingUrlParams('/reservar?category=Estad%C3%ADa');
  const r12b = parseBookingUrlParams('/reservar?category=Estadía');
  recordTest('Tier 1', 'TC-1.12', 'Correctly parse encoded and raw accented category strings',
    r12.category === 'Estadía' && r12b.category === 'Estadía',
    `r12=${r12.category}, r12b=${r12b.category}`
  );

  // TC-1.13: Static inspection of BookingWidget.tsx for query param ingestion
  const bookingWidgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
  const widgetContent = fs.existsSync(bookingWidgetPath) ? fs.readFileSync(bookingWidgetPath, 'utf-8') : '';
  const hasParamIngestion = /useSearchParams|URLSearchParams|location\.search/.test(widgetContent) &&
                            /plan|guests|adults/.test(widgetContent);
  recordTest('Tier 1', 'TC-1.13', 'BookingWidget.tsx implements URL search parameter ingestion',
    hasParamIngestion,
    hasParamIngestion ? 'Search parameter parsing detected in BookingWidget.tsx' : 'Missing URLSearchParams / useSearchParams in BookingWidget.tsx'
  );

  // TC-1.14: Static inspection of BookingWidget.tsx for plan pre-selection
  const hasPlanPreselection = widgetContent.includes('selectedPlan') &&
                              (widgetContent.includes('targetPlan') || widgetContent.includes('paramPlan') || widgetContent.includes('initialPlan') || /planCode|planParam|requestedPlan/i.test(widgetContent));
  recordTest('Tier 1', 'TC-1.14', 'BookingWidget.tsx implements requested plan pre-selection logic',
    hasPlanPreselection,
    hasPlanPreselection ? 'Plan preselection logic found' : 'Missing dynamic plan preselection matching incoming plan param'
  );

  // TC-1.15: Static inspection of App.tsx for trailing slash routing (/reservar and /reservar/)
  const appPath = path.join(PMS_ROOT, 'src', 'App.tsx');
  const appContent = fs.existsSync(appPath) ? fs.readFileSync(appPath, 'utf-8') : '';
  const hasTrailingSlashSupport = appContent.includes('/reservar/') ||
                                  /location\.pathname\.startsWith\(['"]\/reservar['"]\)/.test(appContent) ||
                                  /\/reservar\/?/.test(appContent) ||
                                  (appContent.includes('/reservar') && appContent.includes('pathname.replace(/\\/$/, \'\')'));
  recordTest('Tier 1', 'TC-1.15', 'App.tsx supports both /reservar and /reservar/ without auth gate',
    hasTrailingSlashSupport,
    hasTrailingSlashSupport ? 'Trailing slash routing supported' : 'App.tsx only matches exact "/reservar", fails on "/reservar/"'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 2: PLAN AND PRICING CONSISTENCY ("PMS MANDA" R2)
// ─────────────────────────────────────────────────────────────────────────────
function runTier2Tests() {
  console.log('\n--- Tier 2: Plan and Pricing Consistency ("PMS Manda" R2) ---');

  const dbPath = path.join(PMS_ROOT, 'data', 'casa-mahana.db');
  let dbExists = fs.existsSync(dbPath);
  let db = null;
  if (dbExists) {
    try {
      db = new Database(dbPath, { readonly: true });
    } catch (e) {
      dbExists = false;
    }
  }

  // TC-2.1: escape_mahana in PMS database
  let escapePlan = null;
  if (db) {
    try {
      escapePlan = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'escape_mahana'").get();
    } catch (e) {}
  }
  const escapeValid = escapePlan && escapePlan.activo === 1 && escapePlan.visible_web === 1 && Number(escapePlan.precio_adulto_noche) === 16.50;
  recordTest('Tier 2', 'TC-2.1', 'PMS DB: escape_mahana exists with activo=1, visible_web=1, rate=$16.50',
    Boolean(escapeValid),
    escapePlan ? `Found: activo=${escapePlan.activo}, visible_web=${escapePlan.visible_web}, precio=${escapePlan.precio_adulto_noche}` : 'Plan "escape_mahana" not found in database'
  );

  // TC-2.2: todo_incluido in PMS database
  let todoPlan = null;
  if (db) {
    try {
      todoPlan = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'todo_incluido'").get();
    } catch (e) {}
  }
  const todoValid = todoPlan && todoPlan.activo === 1 && todoPlan.visible_web === 1 && Number(todoPlan.precio_adulto_noche) === 66.00;
  recordTest('Tier 2', 'TC-2.2', 'PMS DB: todo_incluido exists with activo=1, visible_web=1, rate=$66.00',
    Boolean(todoValid),
    todoPlan ? `Found: activo=${todoPlan.activo}, visible_web=${todoPlan.visible_web}, precio=${todoPlan.precio_adulto_noche}` : 'Plan "todo_incluido" not found in database'
  );

  // TC-2.3: mahana_exp in PMS database
  let expPlan = null;
  if (db) {
    try {
      expPlan = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'mahana_exp'").get();
    } catch (e) {}
  }
  const expValid = expPlan && expPlan.activo === 1 && expPlan.visible_web === 1 && Number(expPlan.precio_adulto_noche) === 49.50;
  recordTest('Tier 2', 'TC-2.3', 'PMS DB: mahana_exp exists with activo=1, visible_web=1, rate=$49.50',
    Boolean(expValid),
    expPlan ? `Found: activo=${expPlan.activo}, visible_web=${expPlan.visible_web}, precio=${expPlan.precio_adulto_noche}` : 'Plan "mahana_exp" not found in database'
  );

  // TC-2.4: pasadia_comidas in PMS database
  let pasadiaComidas = null;
  if (db) {
    try {
      pasadiaComidas = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'pasadia_comidas'").get();
    } catch (e) {}
  }
  const pasadiaComidasValid = pasadiaComidas && pasadiaComidas.activo === 1 && pasadiaComidas.visible_web === 1 && Number(pasadiaComidas.precio_adulto_noche) === 35.00;
  recordTest('Tier 2', 'TC-2.4', 'PMS DB: pasadia_comidas exists with activo=1, visible_web=1, rate=$35.00',
    Boolean(pasadiaComidasValid),
    pasadiaComidas ? `Found: activo=${pasadiaComidas.activo}, visible_web=${pasadiaComidas.visible_web}, precio=${pasadiaComidas.precio_adulto_noche}` : 'Plan "pasadia_comidas" not found in database'
  );

  // TC-2.5: pasadia_entrada in PMS database
  let pasadiaEntrada = null;
  if (db) {
    try {
      pasadiaEntrada = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'pasadia_entrada'").get();
    } catch (e) {}
  }
  const pasadiaEntradaValid = pasadiaEntrada && pasadiaEntrada.activo === 1 && pasadiaEntrada.visible_web === 1 && Number(pasadiaEntrada.precio_adulto_noche) === 5.50;
  recordTest('Tier 2', 'TC-2.5', 'PMS DB: pasadia_entrada exists with activo=1, visible_web=1, rate=$5.50',
    Boolean(pasadiaEntradaValid),
    pasadiaEntrada ? `Found: activo=${pasadiaEntrada.activo}, visible_web=${pasadiaEntrada.visible_web}, precio=${pasadiaEntrada.precio_adulto_noche}` : 'Plan "pasadia_entrada" not found in database'
  );

  // Close db
  if (db) {
    try { db.close(); } catch (e) {}
  }

  // TC-2.6: Seed scripts contain escape_mahana migration / definition
  const databaseJsPath = path.join(PMS_ROOT, 'server', 'db', 'database.js');
  const dbJsContent = fs.existsSync(databaseJsPath) ? fs.readFileSync(databaseJsPath, 'utf-8') : '';
  const seedsHaveEscape = dbJsContent.includes('escape_mahana');
  recordTest('Tier 2', 'TC-2.6', 'Seed script server/db/database.js contains escape_mahana definition',
    seedsHaveEscape,
    seedsHaveEscape ? 'escape_mahana seed found in database.js' : 'escape_mahana not found in database.js'
  );

  // TC-2.7: Seed scripts enable visible_web for pasadia plans
  const seedsHavePasadiaVisible = dbJsContent.includes('pasadia_comidas') &&
                                  (dbJsContent.includes("'pasadia_comidas', 'pasadia_entrada'") || dbJsContent.includes('visible_web = 1 WHERE codigo LIKE \'%pasadia%\''));
  recordTest('Tier 2', 'TC-2.7', 'Seed script server/db/database.js sets visible_web=1 for pasadia plans',
    seedsHavePasadiaVisible,
    seedsHavePasadiaVisible ? 'Pasadía visible_web migration found in database.js' : 'Pasadía visible_web migration missing in database.js'
  );

  // TC-2.8: Webpage ProductShowcase.tsx pricing alignment
  const showcasePath = path.join(WEBPAGE_ROOT, 'src', 'pages', 'ProductShowcase.tsx');
  const showcaseContent = fs.existsSync(showcasePath) ? fs.readFileSync(showcasePath, 'utf-8') : '';
  const showcaseAligned = showcaseContent.includes("'$49.50'") &&
                          showcaseContent.includes("'$66'") &&
                          showcaseContent.includes("'$38.50'");
  recordTest('Tier 2', 'TC-2.8', 'Webpage ProductShowcase.tsx aligns package rates ($49.50, $66, $38.50)',
    showcaseAligned,
    showcaseAligned ? 'ProductShowcase prices match PMS canonical rates' : 'ProductShowcase contains legacy prices ($70, $120, etc.)'
  );

  // TC-2.9: Webpage ProductsHook.tsx pricing alignment
  const hookPath = path.join(WEBPAGE_ROOT, 'src', 'components', 'ProductsHook.tsx');
  const hookContent = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf-8') : '';
  const hookHasOldPrice = hookContent.includes('$70/noche') || hookContent.includes('$70/night');
  recordTest('Tier 2', 'TC-2.9', 'Webpage ProductsHook.tsx removes obsolete $70 rate teaser',
    !hookHasOldPrice,
    !hookHasOldPrice ? 'ProductsHook rate teaser aligned' : 'ProductsHook still contains "$70/noche"'
  );

  // TC-2.10: PMS Concurrency Test in e2e.test.js has valid dynamic future date
  const e2eTestPath = path.join(PMS_ROOT, 'server', 'tests', 'e2e.test.js');
  const e2eContent = fs.existsSync(e2eTestPath) ? fs.readFileSync(e2eTestPath, 'utf-8') : '';
  const tc43Index = e2eContent.indexOf('TC-4.3');
  const tc44Index = e2eContent.indexOf('TC-4.4');
  const tc43Block = tc43Index !== -1 && tc44Index !== -1 ? e2eContent.slice(tc43Index, tc44Index) : '';
  const concurrencyTestValid = tc43Block.length > 0 &&
                               (tc43Block.includes('Date.now()') || !/check_in:\s*['"]202[0-5]-/.test(tc43Block));
  recordTest('Tier 2', 'TC-2.10', 'PMS server/tests/e2e.test.js concurrency test uses non-expired date',
    concurrencyTestValid,
    concurrencyTestValid ? 'e2e.test.js TC-4.3 uses valid dynamic date' : 'e2e.test.js TC-4.3 contains expired date or not found'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 3: GA4 CROSS-DOMAIN CONVERSION & UTM ATTRIBUTION TRACKING (R3)
// ─────────────────────────────────────────────────────────────────────────────
function runTier3Tests() {
  console.log('\n--- Tier 3: GA4 & Attribution Tracking (R3) ---');

  // TC-3.1: GA4 tag installed in index.html
  const indexPath = path.join(PMS_ROOT, 'index.html');
  const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : '';
  const hasGtagScript = indexContent.includes('https://www.googletagmanager.com/gtag/js?id=G-02NLS8E3LG');
  const hasGtagInit = indexContent.includes("gtag('config', 'G-02NLS8E3LG')") || indexContent.includes('gtag("config", "G-02NLS8E3LG")');
  recordTest('Tier 3', 'TC-3.1', 'Google tag G-02NLS8E3LG script and init installed in index.html',
    hasGtagScript && hasGtagInit,
    hasGtagScript && hasGtagInit ? 'GA4 tag G-02NLS8E3LG properly initialized' : `Script: ${hasGtagScript}, Init: ${hasGtagInit}`
  );

  // TC-3.2: UTM parameters captured and persisted in BookingWidget.tsx
  const bookingWidgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
  const widgetContent = fs.existsSync(bookingWidgetPath) ? fs.readFileSync(bookingWidgetPath, 'utf-8') : '';
  const hasUtmCapture = /utm_source|utm_medium|utm_campaign|gclid|fbclid/.test(widgetContent);
  recordTest('Tier 3', 'TC-3.2', 'BookingWidget.tsx captures and persists incoming UTM attribution parameters',
    hasUtmCapture,
    hasUtmCapture ? 'UTM attribution parameter capture detected' : 'UTM attribution parameters not found in BookingWidget.tsx'
  );

  // TC-3.3: GA4 purchase event dispatched on booking confirmation
  const hasPurchaseEvent = widgetContent.includes("'purchase'") || widgetContent.includes('"purchase"');
  const hasGtagPurchase = /gtag\s*\(\s*['"]event['"]\s*,\s*['"]purchase['"]/.test(widgetContent);
  recordTest('Tier 3', 'TC-3.3', 'BookingWidget.tsx triggers gtag("event", "purchase", ...) upon confirmation',
    hasGtagPurchase,
    hasGtagPurchase ? 'gtag purchase event dispatch found' : 'Missing gtag purchase event dispatch in BookingWidget.tsx'
  );

  // TC-3.4: Purchase payload contains transaction_id, value, USD currency, and attribution
  const hasPurchasePayloadFields = hasGtagPurchase &&
                                   (widgetContent.includes('transaction_id') && widgetContent.includes('value') && widgetContent.includes("'USD'"));
  recordTest('Tier 3', 'TC-3.4', 'GA4 purchase event payload includes transaction_id, value, and currency="USD"',
    hasPurchasePayloadFields,
    hasPurchasePayloadFields ? 'Purchase payload schema matches contract' : 'Purchase payload missing required fields (transaction_id, value, USD)'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 4: RETURN NAVIGATION TO PUBLIC WEBSITE (R4)
// ─────────────────────────────────────────────────────────────────────────────
function runTier4Tests() {
  console.log('\n--- Tier 4: Return Navigation to Public Website (R4) ---');

  const bookingWidgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
  const widgetContent = fs.existsSync(bookingWidgetPath) ? fs.readFileSync(bookingWidgetPath, 'utf-8') : '';

  // TC-4.1: Brand logo links to https://www.casamahana.com
  const hasLogoReturn = widgetContent.includes('https://www.casamahana.com') &&
                        (/<a[^>]+href=["']https:\/\/www\.casamahana\.com["'][^>]*>[\s\S]*?(logo|img|Casa Mahana)/i.test(widgetContent) ||
                         /onClick=[\s\S]*?https:\/\/www\.casamahana\.com/.test(widgetContent));
  recordTest('Tier 4', 'TC-4.1', 'Brand logo links directly to https://www.casamahana.com',
    hasLogoReturn,
    hasLogoReturn ? 'Logo link to casamahana.com detected' : 'Logo is not linked to https://www.casamahana.com'
  );

  // TC-4.2: Discreet "← Volver al sitio web" action in header
  const hasBackAction = widgetContent.includes('https://www.casamahana.com') &&
                        /Volver al sitio web|Volver a casamahana\.com|Regresar al sitio/i.test(widgetContent);
  recordTest('Tier 4', 'TC-4.2', '"← Volver al sitio web" action exists in header linking to https://www.casamahana.com',
    hasBackAction,
    hasBackAction ? '"Volver al sitio web" action found' : 'Missing "Volver al sitio web" header button/link'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TIER 5: INTEGRATION ROADMAP & CUSTOM DOMAIN DOCUMENTATION (R5)
// ─────────────────────────────────────────────────────────────────────────────
function runTier5Tests() {
  console.log('\n--- Tier 5: Integration Roadmap & Custom Domain Documentation (R5) ---');

  const roadmapPath = path.join(PMS_ROOT, 'docs', 'custom-domain-roadmap.md');
  const docExists = fs.existsSync(roadmapPath);
  recordTest('Tier 5', 'TC-5.1', 'Documentation file exists at casa-mahana-pms/docs/custom-domain-roadmap.md',
    docExists,
    docExists ? 'custom-domain-roadmap.md found' : 'custom-domain-roadmap.md does not exist'
  );

  const docContent = docExists ? fs.readFileSync(roadmapPath, 'utf-8') : '';

  // TC-5.2: DNS CNAME instructions for reservas.casamahana.com
  const hasCname = docContent.includes('CNAME') && docContent.includes('reservas.casamahana.com');
  recordTest('Tier 5', 'TC-5.2', 'Documentation details DNS CNAME mapping for reservas.casamahana.com',
    hasCname,
    hasCname ? 'CNAME instructions found' : 'Missing CNAME record instructions for reservas.casamahana.com'
  );

  // TC-5.3: Render Custom Domain instructions
  const hasRender = docContent.toLowerCase().includes('render') && docContent.includes('Custom Domain');
  recordTest('Tier 5', 'TC-5.3', 'Documentation covers Render custom domain mapping steps',
    hasRender,
    hasRender ? 'Render custom domain instructions found' : 'Missing Render custom domain steps'
  );

  // TC-5.4: SSL / TLS certificate coverage
  const hasSsl = /SSL|TLS|HTTPS|certificate/i.test(docContent);
  recordTest('Tier 5', 'TC-5.4', 'Documentation explains SSL/TLS certificate automated provisioning',
    hasSsl,
    hasSsl ? 'SSL/TLS configuration documented' : 'Missing SSL/TLS certificate documentation'
  );

  // TC-5.5: CORS configuration documentation
  const hasCors = /CORS|Access-Control-Allow-Origin/i.test(docContent);
  recordTest('Tier 5', 'TC-5.5', 'Documentation details Express CORS configuration for cross-domain requests',
    hasCors,
    hasCors ? 'CORS requirements documented' : 'Missing CORS configuration details'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXECUTION & REPORTING
// ─────────────────────────────────────────────────────────────────────────────
function main() {
  console.log('================================================================');
  console.log(' Casa Mahana — E2E Integration Automated Verification Suite   ');
  console.log('================================================================');
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log(`PMS Root: ${PMS_ROOT}`);
  console.log(`Webpage Root: ${WEBPAGE_ROOT}`);

  runTier1Tests();
  runTier2Tests();
  runTier3Tests();
  runTier4Tests();
  runTier5Tests();

  console.log('\n================================================================');
  console.log(' Verification Suite Summary');
  console.log('================================================================');
  console.log(`Total Tests Run:  ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log(`Pass Rate:         ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.log(`⚠️  ${failedTests} integration tests failed against the current implementation baseline.`);
    process.exit(1);
  } else {
    console.log('🎉 All integration verification tests PASSED successfully!');
    process.exit(0);
  }
}

export { main };

const isMain = process.argv[1] && (
  process.argv[1].endsWith('verify_integration.mjs') ||
  process.argv[1].endsWith('verify_integration.js')
);

if (isMain) {
  main();
}


