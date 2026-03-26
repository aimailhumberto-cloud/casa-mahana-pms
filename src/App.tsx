import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { api, setToken, clearToken, isLoggedIn } from './api/client';
import { Hotel, CalendarDays, BedDouble, DollarSign, LogOut, Menu, X, LayoutGrid, Settings, Package } from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Reservas from './pages/Reservas';
import NuevaReserva from './pages/NuevaReserva';
import ReservaDetalle from './pages/ReservaDetalle';
import Habitaciones from './pages/Habitaciones';
import AdminHabitaciones from './pages/AdminHabitaciones';
import Calendario from './pages/Calendario';
import Saldos from './pages/Saldos';
import Productos from './pages/Productos';
import BookingWidget from './pages/BookingWidget';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isLoggedIn()) {
      api.get('/auth/me').then(r => { setUser(r.data); setLoading(false); })
        .catch(() => { clearToken(); setLoading(false); });
    } else { setLoading(false); }
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.data.token);
    setUser(r.data.user);
  };

  const handleLogout = () => { clearToken(); setUser(null); navigate('/login'); };

  // Public route: /reservar (no auth needed)
  if (location.pathname === '/reservar') return <BookingWidget />;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-xl text-gray-400">Cargando...</div></div>;
  if (!user) return <Login onLogin={handleLogin} />;

  const nav = [
    { path: '/', label: 'Dashboard', icon: Hotel },
    { path: '/calendario', label: 'Calendario', icon: LayoutGrid },
    { path: '/reservas', label: 'Reservas', icon: CalendarDays },
    { path: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
    { path: '/productos', label: 'Productos', icon: Package },
    { path: '/admin/habitaciones', label: 'Config Rooms', icon: Settings },
    { path: '/saldos', label: 'CxC', icon: DollarSign },
  ];

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 sticky top-0 z-40">
        <button className="lg:hidden mr-3 text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Casa Mahana" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-semibold text-gray-800 text-lg">Casa Mahana</span>
          <span className="text-xs text-gray-400 hidden sm:block">PMS</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{user.nombre}</span>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 transition" title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-56 bg-white border-r border-gray-200 pt-16 lg:pt-2 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <nav className="p-3 space-y-1">
            {nav.map(n => (
              <Link key={n.path} to={n.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive(n.path) ? 'bg-mahana-50 text-mahana-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                <n.icon size={18} />
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Backdrop */}
        {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Main Content */}
        <main className="flex-1 p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/reservas" element={<Reservas />} />
            <Route path="/reservas/nueva" element={<NuevaReserva />} />
            <Route path="/reservas/:id" element={<ReservaDetalle />} />
            <Route path="/habitaciones" element={<Habitaciones />} />
            <Route path="/admin/habitaciones" element={<AdminHabitaciones />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/saldos" element={<Saldos />} />
            <Route path="/login" element={<Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
