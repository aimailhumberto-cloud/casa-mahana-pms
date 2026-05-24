const fs = require('fs');

const file = 'server/notifications.js';
let content = fs.readFileSync(file, 'utf8');

// Define new notifyReservationConfirmed
const newNotifyReservationConfirmed = `async function notifyReservationConfirmed(reserva, habitacion) {
  const config = getSystemConfig();
  const emailEnabled = config.notifications_enabled === 1;
  const waEnabled = config.wa_enabled === 1;
  if (!emailEnabled && !waEnabled) return { email: false, whatsapp: false };
  const results = { email: false, whatsapp: false };
  
  const context = buildTemplateContext(reserva, habitacion);
  const db = getDb();
  const isPending = reserva.estado === 'Pendiente';
  const tipo = isPending ? 'recibida' : 'confirmacion';
  const codigo = isPending ? 'recibida' : 'confirmacion';

  // EMAIL
  if (reserva.email && emailEnabled) {
    let fallbackSubject, fallbackBody;
    if (isPending) {
      fallbackSubject = \`⏳ Solicitud de Reserva Recibida #\${reserva.id} — \${context.hotel_nombre}\`;
      fallbackBody = \`<h2>⏳ Solicitud de Reserva Recibida</h2>
<p style="color:#4a5568;">Hola <strong>\` + context.cliente_nombre_completo + \`</strong>, hemos recibido con éxito su solicitud de reserva.</p>
<p style="color:#b45309;font-weight:bold;margin-top:16px;">⚠️ Nota Importante sobre su Reserva:</p>
<p style="color:#4a5568;line-height:1.6;font-size:14px;background-color:#fffbeb;border:1px solid #fef3c7;padding:12px;border-radius:8px;">
  Para garantizar la seguridad de su estadía, toda reserva en Casa Mahana requiere de una <strong>revisión y aprobación manual</strong> por nuestro equipo. 
  El procesamiento del pago seguro o la carga de su comprobante de transferencia inicia el trámite de su solicitud, pero <strong>no garantiza la reserva definitiva hasta recibir el correo electrónico oficial de aprobación de Casa Mahana.</strong>
</p>
<p style="color:#4a5568;margin-top:12px;">Nos comunicaremos con usted a la brevedad por WhatsApp o correo electrónico para validar sus datos y confirmar la reserva de manera oficial.</p>

<table class="detail-table" style="margin-top:16px;">
  <tr><td>📋 Solicitud</td><td>#\` + reserva.id + \`</td></tr>
  <tr><td>📊 Estado</td><td><span class="badge badge-amber" style="background-color:#fff3cd;color:#856404;padding:4px 8px;border-radius:4px;font-weight:bold;font-size:11px;">⏳ En Revisión</span></td></tr>
  <tr><td>📅 Check-in</td><td><strong>\` + context.check_in_formateado + \`</strong></td></tr>
  <tr><td>📅 Check-out</td><td><strong>\` + context.check_out_formateado + \`</strong></td></tr>
  <tr><td>🌙 Noches</td><td>\` + reserva.noches + \`</td></tr>
  <tr><td>🏠 Habitación</td><td>\` + context.habitacion + \`</td></tr>
  <tr><td>🍽️ Plan</td><td>\` + context.plan + \`</td></tr>
  <tr><td>👥 Huéspedes</td><td>\` + reserva.adultos + \` adultos\` + (reserva.menores ? ', ' + reserva.menores + ' menores' : '') + \`</td></tr>
</table>

<div class="highlight" style="margin-top:16px;">
  <div class="amount">\` + context.monto_total + \`</div>
  <div class="label">Total Cotizado</div>
  \` + (reserva.monto_pagado > 0 ? \`<div style="margin-top:8px;font-size:13px;color:#22863a;">Abonado: \` + context.monto_pagado + \` | Saldo Pendiente: \` + context.saldo_pendiente + \`</div>\` : '') + \`
</div>

<p style="color:#a0aec0;font-size:12px;margin-top:20px;">Si tienes alguna duda o deseas corregir algún dato, contáctanos por WhatsApp al \` + context.hotel_telefono + \`.</p>\`;
    } else {
      fallbackSubject = \`✅ Reserva Confirmada #\${reserva.id} — \${context.hotel_nombre}\`;
      fallbackBody = \`<h2>✅ ¡Reserva Confirmada!</h2>
<p style="color:#4a5568;">Hola <strong>\` + context.cliente_nombre_completo + \`</strong>, tu reserva ha sido confirmada. ¡Te esperamos!</p>

<table class="detail-table">
  <tr><td>📋 Reserva</td><td>#\` + reserva.id + \`</td></tr>
  <tr><td>📅 Check-in</td><td><strong>\` + context.check_in_formateado + \`</strong></td></tr>
  <tr><td>📅 Check-out</td><td><strong>\` + context.check_out_formateado + \`</strong></td></tr>
  <tr><td>🌙 Noches</td><td>\` + reserva.noches + \`</td></tr>
  <tr><td>🏠 Habitación</td><td>\` + context.habitacion + \`</td></tr>
  <tr><td>🍽️ Plan</td><td>\` + context.plan + \`</td></tr>
  <tr><td>👥 Huéspedes</td><td>\` + reserva.adultos + \` adultos\` + (reserva.menores ? ', ' + reserva.menores + ' menores' : '') + \`</td></tr>
</table>

<div class="highlight">
  <div class="amount">\` + context.monto_total + \`</div>
  <div class="label">Total de tu estadía</div>
  \` + (reserva.monto_pagado > 0 ? \`<div style="margin-top:8px;font-size:13px;color:#22863a;">✓ Pagado: \` + context.monto_pagado + \` | Saldo: \` + context.saldo_pendiente + \`</div>\` : '') + \`
</div>

<p style="color:#718096;font-size:14px;">
  <strong>Check-in:</strong> A partir de las 2:00 PM<br>
  <strong>Check-out:</strong> Antes de las 12:00 PM<br>
  <strong>Dirección:</strong> \` + context.hotel_direccion + \`
</p>

<p style="text-align:center;">
  <a href="\` + HOTEL_URL + \`" class="btn">Ver Detalles</a>
</p>

<p style="color:#a0aec0;font-size:12px;">Si necesitas hacer cambios, contáctanos por WhatsApp al \` + context.hotel_telefono + \` o responde a este correo.</p>\`;
    }
      
    const rendered = renderNotification(codigo, context, fallbackSubject, fallbackBody, 'email');
    const previewText = isPending 
      ? \`Tu solicitud de reserva #\${reserva.id} en \${context.hotel_nombre} está en proceso de revisión\`
      : \`Tu reserva #\${reserva.id} en \${context.hotel_nombre} está confirmada\`;
    const finalHtml = baseTemplate(rendered.body, previewText, config);
    
    results.email = await sendEmail(reserva.email, rendered.subject, finalHtml);
    logNotification(db, reserva.id, tipo, 'email', reserva.email, results.email, finalHtml);
  }
  
  // WHATSAPP
  if ((reserva.whatsapp || reserva.telefono) && waEnabled) {
    let fallbackMsg;
    if (isPending) {
      fallbackMsg = \`⏳ *Solicitud de Reserva Recibida* — \` + context.hotel_nombre + \`\\n\\n\` +
        \`Hola \` + context.cliente_nombre_completo + \` 👋\\n\\n\` +
        \`Hemos recibido tu solicitud de reserva #\` + reserva.id + \` para el período de \` + reserva.check_in + \` a \` + reserva.check_out + \`.\\n\\n\` +
        \`⚠️ *Nota importante:* Tu reserva se encuentra *pendiente de aprobación manual*. Nos comunicaremos contigo a la brevedad por este medio para validar tus datos y confirmar la reserva de manera oficial. El procesamiento de pago seguro o la carga de tu comprobante inicia el trámite de revisión, pero la confirmación definitiva requiere nuestra aprobación oficial.\\n\\n\` +
        \`💰 Total cotizado: \` + context.monto_total + \`\\n\\n\` +
        \`¡Gracias por tu paciencia! 🌊🌴\`;
    } else {
      fallbackMsg = \`✅ *Reserva Confirmada* — \` + context.hotel_nombre + \`\\n\\n\` +
        \`Hola \` + context.cliente_nombre_completo + \` 👋\\n\\n\` +
        \`Tu reserva ha sido confirmada:\\n\` +
        \`📋 #\` + reserva.id + \`\\n\` +
        \`📅 \` + reserva.check_in + \` → \` + reserva.check_out + \` (\` + reserva.noches + \` noches)\\n\` +
        \`🏠 \` + context.habitacion + \`\\n\` +
        \`💰 Total: \` + context.monto_total + \`\\n\\n\` +
        \`Check-in: 2:00 PM\\nCheck-out: 12:00 PM\\n\\n\` +
        \`¡Te esperamos! 🌊🌴\`;
    }
      
    const rendered = renderNotification(codigo, context, null, fallbackMsg, 'whatsapp');
    results.whatsapp = await sendWhatsApp(reserva.whatsapp || reserva.telefono, rendered.body);
    logNotification(db, reserva.id, tipo, 'whatsapp', reserva.whatsapp || reserva.telefono, results.whatsapp, rendered.body);
  }
  
  return results;
}`;

