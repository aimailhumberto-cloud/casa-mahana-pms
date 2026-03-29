<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green?style=for-the-badge&logo=node.js" alt="Node">
  <img src="https://img.shields.io/badge/react-18-61dafb?style=for-the-badge&logo=react" alt="React">
  <img src="https://img.shields.io/badge/sqlite-3-003B57?style=for-the-badge&logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/deploy-Render-46E3B7?style=for-the-badge&logo=render" alt="Render">
</p>

# 🏨 Casa Mahana PMS

**Sistema de Gestión Hotelera (Property Management System)** diseñado para Casa Mahana — un hotel boutique en Panamá. Solución full-stack que integra gestión de reservas, tarifas dinámicas por día, calendario visual, motor de cotización, portal de reservas públicas con PayPal, y API abierta para agentes AI.

---

## ✨ Características Principales

### 📋 Gestión de Reservas
- Crear, editar y gestionar reservas con validaciones estrictas
- Flujo completo de estados: `Pendiente → Confirmada → Hospedado → Check-Out`
- Detección de duplicados y conflictos de habitación
- Validación de capacidad min/max por habitación
- Registro de huéspedes adicionales

### 🏠 Habitaciones
- Gestión de habitaciones por tipo (Familiar, Doble, Estándar, Camping, Bohío, Salón)
- Categorías separadas: **Estadía** y **Pasadía**
- Control de limpieza: `Sucia → Limpia → Inspeccionada`
- Actualización masiva de estados de limpieza
- Fotos por tipo de habitación

### 💰 Motor de Tarifas Dinámicas
- Planes de tarifa (productos) con precios por adulto/menor/mascota
- **Tarifas por día:** diferentes precios para entre semana, fines de semana y festivos
- Cotizador con desglose noche por noche
- Gestión de días festivos

### 📅 Calendario Visual
- Vista tipo Cloudbeds con ocupación por habitación
- Navegación por rangos de fechas
- Agrupación dinámica por tipo de habitación

### 📊 Dashboard & Reportes
- Dashboard en tiempo real con KPIs: ocupación, llegadas/salidas, ingresos
- Filtros por período (día, semana, mes, total)
- Gráficas de ocupación por categoría (Estadía vs Pasadía)
- Distribución de ingresos por plan y tipo de habitación
- Reporte financiero completo con exportación

### 💵 Folio & Pagos
- Sistema de folio por reserva (débitos y créditos)
- Métodos de pago: efectivo, transferencia, Yappy, tarjeta, PayPal
- Cálculo automático de saldos pendientes
- Módulo CxC (Cuentas por Cobrar)

### 📄 Documentos
- Upload de documentos por reserva (cédula, pasaporte, recibos)
- Soporte: JPEG, PNG, WebP, PDF (máx 10MB)
- Visualización inline en nueva pestaña

### 🌐 Portal de Reservas Público
- Widget de reservas embeddable (`/reservar`)
- Disponibilidad en tiempo real por tipo de habitación
- Cotización pública con tarifas por día
- Integración PayPal (sandbox y producción)
- Reservas entran como "Por Aprobar" para revisión del hotel

### 🤖 API para Agentes AI
- Autenticación dual: JWT + API Keys (`X-API-Key`)
- Rate limiting configurable por API key (req/min)
- Endpoint de schema discovery (`/api/v1/schema`)
- Especificación OpenAPI 3.0 (`/api/openapi.json`)
- Swagger UI interactivo (`/api/docs`)
- Webhooks con firma HMAC-SHA256

---

## 🛠 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React 18 + TypeScript + Vite 5 |
| **Estilos** | Tailwind CSS 3 (paleta personalizada `mahana` + `ocean`) |
| **Iconos** | Lucide React |
| **Backend** | Express.js 4 (Node.js) |
| **Base de Datos** | SQLite (better-sqlite3) — archivo local, cero config |
| **Auth** | JWT (7 días) + bcrypt + API Keys SHA-256 |
| **Pagos** | PayPal REST API (sandbox/live) |
| **Upload** | Multer (10MB, imágenes + PDF) |
| **Deploy** | Render.com (Web Service + Persistent Disk) |

---

## 📁 Estructura del Proyecto

```
casa-mahana-pms/
├── index.html                 # Entry HTML
├── vite.config.ts             # Vite config (proxy /api → :3201)
├── tailwind.config.js         # Paleta mahana/ocean
├── render.yaml                # Render.com deploy config
├── package.json
│
├── src/                       # Frontend React
│   ├── App.tsx                # Router + layout (sidebar, topbar)
│   ├── main.tsx               # React DOM entry
│   ├── index.css              # Global styles
│   ├── api/
│   │   └── client.ts          # Axios client + token management
│   └── pages/
│       ├── Dashboard.tsx      # KPIs, gráficas, ocupación
│       ├── Calendario.tsx     # Vista calendario tipo Cloudbeds
│       ├── Reservas.tsx       # Listado de reservas
│       ├── NuevaReserva.tsx   # Formulario crear reserva
│       ├── ReservaDetalle.tsx # Detalle + folio + documentos
│       ├── Habitaciones.tsx   # Grid de habitaciones + limpieza
│       ├── AdminHabitaciones.tsx # CRUD habitaciones (admin)
│       ├── Productos.tsx      # Gestión planes/tarifas
│       ├── Saldos.tsx         # Cuentas por cobrar
│       ├── Reportes.tsx       # Reportes financieros
│       ├── BookingWidget.tsx  # Portal público de reservas
│       └── Login.tsx          # Login
│
├── server/                    # Backend Express
│   ├── server.js              # API completa (~1800 líneas)
│   ├── auth.js                # JWT + API Keys + rate limiting
│   └── db/
│       ├── database.js        # SQLite init + helpers CRUD
│       └── schema.sql         # Schema completo (13 tablas)
│
├── data/                      # Datos persistentes
│   ├── mahana.db              # Base de datos SQLite
│   └── uploads/               # Archivos subidos
│
└── public/                    # Assets estáticos
    └── logo.png
```

