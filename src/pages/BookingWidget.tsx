import { useState, useEffect, useRef } from 'react'
import { Calendar, Users, ChevronRight, Check, CreditCard, Loader2, MapPin, Star, Shield, ArrowLeft, Bed, Coffee, Sun, Waves, Clock, Mail, Phone, Globe, Upload } from 'lucide-react'

const API = '/api/v1/public'

type RoomType = { tipo: string; categoria: string; capacidad_min: number; capacidad_max: number; total: number; disponibles: number }
type Plan = { id: number; codigo: string; nombre: string; descripcion: string; precio_adulto_noche: number; precio_menor_noche: number; incluye: string[]; horario: string; extras_disponibles: string[]; imagen: string | null }
type Cotizacion = { plan: { codigo: string; nombre: string }; noches: number; subtotal: number; impuesto_pct: number; impuesto_monto: number; monto_total: number; deposito_minimo: number; deposito_pct: number; desglose: { fecha: string; dia: string; tipo_dia: string; precio_adulto: number; total_noche: number }[] }
type RoomAllocation = { tipo: string; adultos: number; menores: number; mascotas: number }

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
        try {
          const resp = await fetch(`${API}/paypal/create-order`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ monto, descripcion }) 
          })
          const data = await resp.json()
          if (data.success && data.data?.orderId) return data.data.orderId
          throw new Error(data.error?.message || 'Error al generar la orden de cobro')
        } catch (err: any) {
          onError(err.message || 'Error al conectar con la pasarela de PayPal')
          throw err
        }
      },
      onApprove: async (data: any) => {
        try {
          const resp = await fetch(`${API}/paypal/capture-order`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ orderId: data.orderID }) 
          })
          const result = await resp.json()
          if (result.success && result.data?.status === 'COMPLETED') { 
            onSuccess(data.orderID) 
          } else { 
            throw new Error(result.error?.message || 'La captura del pago no fue completada por PayPal') 
          }
        } catch (err: any) {
          onError(err.message || 'Error al capturar el pago en el servidor')
        }
      },
      onError: (err: any) => {
        console.error('PayPal SDK error:', err)
        onError('Fallo o cancelación en la pasarela de PayPal')
      }
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
type CartItem = {
  id: string;
  tipo: string;
  plan: Plan;
  adultos: number;
  menores: number;
  mascotas: number;
  subtotal: number;
  impuesto_monto: number;
  monto_total: number;
  deposito_minimo: number;
}

