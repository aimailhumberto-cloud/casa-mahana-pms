import { useState, useEffect, useRef } from 'react'
import { Calendar, Users, ChevronRight, Check, CreditCard, Loader2, MapPin, Star, Shield, ArrowLeft, Bed, Coffee, Sun, Waves, Clock, Mail, Phone, Globe } from 'lucide-react'

const API = '/api/v1/public'

type RoomType = { tipo: string; categoria: string; capacidad_min: number; capacidad_max: number; total: number; disponibles: number }
type Plan = { id: number; codigo: string; nombre: string; descripcion: string; precio_adulto_noche: number; precio_menor_noche: number; incluye: string[]; horario: string; extras_disponibles: string[]; imagen: string | null }
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
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 50 },
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

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
  return <div ref={containerRef} />
}

// Room type icon mapping
const roomIcons: Record<string, typeof Bed> = { 'Familiar': Bed, 'Doble': Bed, 'Estándar': Bed, 'Camping': Sun }
const defaultRoomImages: Record<string, string> = {
  'Familiar': 'https://images.unsplash.com/photo-1590490360182-c72a1b3c73b6?w=400&h=250&fit=crop',
  'Doble': 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=250&fit=crop',
  'Estándar': 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400&h=250&fit=crop',
  'Camping': 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=250&fit=crop',
}