---

## 🚀 Instalación

### Requisitos
- **Node.js** ≥ 18
- **npm** ≥ 9

### Setup Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/aimailhumberto-cloud/casa-mahana-pms.git
cd casa-mahana-pms

# 2. Instalar dependencias
npm install

# 3. Iniciar servidor backend (puerto 3201)
npm start

# 4. En otra terminal, iniciar frontend dev (puerto 3200)
npm run dev
```

Abrir **http://localhost:3200** en el navegador.

> **Nota:** La base de datos SQLite se crea automáticamente en `data/mahana.db` al primer inicio. Un usuario admin por defecto se genera si no existen usuarios.

### Variables de Entorno (Opcionales)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3201` | Puerto del servidor Express |
| `JWT_SECRET` | Auto-generado | Secreto para firmar tokens JWT |
| `PAYPAL_CLIENT_ID` | — | PayPal Client ID (sandbox o live) |
| `PAYPAL_CLIENT_SECRET` | — | PayPal Secret |
| `PAYPAL_MODE` | `sandbox` | `sandbox` o `live` |

---

## 🌍 Deploy en Render

El proyecto incluye `render.yaml` listo para deploy:

```bash
# Build
npm install --include=dev && npm run build

# Start (sirve frontend + API)
npm start
```

El servidor Express en producción sirve el frontend compilado desde `/dist` y la API desde `/api/v1/*`. Se configura un disco persistente de 1GB en `/opt/render/project/src/data` para la DB y uploads.

---

## 🔌 API Reference

### Autenticación

```bash
# Login (obtener JWT)
curl -X POST /api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@casamahana.com","password":"..."}'

# Usar JWT
curl /api/v1/hotel/reservas \
  -H "Authorization: Bearer <token>"

# Usar API Key
curl /api/v1/hotel/reservas \
  -H "X-API-Key: cmk_..."
```

### Endpoints Principales

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/auth/login` | Login | — |
| `GET` | `/api/v1/hotel/habitaciones` | Listar habitaciones | ✅ |
| `GET` | `/api/v1/hotel/planes` | Listar planes/tarifas | ✅ |
| `GET` | `/api/v1/hotel/reservas` | Listar reservas | ✅ |
| `POST` | `/api/v1/hotel/reservas` | Crear reserva | ✅ |
| `GET` | `/api/v1/hotel/reservas/:id` | Detalle + folio | ✅ |
| `PATCH` | `/api/v1/hotel/reservas/:id/status` | Cambiar estado | ✅ |
| `POST` | `/api/v1/hotel/reservas/:id/folio` | Registrar pago/cargo | ✅ |
| `GET` | `/api/v1/hotel/cotizar` | Cotizar tarifa | ✅ |
| `GET` | `/api/v1/hotel/disponibilidad` | Disponibilidad | ✅ |
| `GET` | `/api/v1/hotel/dashboard` | Dashboard stats | ✅ |
| `GET` | `/api/v1/hotel/calendario` | Datos calendario | ✅ |
| `GET` | `/api/v1/reportes/financiero` | Reporte financiero | ✅ |
| `GET` | `/api/v1/schema` | Schema discovery (AI) | — |
| `GET` | `/api/openapi.json` | OpenAPI spec | — |
| `GET` | `/api/docs` | Swagger UI | — |

### Endpoints Públicos (sin auth)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/public/disponibilidad` | Disponibilidad por tipo |
| `GET` | `/api/v1/public/planes` | Planes visibles web |
| `GET` | `/api/v1/public/cotizar` | Cotizador público |
| `POST` | `/api/v1/public/reservar` | Crear reserva pública |
| `GET` | `/api/v1/public/paypal-config` | Config PayPal |

### Webhooks

Eventos disponibles:
- `reserva.creada` — Nueva reserva
- `reserva.estado` — Cambio de estado
- `reserva.actualizada` — Reserva editada
- `pago.registrado` — Pago o cargo
- `habitacion.limpieza` — Cambio limpieza
- `plan.actualizado` — Plan editado

Cada webhook incluye firma HMAC-SHA256 en el header `X-Webhook-Signature`.

---

## 🗄 Base de Datos

13 tablas SQLite:

| Tabla | Descripción |
|-------|-------------|
| `habitaciones` | Habitaciones y unidades |
| `planes_tarifa` | Planes/productos con precios |
| `reglas_tarifa` | Tarifas por tipo de día |
| `dias_festivos` | Calendario de festivos |
| `reservas_hotel` | Reservas completas |
| `folio_hotel` | Movimientos financieros |
| `huespedes_reserva` | Huéspedes adicionales |
| `usuarios` | Usuarios del sistema |
| `config_hotel` | Configuración key-value |
| `documentos_reserva` | Archivos adjuntos |
| `api_keys` | API keys para agentes |
| `webhooks` | Suscripciones webhook |

---

## 📜 Licencia

Uso privado — Casa Mahana, Panamá.

---

<p align="center">
  <sub>Desarrollado con ❤️ para Casa Mahana · Panamá 🇵🇦</sub>
</p>
