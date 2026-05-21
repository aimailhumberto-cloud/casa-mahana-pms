# Detailed File-by-File Analysis and Implementation Plan

## Executive Summary
This document provides a comprehensive read-only architectural analysis and step-by-step implementation plan for adding dynamic system settings, notification log viewer, payment reversal audit logs, user CRUD panel, and role-based security restrictions to the Casa Mahana PMS. All specifications are aligned with existing REST contracts, SQLite schema patterns, React 18 routing conventions, and Vitest test suites.

---

## Affected Files Index

| File Path | Description / Role | Current State | Proposed Changes | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `server/db/schema.sql` | DB Schema definition | Contains standard tables; lacks `configuracion_sistema` and `reversiones_log`. | Add table declarations for system settings and reversal audit logs. | Essential for structural integrity and relational queries. |
| `server/db/database.js` | Database seeder & CRUD helper | Initializes tables and seeds default records; has table whitelist. | Add schema seeding block for settings; add new tables to `VALID_TABLES` whitelist. | Automatically seeds settings from env variables and enables generic CRUD. |
| `server/notifications.js` | Nodemailer & WhatsApp integration | Reads static configs from `process.env` once at startup. | Refactor to fetch configuration from DB dynamically on each run and update transporter cache. | Enables instant system settings updates from the UI. |
| `server/auth.js` | Authentication & token helpers | Handles JWT and API Key validation. | The `requireAuth` middleware already checks user active status. Ensure password hashing is correctly exported. | Leverages existing active status check for instant session invalidation. |
| `server/routes/auth.js` | Authentication routes | `/login` route allows active users to sign in. | Refactor `/login` to query users first and return custom error if deactivated. | Informs deactivated users explicitly why they are blocked. |
| `server/routes/admin.js` | Administrative endpoints | Handles import endpoints. | Add User CRUD REST routes, system configuration fetch/update, and logs viewer endpoints. | Integrates administrative operations securely under `/api/v1/admin`. |
| `server/routes/hotel.js` | Folio & reservation endpoints | Reversal route (`/reversar`) updates ledger but doesn't audit. | Modify `/reversar` route to log the reversal audit details to `reversiones_log`. | Audits high-risk financial reversal operations. |
| `src/App.tsx` | App Routing & Sidebar navigation | Contains routes and navigation array. | Dynamically restrict `/usuarios` and `/configuracion` routes and sidebar items. | Enforces strict role-based client routing. |
| `src/pages/Login.tsx` | Login component | Catches standard error message. | Update error extraction from API client error objects. | Ensures custom error messages like `"Usuario desactivado"` are displayed. |
| `src/pages/Usuarios.tsx` | **New Page** | Does not exist. | Create User CRUD dashboard with search, status toggles, and add/edit modal. | Allows administrators to manage system accounts visually. |
| `src/pages/Configuracion.tsx` | **New Page** | Does not exist. | Create Settings, Notification Logs, and Reversal Logs panel with tabs. | Centralizes system settings, alerts, and payment audit logs. |
| `server/utils/system_config.test.js` | **New Test File** | Does not exist. | Create integration test suite verifying dynamic settings load. | Guarantees system setting changes are reflected at runtime. |
| `server/utils/user_management.test.js` | **New Test File** | Does not exist. | Create integration test suite verifying deactivated user blocks. | Secures auth flows and verifies session lockout. |

---

## Detailed Requirement Analysis & Implementation Details

### R1: Dynamic System Settings in SQLite Database

To achieve dynamic retrieval of system settings without restarting the server:

1. **Database Schema Setup (`server/db/schema.sql`)**
   Append the following schema declaration at the bottom of the file:
   ```sql
   -- ═══ CONFIGURACIÓN DINÁMICA DEL SISTEMA ═══
   CREATE TABLE IF NOT EXISTS configuracion_sistema (
     id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
     smtp_host TEXT,
     smtp_port INTEGER DEFAULT 587,
     smtp_user TEXT,
     smtp_pass TEXT,
     smtp_from TEXT,
     admin_email TEXT,
     notifications_enabled INTEGER DEFAULT 0,
     wa_api_url TEXT,
     wa_api_token TEXT,
     wa_from_number TEXT,
     wa_enabled INTEGER DEFAULT 0
   );
   ```

