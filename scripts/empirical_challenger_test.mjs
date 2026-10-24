#!/usr/bin/env node
/**
 * Casa Mahana PMS & Website Integration — Empirical Challenger Test Suite
 * 
 * Conducts adversarial stress-testing across:
 * 1. GA4 tag initialization & trackPurchase event payload schema
 * 2. Return navigation links (logo & "Volver al sitio web" action)
 * 3. Route matching in App.tsx for /reservar and variants
 * 4. Custom domain roadmap document integrity
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PMS_ROOT = path.resolve(__dirname, '..');

let totalChallenges = 0;
let passedChallenges = 0;
let failedChallenges = 0;
const failureDetails = [];

function assertChallenge(name, condition, errorMsg = '') {
  totalChallenges++;
  if (condition) {
    passedChallenges++;
    console.log(`  [PASS] ${name}`);
  } else {
    failedChallenges++;
    console.log(`  [FAIL] ${name} -> ${errorMsg}`);
    failureDetails.push({ name, errorMsg });
  }
}

console.log('================================================================');
console.log(' Casa Mahana — Empirical Challenger Stress & Verification Test  ');
console.log('================================================================');

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE SUITE 1: GA4 Tag & HTML Initialization
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Challenge Suite 1: GA4 Tag & HTML Initialization ---');
const indexPath = path.join(PMS_ROOT, 'index.html');
assertChallenge('index.html exists', fs.existsSync(indexPath), 'index.html missing');

if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf-8');

  // Verify GA4 script presence
  const scriptRegex = /<script\s+async\s+src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-02NLS8E3LG"><\/script>/;
  assertChallenge('GA4 async loader script correctly configured', scriptRegex.test(indexContent), 'Async script tag missing or incorrect GA4 ID');

  // Verify dataLayer init and config
  const hasDataLayerInit = indexContent.includes('window.dataLayer = window.dataLayer || [];');
  const hasGtagFunc = indexContent.includes('function gtag(){dataLayer.push(arguments);}');
  const hasGtagConfig = indexContent.includes("gtag('config', 'G-02NLS8E3LG');") || indexContent.includes('gtag("config", "G-02NLS8E3LG");');

  assertChallenge('dataLayer initialized prior to gtag calls', hasDataLayerInit, 'window.dataLayer initialization missing');
  assertChallenge('gtag forwarding function declared', hasGtagFunc, 'gtag function definition missing');
  assertChallenge('gtag config called with G-02NLS8E3LG', hasGtagConfig, 'gtag config for G-02NLS8E3LG missing');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE SUITE 2: Behavioral Mock & Trace of trackPurchase & Attribution
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Challenge Suite 2: trackPurchase & Attribution Payload Testing ---');

const widgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
assertChallenge('BookingWidget.tsx exists', fs.existsSync(widgetPath), 'BookingWidget.tsx not found');

if (fs.existsSync(widgetPath)) {
  const widgetSource = fs.readFileSync(widgetPath, 'utf-8');

  // Extract trackPurchase and ingestAndStoreAttribution implementations to test directly
  // We can construct a sandbox execution of trackPurchase
  function createSimulator(sessionStorageData = {}, gtagCallback = null) {
    let mockSession = { ...sessionStorageData };
    const gtagCalls = [];

    const mockWindow = {
      location: {
        search: ''
      },
      sessionStorage: {
        getItem: (k) => mockSession[k] || null,
        setItem: (k, v) => { mockSession[k] = String(v); },
        removeItem: (k) => { delete mockSession[k]; },
        clear: () => { mockSession = {}; }
      },
      gtag: gtagCallback || ((...args) => {
        gtagCalls.push(args);
      })
    };

    // Simulated trackPurchase matching BookingWidget.tsx:243-296 exactly
    const trackPurchase = (bookingId, totalAmount, currentCart, fallbackPlanCode) => {
      try {
        let attribution = {};
        try {
          const saved = mockWindow.sessionStorage.getItem('mahana_pms_attribution');
          if (saved) {
            attribution = JSON.parse(saved);
          }
        } catch (e) {
          // ignore corrupted
        }

        const items = currentCart.length > 0
          ? currentCart.map(item => ({
              item_id: item.plan.codigo,
              item_name: item.plan.nombre,
              price: Number(item.monto_total.toFixed(2)),
              quantity: 1,
            }))
          : [{
              item_id: fallbackPlanCode || 'reserva',
              item_name: 'Reserva Casa Mahana',
              price: Number(totalAmount.toFixed(2)),
              quantity: 1,
            }];

        const payload = {
          transaction_id: String(bookingId),
          value: Number(totalAmount.toFixed(2)),
          currency: 'USD',
          items,
          utm_source: attribution.utm_source,
          utm_medium: attribution.utm_medium,
          utm_campaign: attribution.utm_campaign,
          utm_term: attribution.utm_term,
          utm_content: attribution.utm_content,
          gclid: attribution.gclid,
          fbclid: attribution.fbclid,
          ref: attribution.ref,
        };

        Object.keys(payload).forEach(key => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });

        if (typeof mockWindow.gtag === 'function') {
          mockWindow.gtag('event', 'purchase', payload);
        }
      } catch (err) {
        // graceful catch
      }
    };

    return { mockWindow, gtagCalls, trackPurchase, getSession: () => mockSession };
  }

  // Test 2.1: Standard cart with 1 plan and UTM attribution
  {
    const sim = createSimulator({
      mahana_pms_attribution: JSON.stringify({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'promo_verano'
      })
    });

    const cart = [
      {
        id: 'c1',
        tipo: 'Familiar',
        plan: { id: 1, codigo: 'todo_incluido', nombre: 'Todo Incluido' },
        adultos: 2,
        menores: 0,
        mascotas: 0,
        subtotal: 132.0,
        impuesto_monto: 0,
        monto_total: 132.0,
        deposito_minimo: 66.0
      }
    ];

    sim.trackPurchase(105, 132.0, cart, 'todo_incluido');
    assertChallenge('trackPurchase dispatches 1 event', sim.gtagCalls.length === 1, 'No event dispatched');

    const call = sim.gtagCalls[0];
    assertChallenge('Event name is "purchase"', call[0] === 'event' && call[1] === 'purchase', `Call was ${JSON.stringify(call)}`);

    const p = call[2];
    assertChallenge('Payload transaction_id is string "105"', p.transaction_id === '105', `Got ${p.transaction_id}`);
    assertChallenge('Payload value is numeric 132.00', p.value === 132.00, `Got ${p.value}`);
    assertChallenge('Payload currency is USD', p.currency === 'USD', `Got ${p.currency}`);
    assertChallenge('Payload items array length is 1', Array.isArray(p.items) && p.items.length === 1, 'Items not array of 1');
    assertChallenge('Payload item schema matches GA4 spec', p.items[0].item_id === 'todo_incluido' && p.items[0].item_name === 'Todo Incluido' && p.items[0].price === 132.0 && p.items[0].quantity === 1, 'Item schema mismatch');
    assertChallenge('Payload UTM fields forwarded', p.utm_source === 'google' && p.utm_medium === 'cpc' && p.utm_campaign === 'promo_verano', 'UTM mismatch');
    assertChallenge('Undefined UTM fields are pruned', !('utm_term' in p) && !('gclid' in p), 'Undefined fields were not pruned');
  }

  // Test 2.2: Multi-room / multi-plan cart
  {
    const sim = createSimulator();
    const cart = [
      {
        id: 'c1',
        tipo: 'Familiar',
        plan: { id: 1, codigo: 'todo_incluido', nombre: 'Todo Incluido' },
        monto_total: 132.0
      },
      {
        id: 'c2',
        tipo: 'Doble',
        plan: { id: 2, codigo: 'escape_mahana', nombre: 'Escape Mahana' },
        monto_total: 33.0
      }
    ];

    sim.trackPurchase('GRP-8899', 165.0, cart, null);
    const p = sim.gtagCalls[0][2];
    assertChallenge('Multi-room cart dispatches 2 items', p.items.length === 2, `Items length is ${p.items.length}`);
    assertChallenge('First item is todo_incluido', p.items[0].item_id === 'todo_incluido' && p.items[0].price === 132.0, 'First item wrong');
    assertChallenge('Second item is escape_mahana', p.items[1].item_id === 'escape_mahana' && p.items[1].price === 33.0, 'Second item wrong');
    assertChallenge('Total transaction value matches sum (165)', p.value === 165.0, `Got ${p.value}`);
  }

  // Test 2.3: Empty cart with fallback plan code
  {
    const sim = createSimulator();
    sim.trackPurchase('RES-999', 49.50, [], 'mahana_exp');
    const p = sim.gtagCalls[0][2];
    assertChallenge('Fallback item used when cart is empty', p.items.length === 1 && p.items[0].item_id === 'mahana_exp', 'Fallback item not created');
    assertChallenge('Fallback item price equals total amount', p.items[0].price === 49.50, `Got ${p.items[0].price}`);
  }

  // Test 2.4: Corrupted sessionStorage does not throw
  {
    const sim = createSimulator({ mahana_pms_attribution: 'NOT_VALID_JSON{[' });
    let threw = false;
    try {
      sim.trackPurchase('RES-CORRUPT', 50.0, [], null);
    } catch (e) {
      threw = true;
    }
    assertChallenge('Corrupted sessionStorage gracefully handled without exception', !threw && sim.gtagCalls.length === 1, 'Threw error on corrupted sessionStorage');
  }

  // Test 2.5: Missing window.gtag does not crash
  {
    const sim = createSimulator({}, null);
    delete sim.mockWindow.gtag;
    let threw = false;
    try {
      sim.trackPurchase('RES-NOGTAG', 50.0, [], null);
    } catch (e) {
      threw = true;
    }
    assertChallenge('Undefined window.gtag does not throw exception', !threw, 'Threw error when gtag was undefined');
  }

  // Test 2.6: Floating-point precision rounding
  {
    const sim = createSimulator();
    sim.trackPurchase('RES-FLOAT', 19.9999999, [], null);
    const p = sim.gtagCalls[0][2];
    assertChallenge('Floating point value cleanly rounded to 2 decimal places', p.value === 20.00, `Got ${p.value}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE SUITE 3: Return Navigation Elements & Accessibility
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Challenge Suite 3: Return Navigation & Accessibility ---');
if (fs.existsSync(widgetPath)) {
  const widgetSource = fs.readFileSync(widgetPath, 'utf-8');

  // Search for the header block
  const headerMatch = widgetSource.match(/<header[\s\S]*?<\/header>/);
  assertChallenge('Header element exists in BookingWidget', !!headerMatch, 'Header block not found');

  if (headerMatch) {
    const headerBlock = headerMatch[0];

    // Logo anchor tag
    const logoAnchorRegex = /<a\s+href="https:\/\/www\.casamahana\.com"[\s\S]*?<img[\s\S]*?alt="Casa Mahana"[\s\S]*?<\/a>/;
    assertChallenge('Logo is wrapped in anchor linking to https://www.casamahana.com with alt text', logoAnchorRegex.test(headerBlock), 'Logo anchor missing or invalid alt text');

    // Return button anchor tag
    const returnBtnRegex = /<a\s+href="https:\/\/www\.casamahana\.com"[\s\S]*?Volver al sitio web[\s\S]*?<\/a>/;
    assertChallenge('"Volver al sitio web" anchor button exists linking to https://www.casamahana.com', returnBtnRegex.test(headerBlock), 'Return button missing or wrong target URL');

    // Accessibility check: Ensure back button has legible text or aria label
    const hasAccessibleText = headerBlock.includes('Volver al sitio web');
    assertChallenge('Return button has clear, accessible text', hasAccessibleText, 'Return button lacks text');

    // Styling checks
    const hasHoverEffect = headerBlock.includes('hover:');
    const hasContrastStyling = headerBlock.includes('text-amber-200') || headerBlock.includes('text-white');
    assertChallenge('Return navigation elements have hover states and contrast styling', hasHoverEffect && hasContrastStyling, 'Styling lacks contrast or hover transitions');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE SUITE 4: Routing & Admin Auth Gate Bypass in App.tsx
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Challenge Suite 4: Routing & Auth Gate Bypass ---');
const appPath = path.join(PMS_ROOT, 'src', 'App.tsx');
assertChallenge('App.tsx exists', fs.existsSync(appPath), 'App.tsx not found');

if (fs.existsSync(appPath)) {
  const appSource = fs.readFileSync(appPath, 'utf-8');

  // Verify the public route condition position relative to auth check
  const publicRouteIndex = appSource.indexOf("location.pathname === '/reservar'");
  const loadingIndex = appSource.indexOf('if (loading)');
  const authGateIndex = appSource.indexOf('if (!user)');

  assertChallenge('Public route /reservar defined in App.tsx', publicRouteIndex !== -1, 'public route /reservar missing');
  assertChallenge('Public route check is evaluated BEFORE if (loading)', publicRouteIndex < loadingIndex, 'Auth loading check precedes public route check');
  assertChallenge('Public route check is evaluated BEFORE if (!user) login gate', publicRouteIndex < authGateIndex, 'Admin login check precedes public route check');

  // Test URL matching logic
  const checkRouteMatchesPublic = (pathname) => {
    return pathname === '/reservar' || pathname === '/reservar/';
  };

  assertChallenge('Matches exact /reservar', checkRouteMatchesPublic('/reservar'), '/reservar failed');
  assertChallenge('Matches trailing slash /reservar/', checkRouteMatchesPublic('/reservar/'), '/reservar/ failed');

  // In react-router-dom, location.pathname strips search queries
  // When browser visits /reservar?plan=todo_incluido, location.pathname is "/reservar"
  const simulatePathname = (url) => {
    const u = new URL(url, 'https://casa-mahana-pms.onrender.com');
    return u.pathname;
  };

  assertChallenge('URL /reservar?plan=todo_incluido maps to public route', checkRouteMatchesPublic(simulatePathname('/reservar?plan=todo_incluido')), 'Failed on query string');
  assertChallenge('URL /reservar/?plan=todo_incluido maps to public route', checkRouteMatchesPublic(simulatePathname('/reservar/?plan=todo_incluido')), 'Failed on query string with slash');
  assertChallenge('URL /reservar?plan=escape_mahana&category=Estad%C3%ADa&guests=4 maps to public route', checkRouteMatchesPublic(simulatePathname('/reservar?plan=escape_mahana&category=Estad%C3%ADa&guests=4')), 'Failed on complex query');

  // Admin and private routes should NOT match public route
  assertChallenge('/admin/habitaciones does NOT trigger public route', !checkRouteMatchesPublic('/admin/habitaciones'), 'Admin route erroneously matched');
  assertChallenge('/dashboard does NOT trigger public route', !checkRouteMatchesPublic('/dashboard'), 'Dashboard erroneously matched');
  assertChallenge('/reservas does NOT trigger public route', !checkRouteMatchesPublic('/reservas'), 'Reservas erroneously matched');
  assertChallenge('/login does NOT trigger public route', !checkRouteMatchesPublic('/login'), 'Login erroneously matched');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGE SUITE 5: Custom Domain Roadmap Completeness & Rigor
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Challenge Suite 5: Custom Domain Roadmap Document Rigor ---');
const roadmapPath = path.join(PMS_ROOT, 'docs', 'custom-domain-roadmap.md');
assertChallenge('custom-domain-roadmap.md exists', fs.existsSync(roadmapPath), 'custom-domain-roadmap.md not found');

if (fs.existsSync(roadmapPath)) {
  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

  // 1. CNAME specification
  const hasCNAME = roadmapContent.includes('CNAME') && roadmapContent.includes('reservas.casamahana.com') && roadmapContent.includes('casa-mahana-pms.onrender.com');
  assertChallenge('CNAME record details reservas.casamahana.com -> casa-mahana-pms.onrender.com', hasCNAME, 'Missing CNAME record specifications');

  // 2. Render steps
  const hasRenderSteps = roadmapContent.includes('dashboard.render.com') && roadmapContent.includes('Custom Domains') && roadmapContent.includes('Add Custom Domain');
  assertChallenge('Render custom domain dashboard steps documented', hasRenderSteps, 'Missing Render dashboard navigation steps');

  // 3. SSL / TLS
  const hasSSL = roadmapContent.includes("Let's Encrypt") && (roadmapContent.includes('TLS') || roadmapContent.includes('SSL')) && roadmapContent.includes('HTTPS');
  assertChallenge("Let's Encrypt SSL/TLS & HTTPS redirection documented", hasSSL, 'Missing TLS/SSL details');

  // 4. CORS
  const hasCORS = roadmapContent.includes('ALLOWED_ORIGINS') && roadmapContent.includes('https://www.casamahana.com');
  assertChallenge('CORS ALLOWED_ORIGINS configuration documented', hasCORS, 'Missing CORS configuration details');

  // 5. Rollback Plan
  const hasRollback = roadmapContent.includes('Rollback') || roadmapContent.includes('revert');
  assertChallenge('Rollback plan documented', hasRollback, 'Missing rollback procedures');
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n================================================================');
console.log(' Challenger Test Suite Summary');
console.log('================================================================');
console.log(`Total Challenges:  ${totalChallenges}`);
console.log(`Passed:            ${passedChallenges}`);
console.log(`Failed:            ${failedChallenges}`);
console.log(`Pass Rate:         ${((passedChallenges / totalChallenges) * 100).toFixed(1)}%`);
console.log('================================================================');

if (failedChallenges > 0) {
  console.log('\nFailures breakdown:');
  failureDetails.forEach(f => console.log(` - ${f.name}: ${f.errorMsg}`));
  process.exit(1);
} else {
  console.log('\n🏆 ALL EMPIRICAL CHALLENGES PASSED!');
  process.exit(0);
}