export default function BookingWidget() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [categoria, setCategoria] = useState<'Estadía' | 'Pasadía'>('Estadía')
  const [adultos, setAdultos] = useState(1)
  const [menores, setMenores] = useState(0)
  const [mascotas, setMascotas] = useState(0)
  const [adultosBuscados, setAdultosBuscados] = useState(1)
  const [menoresBuscados, setMenoresBuscados] = useState(0)
  const [mascotasBuscadas, setMascotasBuscadas] = useState(0)
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [selectedType, setSelectedType] = useState('')
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [pagoTipo, setPagoTipo] = useState<'deposito' | 'total'>('deposito')
  const [guest, setGuest] = useState({ nombre: '', apellido: '', email: '', whatsapp: '', nacionalidad: '' })
  const [paypalConfig, setPaypalConfig] = useState<{ paypal_enabled: boolean; paypal_client_id: string | null; paypal_mode: string }>({ paypal_enabled: false, paypal_client_id: null, paypal_mode: 'sandbox' })
  const [result, setResult] = useState<{ reserva_id?: number; mensaje?: string; grupo_codigo?: string } | null>(null)
  const [tipoFotos, setTipoFotos] = useState<Record<string, string>>({})

  // Multi-room Shopping Cart states
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartItemAdults, setCartItemAdults] = useState(1)
  const [cartItemMinors, setCartItemMinors] = useState(0)
  const [cartItemPets, setCartItemPets] = useState(0)

  // Plan fetching per room type
  const [allRoomPlans, setAllRoomPlans] = useState<Record<string, Plan[]>>({})
  const [selectedPlans, setSelectedPlans] = useState<Record<string, Plan>>({})

  // Offline Payment states
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string>('paypal')
  const [reference, setReference] = useState('')

  useEffect(() => {
    if (!receiptFile) {
      setPreviewUrl(null)
      return
    }
    if (receiptFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(receiptFile)
    } else {
      setPreviewUrl(null)
    }
  }, [receiptFile])

  useEffect(() => {
    fetch(`${API}/paypal-config`).then(r => r.json()).then(d => { if (d.success) setPaypalConfig(d.data) })
    fetch(`${API}/tipo-fotos`).then(r => r.json()).then(d => { if (d.success) setTipoFotos(d.data) })
  }, [])

  // Reset cart when search criteria changes (Cart State Cleanup)
  useEffect(() => {
    setCart([])
  }, [checkIn, checkOut, adultos, menores, mascotas, categoria])

  const parseUTCDate = (dateStr: string) => {
    if (!dateStr) return null
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(year, month - 1, day))
  }

  const formatUTCDate = (date: Date) => {
    return date.toISOString().split('T')[0]
  }

  const today = new Date().toISOString().split('T')[0]
  
  const minCheckOut = (() => {
    if (!checkIn) return today
    if (categoria === 'Pasadía') return checkIn
    const d = parseUTCDate(checkIn)
    if (!d) return today
    d.setUTCDate(d.getUTCDate() + 1)
    return formatUTCDate(d)
  })()

  const calcNoches = (cIn: string, cOut: string) => {
    if (!cIn || !cOut) return 0
    const d1 = parseUTCDate(cIn)
    const d2 = parseUTCDate(cOut)
    if (!d1 || !d2) return 0
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    return diff >= 0 ? diff : 0
  }

  const noches = calcNoches(checkIn, checkOut)

  const handleCheckInChange = (val: string) => {
    setCheckIn(val)
    if (categoria === 'Pasadía') {
      setCheckOut(val)
    } else {
      if (checkOut && val >= checkOut) {
        setCheckOut('')
      }
    }
  }

  const checkAvailability = async () => {
    setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/disponibilidad?check_in=${checkIn}&check_out=${checkOut}&categoria=${categoria}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      if (data.data.tipos_disponibles.length === 0) { setError('No hay disponibilidad para esas fechas. Prueba con otras fechas.'); return }
      
      setRoomTypes(data.data.tipos_disponibles)
      
      // Save searched values
      setAdultosBuscados(adultos)
      setMenoresBuscados(menores)
      setMascotasBuscadas(mascotas)

      // Fetch plans for all available room types in parallel
      const plansMap: Record<string, Plan[]> = {}
      const defaultPlansMap: Record<string, Plan> = {}
      await Promise.all(data.data.tipos_disponibles.map(async (rt: RoomType) => {
        const pResp = await fetch(`${API}/planes?tipo=${rt.tipo}`)
        const pData = await pResp.json()
        if (pData.success && pData.data.length > 0) {
          plansMap[rt.tipo] = pData.data
          defaultPlansMap[rt.tipo] = pData.data[0]
        }
      }))
      setAllRoomPlans(plansMap)
      setSelectedPlans(defaultPlansMap)
      setStep(2)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  // Backtracking suggested room distribution engine ("El Sugerido")
  const findElSugerido = (
    adults: number,
    minors: number,
    pets: number,
    availableTypes: RoomType[]
  ) => {
    const ROOM_CAPACITIES: Record<string, { min: number; max: number }> = {}
    availableTypes.forEach(rt => {
      ROOM_CAPACITIES[rt.tipo] = { min: rt.capacidad_min, max: rt.capacidad_max }
    })

    function solveDistribution(
      rooms: string[],
      remAdults: number,
      remMinors: number,
      remPets: number
    ): RoomAllocation[] | null {
      const result: RoomAllocation[] = []

      function backtrack(
        idx: number,
        rAdults: number,
        rMinors: number,
        rPets: number
      ): boolean {
        if (idx === rooms.length) {
          return rAdults === 0 && rMinors === 0 && rPets === 0
        }

        const tipo = rooms[idx]
        const cap = ROOM_CAPACITIES[tipo] || { min: 1, max: 4 }

        const minAdults = 1
        const maxAdults = Math.min(rAdults, cap.max)

        for (let a = minAdults; a <= maxAdults; a++) {
          const minMinors = Math.max(0, cap.min - a)
          const maxMinors = Math.min(rMinors, cap.max - a)

          for (let m = minMinors; m <= maxMinors; m++) {
            const maxPets = Math.min(rPets, 2)
            for (let p = 0; p <= maxPets; p++) {
              result.push({ tipo, adultos: a, menores: m, mascotas: p })
              if (backtrack(idx + 1, rAdults - a, rMinors - m, rPets - p)) {
                return true
              }
              result.pop()
            }
          }
        }
        return false
      }

      if (backtrack(0, remAdults, remMinors, remPets)) {
        return result
      }
      return null
    }

    // Sort available room types by max capacity to establish priority weights
    const sortedTypes = [...availableTypes].sort((a, b) => a.capacidad_max - b.capacidad_max)
    const weights: Record<string, number> = {}
    sortedTypes.forEach((rt, index) => {
      weights[rt.tipo] = Math.pow(10, index)
    })

    const typeOrder = sortedTypes.map(rt => rt.tipo)
    const availableMap: Record<string, number> = {}
    
    availableTypes.forEach(rt => {
      availableMap[rt.tipo] = rt.disponibles
    })

    const results: string[][] = []

    function generateCombos(typeIdx: number, currentCombo: string[]) {
      if (typeIdx === typeOrder.length) {
        if (currentCombo.length > 0) results.push([...currentCombo])
        return
      }

      const type = typeOrder[typeIdx]
      const maxQty = Math.min(availableMap[type] || 0, adults)

      for (let qty = 0; qty <= maxQty; qty++) {
        const added = Array(qty).fill(type)
        generateCombos(typeIdx + 1, [...currentCombo, ...added])
      }
    }

    generateCombos(0, [])

    results.sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length
      const wA = a.reduce((sum, r) => sum + (weights[r] || 0), 0)
      const wB = b.reduce((sum, r) => sum + (weights[r] || 0), 0)
      return wA - wB // Ascending order: prioritize smaller capacity rooms first
    })

    for (const combo of results) {
      const allocation = solveDistribution(combo, adults, minors, pets)
      if (allocation) return allocation
    }

    return null
  }

  const aplicarElSugerido = async (sugerencia: RoomAllocation[]) => {
    setLoading(true); setError('')
    try {
      const newCartItems: CartItem[] = []
      
      for (const alloc of sugerencia) {
        const plan = selectedPlans[alloc.tipo] || allRoomPlans[alloc.tipo]?.[0]
        if (!plan) {
          throw new Error(`No se encontró un plan de tarifa para el tipo ${alloc.tipo}`)
        }
        
        const resp = await fetch(`${API}/cotizar?plan=${plan.codigo}&adultos=${alloc.adultos}&menores=${alloc.menores}&mascotas=${alloc.mascotas}&check_in=${checkIn}&check_out=${checkOut}`)
        const data = await resp.json()
        if (!data.success) {
          throw new Error(data.error?.message || `Error cotizando habitación sugerida de tipo ${alloc.tipo}`)
        }
        
        newCartItems.push({
          id: `${Date.now()}-${Math.random()}-${alloc.tipo}`,
          tipo: alloc.tipo,
          plan,
          adultos: alloc.adultos,
          menores: alloc.menores,
          mascotas: alloc.mascotas,
          subtotal: data.data.subtotal,
          impuesto_monto: data.data.impuesto_monto,
          monto_total: data.data.monto_total,
          deposito_minimo: data.data.deposito_minimo
        })
      }
      
      setCart(newCartItems)
      setStep(3)
    } catch (e: any) {
      setError(e.message || 'Error aplicando la sugerencia')
    } finally {
      setLoading(false)
    }
  }

  const handleIncrement = async (rt: RoomType) => {
    const currentQty = cart.filter(x => x.tipo === rt.tipo).length
    if (currentQty >= rt.disponibles) return
    
    const plan = selectedPlans[rt.tipo]
    if (!plan) return

    setLoading(true); setError('')
    try {
      // Fetch or compute the cotizacion for the room using selected plan, default guest counts (adultos = 1, menores = 0, mascotas = 0)
      const resp = await fetch(`${API}/cotizar?plan=${plan.codigo}&adultos=1&menores=0&mascotas=0&check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error cotizando'); return }
      
      const newItem: CartItem = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: rt.tipo,
        plan,
        adultos: 1,
        menores: 0,
        mascotas: 0,
        subtotal: data.data.subtotal,
        impuesto_monto: data.data.impuesto_monto,
        monto_total: data.data.monto_total,
        deposito_minimo: data.data.deposito_minimo
      }
      setCart(prev => [...prev, newItem])
    } catch {
      setError('Error cotizando habitación')
    } finally {
      setLoading(false)
    }
  }

  const handleDecrement = (rt: RoomType) => {
    const idx = [...cart].reverse().findIndex(x => x.tipo === rt.tipo)
    if (idx === -1) return
    const actualIdx = cart.length - 1 - idx
    setCart(prev => prev.filter((_, i) => i !== actualIdx))
  }

  const updateCartItemGuests = async (itemId: string, adults: number, minors: number, pets: number) => {
    // Update local state immediately so UI remains highly responsive
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, adultos: adults, menores: minors, mascotas: pets }
      }
      return item
    }))

    // Fetch exact updated price
    const item = cart.find(x => x.id === itemId)
    if (!item) return
    
    try {
      const resp = await fetch(`${API}/cotizar?plan=${item.plan.codigo}&adultos=${adults}&menores=${minors}&mascotas=${pets}&check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (data.success) {
        setCart(prev => prev.map(x => {
          if (x.id === itemId) {
            return {
              ...x,
              subtotal: data.data.subtotal,
              impuesto_monto: data.data.impuesto_monto,
              monto_total: data.data.monto_total,
              deposito_minimo: data.data.deposito_minimo
            }
          }
          return x
        }))
      }
    } catch (err) {
      console.error("Error updating cotizacion dynamically", err)
    }
  }

  const selectRoomType = async (tipo: string) => {
    setSelectedType(tipo); setLoading(true); setError('')
    // Reset guest counts for this specific room to defaults/top-level preferences
    setCartItemAdults(adultos)
    setCartItemMinors(menores)
    setCartItemPets(0)
    try {
      const resp = await fetch(`${API}/planes?tipo=${tipo}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error'); return }
      setPlans(data.data); setStep(3)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const selectPlan = async (plan: Plan) => {
    setSelectedPlan(plan);
  }

  const addToCart = async (roomType: string, plan: Plan, adults: number, minors: number, pets: number) => {
    setLoading(true); setError('')
    try {
      const resp = await fetch(`${API}/cotizar?plan=${plan.codigo}&adultos=${adults}&menores=${minors}&mascotas=${pets}&check_in=${checkIn}&check_out=${checkOut}`)
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error cotizando'); return }
      
      const newItem: CartItem = {
        id: `${Date.now()}-${Math.random()}`,
        tipo: roomType,
        plan,
        adultos: adults,
        menores: minors,
        mascotas: pets,
        subtotal: data.data.subtotal,
        impuesto_monto: data.data.impuesto_monto,
        monto_total: data.data.monto_total,
        deposito_minimo: data.data.deposito_minimo
      }
      
      setCart(prev => [...prev, newItem])
      setSelectedType('')
      setSelectedPlan(null)
      setStep(2) // return to available room types list to choose more!
    } catch {
      setError('Error cotizando habitación')
    } finally {
      setLoading(false)
    }
  }

  const totalSubtotal = cart.reduce((acc, item) => acc + item.subtotal, 0)
  const totalImpuesto = cart.reduce((acc, item) => acc + item.impuesto_monto, 0)
  const totalMontoTotal = cart.reduce((acc, item) => acc + item.monto_total, 0)
  const totalDepositoMinimo = cart.reduce((acc, item) => acc + item.deposito_minimo, 0)

  // Calculations for Step 3 (Guest Allocation Console)
  const assignedAdults = cart.reduce((acc, x) => acc + x.adultos, 0)
  const assignedMinors = cart.reduce((acc, x) => acc + x.menores, 0)
  const assignedPets = cart.reduce((acc, x) => acc + x.mascotas, 0)

  const adultsMatch = assignedAdults === adultosBuscados
  const minorsMatch = assignedMinors === menoresBuscados
  const petsMatch = assignedPets === mascotasBuscadas

  // Check physical capacities for all rooms in cart
  const capacityViolations = cart.map(item => {
    const rt = roomTypes.find(r => r.tipo === item.tipo)
    const capMin = rt ? rt.capacidad_min : 1
    const capMax = rt ? rt.capacidad_max : 4
    const totalGuests = item.adultos + item.menores
    const isTooLow = totalGuests < capMin
    const isTooHigh = totalGuests > capMax
    const isAdultInvalid = item.adultos < 1
    return {
      itemId: item.id,
      tipo: item.tipo,
      isTooLow,
      isTooHigh,
      isAdultInvalid,
      capMin,
      capMax,
      totalGuests
    }
  })

  const hasCapacityViolation = capacityViolations.some(v => v.isTooLow || v.isTooHigh || v.isAdultInvalid)
  const allMatch = adultsMatch && minorsMatch && petsMatch && !hasCapacityViolation

  const createReservation = async (paypalOrderId: string) => {
    setLoading(true); setError('')
    const totalPagar = pagoTipo === 'total' ? totalMontoTotal : totalDepositoMinimo
    try {
      const resp = await fetch(`${API}/reservas/multi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: guest.nombre, apellido: guest.apellido, email: guest.email, whatsapp: guest.whatsapp, nacionalidad: guest.nacionalidad,
          check_in: checkIn, check_out: checkOut, metodo_pago: 'paypal', paypal_order_id: paypalOrderId, pago_tipo: pagoTipo,
          monto_pagado: totalPagar,
          rooms: cart.map(item => ({
            tipo_habitacion: item.tipo, plan_codigo: item.plan.codigo,
            adultos: item.adultos, menores: item.menores, mascotas: item.mascotas,
            check_in: checkIn, check_out: checkOut
          }))
        })
      })
      const data = await resp.json()
      if (!data.success) { setError(data.error?.message || 'Error creando reserva'); return }
      setResult(data.data); setStep(6)
    } catch { setError('Error de conexión') } finally { setLoading(false) }
  }

  const handleOfflineBooking = async () => {
    setLoading(true); setError('')
    const totalPagar = pagoTipo === 'total' ? totalMontoTotal : totalDepositoMinimo
    try {
      const payload = {
        cliente: guest.nombre,
        apellido: guest.apellido,
        email: guest.email,
        whatsapp: guest.whatsapp,
        nacionalidad: guest.nacionalidad,
        check_in: checkIn,
        check_out: checkOut,
        pago_tipo: pagoTipo,
        monto_pagado: totalPagar,
        metodo_pago: paymentMethod,
        referencia: reference,
        rooms: cart.map(item => ({
          tipo_habitacion: item.tipo,
          plan_codigo: item.plan.codigo,
          adultos: item.adultos,
          menores: item.menores,
          mascotas: item.mascotas,
          check_in: checkIn,
          check_out: checkOut
        }))
      }

      const formData = new FormData()
      if (receiptFile) {
        formData.append('comprobante', receiptFile)
      }
      formData.append('datos', JSON.stringify(payload))
      formData.append('notas', `Comprobante de ${paymentMethod.toUpperCase()} (Ref: ${reference}) subido por el huésped durante la reserva online.`)

      const resp = await fetch(`${API}/reservas/multi`, {
        method: 'POST',
        body: formData
      })
      const data = await resp.json()
      if (!data.success) {
        setError(data.error?.message || 'Error creando reserva')
        return
      }

      setResult(data.data)
      setStep(6)
    } catch (err: any) {
      setError('Error de conexión al procesar la reserva')
    } finally {
      setLoading(false)
    }
  }

  const isGuestValid = guest.nombre && guest.email && guest.apellido
  const montoPagar = pagoTipo === 'total' ? totalMontoTotal : totalDepositoMinimo
  const planImage = cart[0]?.plan.imagen || (cart[0]?.tipo ? (tipoFotos[cart[0].tipo] || defaultRoomImages[cart[0].tipo]) : '') || defaultRoomImages['Familiar']

  const stepLabels = ['Fechas', 'Habitaciones', 'Distribución', 'Resumen', 'Pago', 'Confirmado']

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
              <div><h2 className="text-xl font-bold text-gray-800">Selecciona tu experiencia</h2><p className="text-sm text-gray-400">Planifica tu estadía perfecta o un día de relajación</p></div>
            </div>

            {/* Category Toggle Tabs */}
            <div className="flex bg-amber-50/50 p-1.5 rounded-2xl border border-amber-200/50 mb-6 gap-2">
              <button
                type="button"
                onClick={() => setCategoria('Estadía')}
                className={`flex-1 py-3 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                  categoria === 'Estadía'
                    ? 'bg-amber-700 text-white shadow-md'
                    : 'text-amber-800 hover:bg-amber-100/30'
                }`}
              >
                <Bed className="w-4 h-4" />
                <span>Estadía (Hospedaje)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoria('Pasadía');
                  if (checkIn) setCheckOut(checkIn);
                }}
                className={`flex-1 py-3 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                  categoria === 'Pasadía'
                    ? 'bg-amber-700 text-white shadow-md'
                    : 'text-amber-800 hover:bg-amber-100/30'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Pasadía (Por el día)</span>
              </button>
            </div>

            <div className={`grid grid-cols-1 ${categoria === 'Pasadía' ? '' : 'sm:grid-cols-2'} gap-4 mb-5`}>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{categoria === 'Pasadía' ? 'Fecha de Visita' : 'Check-in'}</label>
                <input type="date" min={today} value={checkIn} onChange={e => handleCheckInChange(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white transition text-gray-700" />
              </div>
              {categoria !== 'Pasadía' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Check-out</label>
                  <input type="date" min={minCheckOut} value={checkOut} onChange={e => setCheckOut(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 focus:border-transparent focus:bg-white transition text-gray-700" />
                </div>
              )}
            </div>
            {categoria === 'Pasadía' && checkIn && (
              <p className="text-sm text-amber-700 font-medium mb-4 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-600" /> Pasadía (1 día de acceso completo de 9:00 AM a 5:00 PM)
              </p>
            )}
            {categoria !== 'Pasadía' && noches > 0 && (
              <p className="text-sm text-amber-700 font-medium mb-4 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {noches} noche{noches > 1 ? 's' : ''}
              </p>
            )}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5"><Users className="w-3.5 h-3.5 inline mr-1" />Adultos</label>
                <select value={adultos} onChange={e => setAdultos(+e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 text-gray-700">
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} adulto{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Menores</label>
                <select value={menores} onChange={e => setMenores(+e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 text-gray-700">
                  {Array.from({ length: 16 }, (_, i) => i).map(n => <option key={n} value={n}>{n} menor{n !== 1 ? 'es' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mascotas</label>
                <select value={mascotas} onChange={e => setMascotas(+e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/50 focus:ring-2 focus:ring-amber-400 text-gray-700">
                  {Array.from({ length: 11 }, (_, i) => i).map(n => <option key={n} value={n}>{n} mascota{n !== 1 ? 's' : ''}</option>)}
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
        {step === 2 && (() => {
          const sugerencia = findElSugerido(adultosBuscados, menoresBuscados, mascotasBuscadas, roomTypes)
          return (
            <div className="space-y-6 animate-fadeIn">
              {cart.length > 0 && (
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 border border-amber-200 rounded-3xl p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-amber-900 text-base flex items-center gap-2">
                      <span>🛒 Tu Carrito de Habitaciones</span>
                      <span className="bg-amber-200 text-amber-900 text-xs px-2 py-0.5 rounded-full font-bold">{cart.length}</span>
                    </h3>
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold transition"
                    >
                      Vaciar carrito
                    </button>
                  </div>
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 text-sm shadow-xs">
                        <div>
                          <p className="font-bold text-gray-800 flex items-center gap-1.5">
                            <Bed className="w-4 h-4 text-amber-600" />
                            <span>{item.tipo}</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{item.plan.nombre} · {item.adultos} Ad{item.menores > 0 ? ` · ${item.menores} Mn` : ''}{item.mascotas > 0 ? ` · ${item.mascotas} Mc` : ''}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-amber-800">${item.monto_total.toFixed(2)}</span>
                          <button
                            onClick={() => setCart(prev => prev.filter(x => x.id !== item.id))}
                            className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition"
                            title="Eliminar de mi carrito"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-5 pt-4 border-t border-amber-200/50 gap-4">
                    <div>
                      <span className="text-xs text-gray-500 block">
                        {categoria === 'Pasadía' ? 'Total de tu pasadía' : `Total de tu estadía (${noches} noche${noches > 1 ? 's' : ''})`}
                      </span>
                      <p className="text-2xl font-bold text-amber-900">${totalMontoTotal.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => setStep(3)}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-700 to-amber-800 text-white font-bold rounded-xl text-sm hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <span>Siguiente: Distribuir Huéspedes</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* ✨ El Sugerido Optimization Recommendation Banner */}
              {sugerencia && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-3xl p-6 shadow-md mb-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-100/30 rounded-full -mr-8 -mt-8 pointer-events-none" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-2">
                        ✨ El Sugerido
                      </span>
                      <h3 className="font-extrabold text-amber-900 text-lg sm:text-xl">
                        Recomendación de Habitación Optimizada
                      </h3>
                      <p className="text-sm text-amber-800/80 mt-1 leading-relaxed">
                        Hemos encontrado la combinación perfecta de habitaciones que minimiza tus costos y se adapta a tus huéspedes y mascotas:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {sugerencia.map((s, idx) => (
                          <span key={idx} className="bg-white border border-amber-200 text-amber-900 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-xs">
                            🚪 <b>{s.tipo}</b> ({s.adultos} Ad{s.menores > 0 ? `, ${s.menores} Mn` : ''}{s.mascotas > 0 ? `, ${s.mascotas} Mc` : ''})
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => aplicarElSugerido(sugerencia)}
                      disabled={loading}
                      className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-5 py-3 rounded-2xl transition shadow-md hover:shadow-lg text-sm shrink-0 flex items-center justify-center gap-2 self-start sm:self-center"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Aceptar Sugerido</span>}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Bed className="w-5 h-5 text-amber-700" /></div>
                  <div><h2 className="text-xl font-bold text-gray-800">Elige una habitación para agregar</h2></div>
                </div>
                <p className="text-sm text-gray-400 mb-6 ml-[52px]">
                  {categoria === 'Pasadía' ? 'Pasadía por el día' : `${noches} noche${noches > 1 ? 's' : ''}`} · {adultosBuscados} adulto{adultosBuscados > 1 ? 's' : ''}{menoresBuscados > 0 ? ` · ${menoresBuscados} menor${menoresBuscados > 1 ? 'es' : ''}` : ''}{mascotasBuscadas > 0 ? ` · ${mascotasBuscadas} mascota${mascotasBuscadas > 1 ? 's' : ''}` : ''}
                </p>
                <div className="space-y-4">
                  {roomTypes.map(rt => {
                    const Icon = roomIcons[rt.tipo] || Bed
                    const img = tipoFotos[rt.tipo] || defaultRoomImages[rt.tipo] || defaultRoomImages['Familiar']
                    const currentQty = cart.filter(x => x.tipo === rt.tipo).length

                    return (
                      <div key={rt.tipo}
                        className="w-full rounded-2xl border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all duration-200 text-left overflow-hidden bg-white">
                        <div className="flex flex-col sm:flex-row">
                          <div className="sm:w-44 h-32 sm:h-auto overflow-hidden shrink-0">
                            <img src={img} alt={rt.tipo} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
                            <div>
                              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Icon className="w-5 h-5 text-amber-600" /> {rt.tipo}</h3>
                              <p className="text-sm text-gray-500 mt-1">{rt.capacidad_min}–{rt.capacidad_max} huéspedes</p>
                              <p className="text-xs text-emerald-600 mt-1 font-medium">{rt.disponibles} disponible{rt.disponibles > 1 ? 's' : ''}</p>
                            </div>

                            {/* Plan select for this room type */}
                            <div className="mt-3">
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plan de Tarifa</label>
                              <select
                                value={selectedPlans[rt.tipo]?.codigo || ''}
                                onChange={(e) => {
                                  const plan = allRoomPlans[rt.tipo]?.find(p => p.codigo === e.target.value)
                                  if (plan) {
                                    setSelectedPlans(prev => ({ ...prev, [rt.tipo]: plan }))
                                  }
                                }}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-amber-400"
                              >
                                {allRoomPlans[rt.tipo]?.map(p => (
                                  <option key={p.codigo} value={p.codigo}>
                                    {p.nombre} (${p.precio_adulto_noche}/{categoria === 'Pasadía' ? 'persona' : 'noche'})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Sleek quantity selector */}
                            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => handleDecrement(rt)}
                                disabled={currentQty === 0 || loading}
                                className="w-8 h-8 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center font-bold text-gray-500 hover:text-amber-700 disabled:opacity-30 transition"
                              >
                                -
                              </button>
                              <span className="font-bold text-gray-800 text-sm w-6 text-center">
                                {currentQty}
                              </span>
                              <button
                                onClick={() => handleIncrement(rt)}
                                disabled={currentQty >= rt.disponibles || loading}
                                className="w-8 h-8 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center font-bold text-gray-500 hover:text-amber-700 disabled:opacity-30 transition"
                              >
                                +
                              </button>
                              <span className="text-xs text-gray-400 ml-auto">
                                ({rt.disponibles} disponibles)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => setStep(1)} className="mt-5 text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Cambiar fechas</button>
              </div>
            </div>
          )
        })()}

        {/* STEP 3: Guest Room Allocation Console */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn pb-32">
            <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-amber-100/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center"><Users className="w-5 h-5 text-amber-700" /></div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Distribución de Huéspedes</h2>
                  <p className="text-sm text-gray-400">Distribuye tus huéspedes y mascotas en las habitaciones seleccionadas</p>
                </div>
              </div>
              
              <div className="space-y-4 mt-6">
                {cart.map((item, idx) => {
                  const rt = roomTypes.find(r => r.tipo === item.tipo)
                  const capMin = rt ? rt.capacidad_min : 1
                  const capMax = rt ? rt.capacidad_max : 4
                  const totalGuests = item.adultos + item.menores
                  const isTooLow = totalGuests < capMin
                  const isTooHigh = totalGuests > capMax
                  const isAdultInvalid = item.adultos < 1
                  const hasWarn = isTooLow || isTooHigh || isAdultInvalid

                  return (
                    <div key={item.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">Habitación {idx + 1}: {item.tipo}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                            {item.plan.nombre}
                          </span>
                          {hasWarn && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              ⚠️ Advertencia de capacidad
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          Capacidad física: {capMin} - {capMax} huéspedes.
                        </p>
                        {isAdultInvalid && <p className="text-[11px] text-red-500 font-medium">Debe haber al menos 1 adulto en cada habitación.</p>}
                        {isTooLow && <p className="text-[11px] text-red-500 font-medium">Faltan huéspedes para cumplir el mínimo de {capMin}.</p>}
                        {isTooHigh && <p className="text-[11px] text-red-500 font-medium">Se supera la capacidad máxima de {capMax} huéspedes.</p>}
                      </div>

                      {/* Guest Adjusters */}
                      <div className="flex items-center gap-4 flex-wrap bg-white p-3 rounded-xl border border-gray-100">
                        {/* Adults */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Adultos</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartItemGuests(item.id, Math.max(0, item.adultos - 1), item.menores, item.mascotas)}
                              className="w-6 h-6 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center text-xs font-bold text-gray-500"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-gray-700 w-4 text-center">{item.adultos}</span>
                            <button
                              onClick={() => updateCartItemGuests(item.id, Math.min(30, item.adultos + 1), item.menores, item.mascotas)}
                              className="w-6 h-6 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center text-xs font-bold text-gray-500"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Minors */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Menores</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartItemGuests(item.id, item.adultos, Math.max(0, item.menores - 1), item.mascotas)}
                              className="w-6 h-6 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center text-xs font-bold text-gray-500"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-gray-700 w-4 text-center">{item.menores}</span>
                            <button
                              onClick={() => updateCartItemGuests(item.id, item.adultos, Math.min(15, item.menores + 1), item.mascotas)}
                              className="w-6 h-6 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center text-xs font-bold text-gray-500"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Pets */}
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-bold text-gray-400 uppercase mb-1">Mascotas</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateCartItemGuests(item.id, item.adultos, item.menores, Math.max(0, item.mascotas - 1))}
                              className="w-6 h-6 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center text-xs font-bold text-gray-500"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-gray-700 w-4 text-center">{item.mascotas}</span>
                            <button
                              onClick={() => updateCartItemGuests(item.id, item.adultos, item.menores, Math.min(10, item.mascotas + 1))}
                              className="w-6 h-6 rounded-full border border-gray-200 hover:border-amber-500 flex items-center justify-center text-xs font-bold text-gray-500"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Room Price */}
                        <div className="text-right pl-2 border-l border-gray-100 flex flex-col justify-center">
                          <span className="text-[10px] text-gray-400 block font-semibold">Hab. Total</span>
                          <span className="font-bold text-amber-800 text-sm">${item.monto_total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 flex justify-between items-center">
                <button onClick={() => setStep(2)} className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" /> Volver a habitaciones
                </button>
              </div>
            </div>

            {/* Floating Glassmorphic Validation Panel at the bottom */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-t border-amber-200/50 shadow-2xl py-5 px-6">
              <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="flex-1 w-full space-y-3">
                  {/* Status Stats */}
                  <div className="grid grid-cols-4 gap-4 text-center md:text-left">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Adultos</span>
                      <p className={`text-base font-bold ${adultsMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {assignedAdults} / {adultosBuscados}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Menores</span>
                      <p className={`text-base font-bold ${minorsMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {assignedMinors} / {menoresBuscados}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Mascotas</span>
                      <p className={`text-base font-bold ${petsMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {assignedPets} / {mascotasBuscadas}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Cap. Máxima</span>
                      <p className="text-base font-bold text-amber-900">
                        {cart.reduce((acc, item) => {
                          const rt = roomTypes.find(r => r.tipo === item.tipo)
                          return acc + (rt ? rt.capacidad_max : 0)
                        }, 0)}
                      </p>
                    </div>
                  </div>

                  {/* Clean status banner */}
                  <div className={`p-3 rounded-2xl text-xs font-semibold ${allMatch ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    {allMatch ? (
                      <p>¡Perfecto! Todos los huéspedes y mascotas han sido asignados correctamente.</p>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-bold">⚠️ Falta completar la distribución correcta:</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {assignedAdults < adultosBuscados && <li>Faltan asignar {adultosBuscados - assignedAdults} adulto(s) de tu búsqueda.</li>}
                          {assignedAdults > adultosBuscados && <li>Sobran {assignedAdults - adultosBuscados} adulto(s) asignado(s).</li>}
                          {assignedMinors < menoresBuscados && <li>Faltan asignar {menoresBuscados - assignedMinors} menor(es) de tu búsqueda.</li>}
                          {assignedMinors > menoresBuscados && <li>Sobran {assignedMinors - menoresBuscados} menor(es) asignado(s).</li>}
                          {assignedPets < mascotasBuscadas && <li>Faltan asignar {mascotasBuscadas - assignedPets} mascota(s) de tu búsqueda.</li>}
                          {assignedPets > mascotasBuscadas && <li>Sobran {assignedPets - mascotasBuscadas} mascota(s) asignada(s).</li>}
                          {hasCapacityViolation && <li>Revisa las advertencias de capacidad física en cada habitación.</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-col items-center sm:items-end gap-1">
                  <span className="text-[10px] text-gray-400 block">Total a Pagar</span>
                  <p className="text-2xl font-black text-amber-900 mb-2">${totalMontoTotal.toFixed(2)}</p>
                  <button
                    disabled={!allMatch}
                    onClick={() => setStep(4)}
                    className="w-full md:w-auto px-6 py-4 bg-gradient-to-r from-amber-700 to-amber-800 text-white font-bold rounded-2xl text-base hover:shadow-xl disabled:opacity-40 disabled:pointer-events-none transition flex items-center justify-center gap-2"
                  >
                    <span>Siguiente: Datos de Huésped</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Summary + Guest Info */}
        {step === 4 && cart.length > 0 && (
          <div className="space-y-5 animate-fadeIn">
            {/* Photo + Summary Card */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-amber-100/50">
            {planImage && (
                <div className="h-48 sm:h-56 overflow-hidden relative">
                  <img src={planImage} alt="Casa Mahana" className="w-full h-full object-cover" />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%)' }} />
                  <div className="absolute bottom-4 left-5 text-white">
                    <h3 className="text-xl font-bold">Resumen de tu reserva</h3>
                    <p className="text-white/70 text-sm">
                      {cart.length} {categoria === 'Pasadía' ? 'Bohío/s' : 'habitación/es'} · {categoria === 'Pasadía' ? 'Pasadía por el día' : `${noches} noche${noches > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              )}
              <div className="p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">{categoria === 'Pasadía' ? 'Bohíos Seleccionados' : 'Habitaciones Seleccionadas'}</h2>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-start bg-gray-50/70 p-4 rounded-2xl border border-gray-100 text-xs">
                      <div>
                        <p className="font-bold text-gray-800 flex items-center gap-1.5">
                          <Bed className="w-3.5 h-3.5 text-amber-600" />
                          <span>{item.tipo}</span>
                        </p>
                        <p className="text-gray-500 mt-1">{item.plan.nombre}</p>
                        <p className="text-gray-400 mt-1">{item.adultos} Ad{item.menores > 0 ? ` · ${item.menores} Mn` : ''}{item.mascotas > 0 ? ` · ${item.mascotas} Mc` : ''}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-amber-800 text-sm block">${item.monto_total.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400">{categoria === 'Pasadía' ? 'Total Bohío' : 'Total habitación'}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <h2 className="text-lg font-bold text-gray-800 mb-4">Resumen financiero</h2>
                <div className="rounded-2xl p-4 space-y-2.5 text-sm" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {categoria === 'Pasadía' ? 'Fecha de Visita' : 'Fechas'}</span>
                    <span className="font-semibold text-gray-700">{categoria === 'Pasadía' ? checkIn : `${checkIn} — ${checkOut}`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {categoria === 'Pasadía' ? 'Bohíos' : 'Habitaciones'}</span>
                    <span className="font-semibold text-gray-700">{cart.length}</span>
                  </div>
                  <hr className="border-amber-200/50" />
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold text-gray-700">${totalSubtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Impuesto (7%)</span><span className="font-semibold text-gray-700">${totalImpuesto.toFixed(2)}</span></div>
                  <div className="flex justify-between text-lg font-bold text-amber-900 pt-1 border-t border-amber-200/50"><span>Total</span><span>${totalMontoTotal.toFixed(2)}</span></div>
                </div>

                <div className="mt-5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modalidad de pago</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setPagoTipo('deposito')}
                      className={`p-4 rounded-2xl border-2 text-center transition-all ${pagoTipo === 'deposito' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                      <p className="text-xl font-bold text-amber-800">${totalDepositoMinimo.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Depósito Mínimo</p>
                    </button>
                    <button onClick={() => setPagoTipo('total')}
                      className={`p-4 rounded-2xl border-2 text-center transition-all ${pagoTipo === 'total' ? 'border-amber-500 bg-amber-50 shadow-md' : 'border-gray-200 hover:border-amber-300'}`}>
                      <p className="text-xl font-bold text-amber-800">${totalMontoTotal.toFixed(2)}</p>
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
            <button onClick={() => setStep(3)} className="text-sm text-amber-700 hover:text-amber-900 font-medium flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Volver a distribución</button>
          </div>
        )}

        {/* STEP 5: Pago */}
        {step === 5 && cart.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-amber-100/50 animate-fadeIn">
            {planImage && (
              <div className="h-32 overflow-hidden relative">
                <img src={planImage} alt="Casa Mahana" className="w-full h-full object-cover" style={{ filter: 'brightness(0.7)' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white">
                    <p className="text-sm opacity-80">{pagoTipo === 'total' ? 'Pago completo' : 'Depósito Mínimo'}</p>
                    <p className="text-4xl font-bold">${montoPagar.toFixed(2)} <span className="text-base font-normal opacity-70">USD</span></p>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6 sm:p-8">
              {pagoTipo === 'deposito' && (
                <p className="text-center text-xs text-gray-400 mb-5">Saldo restante de <b>${(totalMontoTotal - montoPagar).toFixed(2)}</b> se cancela en check-in</p>
              )}

              {/* Segmented Tab Control */}
              <div className="flex bg-amber-50/50 p-1.5 rounded-2xl border border-amber-200/50 mb-6 gap-2">
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('paypal'); setError(''); }}
                  className={`flex-1 py-3 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                    paymentMethod === 'paypal'
                      ? 'bg-amber-700 text-white shadow-md'
                      : 'text-amber-800 hover:bg-amber-100/30'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pago Seguro Online</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('transferencia'); setError(''); }}
                  className={`flex-1 py-3 text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${
                    paymentMethod !== 'paypal'
                      ? 'bg-amber-700 text-white shadow-md'
                      : 'text-amber-800 hover:bg-amber-100/30'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Transferencia / Yappy / Cupón</span>
                </button>
              </div>

              {/* PayPal Payment Tab */}
              {paymentMethod === 'paypal' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-5 justify-center">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm text-gray-500">Pago seguro procesado por PayPal</span>
                  </div>
                  {paypalConfig.paypal_enabled && paypalConfig.paypal_client_id ? (
                    <PayPalButtons clientId={paypalConfig.paypal_client_id} mode={paypalConfig.paypal_mode}
                      monto={montoPagar} descripcion={`Casa Mahana - Reserva de ${cart.length} habitaciones (${categoria === 'Pasadía' ? 'Pasadía' : `${noches} noches`})`}
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
                </div>
              ) : (
                /* Offline Payment (Transfer/Yappy/Cupón) Tab */
                <div className="space-y-4 text-left">
                  {/* Account Type Toggle */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('transferencia')}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                        paymentMethod === 'transferencia'
                          ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-400 font-bold'
                          : 'border-gray-200 hover:border-amber-300 text-gray-500 bg-white'
                      }`}
                    >
                      🏦 Transferencia Bancaria
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('yappy')}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                        paymentMethod === 'yappy'
                          ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-400 font-bold'
                          : 'border-gray-200 hover:border-amber-300 text-gray-500 bg-white'
                      }`}
                    >
                      📱 Yappy (Banco General)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cuponera_oferta_simple')}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                        paymentMethod === 'cuponera_oferta_simple'
                          ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-400 font-bold'
                          : 'border-gray-200 hover:border-amber-300 text-gray-500 bg-white'
                      }`}
                    >
                      🎟️ Oferta Simple (Cupón)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cuponera_pahoy')}
                      className={`py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                        paymentMethod === 'cuponera_pahoy'
                          ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-400 font-bold'
                          : 'border-gray-200 hover:border-amber-300 text-gray-500 bg-white'
                      }`}
                    >
                      🎟️ PaHoy (Cupón)
                    </button>
                  </div>

                  {/* Payment Info Card */}
                  {paymentMethod === 'transferencia' && (
                    <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-sm mb-5 space-y-2">
                      <p className="font-bold text-amber-900 text-base mb-1">Datos de Transferencia</p>
                      <div className="grid grid-cols-2 gap-y-2 text-gray-700 text-xs sm:text-sm">
                        <div><span className="text-gray-400 text-[10px] block uppercase font-medium">Banco</span><strong>Banco General</strong></div>
                        <div><span className="text-gray-400 text-[10px] block uppercase font-medium">Tipo de Cuenta</span><strong>Cuenta Corriente</strong></div>
                        <div><span className="text-gray-400 text-[10px] block uppercase font-medium">Nombre</span><strong>Casa Mahana S.A.</strong></div>
                        <div><span className="text-gray-400 text-[10px] block uppercase font-medium">Número de Cuenta</span><strong>03-72-01-123456-7</strong></div>
                      </div>
                      <p className="text-[10px] text-amber-700/80 italic pt-2 border-t border-amber-200/30">Por favor, transfiera el monto indicado arriba y adjunte el comprobante.</p>
                    </div>
                  )}
                  {paymentMethod === 'yappy' && (
                    <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-sm mb-5 space-y-2">
                      <p className="font-bold text-amber-900 text-base mb-1">Pagar con Yappy</p>
                      <div className="grid grid-cols-2 gap-y-2 text-gray-700 text-xs sm:text-sm">
                        <div><span className="text-gray-400 text-[10px] block uppercase font-medium">Directorio Yappy</span><strong>@casamahana</strong></div>
                        <div><span className="text-gray-400 text-[10px] block uppercase font-medium">Banco</span><strong>Banco General</strong></div>
                      </div>
                      <p className="text-[10px] text-amber-700/80 italic pt-2 border-t border-amber-200/30">Envíe el pago en Yappy a @casamahana y adjunte la captura de pantalla del recibo.</p>
                    </div>
                  )}
                  {paymentMethod === 'cuponera_oferta_simple' && (
                    <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-sm mb-5 space-y-2">
                      <p className="font-bold text-amber-900 text-base mb-1">Cupón de Oferta Simple</p>
                      <p className="text-xs text-amber-700/90 leading-relaxed">
                        Por favor, ingrese el <strong>código o número de cupón</strong> en el campo de abajo y adjunte el archivo o captura del cupón (QR visible).
                      </p>
                      <p className="text-[10px] text-amber-700/80 italic pt-2 border-t border-amber-200/30">El personal de Casa Mahana validará el cupón y confirmará su reserva.</p>
                    </div>
                  )}
                  {paymentMethod === 'cuponera_pahoy' && (
                    <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 text-sm mb-5 space-y-2">
                      <p className="font-bold text-amber-900 text-base mb-1">Cupón de PaHoy</p>
                      <p className="text-xs text-amber-700/90 leading-relaxed">
                        Por favor, ingrese el <strong>código o número de cupón</strong> en el campo de abajo y adjunte el archivo o captura del cupón (QR visible).
                      </p>
                      <p className="text-[10px] text-amber-700/80 italic pt-2 border-t border-amber-200/30">El personal de Casa Mahana validará el cupón y confirmará su reserva.</p>
                    </div>
                  )}

                  {/* Reference input */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Número de Referencia / Transacción *</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-amber-400 focus:border-transparent transition text-gray-700 bg-gray-50/30 text-sm"
                      placeholder="Ej: 123456"
                    />
                  </div>

                  {/* Sleek drag & drop zone */}
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">📸 Adjuntar Comprobante de Pago *</label>
                    <div
                      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragActive(false);
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const file = e.dataTransfer.files[0];
                          const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
                          if (allowed.includes(file.type)) {
                            setReceiptFile(file);
                          } else {
                            alert('Solo se permiten imágenes JPG, PNG, WebP o archivos PDF.');
                          }
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-5 text-center transition relative overflow-hidden flex flex-col items-center justify-center min-h-[140px] bg-gray-50/50 ${
                        dragActive ? 'border-amber-600 bg-amber-50/30' : 'border-gray-300 hover:border-amber-500'
                      }`}
                    >
                      <input
                        type="file"
                        id="public-receipt-input"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setReceiptFile(e.target.files[0]);
                          }
                        }}
                      />
                      {!receiptFile ? (
                        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-amber-700">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-amber-800 hover:underline">Selecciona comprobante</span>
                            <span className="text-sm text-gray-500"> o arrastra aquí</span>
                          </div>
                          <p className="text-xs text-gray-400">PNG, JPG, WebP o PDF hasta 10MB</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center w-full space-y-3 z-20">
                          {previewUrl ? (
                            <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
                              <img src={previewUrl} alt="Comprobante" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-red-500 shadow-sm font-bold text-xs uppercase">
                              {receiptFile.name.split('.').pop()}
                            </div>
                          )}
                          <div className="text-center">
                            <p className="text-sm font-semibold text-gray-700 truncate max-w-xs">{receiptFile.name}</p>
                            <p className="text-xs text-gray-400">{(receiptFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReceiptFile(null); }}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition"
                          >
                            Remover archivo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Button */}
                  <button
                    type="button"
                    disabled={loading || !reference || !receiptFile}
                    onClick={handleOfflineBooking}
                    className="w-full py-4 text-white font-bold rounded-2xl hover:shadow-2xl transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2 text-lg animate-pulse-subtle"
                    style={{ background: 'linear-gradient(135deg, #78350f, #92400e, #a16207)' }}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><span>Confirmar Reserva y Subir Recibo</span><Check className="w-5 h-5" /></>}
                  </button>
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
            {paymentMethod !== 'paypal' && (
              <p className="text-xs text-amber-700 bg-amber-50 py-2 px-4 rounded-xl inline-flex items-center gap-1.5 mx-auto mb-4 border border-amber-200/50">
                <span>🧾 Comprobante de pago ({paymentMethod.toUpperCase()}) recibido y en revisión.</span>
              </p>
            )}
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
