# Casa Mahana — Custom Domain & Infrastructure Roadmap
**Target Subdomain**: `reservas.casamahana.com`  
**Target Backend Service**: `casa-mahana-pms.onrender.com`  
**Primary Website**: `https://www.casamahana.com`  
**GA4 Measurement ID**: `G-02NLS8E3LG`  
**Document Status**: Production Ready / Approved for Deployment  

---

## 1. Executive Summary & Architecture Overview

Casa Mahana operates two tightly integrated web platforms:
1. **Public Guest Website (`webpage-mahana`)**: High-performance marketing and showcase platform built in React 18 / Vite / Tailwind CSS, hosted at `https://www.casamahana.com`.
2. **Property Management System & Booking Engine (`casa-mahana-pms`)**: Full-stack PMS built with an Express.js backend, SQLite database, and React booking widget, hosted on Render at `https://casa-mahana-pms.onrender.com`.

This roadmap establishes the complete technical process for mapping `reservas.casamahana.com` to the PMS deployment on Render. Unifying the guest booking experience under the canonical brand domain (`casamahana.com`) achieves:
- **Guest Trust & Conversion**: Eliminates perceived third-party handoffs by keeping the browser address bar under `*.casamahana.com`.
- **Domain Authority & SEO**: Consolidates search authority, avoids cross-origin warning banners, and improves trust signals.
- **Unified Analytics**: Seamless Google Analytics 4 session continuity without losing marketing attribution or creating false referral traffic.
- **Enterprise Security**: Automated TLS/SSL certificate renewal with zero maintenance via Let's Encrypt and Render's edge proxy.

```
                              ┌──────────────────────────────────────────────┐
                              │            GUEST BROWSER                     │
                              └──────────────────────┬───────────────────────┘
                                                     │
                     ┌───────────────────────────────┴───────────────────────────────┐
                     │                                                               │
                     ▼                                                               ▼
        [ Primary Marketing Portal ]                                    [ Branded Booking Subdomain ]
         https://www.casamahana.com                                      https://reservas.casamahana.com
                     │                                                               │
                     │ DNS: A / CNAME to Hosting                                     │ DNS: CNAME to Render
                     │                                                               │
                     ▼                                                               ▼
        ┌───────────────────────────┐                                   ┌───────────────────────────┐
        │     webpage-mahana        │                                   │   Render Global Edge      │
        │  Static CDN / Cloudflare  │                                   │     Load Balancer         │
        └────────────┬──────────────┘                                   │  (Let's Encrypt TLS/SSL)  │
                     │                                                  └─────────────┬─────────────┘
                     │ Handoff with URL Params                                        │
                     │ (plan, date, guests, utm, _gl)                                 │ Internal Routing
                     └───────────────────────────────────────────────────────────────►│
                                                                                      ▼
                                                                        ┌───────────────────────────┐
                                                                        │      casa-mahana-pms      │
                                                                        │  Node/Express API + SPA   │
                                                                        │  Port 3201 / SQLite DB    │
                                                                        └───────────────────────────┘
```

---

## 2. DNS CNAME Record Specification

To route requests for `reservas.casamahana.com` to Render's global application router, a canonical DNS CNAME record must be created in the authoritative DNS management console for `casamahana.com`.

### 2.1 Specification Table

| Attribute | Value | Description / Notes |
|:---|:---|:---|
| **Record Type** | `CNAME` | Canonical Name alias pointing subdomain to Render |
| **Host / Name** | `reservas` (or `reservas.casamahana.com.`) | Subdomain prefix (enter `@` only for root, `reservas` for subdomain) |
| **Value / Target** | `casa-mahana-pms.onrender.com` | Destination Render service hostname |
| **TTL** | `300` (5 minutes) | Low TTL ensures rapid propagation during initial setup |
| **Proxy Status** | DNS Only (Grey Cloud if Cloudflare) | **Critical:** Must be DNS-only during certificate issuance |

> **⚠️ Cloudflare DNS Warning**: If `casamahana.com` uses Cloudflare nameservers, ensure the proxy status for `reservas` is set to **DNS Only (Grey Cloud)** during the initial configuration. If Orange Cloud (proxied) is enabled prematurely, Render cannot verify the ACME HTTP-01 or ALPN challenge from Let's Encrypt, which will delay or fail SSL issuance. Once Render validates the custom domain and issues the certificate, proxying can optionally be evaluated, but DNS Only is the officially supported Render configuration.

