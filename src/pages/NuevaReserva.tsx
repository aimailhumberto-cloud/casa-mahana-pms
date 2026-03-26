import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Sun, Moon } from 'lucide-react';

export default function NuevaReserva() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [planes, setPlanes] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cotizacion, setCotizacion] = useState<any>(null);

  // Category selection — first step
  const [categoria, setCategoria] = useState<'Estadía' | 'Pasadía'>(
    searchParams.get('categoria') as any || 'Estadía'
  );
  const isPasadia = categoria === 'Pasadía';

  // Step 4: Deposit
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMetodo, setDepositMetodo] = useState('efectivo');
  const [depositRef, setDepositRef] = useState('');

  const [form, setForm] = useState({
    cliente: '', apellido: '', email: '', whatsapp: '', nacionalidad: '',
    check_in: searchParams.get('check_in') || '',
    check_out: searchParams.get('check_out') || '',
    hora_llegada: '',
    habitacion_id: searchParams.get('habitacion_id') || '',
    plan_codigo: '',
    adultos: 1, menores: 0, mascotas: 0,
    fuente: 'Teléfono', notas: ''
  });

  // Pasadía: multi-unit selection (bohíos, salón)
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);

  useEffect(() => {
    api.get('/hotel/planes').then(r => setPlanes(r.data));
  }, []);

  // Filter plans by category
  const filteredPlanes = useMemo(() => {
    return planes.filter(p => p.categoria === categoria);
  }, [planes, categoria]);

  // When category changes, reset form selections
  useEffect(() => {
    setForm(f => ({ ...f, habitacion_id: '', plan_codigo: '' }));
    setSelectedUnits([]);
    setCotizacion(null);
  }, [categoria]);

  // Pasadía: auto-set check-out = check-in + 1 day
  useEffect(() => {
    if (isPasadia && form.check_in) {
      const d = new Date(form.check_in);
      d.setDate(d.getDate() + 1);
      const nextDay = d.toISOString().split('T')[0];
      setForm(f => ({ ...f, check_out: nextDay }));
    }
  }, [isPasadia, form.check_in]);

  // Load available rooms when dates change
  useEffect(() => {
    if (form.check_in && form.check_out && form.check_out > form.check_in) {
      api.get(`/hotel/disponibilidad?check_in=${form.check_in}&check_out=${form.check_out}`)
        .then(r => {
          setRooms(r.data);
          // Clear if pre-selected room is unavailable
          if (form.habitacion_id) {
            const sel = r.data.find((rm: any) => rm.id == form.habitacion_id);
            if (sel && !sel.disponible) setForm(f => ({ ...f, habitacion_id: '' }));
          }
        });
    } else { setRooms([]); }
  }, [form.check_in, form.check_out]);

  // Filter rooms by category
  const categoryRooms = useMemo(() => {
    return rooms.filter(r => r.categoria === categoria);
  }, [rooms, categoria]);
  const availableRooms = categoryRooms.filter(r => r.disponible);

  // Auto-cotizar
  useEffect(() => {
    if (form.plan_codigo && form.check_in && form.check_out && form.check_out > form.check_in) {
      const mainHab = isPasadia ? (selectedUnits[0] || form.habitacion_id) : form.habitacion_id;
      const guests = isPasadia ? form.adultos : form.adultos;
      api.get(`/hotel/cotizar?plan=${form.plan_codigo}&adultos=${guests}&menores=${form.menores}&mascotas=${form.mascotas}&check_in=${form.check_in}&check_out=${form.check_out}`)
        .then(r => {
          // For Pasadía multi-unit, multiply by number of units
          if (isPasadia && selectedUnits.length > 1) {
            r.data.subtotal *= selectedUnits.length;
            r.data.impuesto_monto *= selectedUnits.length;
            r.data.monto_total *= selectedUnits.length;
            r.data.deposito_sugerido *= selectedUnits.length;
          }
          setCotizacion(r.data);
          if (r.data.deposito_sugerido && !depositAmount) {
            setDepositAmount(r.data.deposito_sugerido.toFixed(2));
          }
        }).catch(() => setCotizacion(null));
    } else { setCotizacion(null); }
  }, [form.plan_codigo, form.adultos, form.menores, form.mascotas, form.check_in, form.check_out, selectedUnits.length]);

  const set = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  // Toggle unit selection for Pasadía multi-select
  const toggleUnit = (id: number) => {
    setSelectedUnits(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    // Set first selected as habitacion_id
    if (!selectedUnits.includes(id)) {
      if (selectedUnits.length === 0) set('habitacion_id', id);
    } else {
      const remaining = selectedUnits.filter(x => x !== id);
      set('habitacion_id', remaining[0] || '');
    }
  };

  // Validations
  const todayStr = new Date().toISOString().split('T')[0];
  const pastDateError = form.check_in && form.check_in < todayStr ? 'No se puede reservar en el pasado' : '';
  const dateError = form.check_in && form.check_out && form.check_out <= form.check_in
    ? 'Check-out debe ser después del check-in' : '';
  const totalGuests = form.adultos + form.menores;
  const selectedRoom = rooms.find((r: any) => r.id == form.habitacion_id);
  const selectedRoomAvailable = !form.habitacion_id || selectedRoom?.disponible;
  const capacityError = selectedRoom && selectedRoom.capacidad_max
    ? (totalGuests > selectedRoom.capacidad_max
      ? `${selectedRoom.nombre} admite máximo ${selectedRoom.capacidad_max} personas. Tienes ${totalGuests}.`
      : totalGuests < (selectedRoom.capacidad_min || 1)
        ? `${selectedRoom.nombre} requiere mínimo ${selectedRoom.capacidad_min} personas.`
        : '')
    : '';

  const hasUnit = isPasadia ? selectedUnits.length > 0 : !!form.habitacion_id;
  const canSubmit = form.cliente && form.apellido && form.whatsapp && form.check_in && form.check_out && !dateError && !pastDateError
    && form.plan_codigo && hasUnit && selectedRoomAvailable && !capacityError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.cliente || !form.apellido) { setError('Nombre y apellido son requeridos'); return; }
    if (!form.whatsapp) { setError('WhatsApp es requerido'); return; }
    if (!hasUnit) { setError(isPasadia ? 'Debe seleccionar al menos una unidad' : 'Debe seleccionar una habitación'); return; }
    if (!form.plan_codigo) { setError('Debe seleccionar un plan'); return; }
    if (pastDateError) { setError(pastDateError); return; }
    if (dateError) { setError(dateError); return; }
    if (capacityError) { setError(capacityError); return; }

    // Check deposit step
    if (!showDeposit && cotizacion) {
      setShowDeposit(true);
      return;
    }

    setLoading(true);
    try {
      if (isPasadia && selectedUnits.length > 1) {
        // Create one reservation per selected unit
        let firstId: number | null = null;
        for (const unitId of selectedUnits) {
          const payload = { ...form, habitacion_id: unitId, notas: `${form.notas}\n[Pasadía grupo: ${selectedUnits.length} unidades]`.trim() };
          const r = await api.post('/hotel/reservas', payload);
          if (!firstId) firstId = r.data.id;
          // Deposit only on first reservation
          if (firstId === r.data.id && depositAmount && parseFloat(depositAmount) > 0) {
            await api.post(`/hotel/reservas/${r.data.id}/folio`, {
              monto: parseFloat(depositAmount),
              concepto: 'Depósito inicial (Pasadía)',
              tipo: 'credito',
              metodo_pago: depositMetodo,
              referencia: depositRef
            });
          }
        }
        navigate(`/reservas/${firstId}`);
      } else {
        // Single unit (Estadía or single Pasadía)
        const habId = isPasadia ? selectedUnits[0] : Number(form.habitacion_id);
        const payload = { ...form, habitacion_id: habId };
        const r = await api.post('/hotel/reservas', payload);
        if (depositAmount && parseFloat(depositAmount) > 0) {
          await api.post(`/hotel/reservas/${r.data.id}/folio`, {
            monto: parseFloat(depositAmount),
            concepto: 'Depósito inicial',
            tipo: 'credito',
            metodo_pago: depositMetodo,
            referencia: depositRef
          });
        }
        navigate(`/reservas/${r.data.id}`);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Nueva Reserva</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2"><AlertTriangle size={16} /> {error}</div>}

        {/* Category Selector */}
        <div className="flex gap-3">
          <button type="button" onClick={() => setCategoria('Estadía')}
            className={`flex-1 p-5 rounded-xl border-2 transition flex items-center justify-center gap-3 ${
              !isPasadia ? 'border-ocean-400 bg-ocean-50 ring-2 ring-ocean-200' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${!isPasadia ? 'bg-ocean-500' : 'bg-gray-200'}`}>
              <Moon size={22} className={!isPasadia ? 'text-white' : 'text-gray-500'} />
            </div>
            <div className="text-left">
              <div className={`font-bold text-lg ${!isPasadia ? 'text-ocean-700' : 'text-gray-600'}`}>🏨 Estadía</div>
              <div className="text-sm text-gray-400">Hospedaje • 1+ noches</div>
            </div>
          </button>
          <button type="button" onClick={() => setCategoria('Pasadía')}
            className={`flex-1 p-5 rounded-xl border-2 transition flex items-center justify-center gap-3 ${
              isPasadia ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-200' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isPasadia ? 'bg-amber-500' : 'bg-gray-200'}`}>
              <Sun size={22} className={isPasadia ? 'text-white' : 'text-gray-500'} />
            </div>
            <div className="text-left">
              <div className={`font-bold text-lg ${isPasadia ? 'text-amber-700' : 'text-gray-600'}`}>☀️ Pasadía</div>
              <div className="text-sm text-gray-400">Día de uso • 1 solo día</div>
            </div>
          </button>
        </div>

        {/* Step 1: Date & Availability */}
        <Section title={isPasadia ? '1. Fecha del Pasadía' : '1. Disponibilidad'} active={!showDeposit}>
          <div className={`grid grid-cols-1 ${isPasadia ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
            <Field label="Fuente">
              <select value={form.fuente} onChange={e => set('fuente', e.target.value)} className="input">
                <option>Teléfono</option><option>Email</option><option>Sitio web</option><option>Walk-in</option><option>Manual</option>
              </select>
            </Field>
            <Field label={isPasadia ? 'Fecha *' : 'Check-in *'}>
              <input type="date" value={form.check_in} onChange={e => set('check_in', e.target.value)}
                required className={`input ${pastDateError ? 'border-red-400 ring-1 ring-red-400' : ''}`} min={todayStr} />
            </Field>
            {!isPasadia && (
              <Field label="Check-out *">
                <input type="date" value={form.check_out} onChange={e => set('check_out', e.target.value)}
                  required className={`input ${dateError ? 'border-red-400 ring-1 ring-red-400' : ''}`}
                  min={form.check_in || todayStr} />
              </Field>
            )}
            <Field label="Hora llegada">
              <input type="time" value={form.hora_llegada} onChange={e => set('hora_llegada', e.target.value)} className="input" />
            </Field>
          </div>
          {isPasadia && form.check_in && (
            <div className="text-sm text-amber-600 mt-2 bg-amber-50 px-3 py-2 rounded-lg">
              ☀️ Día de uso: <strong>{form.check_in}</strong> — solo este día
            </div>
          )}
          {dateError && <div className="text-red-500 text-xs mt-1">{dateError}</div>}
          {pastDateError && <div className="text-red-500 text-xs mt-1">{pastDateError}</div>}

          {/* Room / Unit Selection */}
          {categoryRooms.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                {isPasadia ? 'Unidades *' : 'Habitación *'}
                <span className="text-gray-400 font-normal ml-1">
                  ({availableRooms.length} disponibles)
                  {isPasadia && selectedUnits.length > 0 && <span className="text-amber-600 ml-1">• {selectedUnits.length} seleccionada{selectedUnits.length > 1 ? 's' : ''}</span>}
                </span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {categoryRooms.map((r: any) => {
                  const maxCap = r.capacidad_max || r.capacidad || 4;
                  const minCap = r.capacidad_min || 1;
                  const fitsGuests = totalGuests >= minCap && totalGuests <= maxCap;
                  const isSelected = isPasadia ? selectedUnits.includes(r.id) : form.habitacion_id == r.id;
                  const accentColor = isPasadia ? 'amber' : 'ocean';
                  return (
                    <button key={r.id} type="button"
                      onClick={() => {
                        if (!r.disponible) return;
                        if (isPasadia) { toggleUnit(r.id); }
                        else { set('habitacion_id', r.id); }
                      }}
                      disabled={!r.disponible}
                      className={`p-3 rounded-lg border text-sm text-left transition ${
                        !r.disponible ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed opacity-50' :
                        isSelected ? (fitsGuests ? `bg-${accentColor}-50 border-${accentColor}-400 text-${accentColor}-700 ring-2 ring-${accentColor}-400` : 'bg-red-50 border-red-400 text-red-700 ring-2 ring-red-400') :
                        `bg-white border-gray-200 hover:border-${accentColor}-300 hover:bg-${accentColor}-50/30`
                      }`}>
                      <div className="font-semibold">{r.nombre}</div>
                      <div className="text-xs text-gray-400">{r.tipo} • {minCap}-{maxCap} pers.</div>
                      {r.descripcion_camas && <div className="text-xs text-gray-400">🛏️ {r.descripcion_camas}</div>}
                      {!r.disponible && <div className="text-xs text-red-300 mt-1">Ocupada</div>}
                      {r.disponible && isSelected && <div className="text-xs text-green-500 mt-1">✓ Seleccionada</div>}
                      {r.disponible && !isSelected && <div className="text-xs text-gray-300 mt-1">{isPasadia ? 'Click para agregar' : '✓ Disponible'}</div>}
                    </button>
                  );
                })}
              </div>
              {isPasadia && selectedUnits.length > 1 && (
                <div className="mt-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                  📋 Se crearán <strong>{selectedUnits.length} reservas</strong> separadas (una por unidad) vinculadas a este grupo.
                </div>
              )}
              {capacityError && (
                <div className="text-red-500 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> {capacityError}
                </div>
              )}
              {!hasUnit && categoryRooms.length > 0 && !capacityError && (
                <div className="text-amber-600 text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle size={12} /> {isPasadia ? 'Seleccione una o más unidades' : 'Seleccione una habitación para continuar'}
                </div>
              )}
            </div>
          )}

          {/* Plan & Guests */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <Field label="Plan *" className="md:col-span-2">
              <select value={form.plan_codigo} onChange={e => set('plan_codigo', e.target.value)} required className="input">
                <option value="">Seleccionar plan</option>
                {filteredPlanes.map((p: any) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nombre} — ${p.precio_adulto_noche}/{isPasadia ? 'persona' : 'noche'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={isPasadia ? 'Personas' : 'Adultos'}>
              <input type="number" min={1} max={50} value={form.adultos} onChange={e => set('adultos', +e.target.value)} className="input" />
            </Field>
            {!isPasadia && (
              <Field label="Menores">
                <input type="number" min={0} max={10} value={form.menores} onChange={e => set('menores', +e.target.value)} className="input" />
              </Field>
            )}
            {!isPasadia && (
              <Field label="Mascotas">
                <input type="number" min={0} max={5} value={form.mascotas} onChange={e => set('mascotas', +e.target.value)} className="input" />
              </Field>
            )}
          </div>
        </Section>

        {/* Cotización */}
        {cotizacion && (
          <div className={`bg-gradient-to-r ${isPasadia ? 'from-amber-50 to-mahana-50 border-amber-200' : 'from-ocean-50 to-mahana-50 border-ocean-200'} rounded-xl p-5 border`}>
            <h3 className="font-semibold text-gray-700 mb-3">Cotización {isPasadia && selectedUnits.length > 1 ? `(${selectedUnits.length} unidades)` : ''}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-gray-400">Plan:</span> <span className="font-medium">{cotizacion.plan.nombre}</span></div>
              <div><span className="text-gray-400">{isPasadia ? 'Tipo:' : 'Noches:'}</span> <span className="font-medium">{isPasadia ? 'Pasadía (1 día)' : cotizacion.noches}</span></div>
              <div><span className="text-gray-400">{isPasadia ? 'Personas:' : 'Huéspedes:'}</span> <span className="font-medium">{form.adultos}{!isPasadia ? ` A + ${form.menores}M` : ''}</span></div>
              {isPasadia && selectedUnits.length > 1 && <div><span className="text-gray-400">Unidades:</span> <span className="font-medium">{selectedUnits.length}</span></div>}
            </div>

            {/* Per-night breakdown */}
            {cotizacion.desglose?.length > 0 && !isPasadia && (
              <div className="mt-3 mb-1">
                <div className="text-xs font-semibold text-gray-500 mb-1">Desglose por noche:</div>
                <div className="space-y-1">
                  {cotizacion.desglose.map((n: any) => (
                    <div key={n.fecha} className="flex items-center justify-between text-xs bg-white/60 rounded-lg px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-mono w-20">{n.fecha}</span>
                        <span className="text-gray-600 w-8">{n.dia}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          n.tipo_dia === 'festivo' ? 'bg-red-100 text-red-600' :
                          n.tipo_dia === 'fin_de_semana' ? 'bg-orange-100 text-orange-600' :
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {n.tipo_dia === 'festivo' ? `🎊 ${n.festivo_nombre || 'Festivo'}` :
                           n.tipo_dia === 'fin_de_semana' ? '🎉 Fin de semana' : '📅 Entre semana'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-[10px]">${n.precio_adulto}/adulto</span>
                        <span className="font-bold text-gray-700">${n.total_noche.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <hr className="my-3 border-gray-200" />
            <div className="space-y-1 text-sm max-w-xs">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">${cotizacion.subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Impuesto {cotizacion.impuesto_pct}%</span><span>${cotizacion.impuesto_monto.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                <span>Total</span>
                <span className={isPasadia ? 'text-amber-700' : 'text-ocean-700'}>${cotizacion.monto_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs"><span>Depósito sugerido (50%)</span><span>${cotizacion.deposito_sugerido.toFixed(2)}</span></div>
            </div>
          </div>
        )}

        {/* Step 2: Guest Info */}
        <Section title={isPasadia ? '2. Contacto' : '2. Huésped Principal'} active={!showDeposit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Nombre *"><input value={form.cliente} onChange={e => set('cliente', e.target.value)} required className="input" placeholder="Nombre" /></Field>
            <Field label="Apellido *"><input value={form.apellido} onChange={e => set('apellido', e.target.value)} required className={`input ${!form.apellido && form.cliente ? 'border-amber-300' : ''}`} placeholder="Apellido" /></Field>
            {!isPasadia && <Field label="Nacionalidad"><input value={form.nacionalidad} onChange={e => set('nacionalidad', e.target.value)} className="input" placeholder="País" /></Field>}
            <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" placeholder="email@ejemplo.com" /></Field>
            <Field label="WhatsApp *"><input value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} required className={`input ${!form.whatsapp && form.cliente ? 'border-amber-300' : ''}`} placeholder="+507..." /></Field>
          </div>
        </Section>

        {/* Step 3: Notes */}
        <Section title="3. Notas" active={!showDeposit}>
          <textarea value={form.notas} onChange={e => set('notas', e.target.value)} className="input min-h-[80px]" placeholder="Notas adicionales..." />
        </Section>

        {/* Step 4: Deposit */}
        {showDeposit && cotizacion && (
          <Section title="4. Registro de Abono" active={true}>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-700 flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>Depósito sugerido: <strong>${cotizacion.deposito_sugerido.toFixed(2)}</strong> (50% del total). Puede registrar un abono ahora o dejarlo en $0.</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Monto del abono">
                <input type="number" step="0.01" min="0" value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)} className="input" placeholder="0.00" />
              </Field>
              <Field label="Método de pago">
                <select value={depositMetodo} onChange={e => setDepositMetodo(e.target.value)} className="input">
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="yappy">Yappy</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="paypal">PayPal</option>
                </select>
              </Field>
              <Field label="Referencia">
                <input value={depositRef} onChange={e => setDepositRef(e.target.value)} className="input" placeholder="# recibo" />
              </Field>
            </div>
          </Section>
        )}

        <div className="flex gap-3 justify-end">
          {showDeposit && (
            <button type="button" onClick={() => setShowDeposit(false)} className="px-5 py-3 text-gray-500 hover:bg-gray-100 rounded-xl transition text-sm">
              ← Volver a editar
            </button>
          )}
          <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancelar</button>
          <button type="submit" disabled={loading || !canSubmit}
            className={`px-8 py-3 text-white font-semibold rounded-xl hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
              isPasadia ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-mahana-500 to-mahana-600'
            }`}>
            {loading ? 'Creando...' : showDeposit
              ? `✓ Confirmar ${isPasadia ? 'Pasadía' : 'Reserva'}${isPasadia && selectedUnits.length > 1 ? ` (${selectedUnits.length})` : ''}`
              : 'Continuar →'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children, active = true }: { title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm transition ${!active ? 'opacity-60' : ''}`}>
      <h2 className="font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
