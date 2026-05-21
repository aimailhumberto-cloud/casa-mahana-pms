## 2026-05-20T17:38:13Z

Implement a comprehensive User Management (CRUD) interface and a System Settings/Notification Log panel in the Casa Mahana PMS, conforming to the designs and blueprints detailed in `guia_configuracion_y_usuarios.md`.

Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms
Integrity mode: development

## Requirements

### R1. Dynamic System Settings in Database (SMTP & WhatsApp)
- **Database Table:** Create a SQLite table (e.g., `configuracion_sistema`) to store SMTP settings (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`, `admin_email`, `notifications_enabled`) and WhatsApp settings (`wa_api_url`, `wa_api_token`, `wa_from_number`, `wa_enabled`).
- **Initial Seed:** Seed the database table with default values loaded from environment variables if the table is empty or newly created.
- **Dynamic Retrieval:** Refactor `server/notifications.js` to dynamically fetch these credentials from the database during runtime instead of strictly relying on static environment variables, allowing visual updates from the PMS.

### R2. Notification Logs & History Screen (`/configuracion`)
- **Visual Log Viewer:** Create a premium logs grid in a new `/configuracion` panel that displays sent/failed messages from the `notificaciones_log` table.
- **Audit Details:** For each log, show:
  - Destinatario (Email/Phone)
  - Canal (Email vs. WhatsApp badge)
  - Tipo (e.g., `'confirmacion'`, `'pago'`, `'check-in'`, `'recordatorio'`)
  - Estado/Resultado (Success green badge, Failure red badge with error message)
  - Timestamp formatted elegantly.
- **Settings Form:** Include an elegant form to edit the SMTP and WhatsApp settings stored in the `configuracion_sistema` table. Access to this settings edit must be restricted to the `admin` role.
- **Audit Logs for Reversals:** Show a historical log of administrative folio reversals (auditing which admin reversed which payment, on what date, and the reason).

### R3. User Management CRUD & Authorization (`/usuarios`)
- **CRUD Panel:** Create a premium user administration page accessible only to `admin` users.
- **Staff List:** Display a list of all system users (`usuarios` table) with columns for Name, Email, Role, and Status (Active/Inactive).
- **User Creation/Editing Modal:** Allow admins to create new users and edit existing ones. Input fields: Name, Email, Password (hashed using SHA-256 or similar scheme matching existing auth), and Role (`admin`, `receptionist`, `cleaning`).
- **Active/Inactive Status Toggle:** A visual switch to toggle a user's active status. If a user is set to `Inactive`, any login attempts must be blocked with an appropriate error message (`"Usuario desactivado, contacte al administrador"`), and any existing active sessions must be invalidated upon request.
- **Sidebar Integration:** Integrate the `/usuarios` and `/configuracion` routes into the main PMS sidebar, fully restricted so they are only visible and accessible to authorized roles (e.g., `admin`).

### R4. Verification & Clean Build
- **Unit and Integration Tests:** Add an integration test suite in `server/utils/system_config.test.js` or `server/utils/user_management.test.js` verifying user status toggles (login blocking for inactive users) and dynamic database-driven SMTP/WhatsApp notification config retrieval.
- **Zero-Error Build:** Ensure that the PMS builds seamlessly (`npm run build`) without TypeScript, bundling, or linter errors.

## Acceptance Criteria

### Settings & Logs UI
- [ ] Direct database storage of SMTP and WhatsApp configuration values.
- [ ] `/configuracion` panel displays a searchable and filterable history of notifications from `notificaciones_log`.
- [ ] SMTP settings form allows admins to visually edit and save SMTP credentials to the database.
- [ ] Access to `/configuracion` settings edit and logs is locked to the `admin` role (receptionists can see logs but not edit SMTP config, cleaning cannot see the tab).

### User CRUD & Security
- [ ] `/usuarios` panel allows the admin to create new receptionist, cleaning, and admin users.
- [ ] Toggling a user to "Inactive" immediately rejects their future credentials on login with an explicit message.
- [ ] Password hashes of newly created users match the system's auth logic and allow them to log in successfully when active.
- [ ] Access to the `/usuarios` route is restricted exclusively to the `admin` role (redirects/blocks receptionist or cleaning).

### Quality & Tests
- [ ] All unit and integration tests execute successfully with `npm run test`.
- [ ] Production build (`npm run build`) compiles cleanly without errors.

## 2026-05-20T19:14:16Z

Implementar un flujo completo de control interno y doble aprobación (workflow de 4 ojos) en el sistema PMS Casa Mahana, protegiendo las transacciones y datos altamente sensibles (modificaciones de pagos cerrados en folios y edición de tarifas/fechas de reservas activas) frente a modificaciones directas de personal sin nivel de administrador.

Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms
Integrity mode: development

## Requirements

### R1. Base de Datos y Registro de Solicitudes (Auditoría)
- Crear un modelo de datos robusto e histórico para registrar solicitudes de modificación en la base de datos (SQLite).
- Cada registro debe capturar: la reserva afectada, el tipo de modificación (ej. 'editar_pago', 'editar_reserva'), el ID de la transacción original, el estado ('Pendiente', 'Aprobado', 'Rechazado'), el usuario solicitante, la justificación textual del recepcionista, la fecha de solicitud, y un snapshot estructurado (en formato JSON) con los datos a cambiar (ej: `{ "monto": 150, "metodo_pago": "tarjeta" }` o `{ "noches": 3, "monto_total": 450 }`).
- El backend debe exponer endpoints seguros para:
  1. Crear solicitudes de modificación (accesible para todos los roles).
  2. Listar solicitudes pendientes e históricas (restringido a rol `admin`).
  3. Aprobar o rechazar una solicitud (restringido a rol `admin`), ejecutando la acción de forma 100% transaccional sobre la reserva o el folio afectado al momento de la aprobación.

### R2. Interfaz del Recepcionista: Solicitar Cambios
- En la vista detallada de la reserva, cuando un usuario con rol distinto de `admin` intente modificar un abono existente o alterar datos clave de la reserva (fechas, tarifas), el sistema no debe aplicar el cambio de inmediato.
- Debe abrirse un modal intuitivo de "Solicitud de Cambio" que pre-rellene la acción solicitada e instruya al usuario a ingresar de forma obligatoria el **Motivo de la Modificación**.
- Una vez enviada, la solicitud debe reflejarse en la reserva como "Cambio Pendiente de Aprobación" para evitar duplicados.

### R3. Panel de Aprobaciones del Administrador
- Construir una interfaz dedicada y premium para el Administrador que unifique todas las solicitudes pendientes.
- La interfaz debe presentar una comparativa visual clara del **"Antes"** (valores actuales en base de datos) vs. el **"Después"** (valores propuestos en la solicitud), además de mostrar quién lo solicita y su justificación.
- Proveer botones de acción inmediata: **"Autorizar Cambio"** y **"Rechazar"**.
- Al autorizar, aplicar el cambio de inmediato en la base de datos y actualizar el estado visual de la reserva afectada en tiempo real.
- Al rechazar, permitir ingresar un comentario de rechazo de forma opcional.

### R4. Integración y Documentación
- Registrar eventos exitosos o de error en las bitácoras de auditoría de ser necesario.
- Toda la lógica del backend y frontend debe estar completamente documentada en el código, con comentarios limpios detallando el flujo de doble validación.

## Acceptance Criteria

### Backend & Seguridad (RBAC)
- [ ] Solo usuarios autenticados con rol `admin` pueden invocar con éxito los endpoints de aprobación o rechazo (retornar 403 Forbidden a otros roles).
- [ ] La aprobación de cambios se realiza de forma transaccional: si el cambio en la reserva o folio falla por validación o integridad, toda la base de datos se revierte al estado original (rollback).

### Experiencia de Usuario (UI/UX)
- [ ] El recepcionista ve avisos o modales específicos explicativos en lugar de poder sobreescribir directamente los folios y reservas de forma silenciosa.
- [ ] El administrador tiene una pantalla donde se muestran las diferencias de forma legible (por ejemplo, `Monto Anterior: $100` -> `Monto Propuesto: $150`).

### Robustez y Pruebas
- [ ] Creación de un suite de pruebas de integración con Vitest en la carpeta de backend que valide:
  - Crear una solicitud por parte de un recepcionista.
  - El recepcionista no puede aprobar su propia solicitud (403).
  - El administrador aprueba la solicitud y los cambios se aplican automáticamente en la reserva/folio.
  - El administrador rechaza la solicitud y el folio/reserva permanece inalterado.
- [ ] La compilación de producción del frontend (`npm run build`) y el suite de pruebas (`npm run test`) pasan con éxito al finalizar los cambios.

## 2026-05-20T20:18:20Z

Implementar el módulo completo de Reservas de Grupo y Unidades Múltiples (Master/Child Bookings) en el sistema PMS Casa Mahana, dando soporte a la reserva simultánea de múltiples habitaciones de hotel (Estadías) y bohíos (Pasadías), con control de facturación consolidada por defecto y vinculación interactiva en el Calendario.

Working directory: C:\Users\Usuario\.gemini\antigravity\scratch\casa-mahana-pms
Integrity mode: development

## Requirements

### R1. Base de Datos Contable y Relación Master/Child
- Modificar el modelo de datos en SQLite para dar soporte a la vinculación de grupos (ej: columnas `grupo_codigo` para identificar al grupo, `es_maestra` para identificar la reserva líder de control, y `parent_reserva_id` para enlazar las habitaciones hijas).
- Implementar la lógica contable en el backend para folios consolidados:
  - **Esquema Consolidado (Por defecto):** Los cargos por noches/pasadías de todas las reservas hijas se acumulan y reflejan de forma unificada en el balance/folio de la Reserva Maestra. Al registrar un abono general en la Reserva Maestra, el saldo total de la cuenta de grupo disminuye, permitiendo registrar un pago único (ej: abono de $500 del líder) sin saldo pendiente en las hijas.
  - **Esquema de Cuentas Separadas (Opcional):** Si se activa en la interfaz, cada habitación hija mantiene sus cargos y abonos de forma independiente.
- Asegurar que la creación de reservas de grupo (múltiples registros en `reservas_hotel`) se ejecute de forma transaccional bajo una única llamada del backend.

### R2. UI del Recepcionista: Creación de Reserva Grupal (Estadías y Pasadías)
- Rediseñar el formulario de creación de reserva (`NuevaReserva.tsx`) para incluir un switch interactivo: *¿Es una reserva de grupo?*.
- Al estar activo:
  - Permitir al usuario seleccionar múltiples unidades disponibles (con checkboxes en una cuadrícula o lista) para el rango de fechas seleccionado.
  - El selector debe dar soporte completo a la selección de múltiples habitaciones de hotel (Estadías) o múltiples bohíos/áreas de evento (Pasadías).
  - Incluir campos para definir quién es el "Líder del Grupo" (quien recibe la factura consolidada por defecto) e ingresar los nombres/datos de los huéspedes individuales asignados a cada una de las habitaciones seleccionadas.
  - Permitir elegir si la facturación será "Consolidada en la cuenta del Líder" (por defecto) o "Cuentas Separadas".

### R3. UI del Calendario y Gestión de Grupo
- **Visualización Enlazada en Calendario (`Calendario.tsx`):**
  - Las celdas que correspondan a reservas pertenecientes a un mismo grupo en el calendario deben identificarse visualmente de forma inmediata (ej: sutil borde con un código de color común, indicador visual 👥 o tooltip descriptivo).
  - Al hacer hover o clic en una reserva de grupo, se deben resaltar ligeramente todas las demás habitaciones asignadas a ese grupo.
  - **Reasignaciones Individuales:** El recepcionista debe poder mover (arrastrar y soltar) una habitación del grupo de forma independiente para reasignar su número físico o piso, sin alterar la duración o fechas de las demás habitaciones del grupo.
- **Detalle y Acciones de Grupo:**
  - En la vista detallada de la reserva, añadir un panel de "Información de Grupo" que liste todas las habitaciones vinculadas, permitiendo hacer Check-in o Check-out en lote (masivo) o individual de cada cuarto, y ver el balance global consolidado de la cuenta de grupo.

### R4. Integración y Pruebas
- Toda la lógica contable y de base de datos debe documentarse con comentarios limpios.
- Construir un suite de pruebas automatizadas con Vitest en el backend que simule:
  - Creación de una reserva grupal de Estadías (3 habitaciones) en esquema Consolidado.
  - Verificación de que el abono unificado de pago reduce el balance global de la Reserva Maestra correctamente.
  - Creación de una reserva grupal de Pasadías (2 bohíos) en esquema de Cuentas Separadas, comprobando folios independientes.
  - Reasignación de una habitación del grupo sin que afecte a las demás.

## Acceptance Criteria

### Backend & Integridad
- [ ] La creación de reservas de grupo se realiza de forma transaccional completa (rollback si alguna habitación falla por conflicto de fechas o disponibilidad).
- [ ] El motor de cálculo computa de forma precisa el subtotal y balance consolidado del grupo en base a los folios vinculados.

### Experiencia de Usuario (UI/UX)
- [ ] El recepcionista puede cotizar y crear la reserva multi-habitación en una sola pantalla sin necesidad de ingresar 3 reservas consecutivas.
- [ ] La vinculación grupal en el calendario es visualmente atractiva y permite identificar a los grupos de un solo vistazo.
- [ ] Las reasignaciones por drag-and-drop en el calendario permiten mover individualmente cada reserva de grupo.

### Verificación
- [ ] Suite de pruebas de integración con Vitest para reservas de grupo en la carpeta de backend pasando con éxito.
- [ ] La compilación de frontend (`npm run build`) y pruebas generales (`npm run test`) pasan exitosamente.