### 2.2 Provider-Specific Setup Instructions

#### Cloudflare
1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Select the `casamahana.com` zone.
3. In the sidebar, select **DNS** -> **Records**.
4. Click **Add record**:
   - **Type**: `CNAME`
   - **Name**: `reservas`
   - **Target**: `casa-mahana-pms.onrender.com`
   - **Proxy status**: Toggle OFF (Grey cloud — *DNS only*)
   - **TTL**: Auto or 5 min
5. Click **Save**.

#### GoDaddy
1. Log in to [GoDaddy Domain Portfolio](https://dcc.godaddy.com/).
2. Click `casamahana.com` -> **DNS** -> **DNS Records**.
3. Click **Add New Record**:
   - **Type**: `CNAME`
   - **Name**: `reservas`
   - **Value**: `casa-mahana-pms.onrender.com`
   - **TTL**: `1/2 Hour` (or custom `300` seconds if available)
4. Click **Save**.

#### Namecheap / Google Domains / Squarespace / AWS Route 53
- Add a standard `CNAME` record with Host `reservas` pointing to `casa-mahana-pms.onrender.com`.

### 2.3 DNS Propagation Diagnostics

Run the following commands in terminal to verify DNS resolution before proceeding to Render dashboard confirmation:

```bash
# 1. Check CNAME record resolution directly
dig CNAME reservas.casamahana.com +short
# Expected output:
# casa-mahana-pms.onrender.com.

# 2. Query Google Public DNS directly
dig @8.8.8.8 CNAME reservas.casamahana.com +short
# Expected output:
# casa-mahana-pms.onrender.com.

# 3. Windows PowerShell / CMD alternative
nslookup -type=CNAME reservas.casamahana.com
# Expected output:
# reservas.casamahana.com  canonical name = casa-mahana-pms.onrender.com
```

---

## 3. Render Custom Domain & TLS/SSL Setup

Render provides managed custom domains with automated Let's Encrypt certificate issuance and automatic HTTP-to-HTTPS redirection.

### 3.1 Step-by-Step Dashboard Navigation

1. **Access Render Console**: Open [dashboard.render.com](https://dashboard.render.com/) and sign in with the organization account.
2. **Select Web Service**: Click on the Web Service named `casa-mahana-pms`.
3. **Open Settings**: In the left-hand navigation menu of the service, click **Settings**.
4. **Locate Custom Domains**: Scroll down to the **Custom Domains** section.
5. **Add Subdomain**:
   - Click the **Add Custom Domain** button.
   - Enter `reservas.casamahana.com` into the input field.
   - Click **Save**.
6. **Trigger Verification**:
   - Render will display the required DNS configuration (`CNAME` pointing to `casa-mahana-pms.onrender.com`).
   - If the CNAME was already created in Step 2, click **Verify** or wait 60–120 seconds.
   - The status indicator will transition from `Verifying` -> `DNS Verified` -> `Certificate Issued` -> `Active`.

### 3.2 Automated Let's Encrypt TLS/SSL & Redirection

- **Zero-Maintenance Certificates**: Render automatically provisions a 2048-bit RSA / ECDSA Let's Encrypt certificate for `reservas.casamahana.com`. Renewals happen automatically 30 days prior to expiration without requiring manual intervention or webhook tokens.
- **Forced HTTPS Redirection**: Render's edge proxy automatically enforces HTTPS:
  - Any plain HTTP request (`http://reservas.casamahana.com/*`) immediately receives an `HTTP/1.1 301 Moved Permanently` redirect to `https://reservas.casamahana.com/*`.
  - HSTS (`Strict-Transport-Security`) headers can be served directly from Express to guarantee secure browser transport.
- **Dual Endpoint Coexistence**: Adding `reservas.casamahana.com` does **not** break `casa-mahana-pms.onrender.com`. Both hostnames remain accessible in parallel, ensuring that ongoing integrations or internal monitors experience zero downtime during migration.

---

## 4. CORS & Environment Variable Configuration

The backend Express application (`server/server.js`) contains strict CORS middleware designed to protect session credentials and prevent unauthorized cross-origin API calls.

### 4.1 Server Code Architecture (`server/server.js`)

In `server/server.js`:
```javascript
// ── Middleware ──
const corsOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true;

if (process.env.NODE_ENV === 'production' && corsOrigins === true) {
  logger.warn('⚠️ WARNING: ALLOWED_ORIGINS not set in production. Falling back to reflected origins.');
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production' && corsOrigins !== true ? corsOrigins : true,
  credentials: true
}));
```

### 4.2 Updating Environment Variables in Render Dashboard

1. In the Render Dashboard, open `casa-mahana-pms`.
2. In the left navigation, click **Environment**.
3. Under **Environment Variables**, locate or add `ALLOWED_ORIGINS`.
4. Set the value to:
   ```env
   ALLOWED_ORIGINS=https://www.casamahana.com,https://casamahana.com,https://reservas.casamahana.com
   ```
5. Click **Save Changes**. Render will automatically trigger a zero-downtime rolling restart of the service to apply the new environment variables.

### 4.3 Updating Infrastructure as Code (`render.yaml`)

For environments using blueprint / Infrastructure-as-Code deployments, ensure `render.yaml` includes the origin list:

```yaml
services:
  - type: web
    name: casa-mahana-pms
    runtime: node
    buildCommand: npm install --include=dev && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: PORT
        value: 3201
      - key: ALLOWED_ORIGINS
        value: https://www.casamahana.com,https://casamahana.com,https://reservas.casamahana.com
    disk:
      name: data
      mountPath: /opt/render/project/src/data
      sizeGB: 1
```

### 4.4 Client-Side Website Booking Endpoint Transition

Once `reservas.casamahana.com` is active and certified, update the base URL in `webpage-mahana`:

**File**: `webpage-mahana/src/utils/analytics.ts`
```typescript
/**
 * Builds the full PMS reservation URL preserving selected planCode, category, guests, and UTM parameters
 */
export const buildPmsBookingUrl = (options: {
  search?: string;
  planCode?: string;
  category?: string;
  guests?: number;
} = {}): string => {
  // Use environment variable if provided, fallback to branded subdomain
  const baseUrl = import.meta.env.VITE_PMS_BOOKING_URL || 'https://reservas.casamahana.com/reservar';
  const params = new URLSearchParams(options.search || '');
  ...
```

And in `webpage-mahana/.env.production`:
```env
VITE_PMS_BOOKING_URL=https://reservas.casamahana.com/reservar
```

---

## 5. Cross-Domain Session, Cookies & GA4 Tracking

Moving from an external domain (`onrender.com`) to a shared second-level domain (`casamahana.com`) unlocks major architectural benefits for cookie governance and analytics.

### 5.1 Cookie Architecture & Scoping

When `reservas.casamahana.com` and `www.casamahana.com` share the parent domain `casamahana.com`:
- **Shared Session Cookies (Optional)**: If user session or currency preferences need to be shared across the website and PMS without URL parameters, cookies can be scoped with `Domain=.casamahana.com`:
  ```http
  Set-Cookie: cm_session=xyz123; Domain=.casamahana.com; Path=/; Secure; HttpOnly; SameSite=Lax
  ```
- **Isolated Subdomain Cookies**: By default, standard cookies set without an explicit parent domain attribute (e.g. `Path=/; Secure; SameSite=Lax`) remain strictly isolated to `reservas.casamahana.com`, preventing unintended cookie leakage to static marketing assets.

### 5.2 Google Analytics 4 (GA4) Cross-Domain Linker

The official Google Analytics 4 Measurement ID for Casa Mahana is:
`G-02NLS8E3LG`

Because `www.casamahana.com` and `reservas.casamahana.com` share the root domain `casamahana.com`, standard GA4 client cookies (`_ga` and `_ga_<container-id>`) are automatically recognized across subdomains if set on the root. However, to guarantee 100% session continuity across diverse browser tracking protections (such as Safari ITP and Firefox ETP), the GA4 cross-domain linker must be explicitly configured on both applications.

#### A. Marketing Website Configuration (`webpage-mahana/index.html`)

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-02NLS8E3LG"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-02NLS8E3LG', {
    'send_page_view': true,
    'linker': {
      'domains': ['casamahana.com', 'reservas.casamahana.com']
    }
  });
