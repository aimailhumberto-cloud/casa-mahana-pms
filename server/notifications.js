/**
 * 📧📱 NOTIFICATION MODULE — Casa Mahana PMS
 * 
 * Handles email (Nodemailer/SMTP) and WhatsApp (API) notifications.
 * Configure via environment variables:
 * 
 * EMAIL:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   
 * WHATSAPP (WhatsApp Business API / Twilio):
 *   WA_API_URL, WA_API_TOKEN, WA_FROM_NUMBER
 *   
 * GENERAL:
 *   HOTEL_NAME (default: Casa Mahana)
 *   HOTEL_URL  (default: https://casamahana.com)
 *   NOTIFICATIONS_ENABLED (default: false — set to 'true' to activate)
 */

const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');

// ── Configuration ──
const ENABLED = process.env.NOTIFICATIONS_ENABLED === 'true';
const HOTEL_NAME = process.env.HOTEL_NAME || 'Casa Mahana';
const HOTEL_URL = process.env.HOTEL_URL || 'https://casamahana.com';
const HOTEL_PHONE = process.env.HOTEL_PHONE || '+507 6000-0000';
const HOTEL_EMAIL_DISPLAY = process.env.HOTEL_EMAIL_DISPLAY || 'reservas@casamahana.com';

// ── SMTP Transporter (lazy init) ──
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  
  if (!host || !user || !pass) {
    console.log('📧 Email not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return null;
  }
  
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  
  // Verify connection
  transporter.verify().then(() => {
    console.log('📧 SMTP connected successfully');
  }).catch(err => {
    console.log('📧 SMTP connection failed:', err.message);
    transporter = null;
  });
  
  return transporter;
}

// ── WhatsApp Helper ──
function sendWhatsApp(phone, message) {
  return new Promise((resolve, reject) => {
    const apiUrl = process.env.WA_API_URL;
    const token = process.env.WA_API_TOKEN;
    const fromNumber = process.env.WA_FROM_NUMBER;
    
    if (!apiUrl || !token) {
      console.log('📱 WhatsApp not configured (set WA_API_URL, WA_API_TOKEN)');
      return resolve({ sent: false, reason: 'not_configured' });
    }
    
    // Normalize phone
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      return resolve({ sent: false, reason: 'invalid_phone' });
    }
    
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'text',
      text: { body: message }
    });
    
    const url = new URL(apiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload),
      }
    };
    
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ sent: res.statusCode < 300, statusCode: res.statusCode, response: data });
      });
    });
    req.on('error', (e) => resolve({ sent: false, reason: e.message }));
    req.write(payload);
    req.end();
  });
}

// ── Email Templates ──