export default function BookingWidget() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [adultos, setAdultos] = useState(1)
  const [menores, setMenores] = useState(0)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [pagoTipo, setPagoTipo] = useState<'deposito' | 'total'>('deposito')
  const [guest, setGuest] = useState({ nombre: '', apellido: '', email: '', whatsapp: '', nacionalidad: '' })
  const [paypalConfig, setPaypalConfig] = useState<{ paypal_enabled: boolean; paypal_client_id: string | null; paypal_mode: string }>({ paypal_enabled: false, paypal_client_id: null, paypal_mode: 'sandbox' })
  const [result, setResult] = useState<{ reserva_id?: number; mensaje?: string } | null>(null)
  const [tipoFotos, setTipoFotos] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`${API}/paypal-config`).then(r => r.json()).then(d => { if (d.success) setPaypalConfig(d.data) })
    fetch(`${API}/tipo-fotos`).then(r => r.json()).then(d => { if (d.success) setTipoFotos(d.data) })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const minCheckOut = checkIn ? new Date(new Date(checkIn + 'T12:00:00').getTime() + 86400000).toISOString().split('T')[0] : today
  const noches = checkIn && checkOut ? Math.ceil((new Date(checkOut + 'T12:00:00').getTime() - new Date(checkIn + 'T12:00:00').getTime()) / 86400000) : 0

  const checkAvailability = async () => {
    setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/disponibilidad?check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      if (data.data.tipos_disponibles.length === 0) { setError('No hay disponibilidad para esas fechas. Prueba con otras fechas.'); return }
      setRoomTypes(data.data.tipos_disponibles); setStep(2)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const selectRoomType = async (tipo: string) => {
    setSelectedType(tipo); setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/planes?tipo=${tipo}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      setPlans(data.data); setStep(3)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const selectPlan = async (plan: Plan) => {
    setSelectedPlan(plan); setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/cotizar?plan=${plan.codigo}&adultos=${adultos}&menores=${menores}&check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      setCotizacion(data.data); setStep(4)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

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
      setResult(data.data); setStep(6)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const isGuestValid = guest.nombre && guest.email && guest.apellido
  const montoPagar = cotizacion ? (pagoTipo === 'total' ? cotizacion.monto_total : cotizacion.deposito_minimo) : 0
  const planImage = selectedPlan?.imagen || tipoFotos[selectedType] || defaultRoomImages[selectedType] || defaultRoomImages['Familiar']

  const stepLabels = ['Fechas', 'Habitación', 'Tarifa', 'Resumen', 'Pago', 'Confirmado']

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fefbf3 0%, #fdf4e3 30%, #fef9ef 60%, #fffcf5 100%)' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #78350f 0%, #92400e 40%, #a16207 100%)' }} className="text-white shadow-xl">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-4">
          <img src="/logo.png" alt="Casa Mahana" className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover shadow-lg border-2 border-white/20" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>Casa Mahana</h1>
            <p className="text-amber-200/80 text-sm mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Chame, Panamá
            </p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between text-xs font-medium mb-2">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                step > i + 1 ? 'bg-emerald-500 text-white shadow-md' : step === i + 1 ? 'bg-amber-700 text-white shadow-lg ring-4 ring-amber-200' : 'bg-gray-200 text-gray-400'
              }`}>{step > i + 1 ? <Check className="w-4 h-4" /> : i + 1}</div>
              <span className={`hidden sm:block ${step === i + 1 ? 'text-amber-800 font-bold' : 'text-gray-400'}`}>{label}</span>
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-200/60 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${(step / 6) * 100}%`, background: 'linear-gradient(90deg, #92400e, #d97706, #f59e0b)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {error && (
          <div className="mb-5 p-4 rounded-2xl border border-red-200 text-red-700 text-sm flex items-start gap-3" style={{ background: 'linear-gradient(135deg, #fef2f2, #fff5f5)' }}>
            <span className="text-red-400 text-lg mt-0.5">!</span>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Dates */}
        {step === 1 && (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Calendar className="w-5 h-5 text-amber-700" /></div>
              <div><h2 className="text-xl font-bold text-gray-800">Selecciona tus fechas</h2><p className="text-sm text-gray-400">Planifica tu estadía perfecta</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Check-in</label>
                <input type="date" min={today} value={checkIn} onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut('') }}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white transition text-gray-700" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Check-out</label>
                <input type="date" min={minCheckOut} value={checkOut} onChange={e => setCheckOut(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white transition text-gray-700" />
              </div>
            </div>
            {noches > 0 && <p className="text-sm text-amber-700 font-medium mb-4 flex items-center gap-1.5"><Clock className="w-4 h-4" /> {noches} noche{noches > 1 ? 's' : ''}</p>}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"><Users className="w-3.5 h-3.5 inline mr-1" />Adultos</label>
                <select value={adultos} onChange={e => setAdultos(+e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 text-gray-700">
                  {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} adulto{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Menores</label>
                <select value={menores} onChange={e => setMenores(+e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 text-gray-700">
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n} menor{n !== 1 ? 'es' : ''}</option>)}
                </select>
              </div>
            </div>
            <button disabled={!checkIn || !checkOut || loading} onClick={checkAvailability}
              className="w-full py-4 text-white font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2 text-lg"
              style={{ background: 'linear-gradient(135deg, #78350f, #92400e, #a16207)' }}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Ver Disponibilidad</span><ChevronRight className="w-5 h-5" /></>}
            </button>
            {/* Trust badges */}
            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> Pago seguro</span>
              <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Confirmación inmediata</span>
              <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Sin cargos ocultos</span>
            </div>
          </div>
        )}

        {/* STEP 2: Room Type */}
        {step === 2 && (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Bed className="w-5 h-5 text-amber-700" /></div>
              <div><h2 className="text-xl font-bold text-gray-800">Elige tu habitación</h2></div>
            </div>
            <p className="text-sm text-gray-400 mb-6 ml-[52px]">{noches} noche{noches > 1 ? 's' : ''} · {adultos} adulto{adultos > 1 ? 's' : ''}{menores > 0 ? ` · ${menores} menor${menores > 1 ? 'es' : ''}` : ''}</p>
            <div className="space-y-4">
              {roomTypes.map(rt => {
                const Icon = roomIcons[rt.tipo] || Bed
                const img = tipoFotos[rt.tipo] || defaultRoomImages[rt.tipo] || defaultRoomImages['Familiar']
                return (
                  <button key={rt.tipo} onClick={() => selectRoomType(rt.tipo)}
                    className="w-full rounded-2xl border border-gray-100 hover:border-amber-300 hover:shadow-lg transition-all duration-200 text-left overflow-hidden group">
                    <div className="flex flex-col sm:flex-row">
                      <div className="sm:w-44 h-32 sm:h-auto overflow-hidden">
                        <img src={img} alt={rt.tipo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                      <div className="flex-1 p-4 sm:p-5 flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Icon className="w-5 h-5 text-amber-600" /> {rt.tipo}</h3>
                          <p className="text-sm text-gray-500 mt-1">{rt.capacidad_min}–{rt.capacidad_max} huéspedes</p>
                          <p className="text-xs text-emerald-600 mt-1 font-medium">{rt.disponibles} disponible{rt.disponibles > 1 ? 's' : ''}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-amber-600 transition" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <button onClick={() => setStep(1)} className="mt-5 text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Cambiar fechas</button>
          </div>
        )}

        {/* STEP 3: Plan Selection */}
        {step === 3 && (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Coffee className="w-5 h-5 text-amber-700" /></div>
              <div><h2 className="text-xl font-bold text-gray-800">Elige tu experiencia</h2></div>
            </div>
            <p className="text-sm text-gray-400 mb-6 ml-[52px]">Habitación {selectedType} · {noches} noche{noches > 1 ? 's' : ''}</p>
            <div className="space-y-4">
              {plans.map(plan => (
                <button key={plan.codigo} onClick={() => selectPlan(plan)}
                  className="w-full rounded-2xl border border-gray-100 hover:border-amber-300 hover:shadow-lg transition-all duration-200 text-left overflow-hidden group">
                  <div className="flex flex-col sm:flex-row">
                    {(plan.imagen || defaultRoomImages[selectedType]) && (
                      <div className="sm:w-44 h-36 sm:h-auto overflow-hidden">
                        <img src={plan.imagen || defaultRoomImages[selectedType]} alt={plan.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    )}
                    <div className="flex-1 p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-gray-800">{plan.nombre}</h3>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-2xl font-bold text-amber-800">${plan.precio_adulto_noche}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide">por adulto / noche</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{plan.descripcion}</p>
                      {plan.incluye?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {plan.incluye.map((item, i) => (
                            <span key={i} className="text-[11px] px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium flex items-center gap-1">
                              <Check className="w-3 h-3" /> {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="mt-5 text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Cambiar habitación</button>
          </div>
        )}

        {/* STEP 4: Summary + Guest Info */}
        {step === 4 && cotizacion && (
          <div className="space-y-5">
            {/* Photo + Summary Card */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-amber-100/50">
              {planImage && (
                <div className="h-48 sm:h-56 overflow-hidden relative">
                  <img src={planImage} alt={selectedPlan?.nombre} className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%)' }} />
                  <div className="absolute bottom-4 left-5 text-white">
                    <h3 className="text-xl font-bold">{selectedPlan?.nombre}</h3>
                    <p className="text-white/70 text-sm">{selectedType} · {noches} noche{noches > 1 ? 's' : ''}</p>
                  </div>
                </div>
              )}
              <div className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">Resumen de tu reserva</h2>
                <div className="rounded-2xl p-4 space-y-2.5 text-sm" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
                  <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Fechas</span><span className="font-semibold text-gray-700">{checkIn} — {checkOut}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Huéspedes</span><span className="font-semibold text-gray-700">{adultos} adulto{adultos > 1 ? 's' : ''}{menores > 0 ? `, ${menores} menor${menores > 1 ? 'es' : ''}` : ''}</span></div>
                  <hr className="border-amber-200/50" />
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold text-gray-700">${cotizacion.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Impuesto ({cotizacion.impuesto_pct}%)</span><span className="font-semibold text-gray-700">${cotizacion.impuesto_monto.toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-bold text-amber-900 pt-1 border-t border-amber-200/50"><span>Total</span><span>${cotizacion.monto_total.toFixed(2)}</span></div>
                </div>

                <div className="mt-5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modalidad de pago</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPagoTipo('deposito')}
                      className={`p-4 rounded-2xl border-2 text-center transition-all ${pagoTipo === 'deposito' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                      <p className="text-xl font-bold text-amber-800">${cotizacion.deposito_minimo.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Depósito {cotizacion.deposito_pct}%</p>
                    </button>
                    <button onClick={() => setPagoTipo('total')}
                      className={`p-4 rounded-2xl border-2 text-center transition-all ${pagoTipo === 'total' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                      <p className="text-xl font-bold text-amber-800">${cotizacion.monto_total.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Pago completo</p>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Guest Info */}
            <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100/50">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Users className="w-5 h-5 text-amber-700" /></div>
                <h2 className="text-lg font-bold text-gray-800">Datos del huésped principal</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nombre *</label>
                  <input type="text" value={guest.nombre} onChange={e => setGuest({ ...guest, nombre: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:bg-white transition" placeholder="Juan" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Apellido *</label>
                  <input type="text" value={guest.apellido} onChange={e => setGuest({ ...guest, apellido: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:bg-white transition" placeholder="Pérez" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"><Mail className="w-3 h-3 inline mr-1" />Email *</label>
                  <input type="email" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:bg-white transition" placeholder="juan@email.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"><Phone className="w-3 h-3 inline mr-1" />WhatsApp</label>
                  <input type="tel" value={guest.whatsapp} onChange={e => setGuest({ ...guest, whatsapp: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:bg-white transition" placeholder="+507 6XXX-XXXX" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"><Globe className="w-3 h-3 inline mr-1" />Nacionalidad</label>
                  <input type="text" value={guest.nacionalidad} onChange={e => setGuest({ ...guest, nacionalidad: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:bg-white transition" placeholder="Panameño" />
                </div>
              </div>
              <button disabled={!isGuestValid} onClick={() => setStep(5)}
                className="w-full mt-6 py-4 text-white font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2 text-lg"
                style={{ background: 'linear-gradient(135deg, #78350f, #92400e, #a16207)' }}>
                <CreditCard className="w-5 h-5" /> Continuar al pago
              </button>
            </div>
            <button onClick={() => setStep(3)} className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Cambiar tarifa</button>
          </div>
        )}

        {/* STEP 5: PayPal */}
        {step === 5 && cotizacion && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-amber-100/50">
            {planImage && (
              <div className="h-32 overflow-hidden relative">
                <img src={planImage} alt={selectedPlan?.nombre} className="w-full h-full object-cover" style={{ filter: 'brightness(0.7)' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <p className="text-sm opacity-80">{pagoTipo === 'total' ? 'Pago completo' : `Depósito (${cotizacion.deposito_pct}%)`}</p>
                    <p className="text-4xl font-bold">${montoPagar.toFixed(2)} <span className="text-base font-normal opacity-70">USD</span></p>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5 justify-center">
                <Shield className="w-5 h-5 text-emerald-500" />
                <span className="text-sm text-gray-500">Pago seguro procesado por PayPal</span>
              </div>
              {pagoTipo === 'deposito' && (
                <p className="text-center text-xs text-gray-400 mb-5">Saldo restante de <b>${(cotizacion.monto_total - montoPagar).toFixed(2)}</b> se cancela en check-in</p>
              )}
              {paypalConfig.paypal_enabled && paypalConfig.paypal_client_id ? (
                <PayPalButtons clientId={paypalConfig.paypal_client_id} mode={paypalConfig.paypal_mode}
                  monto={montoPagar} descripcion={`Casa Mahana - ${selectedPlan?.nombre} (${cotizacion.noches} noches)`}
                  onSuccess={(orderId) => createReservation(orderId)}
                  onError={(msg) => setError(msg)} />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="font-medium">Sistema de pago no disponible temporalmente</p>
                  <p className="text-sm mt-2">Contacta directamente al hotel para confirmar tu reserva</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <a href="https://wa.me/50760000000" className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition flex items-center gap-2"><Phone className="w-4 h-4" /> WhatsApp</a>
                    <a href="mailto:info@casamahana.com" className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition flex items-center gap-2"><Mail className="w-4 h-4" /> Email</a>
                  </div>
                </div>
              )}
              <button onClick={() => setStep(4)} className="mt-5 text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1 mx-auto"><ArrowLeft className="w-4 h-4" /> Volver al resumen</button>
            </div>
          </div>
        )}

        {/* STEP 6: Confirmation */}
        {step === 6 && result && (
          <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 border border-emerald-200 text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)' }}>
              <Check className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-700 mb-2">Reserva recibida</h2>
            <p className="text-gray-500 mb-6">{result.mensaje}</p>
            <div className="rounded-2xl p-5 inline-block" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)' }}>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Número de referencia</p>
              <p className="text-3xl font-bold text-emerald-700">#{result.reserva_id}</p>
            </div>
            <div className="mt-8 space-y-2.5 text-sm text-gray-400">
              <p className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4" /> Casa Mahana, Chame, Panamá</p>
              <p className="flex items-center justify-center gap-2"><Mail className="w-4 h-4" /> Confirmación enviada a <b className="text-gray-600">{guest.email}</b></p>
              <p className="flex items-center justify-center gap-2"><Clock className="w-4 h-4" /> Nuestro equipo revisará tu reserva en las próximas horas</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-gray-400 space-y-1">
        <p>&copy; {new Date().getFullYear()} Casa Mahana · Chame, Panamá</p>
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> SSL Seguro</span>
          <span className="flex items-center gap-1"><Waves className="w-3 h-3" /> A 1 hora de Ciudad de Panamá</span>
        </div>
      </footer>
    </div>
  )
}
