import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, Calendar, User, DollarSign, CreditCard, ArrowRight, Clock, AlertCircle } from 'lucide-react';

export default function Aprobaciones() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState<any[]>([]);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [userRole, setUserRole] = useState('receptionist');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'nuevas' | 'solicitudes'>('nuevas');
  const [rejectionCommentId, setRejectionCommentId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Retrieve user role on mount and redirect if restricted
  useEffect(() => {
    api.get('/auth/me')
      .then(r => {
        if (r.data && r.data.rol) {
          setUserRole(r.data.rol);
          if (r.data.rol === 'cleaning') {
            navigate('/');
          }
        }
      })
      .catch(() => {});
  }, [navigate]);

  const loadPending = () => {
    setLoading(true);
    api.get('/hotel/reservas?estado=Pendiente')
      .then(r => {
        if (Array.isArray(r.data)) {
          setReservas(r.data);
        }
      })
      .catch(e => console.error('Error fetching pending reservations:', e))
      .finally(() => setLoading(false));
  };

  const loadSolicitudes = () => {
    if (userRole !== 'admin') return;
    setLoadingSolicitudes(true);
    api.get('/admin/solicitudes-modificacion?estado=Pendiente')
      .then(r => {
        if (Array.isArray(r.data)) {
          setSolicitudes(r.data);
        }
      })
      .catch(e => console.error('Error fetching solicitudes:', e))
      .finally(() => setLoadingSolicitudes(false));
  };

  useEffect(() => {
    if (userRole !== 'cleaning') {
      loadPending();
      if (userRole === 'admin') {
        loadSolicitudes();
      }
    }
  }, [userRole]);

  const handleApprove = async (id: number) => {
    setActionLoadingId(id);
    try {
      await api.patch(`/hotel/reservas/${id}/status`, { estado: 'Confirmada' });
      loadPending();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error al aprobar la reserva');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: number, name: string) => {
    if (!confirm(`¿Estás seguro de que deseas rechazar y cancelar la reserva pendiente de ${name}?`)) {
      return;
    }
    setActionLoadingId(id);
    try {
      await api.patch(`/hotel/reservas/${id}/status`, { estado: 'Cancelada' });
      loadPending();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error al rechazar la reserva');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveSolicitud = async (solicitudId: number) => {
    if (!confirm('¿Estás seguro de que deseas autorizar esta solicitud de cambio? Los cambios se aplicarán inmediatamente.')) {
      return;
    }
    setActionLoadingId(solicitudId);
    try {
      await api.post(`/admin/solicitudes-modificacion/${solicitudId}/procesar`, { accion: 'aprobar' });
      loadPending();
      loadSolicitudes();
      alert('Solicitud de cambio aprobada exitosamente y reserva actualizada.');
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error al aprobar la solicitud');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectSolicitud = async (solicitudId: number) => {
    setActionLoadingId(solicitudId);
    try {
      await api.post(`/admin/solicitudes-modificacion/${solicitudId}/procesar`, {
        accion: 'rechazar',
        comentarios_admin: rejectionReason || undefined
      });
      setRejectionCommentId(null);
      setRejectionReason('');
      loadPending();
      loadSolicitudes();
      alert('Solicitud de cambio rechazada exitosamente.');
    } catch (err: any) {
      alert(err?.response?.data?.error?.message || 'Error al rechazar la solicitud');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderComparison = (anterioresStr: any, nuevosStr: any) => {
    let prev: any = {};
    let next: any = {};
    try {
      prev = typeof anterioresStr === 'string' ? JSON.parse(anterioresStr) : anterioresStr;
    } catch (e) { prev = anterioresStr || {}; }
    try {
      next = typeof nuevosStr === 'string' ? JSON.parse(nuevosStr) : nuevosStr;
    } catch (e) { next = nuevosStr || {}; }

    // If both are objects, extract keys
    const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
    
    // Filter to only keys that actually changed
    const changedKeys = keys.filter(key => {
      // ignore empty/null differences if they are equivalent
      const v1 = prev[key] === null || prev[key] === undefined ? '' : String(prev[key]);
      const v2 = next[key] === null || next[key] === undefined ? '' : String(next[key]);
      return v1 !== v2;
    });

    if (changedKeys.length === 0) {
      return <div className="text-xs text-gray-450 italic mt-2 bg-gray-55 p-3 rounded-lg border border-gray-150">Sin cambios detectados en los datos.</div>;
    }

    return (
      <div className="space-y-1.5 mt-2 bg-gray-50/70 p-3 rounded-xl border border-gray-100/80">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Diferencias de Datos</div>
        {changedKeys.map(key => {
          const prevVal = prev[key];
          const nextVal = next[key];
          return (
            <div key={key} className="flex flex-wrap items-center gap-1.5 text-xs py-0.5 border-b border-gray-100 last:border-0">
              <span className="font-semibold text-gray-500 capitalize">{key.replace(/_/g, ' ')}:</span>
              <span className="text-red-500 line-through font-mono">{String(prevVal ?? 'Ninguno')}</span>
              <span className="text-gray-400">→</span>
              <span className="text-green-600 font-bold font-mono">{String(nextVal ?? 'Ninguno')}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const isMainLoading = loading || (userRole === 'admin' && loadingSolicitudes);

  if (isMainLoading && reservas.length === 0 && solicitudes.length === 0) {
    return <div className="animate-pulse text-gray-400 p-8 text-center font-medium">Cargando aprobaciones pendientes...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Aprobaciones Pendientes</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona y aprueba reservas, cambios de reserva y transacciones en folios cerrados.</p>
        </div>
      </div>

      {/* Tabs */}
      {userRole === 'admin' && (
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('nuevas')}
            className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${
              activeTab === 'nuevas'
                ? 'border-ocean-500 text-ocean-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Nuevas Reservas ({reservas.length})
          </button>
          <button
            onClick={() => setActiveTab('solicitudes')}
            className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 -mb-[2px] ${
              activeTab === 'solicitudes'
                ? 'border-ocean-500 text-ocean-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Solicitudes de Cambio ({solicitudes.length})
          </button>
        </div>
      )}

      {/* Nuevas Reservas Tab */}
      {(!userRole || activeTab === 'nuevas') && (
        <>
          {reservas.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-100 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[350px]">
              <div className="w-16 h-16 bg-ocean-50 text-ocean-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-inner">
                🌴
              </div>
              <h3 className="font-bold text-gray-700 text-lg">Todo al día</h3>
              <p className="text-gray-400 text-sm max-w-sm mt-1">No hay reservas pendientes de aprobación en este momento. ¡Buen trabajo!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reservas.map((res: any) => {
                const total = res.monto_total || 0;
                const pending = res.saldo_pendiente || 0;
                const paid = res.monto_pagado !== undefined ? res.monto_pagado : (total - pending);

                return (
                  <div
                    key={res.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-gray-50 pb-3 mb-3">
                        <div>
                          <h3 className="font-bold text-gray-800 text-base leading-tight">
                            <Link to={`/reservas/${res.id}`} className="hover:text-ocean-600 transition">
                              {res.cliente} {res.apellido || ''}
                            </Link>
                          </h3>
                          <span className="text-[10px] text-gray-400 font-medium">Reserva #{res.id} • Fuente: {res.fuente || 'Web'}</span>
                        </div>
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-amber-200 bg-amber-50 text-amber-700">
                          <Clock size={10} className="animate-spin-slow" />
                          Pendiente
                        </span>
                      </div>

                      {/* Card Body Details */}
                      <div className="space-y-2.5 text-xs text-gray-600 mb-4">
                        {/* Dates */}
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-gray-400" />
                          <div className="flex items-center gap-1 font-medium text-gray-700">
                            <span>{res.check_in}</span>
                            <ArrowRight size={10} className="text-gray-300" />
                            <span>{res.check_out}</span>
                            <span className="text-gray-400 font-light ml-1">({res.noches} noches)</span>
                          </div>
                        </div>

                        {/* Room & Category */}
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-gray-400" />
                          <span>
                            Habitación: <strong className="text-gray-700">{res.habitacion_nombre || res.tipo_habitacion || 'Por asignar'}</strong>
                            <span className="ml-1 text-[10px] text-gray-400">({res.plan_nombre || 'Tarifa estándar'})</span>
                          </span>
                        </div>

                        {/* Guests count */}
                        <div className="pl-5 text-gray-500 text-[11px]">
                          Huéspedes: {res.adultos} adulto{res.adultos !== 1 ? 's' : ''}
                          {res.menores > 0 ? ` y ${res.menores} menor${res.menores !== 1 ? 'es' : ''}` : ''}
                        </div>

                        {/* Payment Info */}
                        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100 mt-2">
                          <div className="flex justify-between items-center mb-1 text-[10px] text-gray-400 font-medium">
                            <span>Estado de Abono:</span>
                            <span className={paid >= total ? 'text-green-600 font-bold' : 'text-amber-600 font-semibold'}>
                              {paid >= total ? 'Totalmente Pagado' : (paid > 0 ? 'Pago Parcial' : 'Sin Abono')}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-1">
                              <DollarSign size={12} className="text-gray-400" />
                              <span>Total: <strong className="text-gray-800">${total.toFixed(2)}</strong></span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-green-600 font-medium">Pagado: ${paid.toFixed(2)}</span>
                              <span className="text-gray-300">|</span>
                              <span className="text-red-500 font-medium">Debe: ${pending.toFixed(2)}</span>
                            </div>
                          </div>

                          {res.notas && (
                            <div className="border-t border-gray-100/80 mt-2 pt-2 text-[10px] text-gray-500 flex items-start gap-1">
                              <CreditCard size={11} className="text-gray-400 mt-0.5 flex-shrink-0" />
                              <span className="italic leading-normal">{res.notas}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 border-t border-gray-50 pt-3.5 mt-2">
                      <Link
                        to={`/reservas/${res.id}`}
                        className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition"
                      >
                        Detalle Folio
                      </Link>
                      
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => handleReject(res.id, res.cliente)}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                        >
                          <X size={12} />
                          Rechazar
                        </button>
                        <button
                          onClick={() => handleApprove(res.id)}
                          disabled={actionLoadingId !== null}
                          className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow-md transition disabled:opacity-50"
                        >
                          <Check size={12} />
                          Aprobar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Solicitudes de Cambio Tab */}
      {userRole === 'admin' && activeTab === 'solicitudes' && (
        <>
          {solicitudes.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-100 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[350px]">
              <div className="w-16 h-16 bg-ocean-50 text-ocean-500 rounded-full flex items-center justify-center text-2xl mb-4 shadow-inner">
                🔄
              </div>
              <h3 className="font-bold text-gray-700 text-lg">Todo al día</h3>
              <p className="text-gray-400 text-sm max-w-sm mt-1">No hay solicitudes de cambio de reserva o pago pendientes de aprobación.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {solicitudes.map((sol: any) => {
                const isPago = sol.tipo_modificacion === 'editar_pago';
                return (
                  <div
                    key={sol.id}
                    className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-gray-50 pb-3 mb-3">
                        <div>
                          <h3 className="font-bold text-gray-800 text-base leading-tight">
                            <Link to={`/reservas/${sol.reserva_id}`} className="hover:text-ocean-600 transition">
                              {sol.cliente} {sol.apellido || ''}
                            </Link>
                          </h3>
                          <span className="text-[10px] text-gray-400 font-medium">
                            Solicitud #{sol.id} • Reserva #{sol.reserva_id}
                          </span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isPago
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-cyan-200 bg-cyan-50 text-cyan-700'
                        }`}>
                          {isPago ? 'Cambio Pago' : 'Cambio Reserva'}
                        </span>
                      </div>

                      {/* Card Body Details */}
                      <div className="space-y-2.5 text-xs text-gray-600 mb-4">
                        {/* Request Metadata */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-400 bg-gray-50/50 p-2 rounded-xl border border-gray-100/50">
                          <div>
                            Solicitante: <strong className="text-gray-600">{sol.usuario_solicitante || sol.solicitado_por || 'Sistema'}</strong>
                          </div>
                          <div className="text-right">
                            Fecha: <strong className="text-gray-600">{sol.created_at?.split('T')[0] || sol.fecha_solicitud?.split(' ')[0]}</strong>
                          </div>
                        </div>

                        {/* Justification */}
                        <div className="bg-amber-50/30 border-l-2 border-amber-400 p-2.5 rounded-r-xl">
                          <div className="text-[10px] text-amber-800 font-semibold uppercase tracking-wider mb-0.5">Justificación:</div>
                          <p className="italic text-gray-700 leading-relaxed font-sans">"{sol.justificacion}"</p>
                        </div>

                        {/* Visual Before vs After Diff Comparison */}
                        {renderComparison(sol.datos_anteriores, sol.snapshot_datos)}
                      </div>
                    </div>

                    {/* Card Actions / Inline Rejection Input */}
                    <div className="border-t border-gray-50 pt-3.5 mt-2">
                      {rejectionCommentId === sol.id ? (
                        <div className="space-y-2 animate-fadeIn bg-red-50/30 p-3 rounded-xl border border-red-100">
                          <label className="block text-[11px] font-semibold text-red-700 uppercase tracking-wider">Motivo de Rechazo *</label>
                          <textarea
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder="Ingrese los comentarios o motivos del rechazo..."
                            className="input w-full min-h-[60px] text-xs"
                            required
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => { setRejectionCommentId(null); setRejectionReason(''); }}
                              className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSolicitud(sol.id)}
                              disabled={actionLoadingId !== null || !rejectionReason.trim()}
                              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                            >
                              Confirmar Rechazo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/reservas/${sol.reserva_id}`}
                            className="px-3 py-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-semibold transition"
                          >
                            Ir a Reserva
                          </Link>
                          
                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              onClick={() => { setRejectionCommentId(sol.id); setRejectionReason(''); }}
                              disabled={actionLoadingId !== null}
                              className="flex items-center gap-1 px-3 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                            >
                              <X size={12} />
                              Rechazar
                            </button>
                            <button
                              onClick={() => handleApproveSolicitud(sol.id)}
                              disabled={actionLoadingId !== null}
                              className="flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow-md transition disabled:opacity-50"
                            >
                              <Check size={12} />
                              Autorizar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
