import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';

const estadoColor: Record<string, string> = {
  'Confirmada': 'bg-blue-100 text-blue-700',
  'Hospedado': 'bg-green-100 text-green-700',
  'Check-Out': 'bg-gray-100 text-gray-600',
  'Pendiente': 'bg-yellow-100 text-yellow-700',
  'Cancelada': 'bg-red-100 text-red-700',
  'No-Show': 'bg-red-50 text-red-500',
};

export default function Reservas() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  const load = () => {
    setLoading(true);
    let q = '/hotel/reservas?limit=100';
    if (filtroEstado) q += `&estado=${filtroEstado}`;
    if (filtroCliente) q += `&cliente=${filtroCliente}`;
    api.get(q).then(r => setReservas(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filtroEstado]);

  // Filter by category client-side (reserva has habitacion info)
  const filteredReservas = filtroCategoria
    ? reservas.filter(r => r.categoria_habitacion === filtroCategoria)
    : reservas;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reservas</h1>
        <Link to="/reservas/nueva" className="flex items-center gap-2 bg-mahana-500 text-white px-5 py-2.5 rounded-xl hover:bg-mahana-600 transition font-medium">
          <Plus size={18} /> Nueva Reserva
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input type="text" placeholder="Buscar cliente..." value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-mahana-400 outline-none text-sm" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-mahana-400 outline-none">
          <option value="">Todos los estados</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Confirmada">Confirmada</option>
          <option value="Hospedado">Hospedado</option>
          <option value="Check-Out">Check-Out</option>
          <option value="Cancelada">Cancelada</option>
          <option value="No-Show">No-Show</option>
        </select>
        {/* Category Filter */}
        <div className="flex items-center gap-1">
          <button onClick={() => setFiltroCategoria('')} className={`px-3 py-2 text-xs rounded-lg font-medium transition ${!filtroCategoria ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todas</button>
          <button onClick={() => setFiltroCategoria('Estadía')} className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filtroCategoria === 'Estadía' ? 'bg-ocean-500 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'}`}>🏨 Estadía</button>
          <button onClick={() => setFiltroCategoria('Pasadía')} className={`px-3 py-2 text-xs rounded-lg font-medium transition ${filtroCategoria === 'Pasadía' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>☀️ Pasadía</button>
        </div>
        <button onClick={load} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm font-medium">Buscar</button>
      </div>

      {/* Table */}
      {loading ? <div className="animate-pulse text-gray-400 p-8">Cargando...</div> : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredReservas.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No hay reservas</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Cliente</th>
                    <th className="px-4 py-3 text-center">Categoría</th>
                    <th className="px-4 py-3 text-left">Habitación</th>
                    <th className="px-4 py-3 text-left">Check-in</th>
                    <th className="px-4 py-3 text-left">Check-out</th>
                    <th className="px-4 py-3 text-center">Noches</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredReservas.map((r: any) => (
                    <tr key={r.id} className="hover:bg-gray-50 cursor-pointer">
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.id}</td>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/reservas/${r.id}`} className="text-ocean-600 hover:underline">
                          {r.cliente} {r.plan_nombre ? <span className="text-xs text-gray-400 ml-1">{r.plan_nombre}</span> : ''}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.categoria_habitacion === 'Pasadía' ? 'bg-amber-100 text-amber-700' : 'bg-ocean-100 text-ocean-700'}`}>
                          {r.categoria_habitacion === 'Pasadía' ? '☀️' : '🏨'} {r.categoria_habitacion || 'Estadía'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.habitacion_nombre || r.tipo_habitacion || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{r.check_in}</td>
                      <td className="px-4 py-3 text-gray-500">{r.check_out}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{r.noches}</td>
                      <td className="px-4 py-3 text-gray-500">{r.plan_nombre || '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">${r.monto_total?.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${r.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ${r.saldo_pendiente?.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor[r.estado] || 'bg-gray-100'}`}>{r.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