</script>
```

#### B. PMS Booking Engine Configuration (`casa-mahana-pms/index.html`)

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-02NLS8E3LG"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-02NLS8E3LG', {
    'send_page_view': true,
    'linker': {
      'domains': ['casamahana.com', 'reservas.casamahana.com']
    }
  });
</script>
```

#### C. How the Cross-Domain Linker Operates
1. When a user clicks a reservation button on `https://www.casamahana.com`, `gtag.js` appends a unique URL query parameter `_gl=1*...` to the destination URL.
2. The destination page (`https://reservas.casamahana.com/reservar`) reads the `_gl` parameter on load and extracts the visitor's Client ID (`cid`) and Session ID (`sid`).
3. GA4 stitches the interaction into one continuous guest journey. The original marketing channel (e.g. `utm_source=instagram`, `utm_medium=cpc`, `utm_campaign=verano2026`) is retained throughout the booking process.
4. When the guest finishes booking and triggers the `purchase` event, the revenue is credited to the original campaign instead of showing as a self-referral from `casamahana.com`.

---

## 6. Guest Journey Architecture & Technical Flow

```
+-------------------------------------------------------------------------------------------------------+
|                                     CASA MAHANA GUEST JOURNEY                                         |
+-------------------------------------------------------------------------------------------------------+

1. INGRESS & ATTRIBUTION
   Guest clicks ad / social link:
   --> https://www.casamahana.com/?utm_source=instagram&utm_medium=paid_social&utm_campaign=verano2026
   --> GA4 records session start with UTM attribution.

2. INTENT & PACKAGE SELECTION
   Guest explores Lodging Packages and selects "Todo Incluido" for 2 adults, checking in 2026-11-15:
   --> webpage-mahana calls buildPmsBookingUrl({ planCode: 'todo_incluido', guests: 2, date: '2026-11-15' })
   --> Destination URL formed:
       https://reservas.casamahana.com/reservar?plan=todo_incluido&guests=2&date=2026-11-15&category=Estad%C3%ADa&utm_source=instagram&utm_medium=paid_social&utm_campaign=verano2026&_gl=1*1a2b3c...

3. SUBDOMAIN HANDOFF & PARAMETER INGESTION
   Browser navigates to https://reservas.casamahana.com/reservar:
   --> DNS resolves to Render Edge (Let's Encrypt TLS handshake).
   --> BookingWidget.tsx mounts, parses search params via URLSearchParams.
   --> Category pre-fills to 'Estadía'.
   --> Check-in date pre-fills to '2026-11-15', Check-out date defaults to '2026-11-16'.
   --> Guest count pre-fills to 2.
   --> Plan selector pre-selects 'todo_incluido' ($66/night/adult).
   --> UTM parameters saved to sessionStorage for conversion attribution.

4. RETURN NAVIGATION
   If guest wants to review lodging descriptions or menus before paying:
   --> Guest clicks "<- Volver al sitio web" or Brand Logo in header.
   --> Immediate return to https://www.casamahana.com with smooth UX.

5. BOOKING CONVERSION & EVENT DISPATCH
   Guest submits booking with payment (PayPal or Bank Transfer Receipt):
   --> Booking saved to SQLite database via POST /api/reservas.
   --> GA4 `purchase` event dispatched:
       gtag('event', 'purchase', {
         transaction_id: 'RES-2026-0042',
         value: 132.00,
         currency: 'USD',
         items: [{ item_id: 'todo_incluido', item_name: 'Todo Incluido', price: 132.00, quantity: 1 }],
         utm_source: 'instagram',
         utm_medium: 'paid_social',
         utm_campaign: 'verano2026'
       });
   --> Full return on investment (ROI) visible in Google Analytics reporting.
+-------------------------------------------------------------------------------------------------------+
```

