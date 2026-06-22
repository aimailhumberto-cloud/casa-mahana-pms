import { describe, it, expect, beforeAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.TEST_DB_NAME = 'casa-mahana-crm-test.db';

const { getDb, resetDb } = require('../db/database');
const crmRouter = require('./crm');

function findRouteHandler(router, path, method) {
  const route = router.stack.find(
    (s) => s.route && s.route.path === path && s.route.methods[method]
  );
  if (!route) throw new Error(`Route not found for path: ${path} and method: ${method}`);
  return route.route.stack[route.route.stack.length - 1].handle;
}

describe('CRM & Custom Quotations Router Endpoints', () => {
  let db;
  let getServicesHandler;
  let createServiceHandler;
  let updateServiceHandler;
  let deleteServiceHandler;
  let listLeadsHandler;
  let getLeadHandler;
  let createLeadHandler;
  let updateStatusHandler;
  let createQuoteHandler;

  beforeAll(() => {

    resetDb();

    const fs = require('fs');
    const path = require('path');
    const dbDir = fs.existsSync('/data') ? '/data' : path.resolve(__dirname, '../../data');
    const dbPath = path.join(dbDir, 'casa-mahana-crm-test.db');
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {}
    }

    db = getDb();

    getServicesHandler = findRouteHandler(crmRouter, '/servicios', 'get');
    createServiceHandler = findRouteHandler(crmRouter, '/servicios', 'post');
    updateServiceHandler = findRouteHandler(crmRouter, '/servicios/:id', 'put');
    deleteServiceHandler = findRouteHandler(crmRouter, '/servicios/:id', 'delete');
    listLeadsHandler = findRouteHandler(crmRouter, '/leads', 'get');
    getLeadHandler = findRouteHandler(crmRouter, '/leads/:id', 'get');
    createLeadHandler = findRouteHandler(crmRouter, '/leads', 'post');
    updateStatusHandler = findRouteHandler(crmRouter, '/leads/:id/status', 'patch');
    createQuoteHandler = findRouteHandler(crmRouter, '/leads/:id/cotizaciones', 'post');
  });

  it('should list all preloaded services successfully', () => {
    const req = { user: { id: 1, rol: 'admin' } };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    getServicesHandler(req, res);

    expect(resStatus).toBe(200);
    expect(resData.success).toBe(true);
    expect(resData.data.length).toBeGreaterThan(0);
    expect(resData.data[0].nombre).toBeDefined();
    expect(resData.data[0].precio_base).toBeDefined();
  });

  it('should successfully create a new client lead', () => {
    const req = {
      user: { id: 1, rol: 'admin' },
      body: {
        nombre: 'Carlos',
        apellido: 'Perez',
        email: 'carlos@example.com',
        telefono: '+507 6123-4567',
        notas: 'Interesado en evento grupal',
        estado: 'Borrador'
      }
    };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    createLeadHandler(req, res);

    expect(resStatus).toBe(201);
    expect(resData.success).toBe(true);
    expect(resData.data.id).toBeDefined();
    expect(resData.data.nombre).toBe('Carlos');
    expect(resData.data.apellido).toBe('Perez');
    expect(resData.data.estado).toBe('Borrador');
  });

  it('should list all leads successfully and count cotizaciones', () => {
    const req = { user: { id: 1, rol: 'admin' } };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    listLeadsHandler(req, res);

    expect(resStatus).toBe(200);
    expect(resData.success).toBe(true);
    expect(resData.data.length).toBe(1);
    expect(resData.data[0].nombre).toBe('Carlos');
    expect(resData.data[0].total_cotizaciones).toBe(0);
  });

  it('should successfully create a custom quote for a lead', () => {
    const req = {
      user: { id: 1, rol: 'admin' },
      params: { id: 1 },
      body: {
        check_in: '2026-07-10',
        check_out: '2026-07-12',
        noches: 2,
        adultos: 15,
        menores: 5,
        mascotas: 0,
        plan_codigo: 'todo_incluido',
        habitaciones_seleccionadas: [1, 2, 3],
        items_adicionales: [
          { nombre: 'Servicio de DJ 🎵', precio: 300.00 },
          { nombre: 'Desayuno para Grupo 👥', precio: 10.00 }
        ],
        subtotal: 1200.00,
        descuento: 10,
        descuento_tipo: 'porcentaje',
        impuesto_pct: 10,
        impuesto_monto: 108.00,
        monto_total: 1188.00,
        deposito_sugerido: 594.00,
        notas: 'Descuento especial por volumen'
      }
    };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    createQuoteHandler(req, res);

    expect(resStatus).toBe(201);
    expect(resData.success).toBe(true);
    expect(resData.data.id).toBeDefined();
    expect(resData.data.lead_id).toBe(1);
    expect(resData.data.monto_total).toBe(1188.00);
    expect(resData.data.items_adicionales.length).toBe(2);
  });

  it('should fetch lead details and parse quotes successfully', () => {
    const req = { user: { id: 1, rol: 'admin' }, params: { id: 1 } };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    getLeadHandler(req, res);

    expect(resStatus).toBe(200);
    expect(resData.success).toBe(true);
    expect(resData.data.lead.nombre).toBe('Carlos');
    expect(resData.data.cotizaciones.length).toBe(1);
    expect(resData.data.cotizaciones[0].monto_total).toBe(1188.00);
    expect(Array.isArray(resData.data.cotizaciones[0].items_adicionales)).toBe(true);
  });

  it('should successfully update lead status', () => {
    const req = {
      user: { id: 1, rol: 'admin' },
      params: { id: 1 },
      body: { estado: 'En Negociación' }
    };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    updateStatusHandler(req, res);

    expect(resStatus).toBe(200);
    expect(resData.success).toBe(true);
    expect(resData.data.estado).toBe('En Negociación');

    // Confirm DB reflects the status update
    const leadRow = db.prepare('SELECT estado FROM leads_clientes WHERE id = 1').get();
    expect(leadRow.estado).toBe('En Negociación');
  });

  it('should successfully create a new preloaded service', () => {
    const req = {
      user: { id: 1, rol: 'admin' },
      body: {
        nombre: 'Servicio de Yoga 🧘',
        descripcion: 'Sesión de yoga grupal al amanecer',
        precio_base: 15.00
      }
    };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    createServiceHandler(req, res);

    expect(resStatus).toBe(201);
    expect(resData.success).toBe(true);
    expect(resData.data.id).toBeDefined();
    expect(resData.data.nombre).toBe('Servicio de Yoga 🧘');
    expect(resData.data.precio_base).toBe(15.00);
  });

  it('should successfully update a preloaded service', () => {
    const req = {
      user: { id: 1, rol: 'admin' },
      params: { id: 1 }, // updates the first seeded service
      body: {
        nombre: 'Desayuno Buffet Premium 🥞',
        descripcion: 'Desayuno buffet completo con café ilimitado',
        precio_base: 12.50,
        activo: true
      }
    };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    updateServiceHandler(req, res);

    expect(resStatus).toBe(200);
    expect(resData.success).toBe(true);
    expect(resData.data.nombre).toBe('Desayuno Buffet Premium 🥞');
    expect(resData.data.precio_base).toBe(12.50);
  });

  it('should successfully deactivate a preloaded service', () => {
    const req = {
      user: { id: 1, rol: 'admin' },
      params: { id: 1 }
    };
    let resStatus = 200;
    let resData = null;
    const res = {
      status: (code) => { resStatus = code; return res; },
      json: (data) => { resData = data; return res; }
    };

    deleteServiceHandler(req, res);

    expect(resStatus).toBe(200);
    expect(resData.success).toBe(true);

    // Verify it is deactivated in DB
    const serviceRow = db.prepare('SELECT activo FROM servicios_adicionales WHERE id = 1').get();
    expect(serviceRow.activo).toBe(0);
  });
});
