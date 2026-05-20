import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import { Check, X, Calendar, User, DollarSign, CreditCard, ArrowRight, Clock, AlertCircle } from 'lucide-react';

export default function Aprobaciones() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('receptionist');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

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

  useEffect(() => {
    if (userRole !== 'cleaning') {
      loadPending();
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

  if (loading) {
    return <div className="animate-pulse text-gray-400 p-8">Cargando aprobaciones pendientes...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Aprobaciones Pendientes</h1>
          <p className="text-sm text-gray-500 mt-1">Gestiona y aprueba reservas recibidas del Booking Widget y reservas internas pendientes.</p>
        </div>
        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">
          {reservas.length} por revisar
        </span>
      </div>

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
    </div>
  );
}