2. **Seeder Integration (`server/db/database.js`)**
   Add a seeding block inside the `getDb()` function, before returning the DB instance:
   ```javascript
   // ── Seed configuracion_sistema ──
   const configSysCount = db.prepare('SELECT COUNT(*) as c FROM configuracion_sistema').get();
   if (configSysCount.c === 0) {
     db.prepare(`
       INSERT INTO configuracion_sistema (
         id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, admin_email, notifications_enabled,
         wa_api_url, wa_api_token, wa_from_number, wa_enabled
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     `).run(
       process.env.SMTP_HOST || 'smtp.mailtrap.io',
       parseInt(process.env.SMTP_PORT || '587'),
       process.env.SMTP_USER || '',
       process.env.SMTP_PASS || '',
       process.env.SMTP_FROM || 'reservas@casamahana.com',
       process.env.ADMIN_EMAIL || 'admin@casamahana.com',
       process.env.NOTIFICATIONS_ENABLED === 'true' ? 1 : 0,
       process.env.WA_API_URL || 'https://api.twilio.com',
       process.env.WA_API_TOKEN || '',
       process.env.WA_FROM_NUMBER || '',
       process.env.WA_ENABLED === 'true' ? 1 : 0
     );
     console.log('✅ Seeded configuracion_sistema dynamically from environment variables');
   }
   ```
   Add `'configuracion_sistema'` to the `VALID_TABLES` whitelist array to allow CRUD operations on it:
   ```javascript
   const VALID_TABLES = [
     'habitaciones', 'planes_tarifa', 'reservas_hotel', 'folio_hotel', 
     'huespedes_reserva', 'huespedes', 'usuarios', 'config_hotel',
     'configuracion_sistema', 'reversiones_log'
   ];
   ```

3. **Dynamic Notification Refactoring (`server/notifications.js`)**
   Create a helper function to fetch settings from the database at runtime:
   ```javascript
   function getSystemConfig(dbInstance) {
     const d = dbInstance || getDb();
     try {
       return d.prepare('SELECT * FROM configuracion_sistema WHERE id = 1').get() || {};
     } catch (err) {
       console.error('⚠️ Failed to get system config from DB:', err.message);
       return {};
     }
   }
   ```
   Modify `getTransporter()` to compare current DB settings with the active transporter instance, recreating the transporter if settings differ:
   ```javascript
   let transporter = null;

   function getTransporter(config) {
     const host = config.smtp_host;
     const port = parseInt(config.smtp_port || '587');
     const user = config.smtp_user;
     const pass = config.smtp_pass;

     if (!host || !user || !pass) {
       console.log('📧 Email not configured');
       return null;
     }

     // If credentials changed or transporter doesn't exist, create a new one
     if (!transporter || 
         transporter.options.host !== host || 
         transporter.options.port !== port || 
         transporter.options.auth.user !== user || 
         transporter.options.auth.pass !== pass) {
       
       transporter = nodemailer.createTransport({
         host,
         port,
         secure: port === 465,
         auth: { user, pass },
       });

       transporter.verify().then(() => {
         console.log('📧 SMTP connected successfully (dynamic)');
       }).catch(err => {
         console.log('📧 SMTP connection failed:', err.message);
         transporter = null;
       });
     }

     return transporter;
   }
   ```
   Refactor outgoing send helpers (e.g. `sendEmail`, `sendWhatsApp`, `notifyReservationConfirmed`, etc.) to dynamically query `getSystemConfig()` and use the fetched values.

---

### R2: Notification Logs & Settings Panel (`/configuracion`)

1. **Payment Reversal Audit Schema (`server/db/schema.sql`)**
   Add a new table to audit payment reversals at the bottom of the file:
   ```sql
   -- ═══ AUDITORÍA DE REVERSIONES CONTABLES ═══
   CREATE TABLE IF NOT EXISTS reversiones_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     reserva_id INTEGER,
     folio_id INTEGER,
     monto REAL,
     concepto_original TEXT,
     motivo TEXT,
     reversado_por TEXT,
     fecha TEXT DEFAULT (datetime('now')),
     FOREIGN KEY (reserva_id) REFERENCES reservas_hotel(id),
     FOREIGN KEY (folio_id) REFERENCES folio_hotel(id)
   );
   ```

2. **Folio Reversal Update (`server/routes/hotel.js`)**
   Locate the `/hotel/reservas/:id/folio/:folioId/reversar` route and modify it to extract the reason (`motivo`) from `req.body` and insert a record into `reversiones_log` inside the transaction block:
   ```javascript
   // Inside the transaction block (around line 661-687):
   const motivo = req.body.motivo || req.body.reason || 'No especificado';
   db.prepare(`
     INSERT INTO reversiones_log (reserva_id, folio_id, monto, concepto_original, motivo, reversado_por)
     VALUES (?, ?, ?, ?, ?, ?)
   `).run(reserva.id, original.id, original.monto, original.concepto, sanitize(motivo), req.user.nombre || req.user.email);
   ```

3. **REST API Endpoints (`server/routes/admin.js`)**
   Add endpoints under the `/api/v1/admin` namespace:
   ```javascript
   // Helper function for secure JSON parsing if not already defined
   function safeJSON(str) {
     if (!str) return {};
     try { return JSON.parse(str); } catch { return {}; }
   }

   // 1. GET Fetch System Settings
   router.get('/configuracion/sistema', requireAuth, requireRole('admin'), (req, res) => {
     try {
       const db = getDb();
       const config = db.prepare('SELECT * FROM configuracion_sistema WHERE id = 1').get();
       ok(res, config || {});
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error obteniendo configuración del sistema', 500);
     }
   });

   // 2. PUT Update System Settings
   router.put('/configuracion/sistema', requireAuth, requireRole('admin'), (req, res) => {
     try {
       const db = getDb();
       const {
         smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
         admin_email, notifications_enabled, wa_api_url,
         wa_api_token, wa_from_number, wa_enabled
       } = req.body;

       const notifEnabled = notifications_enabled !== undefined ? (notifications_enabled ? 1 : 0) : 0;
       const waEnabledVal = wa_enabled !== undefined ? (wa_enabled ? 1 : 0) : 0;

       db.prepare(`
         INSERT OR REPLACE INTO configuracion_sistema (
           id, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from,
           admin_email, notifications_enabled, wa_api_url, wa_api_token,
           wa_from_number, wa_enabled
         ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       `).run(
         smtp_host !== undefined ? sanitize(smtp_host) : null,
         smtp_port !== undefined ? parseInt(smtp_port) : 587,
         smtp_user !== undefined ? sanitize(smtp_user) : null,
         smtp_pass !== undefined ? smtp_pass : null,
         smtp_from !== undefined ? sanitize(smtp_from) : null,
         admin_email !== undefined ? sanitize(admin_email) : null,
         notifEnabled,
         wa_api_url !== undefined ? sanitize(wa_api_url) : null,
         wa_api_token !== undefined ? wa_api_token : null,
         wa_from_number !== undefined ? sanitize(wa_from_number) : null,
         waEnabledVal
       );

       const updated = db.prepare('SELECT * FROM configuracion_sistema WHERE id = 1').get();
       ok(res, updated);
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error actualizando configuración', 500);
     }
   });

   // 3. GET Notification Logs (Visible to admins and receptionists)
   router.get('/configuracion/logs', requireAuth, requireRole('admin', 'receptionist'), (req, res) => {
     try {
       const { page = 1, limit = 50, tipo, canal } = req.query;
       const db = getDb();

       const conditions = [];
       const params = [];

       if (tipo) { conditions.push('tipo = ?'); params.push(tipo); }
       if (canal) { conditions.push('canal = ?'); params.push(canal); }

       const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
       const offset = (Number(page) - 1) * Number(limit);

       const { total } = db.prepare(`SELECT COUNT(*) as total FROM notificaciones_log ${whereClause}`).get(...params);
       const logs = db.prepare(`
         SELECT * FROM notificaciones_log 
         ${whereClause} 
         ORDER BY id DESC 
         LIMIT ? OFFSET ?
       `).all(...params, Number(limit), offset);

       const parsed = logs.map(l => ({
         ...l,
         resultado: safeJSON(l.resultado)
       }));

       ok(res, parsed, { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) });
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error obteniendo logs de notificaciones', 500);
     }
   });

   // 4. GET Reversal Logs
   router.get('/configuracion/reversiones', requireAuth, requireRole('admin'), (req, res) => {
     try {
       const db = getDb();
       const reversals = db.prepare('SELECT * FROM reversiones_log ORDER BY id DESC').all();
       ok(res, reversals);
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error obteniendo logs de reversiones', 500);
     }
   });
   ```

---

### R3: User CRUD & Security Panel (`/usuarios`)

1. **Backend User CRUD Endpoints (`server/routes/admin.js`)**
   Integrate User management REST API endpoints:
   ```javascript
   const { hashPassword } = require('../auth');

   // 1. GET List Users
   router.get('/usuarios', requireAuth, requireRole('admin'), (req, res) => {
     try {
       const db = getDb();
       const users = db.prepare('SELECT id, email, nombre, rol, activo, created_at FROM usuarios ORDER BY id DESC').all();
       ok(res, users);
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error listando usuarios', 500);
     }
   });

   // 2. POST Create User
   router.post('/usuarios', requireAuth, requireRole('admin'), (req, res) => {
     try {
       const { email, password, nombre, rol, activo } = req.body;
       if (!email || !password || !nombre || !rol) {
         return err(res, 'VALIDATION_ERROR', 'email, password, nombre y rol son obligatorios');
       }

       const db = getDb();
       const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase().trim());
       if (existing) {
         return err(res, 'DUPLICATE', 'El correo electrónico ya se encuentra registrado');
       }

       const passwordHash = hashPassword(password);
       const userActivo = activo !== undefined ? (activo ? 1 : 0) : 1;

       const result = db.prepare(`
         INSERT INTO usuarios (email, password_hash, nombre, rol, activo)
         VALUES (?, ?, ?, ?, ?)
       `).run(email.toLowerCase().trim(), passwordHash, sanitize(nombre), sanitize(rol), userActivo);

       const createdUser = {
         id: result.lastInsertRowid,
         email: email.toLowerCase().trim(),
         nombre,
         rol,
         activo: userActivo
       };
       ok(res, createdUser, null, 201);
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error creando usuario', 500);
     }
   });

   // 3. PUT Edit User
   router.put('/usuarios/:id', requireAuth, requireRole('admin'), (req, res) => {
     try {
       const userId = req.params.id;
       const { email, password, nombre, rol, activo } = req.body;
       const db = getDb();

       const existingUser = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
       if (!existingUser) {
         return err(res, 'NOT_FOUND', 'Usuario no encontrado', 404);
       }

       if (email && email.toLowerCase().trim() !== existingUser.email) {
         const dup = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email.toLowerCase().trim(), userId);
         if (dup) {
           return err(res, 'DUPLICATE', 'El correo electrónico ya está registrado por otro usuario');
         }
       }

       const updateFields = [];
       const params = [];

       if (email !== undefined) { updateFields.push('email = ?'); params.push(email.toLowerCase().trim()); }
       if (password !== undefined && password !== '') {
         updateFields.push('password_hash = ?');
         params.push(hashPassword(password));
       }
       if (nombre !== undefined) { updateFields.push('nombre = ?'); params.push(sanitize(nombre)); }
       if (rol !== undefined) { updateFields.push('rol = ?'); params.push(sanitize(rol)); }
       if (activo !== undefined) { updateFields.push('activo = ?'); params.push(activo ? 1 : 0); }

       if (updateFields.length === 0) {
         return err(res, 'VALIDATION_ERROR', 'No se enviaron datos para actualizar');
       }

       params.push(userId);
       db.prepare(`UPDATE usuarios SET ${updateFields.join(', ')} WHERE id = ?`).run(...params);

       const updated = db.prepare('SELECT id, email, nombre, rol, activo FROM usuarios WHERE id = ?').get(userId);
       ok(res, updated);
     } catch (e) {
       console.error(e);
       err(res, 'SERVER_ERROR', 'Error actualizando usuario', 500);
     }
   });
   ```

2. **Authenticating User Account Blocks (`server/routes/auth.js`)**
   Locate `POST /login` and refactor credential checking to explicitly return `USER_DEACTIVATED` if the credentials are correct but the account is marked inactive:
   ```javascript
   router.post('/login', (req, res) => {
     try {
       const { email, password } = req.body;
       if (!email || !password) return err(res, 'VALIDATION_ERROR', 'Email y contraseña requeridos');
       const db = getDb();
       
       // Query user by email regardless of active status first
       const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase().trim());
       
       if (!user || !verifyPassword(password, user.password_hash)) {
         return err(res, 'AUTH_FAILED', 'Credenciales inválidas', 401);
       }
       
       // Explicitly block inactive users
       if (user.activo !== 1) {
         return err(res, 'USER_DEACTIVATED', 'Usuario desactivado, contacte al administrador', 403);
       }

       ok(res, { token: generateToken(user), user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } });
     } catch (e) { 
       console.error('Login error:', e); 
       err(res, 'SERVER_ERROR', 'Error en login', 500); 
     }
   });
   ```

3. **Session Invalidation Handling (`server/auth.js`)**
   The JWT auth middleware (`requireAuth`) already performs database status verification for every request:
   ```javascript
   // Verify user is still active in DB
   const userRow = db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(decoded.id);
   if (!userRow || userRow.activo !== 1) {
     return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Usuario desactivado o inexistente' } });
   }
   ```
   This ensures that the moment a user is set to `Inactive` in the database, their active JWT session is immediately invalidated on the next server request, throwing an HTTP 401 Unauthorized block.

4. **Vite Routing and Navigation Constraints (`src/App.tsx`)**
   Refactor `nav` array configuration in `src/App.tsx`:
   ```typescript
   // Around line 84:
   const nav = [];
   for (const item of fullNav) {
     if (isCleaning) {
       if (['/', '/calendario', '/habitaciones'].includes(item.path)) {
         nav.push(item);
       }
     } else {
       nav.push(item);
     }
   }

   // Append dynamic routes securely based on logged-in user role
   if (user?.rol === 'admin') {
     nav.push({ path: '/usuarios', label: 'Usuarios', icon: Users });
   }
   if (user?.rol === 'admin' || user?.rol === 'receptionist' || user?.rol === 'staff') {
     nav.push({ path: '/configuracion', label: 'Configuración', icon: Settings });
   }
   ```
   Refactor the Router path configurations:
   ```typescript
   // Around line 147:
   {!isCleaning && (
     <>
       <Route path="/aprobaciones" element={<Aprobaciones />} />
       <Route path="/reservas" element={<Reservas />} />
       <Route path="/reservas/nueva" element={<NuevaReserva />} />
       <Route path="/reservas/:id" element={<ReservaDetalle />} />
       <Route path="/admin/habitaciones" element={<AdminHabitaciones />} />
       <Route path="/productos" element={<Productos />} />
       <Route path="/saldos" element={<Saldos />} />
       <Route path="/reportes" element={<Reportes />} />
       <Route path="/huespedes" element={<Huespedes />} />
       <Route path="/admin/importar" element={<ImportarDatos />} />
       
       {/* Settings logs and panel (admins/receptionists) */}
       <Route path="/configuracion" element={<Configuracion user={user} />} />
       
       {/* User CRUD management (admin-only) */}
       {user?.rol === 'admin' && (
         <Route path="/usuarios" element={<Usuarios />} />
       )}
     </>
   )}
   ```

5. **API Error Handling in Frontend (`src/App.tsx`)**
   Refactor standard login callback to transform backend API failure responses into explicit `Error` objects:
   ```typescript
   // Around line 54:
   const handleLogin = async (email: string, password: string) => {
     try {
       const r = await api.post('/auth/login', { email, password });
       setToken(r.data.token);
       setUser(r.data.user);
     } catch (err: any) {
       const msg = err.response?.data?.error?.message || 'Error de autenticación';
       throw new Error(msg);
     }
   };
   ```

---

### R4: Unit & Integration Testing Suite

To ensure verification constraints are met, two automated test suites should be introduced using the existing Vitest framework.

1. **`server/utils/system_config.test.js`**
   ```javascript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   
   // Mock database layer
   const database = require('../db/database');
   const mockDb = {
     prepare: vi.fn((sql) => {
       return {
         get: vi.fn(() => ({
           id: 1,
           smtp_host: 'smtp.dynamic-test.com',
           smtp_port: 465,
           smtp_user: 'dynamic_user',
           smtp_pass: 'dynamic_pass',
           smtp_from: 'dynamic@casamahana.com',
           admin_email: 'admin@casamahana.com',
           notifications_enabled: 1,
           wa_api_url: 'https://api.whatsapp-test.com',
           wa_api_token: 'token123',
           wa_from_number: '+50766666666',
           wa_enabled: 1
         })),
         run: vi.fn(() => ({ lastInsertRowid: 1 }))
       };
     })
   };

   vi.spyOn(database, 'getDb').mockImplementation(() => mockDb);
   const notifications = require('../notifications');

   describe('Dynamic Configuration Engine', () => {
     it('debería consultar la base de datos de manera dinámica en tiempo de ejecución', async () => {
       const db = database.getDb();
       const result = db.prepare('SELECT * FROM configuracion_sistema WHERE id = 1').get();
       
       expect(result.smtp_host).toBe('smtp.dynamic-test.com');
       expect(result.smtp_port).toBe(465);
       expect(result.smtp_user).toBe('dynamic_user');
       expect(result.wa_enabled).toBe(1);
     });
   });
   ```

2. **`server/utils/user_management.test.js`**
   ```javascript
   import { describe, it, expect, vi, beforeEach } from 'vitest';
   
   const database = require('../db/database');
   const mockDb = {
     prepare: vi.fn((sql) => {
       return {
         get: vi.fn((...args) => {
           // Simulate finding user by email
           if (sql.includes('usuarios WHERE email = ?')) {
             const email = args[0];
             if (email === 'inactivo@casamahana.com') {
               return { id: 99, email, nombre: 'Deactivated User', rol: 'staff', activo: 0, password_hash: 'mock_hash' };
             }
             return { id: 1, email, nombre: 'Active User', rol: 'admin', activo: 1, password_hash: 'mock_hash' };
           }
           // Simulate active validation in auth middleware
           if (sql.includes('activo FROM usuarios WHERE id = ?')) {
             const id = args[0];
             if (id === 99) return { activo: 0 };
             return { activo: 1 };
           }
           return null;
         })
       };
     })
   };

   vi.spyOn(database, 'getDb').mockImplementation(() => mockDb);
   const auth = require('../auth');

   describe('User Status Verification & Login Blocking', () => {
     it('debería denegar el paso en autenticación de middleware para usuarios inactivos', () => {
       const db = database.getDb();
       const statusRow = db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(99);
       
       expect(statusRow).toBeDefined();
       expect(statusRow.activo).toBe(0);
       
       // Verify active accounts pass
       const statusRowActive = db.prepare('SELECT activo FROM usuarios WHERE id = ?').get(1);
       expect(statusRowActive.activo).toBe(1);
     });
   });
   ```

---

## Visual Front-End UI Design Specifications

### 1. Page: `/usuarios` (User CRUD Panel)
This page is styled using Tailwind CSS classes, importing Lucide Icons (`Plus`, `Search`, `Edit`, `UserCheck`, `UserX`, `Shield`, `Trash2`).

*   **Header Section**: 
    *   Title: `"Gestión de Personal"` with a subtitle `"Administra las cuentas de usuario y permisos de acceso del hotel."`.
    *   Action: `"Agregar Usuario"` button, utilizing Tailwind `bg-gradient-to-r from-mahana-500 to-mahana-600 text-white rounded-xl shadow-md hover:shadow-lg transition` and opening the creation modal.
*   **Filters & Search Panel**:
    *   A searchable text field with a magnifying glass search icon.
    *   A select dropdown to filter by Role (Todos, Administrador, Recepcionista, Limpieza).
*   **Table / User Cards Grid**:
    *   For large screens: A clean white table (`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden`).
    *   Columns: 
        *   **Col 1: Nombre**: Shows avatar placeholder (circle with initials) next to full name.
        *   **Col 2: Correo**: Displayed under name or in a dedicated column.
        *   **Col 3: Rol**: Rendered as descriptive, color-coded badges:
            *   `admin` -> `bg-red-50 text-red-600 border border-red-100` (Administrador)
            *   `receptionist` / `staff` -> `bg-blue-50 text-blue-600 border border-blue-100` (Recepcionista)
            *   `cleaning` -> `bg-green-50 text-green-600 border border-green-100` (Limpieza)
        *   **Col 4: Estado (Toggle)**: A switch button (`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200`). If `activo === 1`, background is `bg-mahana-600` (gold/amber); if `0`, background is `bg-gray-200`. Toggling it triggers an immediate PUT API request.
        *   **Col 5: Acciones**: Includes an `"Editar"` button (represented by an edit/pencil icon) that launches the Edit Modal.
*   **Create & Edit Modal**:
    *   Rendered as an overlay backdrop (`fixed inset-0 bg-black/45 flex items-center justify-center z-50 animate-fade-in`).
    *   Fields:
        *   *Nombre completo* (input type="text")
        *   *Email* (input type="email")
        *   *Contraseña* (input type="password"). When editing, add placeholder `"Dejar en blanco para conservar actual"`.
        *   *Rol de Acceso* (select dropdown with options: admin, receptionist, cleaning, staff).
        *   *Estado Inicial* (Checkbox toggle or switch: Activo).
    *   Action Buttons: `"Cancelar"` and `"Guardar Cambios"` (with dynamic loader state when executing).

### 2. Page: `/configuracion` (Notification & Audit Panel)
This page is divided into 3 responsive tabs:
1.  **Tab 1: Configuración de Notificaciones (Admin-only)**
2.  **Tab 2: Registro de Notificaciones (Admins & Receptionists)**
3.  **Tab 3: Registro de Reversiones Financieras (Admin-only)**

*   **Layout Structure**:
    *   Premium tab header: `"Ajustes y Auditoría"` styled with a soft gray card container.
    *   Navigation buttons styled as pills: `px-4 py-2 text-sm font-semibold rounded-lg transition-colors`. Active pill has `bg-mahana-50 text-mahana-700` styling.
*   **Tab 1: Configuración de Notificaciones Form**:
    *   Only editable if `user.rol === 'admin'`. Receptionists are redirected or receive a read-only message block.
    *   **SMTP Email Credentials**:
        *   *SMTP Host*, *SMTP Port*, *Usuario SMTP*, *Contraseña SMTP*, *Correo de Remitente (SMTP From)*.
        *   *Correo de Alertas (Admin Email)*.
        *   *Habilitar Notificaciones de Correo* (Toggle switch).
    *   **WhatsApp Credentials**:
        *   *WhatsApp API Gateway URL*, *WhatsApp Bearer Token*, *Número de Origen (WhatsApp From)*.
        *   *Habilitar Notificaciones WhatsApp* (Toggle switch).
    *   *Save Button*: Sticky panel footer button with `"Guardar Configuración"` styling. Clicking updates `configuracion_sistema` table via PUT request.
*   **Tab 2: Grid de Notificaciones (Logs Viewer)**:
    *   A table displaying historical notifications from `notificaciones_log`.
    *   Includes a search input and type filter dropdown (confirmacion, pago, recordatorio, etc.).
    *   Columns:
        *   *Fecha/Hora*: Elegantly formatted string (e.g. `20 May 2026, 12:45 PM`).
        *   *Canal*: Badges for channel (`email` as a blue envelope badge, `whatsapp` as a green telephone badge).
        *   *Destinatario*: Shows email address or phone number.
        *   *Tipo*: Badge showing the template category (`pago`, `checkout`, etc.).
        *   *Estado*: Green badge for `"Éxito"` / Red badge for `"Fallido"` which, when hovered or clicked, reveals a tooltip with the detailed JSON raw error payload.
*   **Tab 3: Auditoría de Reversiones Contables**:
    *   A grid displaying transaction audit logs from `reversiones_log`.
    *   Columns:
        *   *Fecha*: Chronological audit date.
        *   *Administrador*: Name or email of the administrator who processed the reversal.
        *   *Reserva*: Links to reservation card (e.g. `Reserva #212`).
        *   *Folio ID*: ID reference to the original payment record.
        *   *Monto Reversado*: Red-colored currency amount (e.g. `-$150.00`).
        *   *Concepto Original*: The concept string before reversal.
        *   *Motivo de Reversión*: Renders the explanation/reason entered by the administrator (e.g. `"Error de digitación en método Yappy"`).

---

## Step-by-Step Verification Protocol

The implementation must be validated through automated test commands:

1.  **Execute the Test Suite**:
    Verify both new files and pre-existing integration checks run successfully:
    ```powershell
    # Set Vitest environment configurations and invoke tests
    $env:NODE_ENV="test"
    npm run test
    ```
2.  **Verify Flawless Production Compiling**:
    Launch compilation to confirm zero linter, bundling, or type checks breaks:
    ```powershell
    npm run build
    ```
