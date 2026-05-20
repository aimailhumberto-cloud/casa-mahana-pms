import { useState, useEffect } from 'react';
import { Settings, Bell, RefreshCw, Mail, Phone, Calendar, ShieldAlert, CheckCircle2, XCircle, ArrowRightLeft, Eye, HelpCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { api } from '../api/client';

interface LogNotificacion {
  id: number;
  reserva_id: number;
  tipo: string;
  canal: string;
  destinatario: string;
  resultado: string;
  contenido?: string;
  created_at: string;
}

interface LogReversion {
  id: number;
  reserva_id: number;
  folio_id: number;
  monto: number;
  concepto_original: string;
  motivo: string;
  reversado_por: string;
  fecha: string;
}

interface User {
  id: number;
  nombre: string;
  rol: 'admin' | 'receptionist' | 'cleaning';
}

export default function Configuracion({ user }: { user: User }) {
  const isAdmin = user?.rol === 'admin';
  const [activeTab, setActiveTab] = useState<'notificaciones' | 'logs' | 'reversiones'>('notificaciones');
  
  // Tab 1: Configuración de Notificaciones
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  const [waApiUrl, setWaApiUrl] = useState('');
  const [waApiToken, setWaApiToken] = useState('');
  const [waFromNumber, setWaFromNumber] = useState('');
  const [waEnabled, setWaEnabled] = useState(false);
  
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState('');
  const [configErrorMsg, setConfigErrorMsg] = useState('');

  // Tab 2: Logs de Notificaciones
  const [logs, setLogs] = useState<LogNotificacion[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [logMeta, setLogMeta] = useState<any>({});
  const [logsPage, setLogsPage] = useState(1);
  const [selectedLogResult, setSelectedLogResult] = useState<any | null>(null);

  // Selected log for premium detail view
  const [selectedLogForView, setSelectedLogForView] = useState<LogNotificacion | null>(null);
  const [resendingLogId, setResendingLogId] = useState<number | null>(null);

  // Tab 3: Logs de Reversiones
  const [reversiones, setReversiones] = useState<LogReversion[]>([]);
  const [loadingReversiones, setLoadingReversiones] = useState(false);
  const [reversionesPage, setReversionesPage] = useState(1);
  const [reversionesMeta, setReversionesMeta] = useState<any>({});

  // 1. Load System Config
  const loadConfig = () => {
    setLoadingConfig(true);
    api.get('/admin/configuracion/sistema')
      .then(r => {
        const c = r.data;
        if (c) {
          setSmtpHost(c.smtp_host || '');
          setSmtpPort(c.smtp_port || 587);
          setSmtpUser(c.smtp_user || '');
          setSmtpPass(c.smtp_pass || '');
          setSmtpFrom(c.smtp_from || '');
          setAdminEmail(c.admin_email || '');
          setNotificationsEnabled(c.notifications_enabled === 1);
          
          setWaApiUrl(c.wa_api_url || '');
          setWaApiToken(c.wa_api_token || '');
          setWaFromNumber(c.wa_from_number || '');
          setWaEnabled(c.wa_enabled === 1);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  };

  // 2. Load Notification Logs
  const loadLogs = () => {
    setLoadingLogs(true);
    const params: any = { page: logsPage, limit: 20 };
    
    // Custom filtering by channel/type if not "all"
    let searchParts: string[] = [];
    if (filterType !== 'all') searchParts.push(filterType);
    if (filterChannel !== 'all') searchParts.push(filterChannel);
    if (searchParts.length > 0) {
      params.search = searchParts.join(' ');
    }

    api.get('/admin/configuracion/logs', { params })
      .then(r => {
        setLogs(r.data || []);
        setLogMeta(r.meta || {});
      })
      .catch(() => {})
      .finally(() => setLoadingLogs(false));
  };

  // 3. Load Reversion Logs
  const loadReversiones = () => {
    if (!isAdmin) return;
    setLoadingReversiones(true);
    const params = { page: reversionesPage, limit: 20 };
    api.get('/admin/configuracion/reversiones', { params })
      .then(r => {
        setReversiones(r.data || []);
        setReversionesMeta(r.meta || {});
      })
      .catch(() => {})
      .finally(() => setLoadingReversiones(false));
  };

  useEffect(() => {
    if (activeTab === 'notificaciones') {
      loadConfig();
    } else if (activeTab === 'logs') {
      loadLogs();
    } else if (activeTab === 'reversiones') {
      loadReversiones();
    }
  }, [activeTab, logsPage, reversionesPage, filterType, filterChannel]);

  // Handle save configuration
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingConfig(true);
    setConfigSuccessMsg('');
    setConfigErrorMsg('');
    
    try {
      const payload = {
        smtp_host: smtpHost || null,
        smtp_port: smtpPort ? Number(smtpPort) : null,
        smtp_user: smtpUser || null,
        smtp_pass: smtpPass || null,
        smtp_from: smtpFrom || null,
        admin_email: adminEmail || null,
        notifications_enabled: notificationsEnabled ? 1 : 0,
        wa_api_url: waApiUrl || null,
        wa_api_token: waApiToken || null,
        wa_from_number: waFromNumber || null,
        wa_enabled: waEnabled ? 1 : 0
      };
      
      await api.put('/admin/configuracion/sistema', payload);
      setConfigSuccessMsg('Configuración guardada exitosamente.');
      loadConfig();
    } catch (err: any) {
      setConfigErrorMsg(err.response?.data?.error?.message || 'Error al guardar la configuración');
    } finally {
      setSavingConfig(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      // Split T to prevent time offsets
      const parts = dateStr.split(' ');
      if (parts.length > 0) {
        const d = new Date(dateStr.replace(' ', 'T'));
        return d.toLocaleString('es-PA', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Status parser helper
  const parseResultStatus = (resultadoStr: string) => {
    try {
      const parsed = JSON.parse(resultadoStr);
      if (parsed.status === 'success' || parsed.success === true || parsed.sent === true) {
        return { success: true, text: 'Exitoso', details: parsed };
      }
      return { success: false, text: 'Fallido', details: parsed };
    } catch {
      // String backup
      if (resultadoStr?.toLowerCase().includes('success') || resultadoStr?.toLowerCase().includes('ok')) {
        return { success: true, text: 'Exitoso', details: { raw: resultadoStr } };
      }
      return { success: false, text: 'Fallido', details: { error: resultadoStr } };
    }
  };

  const handleResendNotif = async (logId: number) => {
    setResendingLogId(logId);
    try {
      await api.post(`/hotel/notificaciones/${logId}/reenviar`);
      alert('Notificación reenviada exitosamente');
      loadLogs();
      // If the selected log is currently open, update its representation
      if (selectedLogForView?.id === logId) {
        setSelectedLogForView(prev => prev ? { ...prev, tipo: prev.tipo.endsWith('_reenvio') ? prev.tipo : prev.tipo + '_reenvio' } : null);
      }
    } catch (e: any) {
      alert(e?.response?.data?.error?.message || 'Error al reenviar la notificación');
    } finally {
      setResendingLogId(null);
    }
  };

  const getNotifTypeLabel = (type: string) => {
    const cleanType = type.replace('_reenvio', '');
    const labels: Record<string, string> = {
      confirmacion: 'Confirmación',
      estado: 'Cambio de Estado',
      pago: 'Recibo de Pago',
      recordatorio: 'Recordatorio',
    };
    const isReenvio = type.endsWith('_reenvio');
    return (
      <span className="text-gray-700 font-medium flex items-center gap-1.5">
        {labels[cleanType] || cleanType}
        {isReenvio && (
          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase tracking-wider">
            Reenvío
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Settings size={28} className="text-mahana-600" /> Configuración de Sistema
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Ajusta las notificaciones automatizadas, visualiza el historial de mensajes y monitorea auditorías.
        </p>
      </div>

      {/* Premium Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('notificaciones')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'notificaciones' ? 'border-mahana-500 text-mahana-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <Bell size={16} /> Configuración de Notificaciones
        </button>
        <button
          onClick={() => { setActiveTab('logs'); setLogsPage(1); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'logs' ? 'border-mahana-500 text-mahana-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
          <Mail size={16} /> Registro de Notificaciones
        </button>
        {isAdmin && (
          <button
            onClick={() => { setActiveTab('reversiones'); setReversionesPage(1); }}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'reversiones' ? 'border-mahana-500 text-mahana-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
          >
            <ArrowRightLeft size={16} /> Registro de Reversiones
          </button>
        )}
      </div>

      {/* Tab 1 Content: Notification Configuration */}
      {activeTab === 'notificaciones' && (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden p-6 space-y-6">
          {!isAdmin && (
            <div className="bg-amber-50 text-amber-800 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-sm">Acceso de Solo Lectura</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  Como Recepcionista, puedes visualizar esta configuración pero no cuentas con permisos para modificarla.
                  Por favor, contacta a un Administrador si requieres realizar cambios.
                </p>
              </div>
            </div>
          )}

          {loadingConfig ? (
            <div className="p-12 text-center text-gray-400 animate-pulse">Cargando configuración...</div>
          ) : (
            <form onSubmit={handleSaveConfig} className="space-y-8">
              {configSuccessMsg && (
                <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-xl border border-green-200 flex items-center gap-2">
                  <CheckCircle2 size={18} /> {configSuccessMsg}
                </div>
              )}
              {configErrorMsg && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200 flex items-center gap-2">
                  <XCircle size={18} /> {configErrorMsg}
                </div>
              )}

              {/* SMTP Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                    <Mail size={18} className="text-mahana-600" /> Correo Electrónico (SMTP)
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={notificationsEnabled}
                      onChange={e => setNotificationsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-mahana-500"></div>
                    <span className="ml-2 text-xs font-semibold text-gray-700">
                      {notificationsEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </span>
                  </label>
                </div>
                
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl text-amber-800 flex items-start gap-3 shadow-xs">
                  <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm text-amber-900">⚠️ Recomendación de Entregabilidad SMTP</h4>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      <strong>IMPORTANTE:</strong> Para evitar que los correos sean catalogados como Spam o rechazados por los servidores de destino, asegúrese de que el dominio de <strong>"Correo de Remitente (De)"</strong> coincida exactamente con el dominio de su <strong>"Usuario SMTP"</strong> (ej. @casamahana.com).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={smtpHost}
                      onChange={e => setSmtpHost(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="smtp.example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      SMTP Port
                    </label>
                    <input
                      type="number"
                      disabled={!isAdmin}
                      value={smtpPort}
                      onChange={e => setSmtpPort(Number(e.target.value))}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="587"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Correo de Remitente (De)
                    </label>
                    <input
                      type="email"
                      disabled={!isAdmin}
                      value={smtpFrom}
                      onChange={e => setSmtpFrom(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="info@casamahana.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Usuario SMTP
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={smtpUser}
                      onChange={e => setSmtpUser(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="info@casamahana.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Contraseña SMTP
                    </label>
                    <input
                      type="password"
                      disabled={!isAdmin}
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Correo de Alertas (Admin)
                    </label>
                    <input
                      type="email"
                      disabled={!isAdmin}
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="admin@casamahana.com"
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h2 className="font-bold text-gray-800 text-base flex items-center gap-2">
                    <Phone size={18} className="text-green-600" /> API de WhatsApp
                  </h2>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={waEnabled}
                      onChange={e => setWaEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    <span className="ml-2 text-xs font-semibold text-gray-700">
                      {waEnabled ? 'Habilitado' : 'Deshabilitado'}
                    </span>
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      WhatsApp API URL
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={waApiUrl}
                      onChange={e => setWaApiUrl(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="https://graph.facebook.com/v19.0/.../messages"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      Número WhatsApp Remitente (ID/From)
                    </label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={waFromNumber}
                      onChange={e => setWaFromNumber(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="10555555555"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                      WhatsApp Token de Acceso (Bearer)
                    </label>
                    <input
                      type="password"
                      disabled={!isAdmin}
                      value={waApiToken}
                      onChange={e => setWaApiToken(e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-mahana-400 focus:border-transparent outline-none transition text-sm disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder="EAAGb..."
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2.5 bg-gradient-to-r from-mahana-500 to-mahana-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition disabled:opacity-50"
                  >
                    {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* Tab 2 Content: Notification logs */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 border border-gray-200 rounded-xl flex flex-wrap gap-3 items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Filtrar por:</span>
            
            <div className="w-full sm:w-48">
              <select
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setLogsPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 outline-none bg-white"
              >
                <option value="all">Cualquier Plantilla</option>
                <option value="confirmacion">Confirmación</option>
                <option value="estado">Cambio de Estado</option>
                <option value="pago">Recibo de Pago</option>
                <option value="recordatorio">Recordatorio</option>
              </select>
            </div>

            <div className="w-full sm:w-48">
              <select
                value={filterChannel}
                onChange={e => { setFilterChannel(e.target.value); setLogsPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 outline-none bg-white"
              >
                <option value="all">Cualquier Canal</option>
                <option value="email">Correo Electrónico</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>

            <button
              onClick={() => { setLogsPage(1); loadLogs(); }}
              className="p-2 text-gray-500 hover:text-mahana-600 hover:bg-gray-50 border border-gray-200 rounded-lg ml-auto transition"
              title="Refrescar logs"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {loadingLogs ? (
              <div className="p-12 text-center text-gray-400 animate-pulse">Cargando registros de mensajería...</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No se encontraron logs de notificaciones</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                      <th className="px-6 py-4 text-left font-medium">Fecha</th>
                      <th className="px-6 py-4 text-center font-medium w-24">Canal</th>
                      <th className="px-6 py-4 text-left font-medium">Destinatario</th>
                      <th className="px-6 py-4 text-left font-medium">Plantilla / Tipo</th>
                      <th className="px-6 py-4 text-left font-medium">Reserva</th>
                      <th className="px-6 py-4 text-center font-medium w-32">Estado</th>
                      <th className="px-6 py-4 text-center font-medium w-32">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map(log => {
                      const statusInfo = parseResultStatus(log.resultado);
                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedLogForView(log)}
                          className="hover:bg-gray-50/70 transition cursor-pointer"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-gray-400" />
                              <span>{formatDate(log.created_at)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              {log.canal === 'email' ? (
                                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 block" title="Email"><Mail size={16} /></span>
                              ) : (
                                <span className="p-1.5 rounded-lg bg-green-50 text-green-600 border border-green-100 block" title="WhatsApp"><Phone size={16} /></span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-700 font-sans">
                            {log.destinatario || '—'}
                          </td>
                          <td className="px-6 py-4">
                            {getNotifTypeLabel(log.tipo)}
                          </td>
                          <td className="px-6 py-4">
                            {log.reserva_id ? (
                              <a
                                href={`/reservas/${log.reserva_id}`}
                                className="text-ocean-600 font-semibold hover:underline inline-flex items-center gap-1"
                                onClick={e => e.stopPropagation()}
                              >
                                #{log.reserva_id} <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {statusInfo.success ? (
                                <>
                                  <CheckCircle2 size={16} className="text-green-500" />
                                  <span className="text-xs font-semibold text-green-700">Entregado</span>
                                </>
                              ) : (
                                <>
                                  <XCircle size={16} className="text-red-500" />
                                  <span className="text-xs font-semibold text-red-700">Fallido</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedLogForView(log)}
                                className="p-1.5 rounded-lg text-ocean-600 hover:bg-ocean-50 border border-transparent hover:border-ocean-100 transition"
                                title="Ver mensaje enviado"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('¿Está seguro de que desea reenviar esta notificación?')) {
                                    handleResendNotif(log.id);
                                  }
                                }}
                                disabled={resendingLogId === log.id || !log.contenido}
                                className={`p-1.5 rounded-lg border border-transparent transition ${
                                  !log.contenido
                                    ? 'text-gray-200 cursor-not-allowed bg-transparent hover:border-transparent'
                                    : 'text-green-600 hover:bg-green-50 hover:border-green-100'
                                }`}
                                title={!log.contenido ? 'Registro histórico sin contenido guardado' : 'Reenviar notificación'}
                              >
                                <RefreshCw size={16} className={resendingLogId === log.id ? 'animate-spin' : ''} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {logMeta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
              <span>Registros {((logsPage - 1) * 20) + 1} - {Math.min(logsPage * 20, logMeta.total)} de {logMeta.total}</span>
              <div className="flex gap-2">
                <button
                  disabled={logsPage <= 1}
                  onClick={() => setLogsPage(p => p - 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={logsPage >= logMeta.pages}
                  onClick={() => setLogsPage(p => p + 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3 Content: Reversions Logs */}
      {activeTab === 'reversiones' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {loadingReversiones ? (
              <div className="p-12 text-center text-gray-400 animate-pulse">Cargando bitácora de reversiones...</div>
            ) : reversiones.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No se han registrado reversiones en el folio</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
                      <th className="px-6 py-4 text-left font-medium">Fecha/Hora</th>
                      <th className="px-6 py-4 text-left font-medium">Autor de Reversión</th>
                      <th className="px-6 py-4 text-left font-medium">Reserva</th>
                      <th className="px-6 py-4 text-left font-medium">Folio ID</th>
                      <th className="px-6 py-4 text-right font-medium">Monto Reversado</th>
                      <th className="px-6 py-4 text-left font-medium">Concepto Original</th>
                      <th className="px-6 py-4 text-left font-medium">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reversiones.map(rev => (
                      <tr key={rev.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span>{formatDate(rev.fecha)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-700">
                          {rev.reversado_por}
                        </td>
                        <td className="px-6 py-4">
                          {rev.reserva_id ? (
                            <a
                              href={`/reservas/${rev.reserva_id}`}
                              className="text-ocean-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              #{rev.reserva_id} <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-xs font-semibold">
                            #F-{rev.folio_id}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-red-600 whitespace-nowrap">
                          -${Number(rev.monto).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {rev.concepto_original || '—'}
                        </td>
                        <td className="px-6 py-4 text-gray-600 font-medium max-w-xs truncate" title={rev.motivo}>
                          {rev.motivo || 'Sin especificar'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {reversionesMeta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
              <span>Registros {((reversionesPage - 1) * 20) + 1} - {Math.min(reversionesPage * 20, reversionesMeta.total)} de {reversionesMeta.total}</span>
              <div className="flex gap-2">
                <button
                  disabled={reversionesPage <= 1}
                  onClick={() => setReversionesPage(p => p - 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={reversionesPage >= reversionesMeta.pages}
                  onClick={() => setReversionesPage(p => p + 1)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw JSON Error Modal */}
      {selectedLogResult && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-6 py-4 text-white flex justify-between items-center">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <ShieldAlert size={20} /> Detalle del Fallo de Envío
              </h2>
              <button
                onClick={() => setSelectedLogResult(null)}
                className="text-white/80 hover:text-white text-xl outline-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                A continuación se muestra el error devuelto por la pasarela de mensajería:
              </p>
              <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-72 border border-gray-800 shadow-inner">
                {JSON.stringify(selectedLogResult, null, 2)}
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLogResult(null)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualizador de Mensaje de Notificación (Configuración) */}
      {selectedLogForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-55 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 relative flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Mail size={20} className="text-ocean-600" /> Detalle de Notificación Enviada
              </h3>
              <button
                onClick={() => setSelectedLogForView(null)}
                className="text-gray-400 hover:text-gray-600 transition outline-none text-xl animate-scaleIn"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl mb-4 shrink-0">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Destinatario:</span>
                <p className="font-semibold text-gray-800 break-all">{selectedLogForView.destinatario || '—'}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Fecha de Envío:</span>
                <p className="font-semibold text-gray-800">{formatDate(selectedLogForView.created_at)}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Canal de Envío:</span>
                <div className="mt-1">
                  {selectedLogForView.canal === 'email' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 font-semibold text-xs">
                      <Mail size={12} /> Correo Electrónico
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-100 font-semibold text-xs">
                      <Phone size={12} /> WhatsApp
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Plantilla / Tipo:</span>
                <div className="mt-1">
                  {getNotifTypeLabel(selectedLogForView.tipo)}
                </div>
              </div>
              {selectedLogForView.reserva_id && (
                <div className="md:col-span-2">
                  <span className="text-xs font-bold text-gray-400 uppercase">Reserva Relacionada:</span>
                  <p className="mt-0.5">
                    <a
                      href={`/reservas/${selectedLogForView.reserva_id}`}
                      className="text-ocean-600 font-semibold hover:underline inline-flex items-center gap-1 text-sm font-sans"
                      onClick={() => setSelectedLogForView(null)}
                    >
                      Ver Reserva #{selectedLogForView.reserva_id} <ExternalLink size={12} />
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Error detail banner if failed */}
            {(() => {
              const statusInfo = parseResultStatus(selectedLogForView.resultado);
              if (!statusInfo.success) {
                return (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 shrink-0 text-sm">
                    <h4 className="font-bold text-red-800 flex items-center gap-1.5 mb-1">
                      <ShieldAlert size={16} /> Error de Entrega / Envío
                    </h4>
                    <p className="text-red-700 text-xs font-mono bg-white p-2.5 border border-red-100 rounded-lg overflow-x-auto max-h-24">
                      {typeof statusInfo.details === 'object' ? JSON.stringify(statusInfo.details) : String(statusInfo.details || 'Error desconocido')}
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex-1 overflow-y-auto mb-4 min-h-[250px]">
              <span className="text-xs font-bold text-gray-400 uppercase block mb-1.5">Contenido del Mensaje:</span>
              
              {selectedLogForView.canal === 'email' ? (
                selectedLogForView.contenido ? (
                  <iframe
                    title="Previsualización de Correo"
                    srcDoc={selectedLogForView.contenido}
                    className="w-full h-[300px] border border-gray-200 rounded-xl bg-white shadow-inner"
                    sandbox="allow-popups"
                  />
                ) : (
                  <div className="flex items-center justify-center h-48 border border-gray-100 rounded-xl bg-gray-50 text-gray-400 text-sm italic">
                    Sin contenido guardado (registro histórico previo a la actualización)
                  </div>
                )
              ) : (
                /* WhatsApp Mockup Chat bubble */
                selectedLogForView.contenido ? (
                  <div
                    className="bg-[#efeae2] p-6 rounded-xl border border-gray-200 relative overflow-hidden"
                    style={{
                      backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
                      backgroundRepeat: 'repeat',
                    }}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="bg-[#d9fdd3] text-gray-800 p-4 rounded-lg shadow-sm max-w-[85%] self-end relative border border-[#e1f3d4]">
                        <p className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-gray-700">
                          {selectedLogForView.contenido}
                        </p>
                        <span className="text-[10px] text-gray-400 block text-right mt-2 font-medium">
                          {formatDate(selectedLogForView.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 border border-gray-100 rounded-xl bg-gray-50 text-gray-400 text-sm italic">
                    Sin contenido guardado (registro histórico previo a la actualización)
                  </div>
                )
              )}
            </div>

            <div className="flex justify-between items-center border-t border-gray-100 pt-4 shrink-0 font-sans">
              {!selectedLogForView.contenido ? (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                  ⚠️ Registro histórico sin contenido guardado. No es posible reenviar.
                </span>
              ) : (
                <button
                  onClick={() => {
                    if (confirm('¿Está seguro de que desea reenviar este mensaje al destinatario original?')) {
                      handleResendNotif(selectedLogForView.id);
                    }
                  }}
                  disabled={resendingLogId !== null}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={14} className={resendingLogId === selectedLogForView.id ? 'animate-spin' : ''} />
                  {resendingLogId === selectedLogForView.id ? 'Reenviando...' : 'Reenviar Notificación'}
                </button>
              )}

              <button
                onClick={() => setSelectedLogForView(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
