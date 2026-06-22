const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const { requireAuth } = require('../auth');

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data });
}

function err(res, message, status = 400) {
  return res.status(status).json({ success: false, error: message });
}

// ── GET /api/v1/crm/servicios ──
router.get('/servicios', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const services = db.prepare('SELECT * FROM servicios_adicionales WHERE activo = 1 ORDER BY nombre ASC').all();
    return ok(res, services);
  } catch (e) {
    console.error('CRM Services error:', e);
    return err(res, 'Error al obtener servicios', 500);
  }
});

// ── GET /api/v1/crm/leads ──
router.get('/leads', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const leads = db.prepare(`
      SELECT l.*, 
             COUNT(c.id) as total_cotizaciones,
             MAX(c.created_at) as ultima_cotizacion_fecha,
             COALESCE((SELECT sum(monto_total) FROM cotizaciones_custom WHERE lead_id = l.id), 0) as valor_total
      FROM leads_clientes l
      LEFT JOIN cotizaciones_custom c ON c.lead_id = l.id
      GROUP BY l.id
      ORDER BY l.updated_at DESC
    `).all();
    return ok(res, leads);
  } catch (e) {
    console.error('CRM Leads list error:', e);
    return err(res, 'Error al listar prospectos', 500);
  }
});

// ── GET /api/v1/crm/leads/:id ──
router.get('/leads/:id', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const lead = db.prepare('SELECT * FROM leads_clientes WHERE id = ?').get(req.params.id);
    if (!lead) return err(res, 'Prospecto no encontrado', 404);
    
    const quotes = db.prepare('SELECT * FROM cotizaciones_custom WHERE lead_id = ? ORDER BY created_at DESC').all(req.params.id);
    
    // Parse JSON fields in quotes
    const quotesParsed = quotes.map(q => {
      try {
        q.habitaciones_seleccionadas = JSON.parse(q.habitaciones_seleccionadas || '[]');
        q.items_adicionales = JSON.parse(q.items_adicionales || '[]');
      } catch (ex) {
        q.habitaciones_seleccionadas = [];
        q.items_adicionales = [];
      }
      return q;
    });

    return ok(res, { lead, cotizaciones: quotesParsed });
  } catch (e) {
    console.error('CRM Lead details error:', e);
    return err(res, 'Error al obtener detalles del prospecto', 500);
  }
});

// ── POST /api/v1/crm/leads ──
router.post('/leads', requireAuth, (req, res) => {
  try {
    const { nombre, apellido, email, telefono, notas, estado } = req.body;
    if (!nombre) return err(res, 'El nombre es obligatorio');
    
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO leads_clientes (nombre, apellido, email, telefono, notas, estado, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nombre,
      apellido || '',
      email || '',
      telefono || '',
      notas || '',
      estado || 'Borrador',
      now,
      now
    );
    
    const newLead = db.prepare('SELECT * FROM leads_clientes WHERE id = ?').get(result.lastInsertRowid);
    return ok(res, newLead, 201);
  } catch (e) {
    console.error('CRM Lead create error:', e);
    return err(res, 'Error al crear prospecto', 500);
  }
});

// ── PATCH /api/v1/crm/leads/:id/status ──
router.patch('/leads/:id/status', requireAuth, (req, res) => {
  try {
    const { estado } = req.body;
    const validStatuses = ['Borrador', 'Enviada', 'En Negociación', 'Aceptada', 'Rechazada'];
    if (!estado || !validStatuses.includes(estado)) {
      return err(res, 'Estado inválido');
    }
    
    const db = getDb();
    const now = new Date().toISOString();
    const result = db.prepare(`
      UPDATE leads_clientes 
      SET estado = ?, updated_at = ?
      WHERE id = ?
    `).run(estado, now, req.params.id);
    
    if (result.changes === 0) return err(res, 'Prospecto no encontrado', 404);
    
    const updatedLead = db.prepare('SELECT * FROM leads_clientes WHERE id = ?').get(req.params.id);
    return ok(res, updatedLead);
  } catch (e) {
    console.error('CRM Lead status update error:', e);
    return err(res, 'Error al actualizar estado del prospecto', 500);
  }
});

// ── POST /api/v1/crm/leads/:id/cotizaciones ──
router.post('/leads/:id/cotizaciones', requireAuth, (req, res) => {
  try {
    const leadId = req.params.id;
    const db = getDb();
    
    const leadExists = db.prepare('SELECT 1 FROM leads_clientes WHERE id = ?').get(leadId);
    if (!leadExists) return err(res, 'Prospecto no encontrado', 404);
    
    const {
      check_in,
      check_out,
      noches,
      adultos,
      menores,
      mascotas,
      plan_codigo,
      habitaciones_seleccionadas,
      items_adicionales,
      subtotal,
      descuento,
      descuento_tipo,
      impuesto_pct,
      impuesto_monto,
      monto_total,
      deposito_sugerido,
      notas
    } = req.body;

    const now = new Date().toISOString();
    
    const result = db.prepare(`
      INSERT INTO cotizaciones_custom (
        lead_id, check_in, check_out, noches, adultos, menores, mascotas, plan_codigo,
        habitaciones_seleccionadas, items_adicionales, subtotal, descuento, descuento_tipo,
        impuesto_pct, impuesto_monto, monto_total, deposito_sugerido, notas, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      leadId,
      check_in || '',
      check_out || '',
      noches || 1,
      adultos || 1,
      menores || 0,
      mascotas || 0,
      plan_codigo || '',
      JSON.stringify(habitaciones_seleccionadas || []),
      JSON.stringify(items_adicionales || []),
      subtotal || 0,
      descuento || 0,
      descuento_tipo || 'fijo',
      impuesto_pct || 10,
      impuesto_monto || 0,
      monto_total || 0,
      deposito_sugerido || 0,
      notas || '',
      now
    );

    // Update the updated_at timestamp on the lead
    db.prepare('UPDATE leads_clientes SET updated_at = ? WHERE id = ?').run(now, leadId);

    const newQuote = db.prepare('SELECT * FROM cotizaciones_custom WHERE id = ?').get(result.lastInsertRowid);
    newQuote.habitaciones_seleccionadas = JSON.parse(newQuote.habitaciones_seleccionadas || '[]');
    newQuote.items_adicionales = JSON.parse(newQuote.items_adicionales || '[]');
    
    return ok(res, newQuote, 201);
  } catch (e) {
    console.error('CRM Quote create error:', e);
    return err(res, 'Error al crear cotización', 500);
  }
});

module.exports = router;
