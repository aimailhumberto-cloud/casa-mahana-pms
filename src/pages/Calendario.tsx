import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const estadoColors: Record<string, string> = {
  'Confirmada': 'bg-blue-400',
  'Hospedado': 'bg-green-500',
  'Check-Out': 'bg-gray-400',
  'Pendiente': 'bg-yellow-400',
  'Cancelada': 'bg-red-400',
  'No-Show': 'bg-red-300',
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date) {
  return d.toISOString().split('T')[0];
}

function daysBetween(d1: string, d2: string) {
  return Math.ceil((new Date(d2).getTime() - new Date(d1).getTime()) / (1000 * 60 * 60 * 24));
}

const DAYS_TO_SHOW = 14;
const ROOM_COL_W = 'w-36 min-w-[144px]';

export default function Calendario() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [jumpDate, setJumpDate] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ reserva: any; x: number; y: number } | null>(null);
  const [catFilter, setCatFilter] = useState('');

  const dates = useMemo(() => {
    return Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(startDate, i));
  }, [startDate]);

  const desde = formatDate(dates[0]);
  const hasta = formatDate(addDays(dates[dates.length - 1], 1));

  useEffect(() => {
    setLoading(true);
    api.get(`/hotel/calendario?desde=${desde}&hasta=${hasta}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  const prev = () => setStartDate(d => addDays(d, -7));
  const next = () => setStartDate(d => addDays(d, 7));
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); setStartDate(d); };
  const jumpTo = () => {
    if (jumpDate) {
      const d = new Date(jumpDate + 'T00:00:00');
      if (!isNaN(d.getTime())) setStartDate(d);
    }
  };

  // Group rooms by categoria > tipo — two-level grouping
  const categoryGroups = useMemo(() => {
    if (!data?.habitaciones) return [];
    const catMap: Record<string, Record<string, any[]>> = {};
    for (const r of data.habitaciones) {
      const cat = r.categoria || 'Estadía';
      if (!catMap[cat]) catMap[cat] = {};
      (catMap[cat][r.tipo] = catMap[cat][r.tipo] || []).push(r);
    }
    // Order: Estadía first, then Pasadía
    const catOrder = ['Estadía', 'Pasadía'];
    const typeOrder: Record<string, number> = { 'Familiar': 1, 'Doble': 2, 'Estándar': 3, 'Camping': 4, 'Bohío': 1, 'Salón': 2, 'Restaurante': 3 };
    return catOrder
      .filter(cat => catMap[cat])
      .filter(cat => !catFilter || cat === catFilter)
      .map(cat => ({
        categoria: cat,
        groups: Object.entries(catMap[cat])
          .sort(([a], [b]) => (typeOrder[a] || 99) - (typeOrder[b] || 99))
          .map(([tipo, rooms]) => ({ tipo, rooms }))
      }));
  }, [data?.habitaciones, catFilter]);

  const getReservationsForRoom = (roomId: number) => {
    if (!data?.reservas) return [];
    return data.reservas.filter((r: any) => r.habitacion_id === roomId);
  };

  const getBarStyle = (reserva: any) => {
    const resStart = new Date(reserva.check_in + 'T12:00:00');
    const resEnd = new Date(reserva.check_out + 'T12:00:00');
    const viewStart = dates[0];
    const viewEnd = addDays(dates[dates.length - 1], 1);
    const barStart = resStart < viewStart ? viewStart : resStart;
    const barEnd = resEnd > viewEnd ? viewEnd : resEnd;
    const totalViewDays = DAYS_TO_SHOW;
    const startOffset = daysBetween(formatDate(viewStart), formatDate(barStart));
    const barDays = daysBetween(formatDate(barStart), formatDate(barEnd));
    const left = (startOffset / totalViewDays) * 100;
    const width = (barDays / totalViewDays) * 100;
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  // Cloudbeds-style: show a small checkout indicator on the checkout day
  const getCheckoutIndicator = (reserva: any) => {
    const coDate = new Date(reserva.check_out + 'T12:00:00');
    const viewStart = dates[0];
    const viewEnd = addDays(dates[dates.length - 1], 1);
    if (coDate < viewStart || coDate >= viewEnd) return null;
    const offset = daysBetween(formatDate(viewStart), reserva.check_out);
    const left = (offset / DAYS_TO_SHOW) * 100;
    const w = (1 / DAYS_TO_SHOW) * 100 * 0.4; // 40% of the checkout day column
    return { left: `${left}%`, width: `${w}%` };
  };

  const isToday = (d: Date) => formatDate(d) === formatDate(new Date());
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  if (loading && !data) return <div className="animate-pulse text-gray-400 p-8">Cargando calendario...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Calendario</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronLeft size={20} /></button>
          <button onClick={today} className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">Hoy</button>
          <button onClick={next} className="p-2 hover:bg-gray-100 rounded-lg transition"><ChevronRight size={20} /></button>
          <span className="text-sm text-gray-500 ml-1">
            {monthNames[dates[0].getMonth()]} {dates[0].getDate()} — {monthNames[dates[dates.length - 1].getMonth()]} {dates[dates.length - 1].getDate()}, {dates[dates.length - 1].getFullYear()}
          </span>
          {/* Date Picker Search */}
          <div className="flex items-center gap-1 ml-2">
            <CalendarDays size={16} className="text-gray-400" />
            <input type="date" value={jumpDate} onChange={e => setJumpDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-ocean-400" />
            <button onClick={jumpTo} disabled={!jumpDate}
              className="px-3 py-1.5 text-xs bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 transition disabled:opacity-40">Ir</button>
          </div>
          {/* Category Filter */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setCatFilter('')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${!catFilter ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todas</button>
            <button onClick={() => setCatFilter('Estadía')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${catFilter === 'Estadía' ? 'bg-ocean-500 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'}`}>🏨 Estadía</button>
            <button onClick={() => setCatFilter('Pasadía')} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${catFilter === 'Pasadía' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>☀️ Pasadía</button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        {/* Date Headers */}
        <div className="flex border-b border-gray-200 bg-white">
          <div className={`${ROOM_COL_W} flex-shrink-0 bg-gray-50 border-r border-gray-200 px-3 py-2`}>
            <span className="text-xs font-semibold text-gray-500 uppercase">Habitación</span>
          </div>
          <div className="flex-1 flex">
            {dates.map((d, i) => (
              <div key={i} className={`flex-1 min-w-[50px] text-center border-r border-gray-100 py-2 ${isToday(d) ? 'bg-ocean-50' : isWeekend(d) ? 'bg-gray-50' : ''}`}>
                <div className="text-xs text-gray-400">{dayNames[d.getDay()]}</div>
                <div className={`text-sm font-semibold ${isToday(d) ? 'text-ocean-600' : 'text-gray-700'}`}>{d.getDate()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Room Rows */}
        {categoryGroups.map(catGroup => (
          <div key={catGroup.categoria}>
            {/* Category Header */}
            <div className="flex border-b border-gray-300 bg-gradient-to-r from-mahana-50 to-white">
              <div className={`${ROOM_COL_W} flex-shrink-0 px-3 py-2 border-r border-gray-300`}>
                <span className="text-xs font-bold text-mahana-700 uppercase tracking-wider">{catGroup.categoria === 'Estadía' ? '🏨 Estadía' : '☀️ Pasadía'}</span>
              </div>
              <div className="flex-1" />
            </div>

            {catGroup.groups.map(group => (
              <div key={group.tipo}>
                {/* Type Sub-Header */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <div className={`${ROOM_COL_W} flex-shrink-0 px-3 py-1 border-r border-gray-200`}>
                    <span className="text-[11px] font-semibold text-gray-500 uppercase">{group.tipo} ({group.rooms.length})</span>
                  </div>
                  <div className="flex-1" />
                </div>

                {/* Individual Room Rows */}
                {group.rooms.map((room: any) => {
                  const reservations = getReservationsForRoom(room.id);
                  return (
                    <div key={room.id} className="flex border-b border-gray-100 hover:bg-gray-50/50 group" style={{ minHeight: '40px' }}>
                      {/* Room Name */}
                      <div className={`${ROOM_COL_W} flex-shrink-0 border-r border-gray-200 px-3 py-1.5 flex items-center gap-2`}>
                        <span className="text-sm font-medium text-gray-700">{room.nombre}</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${room.estado_limpieza === 'Limpia' ? 'bg-green-400' : room.estado_limpieza === 'Inspeccionada' ? 'bg-blue-400' : 'bg-red-400'}`} title={room.estado_limpieza} />
                        {room.estado_habitacion === 'Ocupada' && <span className="text-[10px] text-orange-500">●</span>}
                      </div>

                      {/* Grid cells + Reservation bars */}
                      <div className="flex-1 relative">
                        <div className="flex absolute inset-0">
                          {dates.map((d, i) => (
                            <div key={i} className={`flex-1 min-w-[50px] border-r border-gray-50 cursor-pointer hover:bg-ocean-50/30 transition ${isToday(d) ? 'bg-ocean-50/20' : isWeekend(d) ? 'bg-gray-50/50' : ''}`}
                              onClick={() => navigate(`/reservas/nueva?check_in=${formatDate(d)}&check_out=${formatDate(addDays(d, 1))}&habitacion_id=${room.id}`)}
                              title={`Nueva reserva: ${room.nombre} — ${formatDate(d)}`}
                            />
                          ))}
                        </div>
                        {reservations.map((res: any) => {
                          const style = getBarStyle(res);
                          const coStyle = getCheckoutIndicator(res);
                          const colorClass = estadoColors[res.estado] || 'bg-gray-400';
                          return (
                            <div key={res.id}>
                              <Link to={`/reservas/${res.id}`}
                                className={`absolute top-1 bottom-1 ${colorClass} rounded-md flex items-center px-2 text-white text-xs font-medium shadow-sm hover:shadow-md hover:brightness-110 transition cursor-pointer overflow-hidden whitespace-nowrap z-10`}
                                style={style}
                                onMouseEnter={(e) => setTooltip({ reserva: res, x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setTooltip(null)}
                              >
                                <span className="truncate">{res.cliente} {res.plan_nombre ? `• ${res.plan_nombre}` : ''}</span>
                              </Link>
                              {coStyle && (
                                <div className={`absolute top-1 bottom-1 ${colorClass} opacity-40 rounded-r-md z-[9]`}
                                  style={coStyle} title={`Check-out: ${res.check_out}`} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl max-w-xs pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div className="font-semibold">{tooltip.reserva.cliente}</div>
          <div>{tooltip.reserva.check_in} → {tooltip.reserva.check_out} ({tooltip.reserva.noches}n)</div>
          <div>{tooltip.reserva.plan_nombre} • {tooltip.reserva.adultos}A {tooltip.reserva.menores > 0 ? `+ ${tooltip.reserva.menores}M` : ''}</div>
          <div className="text-green-300">${tooltip.reserva.monto_total?.toFixed(2)} • Saldo: ${tooltip.reserva.saldo_pendiente?.toFixed(2)}</div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400" /> Confirmada</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Hospedado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400" /> Pendiente</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400" /> Check-Out</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Cancelada</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400" /> Limpia</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Sucia</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Inspecc.</span>
      </div>
    </div>
  );
}
