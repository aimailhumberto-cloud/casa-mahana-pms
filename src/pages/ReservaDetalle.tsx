// v2 — cancel/edit/folio-totals
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ArrowLeft, Plus, Edit2, X, Check, Upload, FileText, Trash2, Image } from 'lucide-react';

const estadoColor: Record<string, string> = {
  'Confirmada': 'bg-blue-100 text-blue-700',
  'Hospedado': 'bg-green-100 text-green-700',
  'Check-Out': 'bg-gray-100 text-gray-600',
  'Pendiente': 'bg-yellow-100 text-yellow-700',
  'Cancelada': 'bg-red-100 text-red-700',
  'No-Show': 'bg-red-50 text-red-500',
};

export default function ReservaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reserva, setReserva] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPago, setShowPago] = useState(false);
  const [pago, setPago] = useState({ monto: '', concepto: 'Abono', metodo_pago: 'efectivo', referencia: '' });
  const [pagoLoading, setPagoLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null); // 'Cancelada' | 'No-Show'
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('recibo');
  const [uploadNotas, setUploadNotas] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => { api.get(`/hotel/reservas/${id}`).then(r => { setReserva(r.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { load(); }, [id]);

  const changeStatus = async (estado: string) => {
    try {
      await api.patch(`/hotel/reservas/${id}/status`, { estado });
      setConfirmCancel(null);
      load();
    } catch (err: any) { alert(err.message); }
  };

  const submitPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pago.monto || parseFloat(pago.monto) <= 0) return;
    setPagoLoading(true);
    try {
      await api.post(`/hotel/reservas/${id}/folio`, { ...pago, monto: parseFloat(pago.monto), tipo: 'credito' });
      setPago({ monto: '', concepto: 'Abono', metodo_pago: 'efectivo', referencia: '' });
      setShowPago(false);
      load();
    } catch (err: any) { alert(err.message); }
    finally { setPagoLoading(false); }
  };

  const startEdit = () => {
    setEditForm({
      cliente: reserva.cliente || '',
      apellido: reserva.apellido || '',
      email: reserva.email || '',
      whatsapp: reserva.whatsapp || '',
      telefono: reserva.telefono || '',
      nacionalidad: reserva.nacionalidad || '',
      notas: reserva.notas || '',
      hora_llegada: reserva.hora_llegada || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setEditLoading(true);
    try {
      await api.put(`/hotel/reservas/${id}`, editForm);
      setEditing(false);
      load();
    } catch (err: any) { alert(err.message); }
    finally { setEditLoading(false); }
  };

  if (loading) return <div className="animate-pulse text-gray-400 p-8">Cargando...</div>;
  if (!reserva) return <div className="p-8 text-red-500">Reserva no encontrada</div>;

  const saldoPct = reserva.monto_total > 0 ? Math.min(100, (reserva.monto_pagado / reserva.monto_total) * 100) : 0;
  const isClosed = ['Cancelada', 'No-Show'].includes(reserva.estado);

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"><ArrowLeft size={16} /> Volver</button>

      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {reserva.cliente} {reserva.apellido || ''}
              <span className="text-lg text-mahana-500 ml-2">{reserva.plan_nombre}</span>
            </h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <span>📅 {reserva.check_in} → {reserva.check_out}</span>
              <span>🌙 {reserva.noches} noches</span>
              <span>👥 {reserva.adultos}A {reserva.menores > 0 ? `+ ${reserva.menores}M` : ''} {reserva.mascotas > 0 ? `+ ${reserva.mascotas}🐾` : ''}</span>
              <span>📞 {reserva.fuente}</span>
              {reserva.habitacion && <span>🛏️ {reserva.habitacion.nombre} ({reserva.habitacion.tipo})</span>}
              {reserva.hora_llegada && <span>⏰ {reserva.hora_llegada}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${estadoColor[reserva.estado] || 'bg-gray-100'}`}>{reserva.estado}</span>
            {/* Status Progression: Pendiente → Confirmada → Hospedado → Check-Out (terminal) */}
            {reserva.estado === 'Pendiente' && (
              <button onClick={() => changeStatus('Confirmada')} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition">Confirmar</button>
            )}
            {reserva.estado === 'Confirmada' && (
              <>
                <button onClick={() => changeStatus('Hospedado')} className="px-4 py-2 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition">Check-In</button>
                <button onClick={() => changeStatus('Pendiente')} className="px-3 py-2 text-gray-400 hover:text-gray-600 text-xs rounded-lg hover:bg-gray-100 transition">↩ Pendiente</button>
              </>
            )}
            {reserva.estado === 'Hospedado' && (
              <button onClick={() => changeStatus('Check-Out')} className="px-4 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition">Check-Out</button>
            )}
            {/* Check-Out = terminal, no going back */}
            {reserva.estado === 'Check-Out' && (
              <span className="text-xs text-gray-400 italic">Estado final</span>
            )}
            {/* Cancel/No-Show — only if not already closed and not checked-out */}
            {!isClosed && reserva.estado !== 'Check-Out' && (
              <div className="relative">
                <button onClick={() => setConfirmCancel(confirmCancel ? null : 'menu')}
                  className="px-3 py-2 text-gray-400 hover:text-red-500 text-sm rounded-lg hover:bg-red-50 transition">⋯</button>
                {confirmCancel && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-48">
                    {confirmCancel === 'menu' ? (
                      <>
                        <button onClick={() => setConfirmCancel('Cancelada')} className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition">Cancelar Reserva</button>
                        <button onClick={() => setConfirmCancel('No-Show')} className="w-full px-4 py-2.5 text-left text-sm text-orange-600 hover:bg-orange-50 transition">Marcar No-Show</button>
                      </>
                    ) : (
                      <div className="p-3">
                        <div className="text-sm font-medium text-gray-700 mb-2">¿Confirmar {confirmCancel}?</div>
                        <div className="flex gap-2">
                          <button onClick={() => changeStatus(confirmCancel)} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg">Sí</button>
                          <button onClick={() => setConfirmCancel(null)} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">No</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* Cancelada/No-Show = terminal */}
            {isClosed && (
              <span className="text-xs text-red-400 italic">Estado final</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Datos del Huésped</h3>
              {!editing && !isClosed && (
                <button onClick={startEdit} className="text-sm text-ocean-600 hover:text-ocean-700 flex items-center gap-1"><Edit2 size={14} /> Editar</button>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500">Nombre</label><input value={editForm.cliente} onChange={e => setEditForm((f: any) => ({ ...f, cliente: e.target.value }))} className="input" /></div>
                  <div><label className="text-xs text-gray-500">Apellido</label><input value={editForm.apellido} onChange={e => setEditForm((f: any) => ({ ...f, apellido: e.target.value }))} className="input" /></div>
                  <div><label className="text-xs text-gray-500">Email</label><input value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} className="input" /></div>
                  <div><label className="text-xs text-gray-500">WhatsApp</label><input value={editForm.whatsapp} onChange={e => setEditForm((f: any) => ({ ...f, whatsapp: e.target.value }))} className="input" /></div>
                  <div><label className="text-xs text-gray-500">Teléfono</label><input value={editForm.telefono} onChange={e => setEditForm((f: any) => ({ ...f, telefono: e.target.value }))} className="input" /></div>
                  <div><label className="text-xs text-gray-500">Nacionalidad</label><input value={editForm.nacionalidad} onChange={e => setEditForm((f: any) => ({ ...f, nacionalidad: e.target.value }))} className="input" /></div>
                </div>
                <div><label className="text-xs text-gray-500">Notas</label><textarea value={editForm.notas} onChange={e => setEditForm((f: any) => ({ ...f, notas: e.target.value }))} className="input min-h-[60px]" /></div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={editLoading} className="px-4 py-2 bg-ocean-500 text-white text-sm rounded-lg hover:bg-ocean-600 flex items-center gap-1 disabled:opacity-50"><Check size={14} /> {editLoading ? 'Guardando...' : 'Guardar'}</button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-500 text-sm flex items-center gap-1"><X size={14} /> Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-400">Email:</span> {reserva.email || '-'}</div>
                  <div><span className="text-gray-400">WhatsApp:</span> {reserva.whatsapp || '-'}</div>
                  <div><span className="text-gray-400">Teléfono:</span> {reserva.telefono || '-'}</div>
                  <div><span className="text-gray-400">Nacionalidad:</span> {reserva.nacionalidad || '-'}</div>
                </div>
                {reserva.notas && <div className="mt-3 text-sm bg-gray-50 p-3 rounded-lg text-gray-600">{reserva.notas}</div>}
              </>
            )}
          </div>

          {/* Folio */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Resumen de Cuenta (Folio)</h3>
              {!isClosed && (
                <button onClick={() => setShowPago(!showPago)} className="flex items-center gap-1 text-sm text-ocean-600 hover:text-ocean-700">
                  <Plus size={16} /> Registrar Pago
                </button>
              )}
            </div>

            {showPago && (
              <form onSubmit={submitPago} className="bg-ocean-50 rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Monto *</label>
                    <input type="number" step="0.01" min="0.01" value={pago.monto} onChange={e => setPago(p => ({ ...p, monto: e.target.value }))} required className="input" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Concepto</label>
                    <input value={pago.concepto} onChange={e => setPago(p => ({ ...p, concepto: e.target.value }))} className="input" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Método</label>
                    <select value={pago.metodo_pago} onChange={e => setPago(p => ({ ...p, metodo_pago: e.target.value }))} className="input">
                      <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option>
                      <option value="yappy">Yappy</option><option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Referencia</label>
                    <input value={pago.referencia} onChange={e => setPago(p => ({ ...p, referencia: e.target.value }))} className="input" placeholder="#" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={pagoLoading} className="px-4 py-2 bg-ocean-500 text-white rounded-lg text-sm hover:bg-ocean-600 disabled:opacity-50">
                    {pagoLoading ? 'Guardando...' : 'Guardar Pago'}
                  </button>
                  <button type="button" onClick={() => setShowPago(false)} className="px-4 py-2 text-gray-500 text-sm">Cancelar</button>
                </div>
              </form>
            )}

            {(reserva.folio || []).length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-4">Sin movimientos</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs uppercase border-b">
                  <tr>
                    <th className="py-2 text-left">Fecha</th>
                    <th className="py-2 text-left">Concepto</th>
                    <th className="py-2 text-left">Método</th>
                    <th className="py-2 text-right">Débito</th>
                    <th className="py-2 text-right">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...(reserva.folio || [])].sort((a: any, b: any) => a.id - b.id).map((f: any) => (
                    <tr key={f.id} className={f.tipo === 'credito' ? 'bg-green-50/30' : ''}>
                      <td className="py-2 text-gray-400">{f.fecha}</td>
                      <td className="py-2">{f.concepto}</td>
                      <td className="py-2 text-gray-400">{f.metodo_pago || '-'}</td>
                      <td className="py-2 text-right text-red-500 font-medium">{f.tipo === 'debito' ? `$${f.monto.toFixed(2)}` : ''}</td>
                      <td className="py-2 text-right text-green-600 font-medium">{f.tipo === 'credito' ? `$${f.monto.toFixed(2)}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300">
                  <tr className="font-bold">
                    <td className="py-2" colSpan={3}>TOTAL</td>
                    <td className="py-2 text-right text-red-600">
                      ${[...(reserva.folio || [])].filter((f: any) => f.tipo === 'debito').reduce((s: number, f: any) => s + f.monto, 0).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-green-600">
                      ${[...(reserva.folio || [])].filter((f: any) => f.tipo === 'credito').reduce((s: number, f: any) => s + f.monto, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

          {/* Documents Section */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">📎 Documentos</h3>
              {!isClosed && (
                <button onClick={() => setShowUpload(!showUpload)} className="text-sm text-ocean-600 hover:text-ocean-700 flex items-center gap-1">
                  <Upload size={14} /> Subir
                </button>
              )}
            </div>

            {/* Upload Form */}
            {showUpload && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500">Tipo de documento</label>
                    <select value={uploadTipo} onChange={e => setUploadTipo(e.target.value)} className="input">
                      <option value="cedula">Cédula / ID</option>
                      <option value="pasaporte">Pasaporte</option>
                      <option value="recibo">Recibo de pago</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Archivo (JPEG, PNG, PDF)</label>
                    <input type="file" accept="image/*,.pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                      className="text-sm w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-ocean-50 file:text-ocean-600 file:font-medium hover:file:bg-ocean-100 file:cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Notas (opcional)</label>
                    <input value={uploadNotas} onChange={e => setUploadNotas(e.target.value)} className="input" placeholder="Referencia..." />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button disabled={!uploadFile || uploading} onClick={async () => {
                    if (!uploadFile) return;
                    setUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append('archivo', uploadFile);
                      fd.append('tipo', uploadTipo);
                      fd.append('notas', uploadNotas);
                      await api.post(`/hotel/reservas/${id}/documentos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                      setShowUpload(false); setUploadFile(null); setUploadNotas('');
                      load();
                    } catch (e: any) { alert(e?.response?.data?.error?.message || 'Error subiendo'); }
                    finally { setUploading(false); }
                  }} className="px-4 py-2 bg-ocean-500 text-white text-sm rounded-lg hover:bg-ocean-600 disabled:opacity-50 flex items-center gap-1">
                    <Upload size={14} /> {uploading ? 'Subiendo...' : 'Subir'}
                  </button>
                  <button onClick={() => { setShowUpload(false); setUploadFile(null); }} className="px-4 py-2 text-gray-500 text-sm">Cancelar</button>
                </div>
              </div>
            )}

            {/* Document Grid */}
            {(reserva.documentos || []).length === 0 && !showUpload ? (
              <div className="text-center text-gray-400 text-sm py-4">Sin documentos adjuntos</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(reserva.documentos || []).map((doc: any) => {
                  const isImage = doc.mime_type?.startsWith('image/');
                  const tipoLabel = doc.tipo === 'cedula' ? '🪪 Cédula' : doc.tipo === 'pasaporte' ? '📘 Pasaporte' : doc.tipo === 'recibo' ? '🧾 Recibo' : '📄 Otro';
                  const token = localStorage.getItem('pms_token');
                  const docUrl = `/api/v1/hotel/documentos/${doc.id}/archivo${token ? `?token=${token}` : ''}`;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <a href={docUrl} target="_blank" rel="noopener"
                        className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden text-gray-400 hover:text-ocean-500">
                        {isImage ? (
                          <img src={docUrl} alt={doc.nombre_original} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <FileText size={20} />
                        )}
                      </a>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700 truncate">{tipoLabel}</div>
                        <div className="text-xs text-gray-400 truncate">{doc.nombre_original}</div>
                        {doc.notas && <div className="text-xs text-gray-400">{doc.notas}</div>}
                        <div className="text-xs text-gray-300">{doc.created_at?.split('T')[0]}</div>
                      </div>
                      <a href={docUrl} target="_blank" rel="noopener" className="text-ocean-400 hover:text-ocean-600 flex-shrink-0 mr-1" title="Abrir">
                        <Image size={14} />
                      </a>
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar este documento?')) return;
                        await api.delete(`/hotel/documentos/${doc.id}`);
                        load();
                      }} className="text-gray-300 hover:text-red-500 flex-shrink-0" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        {/* Sidebar - Totals */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-4">Total</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>${reserva.subtotal?.toFixed(2)}</span></div>
              {reserva.productos_adicionales > 0 && <div className="flex justify-between"><span className="text-gray-400">Productos adicionales</span><span>${reserva.productos_adicionales?.toFixed(2)}</span></div>}
              <div className="flex justify-between"><span className="text-gray-400">Impuesto Turismo {reserva.impuesto_pct}%</span><span>${reserva.impuesto_monto?.toFixed(2)}</span></div>
              <hr />
              <div className="flex justify-between font-bold text-lg"><span>Monto Total</span><span>${reserva.monto_total?.toFixed(2)}</span></div>
              <hr />
              <div className="flex justify-between text-green-600"><span>Monto pagado</span><span>${reserva.monto_pagado?.toFixed(2)}</span></div>
              <div className={`flex justify-between font-bold text-lg ${reserva.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                <span>Saldo pendiente</span><span>${reserva.saldo_pendiente?.toFixed(2)}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all ${saldoPct >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-green-400 to-green-500'}`} style={{ width: `${saldoPct}%` }} />
              </div>
              <div className="text-xs text-gray-400 mt-1 text-center">
                {saldoPct >= 100 ? '✅ Pagado completo' : `${saldoPct.toFixed(0)}% pagado`}
              </div>
            </div>

            {reserva.saldo_pendiente > 0 && reserva.deposito_sugerido > 0 && (
              <div className="mt-3 text-xs text-gray-400">Depósito sugerido: ${reserva.deposito_sugerido?.toFixed(2)}</div>
            )}
          </div>

          {/* Quick Info */}
          <div className="bg-white rounded-xl p-5 shadow-sm text-sm space-y-2">
            <h3 className="font-semibold text-gray-700 mb-3">Info</h3>
            <div className="text-gray-400">Creado por: <span className="text-gray-600">{reserva.created_by}</span></div>
            <div className="text-gray-400">Fecha: <span className="text-gray-600">{reserva.created_at?.split('T')[0]}</span></div>
            <div className="text-gray-400">ID: <span className="text-gray-600">#{reserva.id}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