---

## 7. Verification & Production Cutover Checklist

Follow this pre-flight and post-flight verification checklist to ensure zero disruption.

### Phase 1: Pre-Cutover Preparation
- [ ] **DNS Access Verified**: Administrative access to the authoritative DNS manager for `casamahana.com` confirmed.
- [ ] **Current TTL Checked**: Ensure TTL on existing DNS records is low (300 seconds) prior to modifications.
- [ ] **Render Credentials**: Ensure team access to the Render Dashboard containing `casa-mahana-pms`.

### Phase 2: DNS & Render Custom Domain Activation
- [ ] **CNAME Record Added**: `reservas` -> `casa-mahana-pms.onrender.com` created with Proxy Status set to DNS-only.
- [ ] **DNS Propagation Verified**: `dig CNAME reservas.casamahana.com` returns `casa-mahana-pms.onrender.com`.
- [ ] **Render Custom Domain Added**: `reservas.casamahana.com` added in Render -> Settings -> Custom Domains.
- [ ] **SSL Certificate Status**: Render displays `Certificate Issued` (green checkmark).
- [ ] **HTTPS Redirection Tested**: `http://reservas.casamahana.com` successfully redirects (301) to `https://reservas.casamahana.com`.

### Phase 3: CORS & Backend Environment
- [ ] **Environment Variable Set**: `ALLOWED_ORIGINS` configured in Render Environment Variables with:
  `https://www.casamahana.com,https://casamahana.com,https://reservas.casamahana.com`