function baseTemplate(content, preheader = '') {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f4f1eb; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #d4a853 0%, #c4943f 100%); padding: 32px 24px; text-align: center; }
  .header h1 { color: white; margin: 0; font-size: 28px; letter-spacing: 1px; }
  .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
  .body { background: white; padding: 32px 24px; }
  .body h2 { color: #2d3748; margin: 0 0 16px; font-size: 22px; }
  .detail-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .detail-table td { padding: 10px 12px; border-bottom: 1px solid #f0ece4; font-size: 14px; }
  .detail-table td:first-child { color: #718096; width: 140px; }
  .detail-table td:last-child { color: #2d3748; font-weight: 500; }
  .highlight { background: #faf8f4; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #d4a853; }
  .highlight .amount { font-size: 28px; font-weight: 700; color: #2d3748; }
  .highlight .label { font-size: 13px; color: #718096; margin-top: 4px; }
  .btn { display: inline-block; background: #d4a853; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
  .btn:hover { background: #c4943f; }
  .footer { text-align: center; padding: 24px; color: #a0aec0; font-size: 12px; }
  .footer a { color: #d4a853; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-green { background: #e6f9ed; color: #22863a; }
  .badge-blue { background: #e3f2fd; color: #1565c0; }
  .badge-amber { background: #fff8e1; color: #e65100; }
</style></head><body>
<div style="display:none;font-size:1px;color:#f4f1eb;line-height:1px;max-height:0;overflow:hidden;">${preheader}</div>
<div class="container">
  <div class="header">
    <h1>🏨 ${HOTEL_NAME}</h1>
    <p>Playa, Naturaleza y Aventura</p>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p>${HOTEL_NAME} • Playa El Palmar, Chame, Panamá</p>
    <p>📞 ${HOTEL_PHONE} • 📧 ${HOTEL_EMAIL_DISPLAY}</p>
    <p><a href="${HOTEL_URL}">${HOTEL_URL}</a></p>
  </div>
</div></body></html>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-PA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function formatMoney(amount) {
  return '$' + (amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Notification Functions ──

/**
 * 1. RESERVATION CONFIRMED — sent when a new reservation is created or confirmed
 */
async function notifyReservationConfirmed(reserva, habitacion) {
  if (!ENABLED) return { email: false, whatsapp: false };
  const results = { email: false, whatsapp: false };
  
  const guestName = `${reserva.cliente} ${reserva.apellido || ''}`.trim();
  const roomName = habitacion?.nombre || reserva.tipo_habitacion || '-';
  
  // EMAIL
  if (reserva.email) {
    const html = baseTemplate(`
      <h2>✅ ¡Reserva Confirmada!</h2>
      <p style="color:#4a5568;">Hola <strong>${guestName}</strong>, tu reserva ha sido confirmada. ¡Te esperamos!</p>
      
      <table class="detail-table">
        <tr><td>📋 Reserva</td><td>#${reserva.id}</td></tr>
        <tr><td>📅 Check-in</td><td><strong>${formatDate(reserva.check_in)}</strong></td></tr>
        <tr><td>📅 Check-out</td><td><strong>${formatDate(reserva.check_out)}</strong></td></tr>
        <tr><td>🌙 Noches</td><td>${reserva.noches}</td></tr>
        <tr><td>🏠 Habitación</td><td>${roomName}</td></tr>
        <tr><td>🍽️ Plan</td><td>${reserva.plan_nombre || 'Estándar'}</td></tr>
        <tr><td>👥 Huéspedes</td><td>${reserva.adultos} adultos${reserva.menores ? ', ' + reserva.menores + ' menores' : ''}</td></tr>
      </table>
      
      <div class="highlight">
        <div class="amount">${formatMoney(reserva.monto_total)}</div>
        <div class="label">Total de tu estadía</div>
        ${reserva.monto_pagado > 0 ? `<div style="margin-top:8px;font-size:13px;color:#22863a;">✓ Pagado: ${formatMoney(reserva.monto_pagado)} | Saldo: ${formatMoney(reserva.saldo_pendiente)}</div>` : ''}
      </div>
      
      <p style="color:#718096;font-size:14px;">
        <strong>Check-in:</strong> A partir de las 2:00 PM<br>
        <strong>Check-out:</strong> Antes de las 12:00 PM<br>
        <strong>Dirección:</strong> Playa El Palmar, Chame, Panamá
      </p>
      
      <p style="text-align:center;">
        <a href="${HOTEL_URL}" class="btn">Ver Detalles</a>
      </p>
      
      <p style="color:#a0aec0;font-size:12px;">Si necesitas hacer cambios, contáctanos por WhatsApp al ${HOTEL_PHONE} o responde a este correo.</p>
    `, `Tu reserva #${reserva.id} en ${HOTEL_NAME} está confirmada`);
    
    results.email = await sendEmail(reserva.email, `✅ Reserva Confirmada #${reserva.id} — ${HOTEL_NAME}`, html);
  }
  
  // WHATSAPP
  if (reserva.whatsapp || reserva.telefono) {
    const msg = `✅ *Reserva Confirmada* — ${HOTEL_NAME}\n\n` +
      `Hola ${guestName} 👋\n\n` +
      `Tu reserva ha sido confirmada:\n` +
      `📋 #${reserva.id}\n` +
      `📅 ${reserva.check_in} → ${reserva.check_out} (${reserva.noches} noches)\n` +
      `🏠 ${roomName}\n` +
      `💰 Total: ${formatMoney(reserva.monto_total)}\n\n` +
      `Check-in: 2:00 PM\nCheck-out: 12:00 PM\n\n` +
      `¡Te esperamos! 🌊🌴`;
    
    results.whatsapp = await sendWhatsApp(reserva.whatsapp || reserva.telefono, msg);
  }
  
  return results;
}

/**
 * 2. STATUS CHANGE — sent when reservation status changes
 */
async function notifyStatusChange(reserva, oldStatus, newStatus, habitacion) {
  if (!ENABLED) return { email: false, whatsapp: false };
  const results = { email: false, whatsapp: false };
  
  const guestName = `${reserva.cliente} ${reserva.apellido || ''}`.trim();
  const roomName = habitacion?.nombre || reserva.tipo_habitacion || '-';
  
  const statusConfig = {
    'Confirmada': { emoji: '✅', badge: 'badge-green', label: 'Confirmada', msg: 'Tu reserva ha sido confirmada.' },
    'Hospedado': { emoji: '🏨', badge: 'badge-green', label: 'Check-In', msg: '¡Bienvenido! Tu check-in ha sido registrado.' },
    'Check-Out': { emoji: '👋', badge: 'badge-blue', label: 'Check-Out', msg: 'Esperamos que hayas disfrutado tu estadía.' },
    'Cancelada': { emoji: '❌', badge: 'badge-amber', label: 'Cancelada', msg: 'Tu reserva ha sido cancelada.' },
    'No-Show': { emoji: '⚠️', badge: 'badge-amber', label: 'No-Show', msg: 'Tu reserva fue marcada como No-Show.' },
  };
  
  const config = statusConfig[newStatus] || { emoji: '📋', badge: 'badge-blue', label: newStatus, msg: `Tu reserva cambió a ${newStatus}.` };
  
  // EMAIL
  if (reserva.email) {
    let extraContent = '';
    
    if (newStatus === 'Check-Out') {
      extraContent = `
        <div class="highlight">
          <div class="amount">${formatMoney(reserva.monto_total)}</div>
          <div class="label">Total de tu estadía</div>
          <div style="margin-top:8px;font-size:13px;color:${reserva.saldo_pendiente > 0 ? '#e53e3e' : '#22863a'};">
            Pagado: ${formatMoney(reserva.monto_pagado)} 
            ${reserva.saldo_pendiente > 0 ? `| <strong>Saldo pendiente: ${formatMoney(reserva.saldo_pendiente)}</strong>` : '| ✓ Cuenta saldada'}
          </div>
        </div>
        <p style="color:#4a5568;font-size:14px;">🙏 ¡Gracias por hospedarte con nosotros! Esperamos verte pronto.</p>
        <p style="color:#718096;font-size:13px;">¿Disfrutaste tu estadía? Déjanos una reseña en Google o TripAdvisor. ⭐⭐⭐⭐⭐</p>`;
    }
    
    if (newStatus === 'Hospedado') {
      extraContent = `
        <p style="color:#4a5568;font-size:14px;">🎉 ¡Bienvenido a ${HOTEL_NAME}! Tu habitación <strong>${roomName}</strong> está lista.</p>
        <p style="color:#718096;font-size:13px;">
          📶 WiFi: Casa Mahana Guest<br>
          🍽️ Restaurante: 7am - 10pm<br>
          🏖️ ¡Disfruta la playa!
        </p>`;
    }
    
    const html = baseTemplate(`
      <h2>${config.emoji} Reserva ${config.label}</h2>
      <p style="color:#4a5568;">Hola <strong>${guestName}</strong>, ${config.msg}</p>
      
      <table class="detail-table">
        <tr><td>📋 Reserva</td><td>#${reserva.id}</td></tr>
        <tr><td>📊 Estado</td><td><span class="badge ${config.badge}">${config.emoji} ${config.label}</span></td></tr>
        <tr><td>📅 Check-in</td><td>${formatDate(reserva.check_in)}</td></tr>
        <tr><td>📅 Check-out</td><td>${formatDate(reserva.check_out)}</td></tr>
        <tr><td>🏠 Habitación</td><td>${roomName}</td></tr>
      </table>
      ${extraContent}
    `, `${config.emoji} Reserva ${config.label} #${reserva.id} — ${HOTEL_NAME}`);
    
    results.email = await sendEmail(reserva.email, `${config.emoji} ${config.label} — Reserva #${reserva.id} — ${HOTEL_NAME}`, html);
  }
  
  // WHATSAPP
  if (reserva.whatsapp || reserva.telefono) {
    let msg = `${config.emoji} *${config.label}* — ${HOTEL_NAME}\n\nHola ${guestName}, ${config.msg}\n\n📋 Reserva #${reserva.id}\n📅 ${reserva.check_in} → ${reserva.check_out}\n🏠 ${roomName}`;
    
    if (newStatus === 'Check-Out' && reserva.saldo_pendiente > 0) {
      msg += `\n\n💰 Saldo pendiente: ${formatMoney(reserva.saldo_pendiente)}\nPor favor contáctanos para saldar tu cuenta.`;
    }
    if (newStatus === 'Check-Out') {
      msg += '\n\n🙏 ¡Gracias por tu visita! Esperamos verte pronto. 🌊';
    }
    if (newStatus === 'Hospedado') {
      msg += '\n\n🎉 ¡Bienvenido! Disfruta tu estadía. 🌴';
    }
    
    results.whatsapp = await sendWhatsApp(reserva.whatsapp || reserva.telefono, msg);
  }
  
  return results;
}

/**
 * 3. PAYMENT RECEIVED — sent when a payment is registered
 */
async function notifyPaymentReceived(reserva, payment, habitacion) {
  if (!ENABLED) return { email: false, whatsapp: false };
  const results = { email: false, whatsapp: false };
  
  const guestName = `${reserva.cliente} ${reserva.apellido || ''}`.trim();
  const roomName = habitacion?.nombre || reserva.tipo_habitacion || '-';
  
  // EMAIL
  if (reserva.email) {
    const html = baseTemplate(`
      <h2>💳 Pago Registrado</h2>
      <p style="color:#4a5568;">Hola <strong>${guestName}</strong>, hemos recibido tu pago. ¡Gracias!</p>
      
      <div class="highlight">
        <div class="amount" style="color:#22863a;">+ ${formatMoney(payment.monto)}</div>
        <div class="label">${payment.concepto || 'Pago'} — ${payment.metodo_pago || 'N/D'}</div>
      </div>
      
      <table class="detail-table">
        <tr><td>📋 Reserva</td><td>#${reserva.id}</td></tr>
        <tr><td>🏠 Habitación</td><td>${roomName}</td></tr>
        <tr><td>💰 Total estadía</td><td>${formatMoney(reserva.monto_total)}</td></tr>
        <tr><td>✅ Total pagado</td><td style="color:#22863a;">${formatMoney(reserva.monto_pagado)}</td></tr>
        <tr><td>📊 Saldo</td><td style="color:${reserva.saldo_pendiente > 0 ? '#e53e3e' : '#22863a'};">
          ${reserva.saldo_pendiente > 0 ? formatMoney(reserva.saldo_pendiente) : '✓ Saldado'}
        </td></tr>
      </table>
    `, `Pago de ${formatMoney(payment.monto)} recibido — Reserva #${reserva.id}`);
    
    results.email = await sendEmail(reserva.email, `💳 Pago Recibido ${formatMoney(payment.monto)} — Reserva #${reserva.id}`, html);
  }
  
  // WHATSAPP
  if (reserva.whatsapp || reserva.telefono) {
    const msg = `💳 *Pago Registrado* — ${HOTEL_NAME}\n\n` +
      `Hola ${guestName}, recibimos tu pago:\n\n` +
      `✅ Monto: ${formatMoney(payment.monto)}\n` +
      `📋 Reserva: #${reserva.id}\n` +
      `💰 Total: ${formatMoney(reserva.monto_total)}\n` +
      `✅ Pagado: ${formatMoney(reserva.monto_pagado)}\n` +
      (reserva.saldo_pendiente > 0 ? `⚠️ Saldo: ${formatMoney(reserva.saldo_pendiente)}` : '🎉 ¡Cuenta saldada!') +
      `\n\n¡Gracias! 🙏`;
    
    results.whatsapp = await sendWhatsApp(reserva.whatsapp || reserva.telefono, msg);
  }
  
  return results;
}

/**
 * 4. ADMIN NOTIFICATION — notify hotel staff of new booking
 */
async function notifyAdminNewBooking(reserva, habitacion) {
  if (!ENABLED) return { email: false };
  
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return { email: false };
  
  const guestName = `${reserva.cliente} ${reserva.apellido || ''}`.trim();
  const roomName = habitacion?.nombre || reserva.tipo_habitacion || '-';
  
  const html = baseTemplate(`
    <h2>🔔 Nueva Reserva Recibida</h2>
    <p style="color:#4a5568;">Se ha registrado una nueva reserva en el sistema.</p>
    
    <table class="detail-table">
      <tr><td>👤 Huésped</td><td><strong>${guestName}</strong></td></tr>
      <tr><td>📧 Email</td><td>${reserva.email || 'N/D'}</td></tr>
      <tr><td>📱 WhatsApp</td><td>${reserva.whatsapp || reserva.telefono || 'N/D'}</td></tr>
      <tr><td>📅 Check-in</td><td><strong>${formatDate(reserva.check_in)}</strong></td></tr>
      <tr><td>📅 Check-out</td><td><strong>${formatDate(reserva.check_out)}</strong></td></tr>
      <tr><td>🌙 Noches</td><td>${reserva.noches}</td></tr>
      <tr><td>🏠 Habitación</td><td>${roomName}</td></tr>
      <tr><td>🍽️ Plan</td><td>${reserva.plan_nombre || 'N/D'}</td></tr>
      <tr><td>💰 Total</td><td><strong>${formatMoney(reserva.monto_total)}</strong></td></tr>
      <tr><td>📝 Fuente</td><td>${reserva.fuente || 'Directa'}</td></tr>
      <tr><td>📝 Notas</td><td>${reserva.notas || '-'}</td></tr>
    </table>
    
    <p style="text-align:center;">
      <a href="${HOTEL_URL}" class="btn">Ir al PMS</a>
    </p>
  `, `Nueva reserva de ${guestName} — ${reserva.check_in}`);
  
  return { email: await sendEmail(adminEmail, `🔔 Nueva Reserva — ${guestName} — ${formatDate(reserva.check_in)}`, html) };
}

/**
 * 5. REMINDER — pre-arrival reminder (X days before check-in)
 */
async function notifyReminder(reserva, habitacion, daysUntil) {
  if (!ENABLED) return { email: false, whatsapp: false };
  const results = { email: false, whatsapp: false };
  
  const guestName = `${reserva.cliente} ${reserva.apellido || ''}`.trim();
  const roomName = habitacion?.nombre || reserva.tipo_habitacion || '-';
  
  const dayLabel = daysUntil === 1 ? 'mañana' : `en ${daysUntil} días`;
  
  // EMAIL
  if (reserva.email) {
    const html = baseTemplate(`
      <h2>📅 Tu estadía es ${dayLabel}</h2>
      <p style="color:#4a5568;">Hola <strong>${guestName}</strong>, te recordamos que tu reserva en ${HOTEL_NAME} es ${dayLabel}.</p>
      
      <table class="detail-table">
        <tr><td>📅 Check-in</td><td><strong>${formatDate(reserva.check_in)}</strong> (2:00 PM)</td></tr>
        <tr><td>📅 Check-out</td><td>${formatDate(reserva.check_out)} (12:00 PM)</td></tr>
        <tr><td>🏠 Habitación</td><td>${roomName}</td></tr>
        <tr><td>🍽️ Plan</td><td>${reserva.plan_nombre || 'Estándar'}</td></tr>
      </table>
      
      ${reserva.saldo_pendiente > 0 ? `
        <div class="highlight">
          <div class="label">Saldo pendiente</div>
          <div class="amount" style="color:#e53e3e;">${formatMoney(reserva.saldo_pendiente)}</div>
        </div>
      ` : ''}
      
      <p style="color:#718096;font-size:14px;">
        <strong>📍 Dirección:</strong> Playa El Palmar, Chame, Panamá<br>
        <strong>🅿️ Estacionamiento:</strong> Disponible en el hotel<br>
        <strong>📶 WiFi:</strong> Disponible en todo el recinto
      </p>
      
      <p style="color:#4a5568;">¡Te esperamos! 🌊🌴</p>
    `, `Recordatorio: tu estadía en ${HOTEL_NAME} es ${dayLabel}`);
    
    results.email = await sendEmail(reserva.email, `📅 Recordatorio — Tu estadía es ${dayLabel} — ${HOTEL_NAME}`, html);
  }
  
  // WHATSAPP
  if (reserva.whatsapp || reserva.telefono) {
    const msg = `📅 *Recordatorio* — ${HOTEL_NAME}\n\n` +
      `Hola ${guestName} 👋\n\n` +
      `Te recordamos que tu estadía es *${dayLabel}*:\n\n` +
      `📅 Check-in: ${reserva.check_in} (2:00 PM)\n` +
      `🏠 ${roomName}\n` +
      (reserva.saldo_pendiente > 0 ? `💰 Saldo pendiente: ${formatMoney(reserva.saldo_pendiente)}\n` : '') +
      `\n📍 Playa El Palmar, Chame, Panamá\n\n¡Te esperamos! 🌊🌴`;
    
    results.whatsapp = await sendWhatsApp(reserva.whatsapp || reserva.telefono, msg);
  }
  
  return results;
}

// ── Core send email function ──
async function sendEmail(to, subject, html) {
  try {
    const t = getTransporter();
    if (!t) return { sent: false, reason: 'not_configured' };
    
    const from = process.env.SMTP_FROM || `${HOTEL_NAME} <${process.env.SMTP_USER}>`;
    
    const info = await t.sendMail({ from, to, subject, html });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`📧 Email error to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Notification Log (optional DB logging) ──
function logNotification(db, reservaId, tipo, canal, resultado) {
  try {
    db.prepare(`INSERT INTO notificaciones_log (reserva_id, tipo, canal, resultado, created_at) 
      VALUES (?, ?, ?, ?, datetime('now'))`).run(reservaId, tipo, canal, JSON.stringify(resultado));
  } catch { /* table may not exist yet */ }
}

module.exports = {
  notifyReservationConfirmed,
  notifyStatusChange,
  notifyPaymentReceived,
  notifyAdminNewBooking,
  notifyReminder,
  sendEmail,
  sendWhatsApp,
  logNotification,
  ENABLED
};