// Define new notifyStatusChange
const newNotifyStatusChange = `async function notifyStatusChange(reserva, oldStatus, newStatus, habitacion) {
  const config = getSystemConfig();
  const emailEnabled = config.notifications_enabled === 1;
  const waEnabled = config.wa_enabled === 1;
  if (!emailEnabled && !waEnabled) return { email: false, whatsapp: false };
  const results = { email: false, whatsapp: false };
  
  const context = buildTemplateContext(reserva, habitacion);
  const db = getDb();
  
  const isRejectedRequest = newStatus === 'Cancelada' && oldStatus === 'Pendiente';
  
  const statusConfig = {
    'Confirmada': { emoji: '✅', badge: 'badge-green', label: 'Confirmada', msg: 'Tu reserva ha sido confirmada.' },
    'Hospedado': { emoji: '🏨', badge: 'badge-green', label: 'Check-In', msg: '¡Bienvenido! Tu check-in ha sido registrado.' },
    'Check-Out': { emoji: '👋', badge: 'badge-blue', label: 'Check-Out', msg: 'Esperamos que hayas disfrutado tu estadía.' },
    'Cancelada': { 
      emoji: '❌', 
      badge: 'badge-amber', 
      label: isRejectedRequest ? 'Solicitud No Aprobada' : 'Cancelada', 
      msg: isRejectedRequest 
        ? 'agradecemos tu interés en hospedarte con nosotros. Lamentablemente, tu solicitud de reserva no pudo ser aprobada en esta ocasión debido a limitaciones de disponibilidad o políticas de capacidad.' 
        : 'Tu reserva ha sido cancelada.' 
    },
    'No-Show': { emoji: '⚠️', badge: 'badge-amber', label: 'No-Show', msg: 'Tu reserva fue marcada como No-Show.' },
  };
  
  const configObj = statusConfig[newStatus] || { emoji: '📋', badge: 'badge-blue', label: newStatus, msg: \`Tu reserva cambió a \${newStatus}.\` };
  
  let codigo = 'estado';
  if (newStatus === 'Confirmada') codigo = 'confirmacion';
  else if (newStatus === 'Hospedado') codigo = 'bienvenida';
  else if (newStatus === 'Check-Out') codigo = 'checkout';
  else if (isRejectedRequest) codigo = 'rechazo';

  // EMAIL
  if (reserva.email && emailEnabled) {
    let fallbackExtraContent = '';
    if (newStatus === 'Check-Out') {
      fallbackExtraContent = \`
        <div class="highlight">
          <div class="amount">\` + context.monto_total + \`</div>
          <div class="label">Total de tu estadía</div>
          <div style="margin-top:8px;font-size:13px;color:\` + (reserva.saldo_pendiente > 0 ? '#e53e3e' : '#22863a') + \`;>
            Pagado: \` + context.monto_pagado + \` 
            \` + (reserva.saldo_pendiente > 0 ? \`| <strong>Saldo pendiente: \` + context.saldo_pendiente + \`</strong>\` : '| ✓ Cuenta saldada') + \`
          </div>
        </div>
        <p style="color:#4a5568;font-size:14px;">🙏 ¡Gracias por hospedarte con nosotros! Esperamos verle pronto.</p>
        <p style="color:#718096;font-size:13px;">¿Disfrutaste tu estadía? Déjanos una reseña en Google o TripAdvisor. ⭐⭐⭐⭐⭐</p>\`;
    } else if (newStatus === 'Hospedado') {
      fallbackExtraContent = \`
        <p style="color:#4a5568;font-size:14px;">🎉 ¡Bienvenido a \` + context.hotel_nombre + \`! Tu habitación <strong>\` + context.habitacion + \`</strong> está lista.</p>
        <p style="color:#718096;font-size:13px;">
          📶 WiFi: Casa Mahana Guest<br>
          🍽️ Restaurante: 7am - 10pm<br>
          🏖️ ¡Disfruta la playa!
        </p>\`;
    } else if (isRejectedRequest) {
      fallbackExtraContent = \`
        <div style="background-color:#fff5f5;border:1px solid #fed7d7;padding:12px;border-radius:8px;margin-top:16px;color:#c53030;font-size:13px;line-height:1.5;">
          <strong>Nota de Devolución:</strong> Lamentamos los inconvenientes. Si realizó algún pago seguro en línea o transferencia bancaria, nuestro equipo se pondrá en contacto con usted por WhatsApp de manera prioritaria para coordinar el reembolso inmediato y total de su dinero.
        </div>
        <p style="color:#718096;font-size:12px;margin-top:16px;">Si desea consultar disponibilidad para otras fechas, no dude en escribirnos directamente por WhatsApp al \` + context.hotel_telefono + \`.</p>\`;
    }
    
    const fallbackSubject = configObj.emoji + \` \` + configObj.label + \` — Reserva #\` + reserva.id + \` — \` + context.hotel_nombre;
    const fallbackBody = \`
      <h2>\` + configObj.emoji + \` Reserva \` + configObj.label + \`</h2>
      <p style="color:#4a5568;">Hola <strong>\` + context.cliente_nombre_completo + \`</strong>, \` + configObj.msg + \`</p>
      
      <table class="detail-table">
        <tr><td>📋 Reserva</td><td>#\` + reserva.id + \`</td></tr>
        <tr><td>📊 Estado</td><td><span class="badge \` + configObj.badge + \` font-semibold" style="padding:4px 8px;border-radius:4px;font-size:11px;">\` + configObj.emoji + \` \` + configObj.label + \`</span></td></tr>
        <tr><td>📅 Check-in</td><td>\` + context.check_in_formateado + \`</td></tr>
        <tr><td>📅 Check-out</td><td>\` + context.check_out_formateado + \`</td></tr>
        <tr><td>🏠 Habitación</td><td>\` + context.habitacion + \`</td></tr>
      </table>
      \` + fallbackExtraContent;
      
    const rendered = renderNotification(codigo, context, fallbackSubject, fallbackBody, 'email');
    const finalHtml = baseTemplate(rendered.body, configObj.emoji + \` Reserva \` + configObj.label + \` #\` + reserva.id + \` — \` + context.hotel_nombre, config);
    
    results.email = await sendEmail(reserva.email, rendered.subject, finalHtml);
    logNotification(db, reserva.id, codigo, 'email', reserva.email, results.email, finalHtml);
  }
  
  // WHATSAPP
  if ((reserva.whatsapp || reserva.telefono) && waEnabled) {
    let fallbackMsg = configObj.emoji + \` *\` + configObj.label + \`* — \` + context.hotel_nombre + \`\\n\\nHola \` + context.cliente_nombre_completo + \`, \` + configObj.msg + \`\\n\\n📋 Reserva #\` + reserva.id + \`\\n📅 \` + reserva.check_in + \` → \` + reserva.check_out + \`\\n🏠 \` + context.habitacion;
    if (newStatus === 'Check-Out' && reserva.saldo_pendiente > 0) {
      fallbackMsg += \`\\n\\n💰 Saldo pendiente: \` + context.saldo_pendiente + \`\\nPor favor contáctanos para saldar tu cuenta.\`;
    }
    if (newStatus === 'Check-Out') {
      fallbackMsg += '\\n\\n🙏 ¡Gracias por tu visita! Esperamos verte pronto. 🌊';
    }
    if (newStatus === 'Hospedado') {
      fallbackMsg += '\\n\\n🎉 ¡Bienvenido! Disfruta tu estadía. 🌴';
    }
    
    const rendered = renderNotification(codigo, context, null, fallbackMsg, 'whatsapp');
    results.whatsapp = await sendWhatsApp(reserva.whatsapp || reserva.telefono, rendered.body);
    logNotification(db, reserva.id, codigo, 'whatsapp', reserva.whatsapp || reserva.telefono, results.whatsapp, rendered.body);
  }
  
  return results;
}`;

// Extract boundaries and replace
const startMarker = 'async function notifyReservationConfirmed';
const endMarker = 'async function notifyPaymentReceived';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Failed to locate markers');
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);

content = before + newNotifyReservationConfirmed + '\n\n' + newNotifyStatusChange + '\n\n' + after;

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully patched notifications.js');
