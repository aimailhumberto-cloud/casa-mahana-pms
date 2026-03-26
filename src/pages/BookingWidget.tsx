import { useState, useEffect, useRef } from 'react'
import { Calendar, Users, ChevronRight, Check, CreditCard, Loader2, MapPin, Star, Shield } from 'lucide-react'

const API = '/api/v1/public'

type RoomType = { tipo: string; categoria: string; capacidad_min: number; capacidad_max: number; total: number; disponibles: number }
type Plan = { id: number; codigo: string; nombre: string; descripcion: string; precio_adulto_noche: number; precio_menor_noche: number; incluye: string[]; horario: string; extras_disponibles: string[] }
type Cotizacion = { plan: { codigo: string; nombre: string }; noches: number; subtotal: number; impuesto_pct: number; impuesto_monto: number; monto_total: number; deposito_minimo: number; deposito_pct: number; desglose: { fecha: string; dia: string; tipo_dia: string; precio_adulto: number; total_noche: number }[] }

function PayPalButtons({ clientId, mode, monto, descripcion, onSuccess, onError }: {
  clientId: string; mode: string; monto: number; descripcion: string; onSuccess: (orderId: string) => void; onError: (msg: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const existing = document.getElementById('paypal-sdk')
    if (existing) { setSdkReady(true); setLoading(false); return }
    const script = document.createElement('script')
    script.id = 'paypal-sdk'
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture&enable-funding=card`
    script.onload = () => { setSdkReady(true); setLoading(false) }
    script.onerror = () => { onError('Error cargando PayPal'); setLoading(false) }
    document.head.appendChild(script)
  }, [clientId])

  useEffect(() => {
    if (!sdkReady || !containerRef.current || !(window as any).paypal) return
    containerRef.current.innerHTML = ''
    ;(window as any).paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 45 },
      createOrder: async () => {
        const resp = await fetch(`${API}/paypal/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monto, descripcion }) })
        const data = await resp.json()
        if (data.success) return data.data.orderId
        throw new Error(data.error?.message || 'Error creando orden')
      },
      onApprove: async (data: any) => {
        const resp = await fetch(`${API}/paypal/capture-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: data.orderID }) })
        const result = await resp.json()
        if (result.success && result.data.status === 'COMPLETED') { onSuccess(data.orderID) }
        else { onError('Pago no completado') }
      },
      onError: () => onError('Error en PayPal')
    }).render(containerRef.current)
  }, [sdkReady, monto])

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-amber-600" /></div>
  return <div ref={containerRef} />
}

export default function BookingWidget() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Step 1: dates
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adultos, setAdultos] = useState(1)
  const [menores, setMenores] = useState(0)
  // Step 2: room types
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [selectedType, setSelectedType] = useState('')
  // Step 3: plans
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  // Step 4: cotizacion
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [pagoTipo, setPagoTipo] = useState<'deposito' | 'total'>('deposito')
  // Step 5: guest info
  const [guest, setGuest] = useState({ nombre: '', apellido: '', email: '', whatsapp: '', nacionalidad: '' })
  // PayPal
  const [paypalConfig, setPaypalConfig] = useState<{ paypal_enabled: boolean; paypal_client_id: string | null; paypal_mode: string }>({ paypal_enabled: false, paypal_client_id: null, paypal_mode: 'sandbox' })
  // Result
  const [result, setResult] = useState<{ reserva_id?: number; mensaje?: string } | null>(null)

  useEffect(() => {
    fetch(`${API}/paypal-config`).then(r => r.json()).then(d => { if (d.success) setPaypalConfig(d.data) })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const minCheckOut = checkIn ? new Date(new Date(checkIn + 'T12:00:00').getTime() + 86400000).toISOString().split('T')[0] : today

  // Step 1: Check availability
  const checkAvailability = async () => {
    setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/disponibilidad?check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      if (data.data.tipos_disponibles.length === 0) { setError('No hay disponibilidad para esas fechas. Intenta con otras fechas.'); return }
      setRoomTypes(data.data.tipos_disponibles)
      setStep(2)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  // Step 2: Select room type → load plans
  const selectRoomType = async (tipo: string) => {
    setSelectedType(tipo); setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/planes?tipo=${tipo}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      setPlans(data.data)
      setStep(3)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  // Step 3: Select plan → cotizar
  const selectPlan = async (plan: Plan) => {
    setSelectedPlan(plan); setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/cotizar?plan=${plan.codigo}&adultos=${adultos}&menores=${menores}&check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      setCotizacion(data.data)
      setStep(4)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  // Step 5: After PayPal → create reservation
  const createReservation = async (paypalOrderId: string) => {
    setLoading(true); setError('')
    const montoPagar = pagoTipo === 'total' ? cotizacion!.monto_total : cotizacion!.deposito_minimo
    try {
      const resp = await fetch(`${API}/reservar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: guest.nombre, apellido: guest.apellido, email: guest.email, whatsapp: guest.whatsapp, nacionalidad: guest.nacionalidad,
          check_in: checkIn, check_out: checkOut, tipo_habitacion: selectedType, plan_codigo: selectedPlan!.codigo,
          adultos, menores, monto_pagado: montoPagar, paypal_order_id: paypalOrderId, pago_tipo: pagoTipo
        })
      })
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error creando reserva'); return }
      setResult(data.data)
      setStep(6)
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  const isGuestValid = guest.nombre && guest.email && guest.apellido

  const montoPagar = cotizacion ? (pagoTipo === 'total' ? cotizacion.monto_total : cotizacion.deposito_minimo) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-yellow-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">🌴 Casa Mahana</h1>
          <p className="text-amber-200 mt-1">Reserva tu experiencia en Chame, Panamá</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between text-xs font-medium">
          {['Fechas', 'Habitación', 'Tarifa', 'Resumen', 'Pago', 'Confirmado'].map((label, i) => (
            <div key={i} className={`flex items-center gap-1 ${step > i + 1 ? 'text-green-600' : step === i + 1 ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}>
                {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full mt-3">
          <div className="h-full bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-all duration-500" style={{ width: `${(step / 6) * 100}%` }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

        {/* STEP 1: Dates */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-6"><Calendar className="w-5 h-5 text-amber-600" /> Selecciona tus fechas</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Check-in</label>
                <input type="date" min={today} value={checkIn} onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Check-out</label>
                <input type="date" min={minCheckOut} value={checkOut} onChange={e => setCheckOut(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400 focus:border-transparent" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1"><Users className="w-4 h-4 inline mr-1" />Adultos</label>
                <select value={adultos} onChange={e => setAdultos(+e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Menores</label>
                <select value={menores} onChange={e => setMenores(+e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200">
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <button disabled={!checkIn || !checkOut || loading} onClick={checkAvailability}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Ver Disponibilidad</span><ChevronRight className="w-5 h-5" /></>}
            </button>
          </div>
        )}

        {/* STEP 2: Room Type Selection */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Habitaciones disponibles</h2>
            <p className="text-sm text-gray-500 mb-6">{checkIn} → {checkOut}</p>
            <div className="space-y-3">
              {roomTypes.map(rt => (
                <button key={rt.tipo} onClick={() => selectRoomType(rt.tipo)}
                  className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-amber-400 hover:bg-amber-50 transition text-left flex items-center justify-between group">
                  <div>
                    <h3 className="font-bold text-gray-800">{rt.tipo === 'Familiar' ? '🏠' : rt.tipo === 'Doble' ? '🛏️' : rt.tipo === 'Estándar' ? '🏡' : '🏕️'} {rt.tipo}</h3>
                    <p className="text-sm text-gray-500">{rt.capacidad_min}–{rt.capacidad_max} personas • {rt.disponibles} disponible{rt.disponibles > 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-amber-600 transition" />
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="mt-4 text-sm text-amber-600 hover:underline">← Cambiar fechas</button>
          </div>
        )}

        {/* STEP 3: Plan Selection */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Selecciona tu tarifa</h2>
            <p className="text-sm text-gray-500 mb-6">Habitación {selectedType} • {checkIn} → {checkOut}</p>
            <div className="space-y-4">
              {plans.map(plan => (
                <button key={plan.codigo} onClick={() => selectPlan(plan)}
                  className="w-full p-5 rounded-xl border-2 border-gray-100 hover:border-amber-400 hover:shadow-md transition text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">{plan.nombre}</h3>
                      <p className="text-sm text-gray-500 mt-1">{plan.descripcion}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-amber-700">${plan.precio_adulto_noche}</p>
                      <p className="text-xs text-gray-400">/adulto/noche</p>
                    </div>
                  </div>
                  {plan.incluye?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {plan.incluye.map((item, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">✓ {item}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="mt-4 text-sm text-amber-600 hover:underline">← Cambiar habitación</button>
          </div>
        )}

        {/* STEP 4: Cotización + Guest Info */}
        {step === 4 && cotizacion && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen de tu reserva</h2>
              <div className="bg-amber-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-600">Habitación</span><span className="font-medium">{selectedType}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Plan</span><span className="font-medium">{cotizacion.plan.nombre}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Fechas</span><span className="font-medium">{checkIn} → {checkOut} ({cotizacion.noches} noches)</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Huéspedes</span><span className="font-medium">{adultos} adulto{adultos > 1 ? 's' : ''}{menores > 0 ? ` + ${menores} menor${menores > 1 ? 'es' : ''}` : ''}</span></div>
                <hr className="border-amber-200" />
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium">${cotizacion.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Impuesto ({cotizacion.impuesto_pct}%)</span><span className="font-medium">${cotizacion.impuesto_monto.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-bold text-amber-800 pt-1"><span>Total</span><span>${cotizacion.monto_total.toFixed(2)}</span></div>
              </div>

              {/* Payment option */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-600 mb-2">¿Cuánto deseas pagar?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPagoTipo('deposito')}
                    className={`p-3 rounded-xl border-2 text-center transition ${pagoTipo === 'deposito' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300'}`}>
                    <p className="font-bold text-amber-700">${cotizacion.deposito_minimo.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Depósito {cotizacion.deposito_pct}%</p>
                  </button>
                  <button onClick={() => setPagoTipo('total')}
                    className={`p-3 rounded-xl border-2 text-center transition ${pagoTipo === 'total' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300'}`}>
                    <p className="font-bold text-amber-700">${cotizacion.monto_total.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">Pago total</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Guest Info */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Datos del huésped</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nombre *</label>
                  <input type="text" value={guest.nombre} onChange={e => setGuest({ ...guest, nombre: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Apellido *</label>
                  <input type="text" value={guest.apellido} onChange={e => setGuest({ ...guest, apellido: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400" placeholder="Pérez" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email *</label>
                  <input type="email" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400" placeholder="juan@email.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">WhatsApp</label>
                  <input type="tel" value={guest.whatsapp} onChange={e => setGuest({ ...guest, whatsapp: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400" placeholder="+507 6XXX-XXXX" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nacionalidad</label>
                  <input type="text" value={guest.nacionalidad} onChange={e => setGuest({ ...guest, nacionalidad: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400" placeholder="Panameño" />
                </div>
              </div>
              <button disabled={!isGuestValid} onClick={() => setStep(5)}
                className="w-full mt-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold rounded-xl hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" /> Continuar al pago
              </button>
            </div>
            <button onClick={() => setStep(3)} className="text-sm text-amber-600 hover:underline">← Cambiar tarifa</button>
          </div>
        )}

        {/* STEP 5: PayPal Payment */}
        {step === 5 && cotizacion && (
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-amber-100">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-600" /> Pago seguro</h2>
            <div className="bg-amber-50 rounded-xl p-4 mb-6 text-center">
              <p className="text-sm text-gray-600">{pagoTipo === 'total' ? 'Pago total' : `Depósito (${cotizacion.deposito_pct}%)`}</p>
              <p className="text-3xl font-bold text-amber-800">${montoPagar.toFixed(2)} USD</p>
              {pagoTipo === 'deposito' && <p className="text-xs text-gray-500 mt-1">Saldo restante: ${(cotizacion.monto_total - montoPagar).toFixed(2)} (se paga en check-in)</p>}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 justify-center">
              <Shield className="w-4 h-4" /> Pago seguro procesado por PayPal
            </div>
            {paypalConfig.paypal_enabled && paypalConfig.paypal_client_id ? (
              <PayPalButtons clientId={paypalConfig.paypal_client_id} mode={paypalConfig.paypal_mode}
                monto={montoPagar} descripcion={`Casa Mahana - ${selectedPlan?.nombre} (${cotizacion.noches} noches)`}
                onSuccess={(orderId) => createReservation(orderId)}
                onError={(msg) => setError(msg)} />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="font-medium">PayPal no configurado</p>
                <p className="text-sm mt-1">Contacta al hotel directamente para reservar</p>
                <a href="https://wa.me/50760000000" className="mt-3 inline-block px-6 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600">WhatsApp</a>
              </div>
            )}
            <button onClick={() => setStep(4)} className="mt-4 text-sm text-amber-600 hover:underline block mx-auto">← Volver al resumen</button>
          </div>
        )}

        {/* STEP 6: Confirmation */}
        {step === 6 && result && (
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-green-200 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 mb-2">¡Reserva recibida!</h2>
            <p className="text-gray-600 mb-4">{result.mensaje}</p>
            <div className="bg-green-50 rounded-xl p-4 inline-block">
              <p className="text-sm text-gray-500">Número de referencia</p>
              <p className="text-2xl font-bold text-green-700">#{result.reserva_id}</p>
            </div>
            <div className="mt-6 space-y-2 text-sm text-gray-500">
              <p className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4" /> Casa Mahana, Chame, Panamá</p>
              <p className="flex items-center justify-center gap-2"><Star className="w-4 h-4" /> Recibirás confirmación por email a {guest.email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-gray-400">
        © {new Date().getFullYear()} Casa Mahana · Chame, Panamá
      </div>
    </div>
  )
}
