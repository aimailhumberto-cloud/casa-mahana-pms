import { describe, it, expect, beforeAll, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.TEST_DB_NAME = 'casa-mahana-admin-test.db';

const { getDb, resetDb } = require('../db/database');
const { hashPassword } = require('../auth');
const adminRouter = require('./admin');
const authRouter = require('./auth');

// Helper to find the route handler directly from the router stack
function findRouteHandler(router, path, method) {
  const route = router.stack.find(
    (s) => s.route && s.route.path === path && s.route.methods[method]
  );
  if (!route) throw new Error(`Route not found for path: ${path} and method: ${method}`);
  return route.route.stack[route.route.stack.length - 1].handle;
}

describe('Admin CRUD and Deactivated User Security Endpoints', () => {
  let db;
  let loginHandler;
  let getUsuariosHandler;
  let postUsuariosHandler;
  let putUsuariosHandler;
  let deleteUsuariosHandler;
  let getConfigHandler;
  let putConfigHandler;
  let getNotifLogsHandler;
  let getReversionesLogsHandler;
  let postTestResendHandler;

  beforeAll(() => {
    resetDb();

    const fs = require('fs');
    const path = require('path');
    const dbDir = fs.existsSync('/data') ? '/data' : path.resolve(__dirname, '../../data');
    const dbPath = path.join(dbDir, 'casa-mahana-admin-test.db');
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch (e) {}
    }

    db = getDb();

    // Find handlers
    loginHandler = findRouteHandler(authRouter, '/login', 'post');
    getUsuariosHandler = findRouteHandler(adminRouter, '/usuarios', 'get');
    postUsuariosHandler = findRouteHandler(adminRouter, '/usuarios', 'post');
    putUsuariosHandler = findRouteHandler(adminRouter, '/usuarios/:id', 'put');
    deleteUsuariosHandler = findRouteHandler(adminRouter, '/usuarios/:id', 'delete');
    getConfigHandler = findRouteHandler(adminRouter, '/configuracion/sistema', 'get');
    putConfigHandler = findRouteHandler(adminRouter, '/configuracion/sistema', 'put');
    getNotifLogsHandler = findRouteHandler(adminRouter, '/configuracion/logs', 'get');
    getReversionesLogsHandler = findRouteHandler(adminRouter, '/configuracion/reversiones', 'get');
    postTestResendHandler = findRouteHandler(adminRouter, '/configuracion/test-resend', 'post');
  });

  describe('Deactivated User Security Blocking', () => {
    it('should prevent deactivated users from logging in and return USER_DEACTIVATED (403)', () => {
      // Seed a deactivated user
      const passHash = hashPassword('secret123');
      db.prepare(`
        INSERT INTO usuarios (email, nombre, rol, password_hash, activo)
        VALUES ('deactivated@casamahana.com', 'Deactivated Guy', 'receptionist', ?, 0)
      `).run(passHash);

      const req = {
        body: { email: 'deactivated@casamahana.com', password: 'secret123' }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      loginHandler(req, res);
      expect(resStatus).toBe(403);
      expect(resData.success).toBe(false);
      expect(resData.error.code).toBe('USER_DEACTIVATED');
    });
  });

  describe('User Management CRUD', () => {
    let newUserId;

    it('should allow admin to create a new user', () => {
      const req = {
        user: { rol: 'admin' },
        body: {
          email: 'newstaff@casamahana.com',
          nombre: 'New Staff Member',
          rol: 'receptionist',
          password: 'password123'
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      postUsuariosHandler(req, res);
      expect(resStatus).toBe(201);
      expect(resData.success).toBe(true);
      expect(resData.data.email).toBe('newstaff@casamahana.com');
      newUserId = resData.data.id;
    });

    it('should validate inputs during user creation', () => {
      const req = {
        user: { rol: 'admin' },
        body: {
          email: 'invalid-email',
          nombre: 'Bad Email',
          rol: 'invalid-role',
          password: '123'
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      postUsuariosHandler(req, res);
      expect(resStatus).toBe(400);
      expect(resData.success).toBe(false);
      expect(resData.error.code).toBe('VALIDATION_ERROR');
    });

    it('should list all users with pagination and search', () => {
      const req = {
        user: { rol: 'admin' },
        query: { page: 1, limit: 10, search: 'New Staff' }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      getUsuariosHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.length).toBe(1);
      expect(resData.data[0].id).toBe(newUserId);
    });

    it('should allow updating user info and active status', () => {
      const req = {
        user: { rol: 'admin' },
        params: { id: newUserId },
        body: {
          nombre: 'Updated Staff Name',
          rol: 'cleaning',
          activo: false
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      putUsuariosHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.nombre).toBe('Updated Staff Name');
      expect(resData.data.rol).toBe('cleaning');
      expect(resData.data.activo).toBe(0); // false is converted to 0
    });

    it('should soft-delete/deactivate a user via DELETE /usuarios/:id', () => {
      const req = {
        user: { rol: 'admin' },
        params: { id: newUserId }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      deleteUsuariosHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);

      const dbUser = db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(newUserId);
      expect(dbUser.activo).toBe(0);
    });
  });

  describe('System Settings and Configuration CRUD', () => {
    it('should allow admin to retrieve current configuration', () => {
      const req = {
        user: { rol: 'admin' }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      getConfigHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.id).toBe(1);
    });

    it('should allow admin to modify configuration settings', () => {
      const req = {
        user: { rol: 'admin' },
        body: {
          smtp_host: 'smtp.casamahana.com',
          smtp_port: 465,
          smtp_user: 'pms@casamahana.com',
          smtp_pass: 'pass456',
          smtp_from: 'PMS System <pms@casamahana.com>',
          notifications_enabled: true,
          wa_api_url: 'https://graph.facebook.com/v19.0/12345/messages',
          wa_api_token: 'token789',
          wa_from_number: '1234567890',
          wa_enabled: true,
          email_provider: 'resend',
          resend_api_key: 're_secret123',
          resend_from_email: 'noreply@casamahana.com'
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      putConfigHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.smtp_host).toBe('smtp.casamahana.com');
      expect(resData.data.smtp_port).toBe(465);
      expect(resData.data.notifications_enabled).toBe(1);
      expect(resData.data.wa_api_url).toBe('https://graph.facebook.com/v19.0/12345/messages');
      expect(resData.data.wa_enabled).toBe(1);
      expect(resData.data.email_provider).toBe('resend');
      expect(resData.data.resend_api_key).toBe('re_secret123');
      expect(resData.data.resend_from_email).toBe('noreply@casamahana.com');
    });

    it('should validate SMTP port during updates', () => {
      const req = {
        user: { rol: 'admin' },
        body: {
          smtp_port: 999999
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      putConfigHandler(req, res);
      expect(resStatus).toBe(400);
      expect(resData.success).toBe(false);
      expect(resData.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Logs Queries', () => {
    beforeAll(() => {
      // Seed reservation and folio to satisfy foreign key constraints
      db.prepare(`
        INSERT INTO reservas_hotel (id, cliente, check_in, check_out, adultos, estado)
        VALUES (42, 'Log Guest', '2026-06-10', '2026-06-12', 2, 'Confirmada')
      `).run();

      db.prepare(`
        INSERT INTO folio_hotel (id, reserva_id, tipo, concepto, monto, registrado_por)
        VALUES (101, 42, 'credito', 'Pago depósito', 150.0, 'Test Staff')
      `).run();

      // Seed some log data
      db.prepare(`
        INSERT INTO notificaciones_log (reserva_id, tipo, canal, destinatario, resultado, created_at)
        VALUES (42, 'confirmacion', 'email', 'guest@example.com', '{"sent":true}', datetime('now'))
      `).run();

      db.prepare(`
        INSERT INTO reversiones_log (reserva_id, folio_id, monto, concepto_original, motivo, reversado_por)
        VALUES (42, 101, 150.0, 'Pago depósito', 'Cancelación', 'Admin User')
      `).run();
    });

    it('should retrieve notification logs', () => {
      const req = {
        user: { rol: 'admin' },
        query: { page: 1, limit: 10 }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      getNotifLogsHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.length).toBeGreaterThan(0);
      expect(resData.data[0].reserva_id).toBe(42);
    });

    it('should retrieve reversals audit logs', () => {
      const req = {
        user: { rol: 'admin' },
        query: { page: 1, limit: 10 }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      getReversionesLogsHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.length).toBeGreaterThan(0);
      expect(resData.data[0].reserva_id).toBe(42);
    });
  });

  describe('Resend Test Diagnostics Endpoint', () => {
    it('should validate request fields and return VALIDATION_ERROR (400)', async () => {
      const req = {
        user: { rol: 'admin' },
        body: {
          resend_api_key: '',
          resend_from_email: 'noreply@casamahana.com',
          destinatario: 'test@example.com'
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      await postTestResendHandler(req, res);
      expect(resStatus).toBe(400);
      expect(resData.success).toBe(false);
      expect(resData.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return success when Resend API responds with success', async () => {
      const https = require('https');
      const mockRequest = vi.spyOn(https, 'request').mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 200,
          on: (event, cb) => {
            if (event === 'data') {
              cb(JSON.stringify({ id: 're_order_12345' }));
            }
            if (event === 'end') {
              cb();
            }
          }
        };
        callback(mockResponse);
        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn()
        };
      });

      const req = {
        user: { rol: 'admin' },
        body: {
          resend_api_key: 're_testkey123',
          resend_from_email: 'noreply@casamahana.com',
          destinatario: 'client@example.com'
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      await postTestResendHandler(req, res);
      expect(resStatus).toBe(200);
      expect(resData.success).toBe(true);
      expect(resData.data.messageId).toBe('re_order_12345');

      mockRequest.mockRestore();
    });

    it('should return error details when Resend API fails', async () => {
      const https = require('https');
      const mockRequest = vi.spyOn(https, 'request').mockImplementation((options, callback) => {
        const mockResponse = {
          statusCode: 400,
          on: (event, cb) => {
            if (event === 'data') {
              cb('Invalid API Key');
            }
            if (event === 'end') {
              cb();
            }
          }
        };
        callback(mockResponse);
        return {
          on: vi.fn(),
          write: vi.fn(),
          end: vi.fn()
        };
      });

      const req = {
        user: { rol: 'admin' },
        body: {
          resend_api_key: 're_badkey',
          resend_from_email: 'noreply@casamahana.com',
          destinatario: 'client@example.com'
        }
      };
      let resStatus = 200;
      let resData = null;
      const res = {
        status: (code) => { resStatus = code; return res; },
        json: (data) => { resData = data; return res; }
      };

      await postTestResendHandler(req, res);
      expect(resStatus).toBe(400);
      expect(resData.success).toBe(false);
      expect(resData.error.code).toBe('RESEND_TEST_FAILED');
      expect(resData.error.message).toContain('Invalid API Key');

      mockRequest.mockRestore();
    });
  });
});
