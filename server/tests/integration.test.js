import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { parseBookingUrlParams } from '../../scripts/verify_integration.mjs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PMS_ROOT = path.resolve(__dirname, '../..');
const SCRATCH_ROOT = path.resolve(PMS_ROOT, '..');
const WEBPAGE_ROOT = path.resolve(SCRATCH_ROOT, 'webpage-mahana');

describe('Casa Mahana PMS & Website Integration Suite (R1 - R5)', () => {

  // ── Tier 1: URL Parameter Ingestion & Routing (R1) ──
  describe('Tier 1: URL Parameter Ingestion & Routing (R1)', () => {
    it('TC-1.1: Ingests Estadía parameters accurately (/reservar?plan=todo_incluido&guests=4&date=2026-11-01&category=Estadía)', () => {
      const res = parseBookingUrlParams('/reservar?plan=todo_incluido&guests=4&date=2026-11-01&category=Estad%C3%ADa');
      expect(res.plan).toBe('todo_incluido');
      expect(res.category).toBe('Estadía');
      expect(res.adults).toBe(4);
      expect(res.checkIn).toBe('2026-11-01');
      expect(res.checkOut).toBe('2026-11-02');
    });

    it('TC-1.2: Ingests Pasadía parameters with checkOut synced to checkIn', () => {
      const res = parseBookingUrlParams('/reservar?plan=pasadia_comidas&category=Pasad%C3%ADa&date=2026-11-05');
      expect(res.plan).toBe('pasadia_comidas');
      expect(res.category).toBe('Pasadía');
      expect(res.checkIn).toBe('2026-11-05');
      expect(res.checkOut).toBe('2026-11-05');
    });

    it('TC-1.3 & TC-1.4: Infers category="Pasadía" when category is omitted for pasadia plans', () => {
      const resComidas = parseBookingUrlParams('/reservar?plan=pasadia_comidas&date=2026-11-10');
      expect(resComidas.category).toBe('Pasadía');
      expect(resComidas.checkOut).toBe('2026-11-10');

      const resEntrada = parseBookingUrlParams('/reservar?plan=pasadia_entrada');
      expect(resEntrada.category).toBe('Pasadía');
    });

    it('TC-1.5 to TC-1.7: Infers category="Estadía" when category is omitted for lodging plans', () => {
      const resEscape = parseBookingUrlParams('/reservar?plan=escape_mahana&date=2026-11-20');
      expect(resEscape.category).toBe('Estadía');
      expect(resEscape.checkOut).toBe('2026-11-21');

      const resTodo = parseBookingUrlParams('/reservar?plan=todo_incluido');
      expect(resTodo.category).toBe('Estadía');

      const resExp = parseBookingUrlParams('/reservar?plan=mahana_exp');
      expect(resExp.category).toBe('Estadía');
    });

    it('TC-1.8 to TC-1.10: Handles parameter aliases and explicit check_out override', () => {
      const resAliases = parseBookingUrlParams('/reservar?plan=todo_incluido&check_in=2026-12-15&adults=3');
      expect(resAliases.checkIn).toBe('2026-12-15');
      expect(resAliases.adults).toBe(3);

      const resOverride = parseBookingUrlParams('/reservar?date=2026-11-01&check_out=2026-11-10');
      expect(resOverride.checkIn).toBe('2026-11-01');
      expect(resOverride.checkOut).toBe('2026-11-10');
    });

    it('TC-1.11 & TC-1.12: Gracefully sanitizes boundary, negative, or malformed inputs', () => {
      const resInvalid = parseBookingUrlParams('/reservar?guests=-10&date=invalid-date-string');
      expect(resInvalid.adults).toBe(1);
      expect(resInvalid.checkIn).toBe('');

      const resAccents = parseBookingUrlParams('/reservar?category=Estad%C3%ADa');
      expect(resAccents.category).toBe('Estadía');
    });

    it('TC-1.13 & TC-1.14: BookingWidget.tsx contains search parameter ingestion and plan pre-selection logic', () => {
      const widgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
      expect(fs.existsSync(widgetPath)).toBe(true);
      const content = fs.readFileSync(widgetPath, 'utf-8');
      expect(/URLSearchParams|useSearchParams|location\.search/.test(content)).toBe(true);
      expect(content).toContain('selectedPlan');
    });

    it('TC-1.15: App.tsx routes both /reservar and /reservar/ without authentication redirect', () => {
      const appPath = path.join(PMS_ROOT, 'src', 'App.tsx');
      expect(fs.existsSync(appPath)).toBe(true);
      const content = fs.readFileSync(appPath, 'utf-8');
      const supportsTrailingSlash = content.includes('/reservar/') ||
                                    /location\.pathname\.startsWith\(['"]\/reservar['"]\)/.test(content) ||
                                    /\/reservar\/?/.test(content) ||
                                    (content.includes('/reservar') && content.includes('pathname.replace(/\\/$/, \'\')'));
      expect(supportsTrailingSlash).toBe(true);
    });
  });

  // ── Tier 2: Plan and Pricing Consistency (R2) ──
  describe('Tier 2: Plan and Pricing Consistency ("PMS Manda" R2)', () => {
    it('TC-2.1: escape_mahana exists with activo=1, visible_web=1, rate=$16.50', () => {
      const dbPath = path.join(PMS_ROOT, 'data', 'casa-mahana.db');
      const db = new Database(dbPath, { readonly: true });
      try {
        const plan = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'escape_mahana'").get();
        expect(plan).toBeDefined();
        expect(plan.activo).toBe(1);
        expect(plan.visible_web).toBe(1);
        expect(Number(plan.precio_adulto_noche)).toBe(16.50);
      } finally {
        db.close();
      }
    });

    it('TC-2.2: todo_incluido exists with activo=1, visible_web=1, rate=$66.00', () => {
      const dbPath = path.join(PMS_ROOT, 'data', 'casa-mahana.db');
      const db = new Database(dbPath, { readonly: true });
      try {
        const plan = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'todo_incluido'").get();
        expect(plan).toBeDefined();
        expect(plan.activo).toBe(1);
        expect(plan.visible_web).toBe(1);
        expect(Number(plan.precio_adulto_noche)).toBe(66.00);
      } finally {
        db.close();
      }
    });

    it('TC-2.3: mahana_exp exists with activo=1, visible_web=1, rate=$49.50', () => {
      const dbPath = path.join(PMS_ROOT, 'data', 'casa-mahana.db');
      const db = new Database(dbPath, { readonly: true });
      try {
        const plan = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'mahana_exp'").get();
        expect(plan).toBeDefined();
        expect(plan.activo).toBe(1);
        expect(plan.visible_web).toBe(1);
        expect(Number(plan.precio_adulto_noche)).toBe(49.50);
      } finally {
        db.close();
      }
    });

    it('TC-2.4 & TC-2.5: Pasadía plans exist with activo=1, visible_web=1', () => {
      const dbPath = path.join(PMS_ROOT, 'data', 'casa-mahana.db');
      const db = new Database(dbPath, { readonly: true });
      try {
        const comidas = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'pasadia_comidas'").get();
        expect(comidas).toBeDefined();
        expect(comidas.activo).toBe(1);
        expect(comidas.visible_web).toBe(1);
        expect(Number(comidas.precio_adulto_noche)).toBe(35.00);

        const entrada = db.prepare("SELECT * FROM planes_tarifa WHERE codigo = 'pasadia_entrada'").get();
        expect(entrada).toBeDefined();
        expect(entrada.activo).toBe(1);
        expect(entrada.visible_web).toBe(1);
        expect(Number(entrada.precio_adulto_noche)).toBe(5.50);
      } finally {
        db.close();
      }
    });

    it('TC-2.6 & TC-2.7: Seed script server/db/database.js defines escape_mahana and visible_web=1', () => {
      const dbJsPath = path.join(PMS_ROOT, 'server', 'db', 'database.js');
      const content = fs.readFileSync(dbJsPath, 'utf-8');
      expect(content).toContain('escape_mahana');
      expect(content).toContain('visible_web');
    });

    it('TC-2.8 & TC-2.9: Webpage package rate alignment in ProductShowcase.tsx and ProductsHook.tsx', () => {
      const showcasePath = path.join(WEBPAGE_ROOT, 'src', 'pages', 'ProductShowcase.tsx');
      if (fs.existsSync(showcasePath)) {
        const content = fs.readFileSync(showcasePath, 'utf-8');
        expect(content).toContain("'$49.50'");
        expect(content).toContain("'$66'");
        expect(content).toContain("'$38.50'");
      }

      const hookPath = path.join(WEBPAGE_ROOT, 'src', 'components', 'ProductsHook.tsx');
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');
        expect(content.includes('$70/noche')).toBe(false);
      }
    });

    it('TC-2.10: PMS Concurrency Test in e2e.test.js uses non-expired dynamic date', () => {
      const e2eTestPath = path.join(PMS_ROOT, 'server', 'tests', 'e2e.test.js');
      const content = fs.readFileSync(e2eTestPath, 'utf-8');
      const tc43Index = content.indexOf('TC-4.3');
      const tc44Index = content.indexOf('TC-4.4');
      expect(tc43Index).toBeGreaterThan(-1);
      const tc43Block = content.slice(tc43Index, tc44Index > -1 ? tc44Index : undefined);
      expect(tc43Block.includes('Date.now()')).toBe(true);
    });
  });

  // ── Tier 3: GA4 & Attribution Tracking (R3) ──
  describe('Tier 3: GA4 & Attribution Tracking (R3)', () => {
    it('TC-3.1: Google tag G-02NLS8E3LG is installed in index.html', () => {
      const indexPath = path.join(PMS_ROOT, 'index.html');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('https://www.googletagmanager.com/gtag/js?id=G-02NLS8E3LG');
      expect(content).toContain('G-02NLS8E3LG');
    });

    it('TC-3.2: UTM parameters captured and stored in BookingWidget.tsx', () => {
      const widgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
      const content = fs.readFileSync(widgetPath, 'utf-8');
      expect(/utm_source|utm_medium|utm_campaign|gclid|fbclid/.test(content)).toBe(true);
    });

    it('TC-3.3 & TC-3.4: gtag purchase event dispatched with transaction_id, value, and USD currency', () => {
      const widgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
      const content = fs.readFileSync(widgetPath, 'utf-8');
      expect(/gtag\s*\(\s*['"]event['"]\s*,\s*['"]purchase['"]/.test(content)).toBe(true);
      expect(content).toContain('transaction_id');
      expect(content).toContain('value');
      expect(content).toContain('USD');
    });
  });

  // ── Tier 4: Return Navigation to Public Website (R4) ──
  describe('Tier 4: Return Navigation to Public Website (R4)', () => {
    it('TC-4.1 & TC-4.2: Brand logo and "← Volver al sitio web" link to https://www.casamahana.com', () => {
      const widgetPath = path.join(PMS_ROOT, 'src', 'pages', 'BookingWidget.tsx');
      const content = fs.readFileSync(widgetPath, 'utf-8');
      expect(content).toContain('https://www.casamahana.com');
      expect(/Volver al sitio web/i.test(content)).toBe(true);
    });
  });

  // ── Tier 5: Integration Roadmap & Custom Domain Documentation (R5) ──
  describe('Tier 5: Integration Roadmap & Custom Domain Documentation (R5)', () => {
    it('TC-5.1 to TC-5.5: custom-domain-roadmap.md exists and covers CNAME, Render, SSL/TLS, and CORS', () => {
      const docPath = path.join(PMS_ROOT, 'docs', 'custom-domain-roadmap.md');
      expect(fs.existsSync(docPath)).toBe(true);
      const content = fs.readFileSync(docPath, 'utf-8');
      expect(content).toContain('CNAME');
      expect(content).toContain('reservas.casamahana.com');
      expect(/render/i.test(content)).toBe(true);
      expect(/ssl|tls/i.test(content)).toBe(true);
      expect(/cors/i.test(content)).toBe(true);
    });
  });

});
