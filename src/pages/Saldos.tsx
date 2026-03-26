import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { DollarSign, Search, Filter, Plus, X, MessageCircle, Calendar } from 'lucide-react';

export default function Saldos() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [sortBy, setSortBy] = useState<'saldo' | 'fecha' | 'cliente'>('saldo');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Quick payment modal state
  const [pagoModal, setPagoModal] = useState<any>(null); // reservation object or null
  const [pagoForm, setPagoForm] = useState({ monto: '', concepto: 'Abono', metodo_pago: 'efectivo', referencia: '' });
  const [pagoLoading, setPagoLoading] = useState(false);

  const loadData = () => {
    setLoading(true);
    api.get('/hotel/saldos').then(r => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openPagoModal = (reserva: any) => {
    setPagoModal(reserva);
    setPagoForm({ monto: reserva.saldo_pendiente?.toFixed(2) || '', concepto: 'Abono', metodo_pago: 'efectivo', referencia: '' });
  };

  const submitPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pagoForm.monto || parseFloat(pagoForm.monto) <= 0) return;
    setPagoLoading(true);
    try {
      await api.post(`/hotel/reservas/${pagoModal.id}/folio`, {
        ...pagoForm,
        monto: parseFloat(pagoForm.monto),
        tipo: 'credito'
      });
      setPagoModal(null);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error registrando pago');
    } finally { setPagoLoading(false); }
  };

  const buildWhatsAppLink = (r: any) => {
    if (!r.whatsapp) return null;
    const phone = r.whatsapp.replace(/[^0-9]/g, '');
    if (!phone) return null;
    const msg = encodeURIComponent(
      `Hola ${r.cliente} 👋\n\nLe recordamos que tiene un saldo pendiente de $${r.saldo_pendiente?.toFixed(2)} en Casa Mahana.\n\n` +
      `Reserva: ${r.check_in} → ${r.check_out}\nHabitación: ${r.habitacion_nombre || '-'}\nTotal: $${r.monto_total?.toFixed(2)}\nPagado: $${r.monto_pagado?.toFixed(2)}\nSaldo: $${r.saldo_pendiente?.toFixed(2)}\n\n` +
      `¿Cómo desea realizar su pago? Aceptamos efectivo, transferencia, Yappy y tarjeta. ¡Gracias! 🙏`
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  if (loading) return <div className="animate-pulse text-gray-400 p-8">Cargando...</div>;

  // Filter & sort
  let filtered = data.filter((r: any) => {
    if (search) {
      const q = search.toLowerCase();
      if (!r.cliente?.toLowerCase().includes(q) && !r.apellido?.toLowerCase().includes(q) && !r.habitacion_nombre?.toLowerCase().includes(q)) return false;
    }
    if (filterEstado !== 'todos' && r.estado !== filterEstado) return false;
    if (fechaDesde && r.check_in < fechaDesde) return false;
    if (fechaHasta && r.check_in > fechaHasta) return false;
    return true;
  });

  if (sortBy === 'saldo') filtered.sort((a: any, b: any) => (b.saldo_pendiente || 0) - (a.saldo_pendiente || 0));
  else if (sortBy === 'fecha') filtered.sort((a: any, b: any) => a.check_in?.localeCompare(b.check_in));
  else if (sortBy === 'cliente') filtered.sort((a: any, b: any) => a.cliente?.localeCompare(b.cliente));

  const totalSaldo = filtered.reduce((s: number, r: any) => s + (r.saldo_pendiente || 0), 0);
  const totalMonto = filtered.reduce((s: number, r: any) => s + (r.monto_total || 0), 0);
  const totalPagado = filtered.reduce((s: number, r: any) => s + (r.monto_pagado || 0), 0);
  const estadosUnicos = [...new Set(data.map((r: any) => r.estado))].sort();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cuentas por Cobrar</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} reservas con saldo pendiente</p>
        </div>
        <div className="bg-red-50 text-red-700 px-5 py-3 rounded-xl font-semibold text-lg">
          Total pend: ${totalSaldo.toFixed(2)}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-400">
          <div className="text-2xl font-bold text-gray-800">${totalMonto.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Total Facturado</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-400">
          <div className="text-2xl font-bold text-green-600">${totalPagado.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Total Cobrado</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-400">
          <div className="text-2xl font-bold text-red-600">${totalSaldo.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Pendiente por Cobrar</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="input pl-9 w-full" placeholder="Buscar por cliente o habitación..." />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="input text-sm">
            <option value="todos">Todos los estados</option>
            {estadosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input text-sm">
          <option value="saldo">Mayor saldo primero</option>
          <option value="fecha">Fecha check-in</option>
          <option value="cliente">Nombre A-Z</option>
        </select>
      </div>

      {/* Date Range Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Calendar size={16} className="text-gray-400" />
        <span className="text-xs text-gray-400">Check-in:</span>
        <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="input text-sm" placeholder="Desde" />
        <span className="text-xs text-gray-400">→</span>
        <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="input text-sm" placeholder="Hasta" />
        {(fechaDesde || fechaHasta) && (
          <button onClick={() => { setFechaDesde(''); setFechaHasta(''); }} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
            <X size={12} /> Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400">
          {search || filterEstado !== 'todos' || fechaDesde || fechaHasta ? 'No hay resultados para los filtros aplicados' : 'No hay saldos pendientes 🎉'}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Habitación</th>
                  <th className="px-4 py-3 text-left">Check-in</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Pagado</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r: any) => {
                  const pct = r.monto_total > 0 ? Math.round((r.monto_pagado / r.monto_total) * 100) : 0;
                  const estadoClass = r.estado === 'Hospedado' ? 'bg-green-100 text-green-700'
                    : r.estado === 'Confirmada' ? 'bg-blue-100 text-blue-700'
                    : r.estado === 'Pendiente' ? 'bg-yellow-100 text-yellow-700'
                    : r.estado === 'Check-Out' ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-100 text-gray-500';
                  const waLink = buildWhatsAppLink(r);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/reservas/${r.id}`} className="text-ocean-600 hover:underline">{r.cliente} {r.apellido || ''}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.habitacion_nombre || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.check_in}</td>
                      <td className="px-4 py-3 text-gray-500">{r.plan_nombre || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoClass}`}>{r.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">${r.monto_total?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-green-600">${r.monto_pagado?.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-red-600 font-bold">${r.saldo_pendiente?.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-400' : 'bg-red-400'}`}
                                style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{pct}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openPagoModal(r)} title="Registrar pago"
                            className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 hover:text-green-700 transition">
                            <Plus size={16} />
                          </button>
                          {waLink && (
                            <a href={waLink} target="_blank" rel="noopener noreferrer" title="Recordatorio WhatsApp"
                              className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition">
                              <MessageCircle size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-sm">
                <tr>
                  <td className="px-4 py-3" colSpan={5}>TOTAL ({filtered.length} reservas)</td>
                  <td className="px-4 py-3 text-right">${totalMonto.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-green-600">${totalPagado.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-red-600">${totalSaldo.toFixed(2)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Quick Payment Modal */}
      {pagoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPagoModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800">Registrar Pago</h3>
                <button onClick={() => setPagoModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {pagoModal.cliente} {pagoModal.apellido || ''} — {pagoModal.habitacion_nombre || 'Sin hab.'}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-400">
                <span>Total: <span className="font-medium text-gray-600">${pagoModal.monto_total?.toFixed(2)}</span></span>
                <span>Pagado: <span className="font-medium text-green-600">${pagoModal.monto_pagado?.toFixed(2)}</span></span>
                <span>Saldo: <span className="font-bold text-red-600">${pagoModal.saldo_pendiente?.toFixed(2)}</span></span>
              </div>
            </div>
            <form onSubmit={submitPago} className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Monto *</label>
                  <input type="number" step="0.01" min="0.01" value={pagoForm.monto}
                    onChange={e => setPagoForm(p => ({ ...p, monto: e.target.value }))}
                    required className="input" placeholder="0.00" autoFocus />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Método</label>
                  <select value={pagoForm.metodo_pago} onChange={e => setPagoForm(p => ({ ...p, metodo_pago: e.target.value }))} className="input">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="yappy">Yappy</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Concepto</label>
                  <input value={pagoForm.concepto} onChange={e => setPagoForm(p => ({ ...p, concepto: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Referencia</label>
                  <input value={pagoForm.referencia} onChange={e => setPagoForm(p => ({ ...p, referencia: e.target.value }))} className="input" placeholder="#" />
                </div>
              </div>
              {/* Quick amount buttons */}
              <div className="flex gap-2">
                <button type="button" onClick={() => setPagoForm(p => ({ ...p, monto: pagoModal.saldo_pendiente?.toFixed(2) }))}
                  className="text-xs px-3 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition">
                  Saldo completo (${pagoModal.saldo_pendiente?.toFixed(2)})
                </button>
                <button type="button" onClick={() => setPagoForm(p => ({ ...p, monto: (pagoModal.saldo_pendiente / 2)?.toFixed(2) }))}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                  50% (${(pagoModal.saldo_pendiente / 2)?.toFixed(2)})
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={pagoLoading}
                  className="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition">
                  {pagoLoading ? 'Guardando...' : '✓ Registrar Pago'}
                </button>
                <button type="button" onClick={() => setPagoModal(null)}
                  className="px-4 py-2.5 text-gray-500 text-sm rounded-lg hover:bg-gray-100 transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