- [ ] **Service Redeployed**: Render service has restarted and finished building.
- [ ] **CORS Preflight Verified**: Options request to `/api/health` or `/api/reservas` returns `Access-Control-Allow-Origin: https://www.casamahana.com`.

### Phase 4: Frontend & Analytics Validation
- [ ] **Website Booking URL Updated**: `webpage-mahana` updated with `https://reservas.casamahana.com/reservar`.
- [ ] **GA4 Tag Present**: Both `casamahana.com` and `reservas.casamahana.com` include the GA4 snippet with container `G-02NLS8E3LG`.
- [ ] **Cross-Domain Linker Active**: Clicking from website to booking widget appends `_gl` query parameter.
- [ ] **URL Ingestion Test**: Query parameters (`plan`, `guests`, `date`, `category`) pre-populate booking widget fields cleanly.
- [ ] **Return Navigation**: Header logo and "Volver al sitio web" correctly return guest to `https://www.casamahana.com`.
- [ ] **Purchase Event Verification**: Test booking triggers `purchase` event visible in Google Analytics 4 Realtime / DebugView console.

---

## 8. CLI Automated Diagnostic Suite

Use the following commands to execute immediate diagnostic verification from any developer or operations workstation:

### 8.1 Test DNS Resolution
```bash
# Query Authoritative Nameserver
nslookup -type=CNAME reservas.casamahana.com
```

### 8.2 Test HTTP to HTTPS Redirection
```bash
curl -I http://reservas.casamahana.com/reservar
# Expected Output:
# HTTP/1.1 301 Moved Permanently
# Location: https://reservas.casamahana.com/reservar
```

### 8.3 Test TLS/SSL Handshake & Certificate Authority
```bash
curl -Iv https://reservas.casamahana.com/reservar 2>&1 | grep -E "Server certificate|issuer|SSL connection"
# Expected Output:
# * Server certificate:
# *  subject: CN=reservas.casamahana.com
# *  issuer: C=US, O=Let's Encrypt, CN=R...
# * SSL connection using TLSv1.3
```

### 8.4 Test CORS Response Headers
```bash
curl -I -X OPTIONS https://reservas.casamahana.com/api/planes \
  -H "Origin: https://www.casamahana.com" \
  -H "Access-Control-Request-Method: GET"
# Expected Output:
# HTTP/1.1 204 No Content (or 200 OK)
# Access-Control-Allow-Origin: https://www.casamahana.com
# Access-Control-Allow-Credentials: true
```

### 8.5 Test Public Booking Interface Availability
```bash
curl -I "https://reservas.casamahana.com/reservar?plan=todo_incluido&guests=2&date=2026-11-15"
# Expected Output:
# HTTP/1.1 200 OK
# Content-Type: text/html; charset=utf-8
```

---

## 9. Rollback Plan

If unexpected DNS or routing issues arise during the migration window:
1. **Zero-Impact Rollback**: Immediately revert `webpage-mahana`'s booking link URL to `https://casa-mahana-pms.onrender.com/reservar`.
2. Because `casa-mahana-pms.onrender.com` remains active at all times, 100% of guest booking traffic continues without disruption.
3. Investigate DNS propagation or SSL issuance logs in Render without customer-facing impact.
4. Once issues are resolved, switch the website links back to `https://reservas.casamahana.com/reservar`.
