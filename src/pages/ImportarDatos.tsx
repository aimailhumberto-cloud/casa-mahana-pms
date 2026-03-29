import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowRight, Download, Info, X } from 'lucide-react';
import { api } from '../api/client';

interface PreviewRow {
  row: number;
  status: string;
  guest?: string;
  dates?: string;
  room?: string;
  total?: number;
  estado?: string;
  errors?: string[];
  warnings?: string[];
  existingId?: number;
}

interface ImportResult {
  filename: string;
  total_rows?: number;
  headers?: string[];
  mapping?: Record<string, string>;
  unmapped?: string[];
  preview?: PreviewRow[];
  summary: {
    will_import?: number;
    imported?: number;
    duplicates: number;
    errors: number;
    total?: number;
  };
  details?: PreviewRow[];
}

export default function ImportarDatos() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ total_imported: number; last_import: string | null } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load import stats on mount
  useState(() => {
    api.get('/admin/import/stats').then(r => setStats(r.data.data)).catch(() => {});
  });

  const handleFile = (f: File) => {
    const validExts = ['.csv', '.xlsx', '.xls', '.tsv'];
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
      setError('Formato no soportado. Usa CSV, XLSX, XLS o TSV.');
      return;
    }
    setFile(f);
    setError('');
    setPreview(null);
    setResult(null);
    setPhase('upload');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('archivo', file);
      const r = await api.post('/admin/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(r.data.data);
      setPhase('preview');
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Error procesando archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setPhase('importing');
    setLoading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('archivo', file);
      const r = await api.post('/admin/import/execute', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(r.data.data);
      setPhase('done');
      // Refresh stats
      api.get('/admin/import/stats').then(r => setStats(r.data.data)).catch(() => {});
    } catch (e: any) {
      setError(e.response?.data?.error?.message || 'Error importando datos');
      setPhase('preview');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setPhase('upload');
    if (fileRef.current) fileRef.current.value = '';
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'preview':
      case 'imported': return <CheckCircle2 size={16} className="text-green-500" />;
      case 'duplicate': return <AlertTriangle size={16} className="text-amber-500" />;
      case 'error': return <XCircle size={16} className="text-red-500" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'preview': return 'Listo';
      case 'imported': return 'Importado';
      case 'duplicate': return 'Duplicado';
      case 'error': return 'Error';
      default: return status;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Importar Datos</h1>
          <p className="text-sm text-gray-500 mt-1">Cargar historial desde Cloudbeds (CSV / Excel)</p>
        </div>
        {stats && stats.total_imported > 0 && (
          <div className="text-right text-sm text-gray-500">
            <div className="font-medium text-gray-700">{stats.total_imported} reservas importadas</div>
            {stats.last_import && <div>Última: {new Date(stats.last_import).toLocaleDateString()}</div>}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 space-y-2">
            <p className="font-semibold">Cómo exportar desde Cloudbeds:</p>
            <ol className="list-decimal ml-4 space-y-1">
              <li>En Cloudbeds → <strong>Reservations</strong> → filtrar el rango de fechas</li>
              <li>Click en el ícono <strong>Export Reservations</strong> (📥)</li>
              <li>Seleccionar todos los campos disponibles (moverlos a "Selected Columns")</li>
              <li>Click <strong>Exportar</strong> → descargar CSV o XLSX</li>
              <li>Subir ese archivo aquí</li>
            </ol>
            <p className="text-blue-600">Campos recomendados: First Name, Surname, Check-in, Check-out, Room Type, Room #, Status, Total, Balance, Source, Adults, Children, Email, Phone</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={18} /></button>
        </div>
      )}

      {/* Upload Zone */}
      {phase === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer
            ${dragging ? 'border-mahana-500 bg-mahana-50' : file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-mahana-400 hover:bg-mahana-50/50'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.tsv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {file ? (
            <div className="space-y-3">
              <FileSpreadsheet size={48} className="mx-auto text-green-500" />
              <div>
                <p className="text-lg font-semibold text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handlePreview(); }}
                disabled={loading}
                className="px-6 py-2.5 bg-mahana-600 text-white rounded-lg hover:bg-mahana-700 disabled:opacity-50 font-medium inline-flex items-center gap-2"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                {loading ? 'Analizando...' : 'Analizar Archivo'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload size={48} className="mx-auto text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-600">Arrastra tu archivo aquí</p>
                <p className="text-sm text-gray-400">o haz click para seleccionar</p>
              </div>
              <p className="text-xs text-gray-400">Formatos: CSV, XLSX, XLS, TSV · Máx 50MB</p>
            </div>
          )}
        </div>
      )}

      {/* Preview Phase */}
      {phase === 'preview' && preview && (
        <div className="space-y-4">
          {/* Mapping Info */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-mahana-600" />
              Mapeo de Columnas Detectado
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {Object.entries(preview.mapping || {}).map(([pmsField, cbHeader]) => (
                <div key={pmsField} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-1.5">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <span className="text-gray-500">{cbHeader}</span>
                  <ArrowRight size={12} className="text-gray-400" />
                  <span className="font-medium text-gray-700">{pmsField}</span>
                </div>
              ))}
            </div>
            {preview.unmapped && preview.unmapped.length > 0 && (
              <div className="text-sm text-gray-500">
                <span className="font-medium">Columnas no mapeadas:</span> {preview.unmapped.join(', ')}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{preview.summary.will_import}</div>
              <div className="text-sm text-gray-500">Listas para importar</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-500">{preview.summary.duplicates}</div>
              <div className="text-sm text-gray-500">Duplicadas (se omiten)</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-500">{preview.summary.errors}</div>
              <div className="text-sm text-gray-500">Con errores</div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">Preview ({preview.preview?.length || 0} de {preview.total_rows} filas)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">#</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Estado</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Huésped</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Fechas</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Habitación</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-medium">Total</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Status</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(preview.preview || []).map((row, i) => (
                    <tr key={i} className={row.status === 'error' ? 'bg-red-50/50' : row.status === 'duplicate' ? 'bg-amber-50/50' : ''}>
                      <td className="px-4 py-2 text-gray-400">{row.row}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center gap-1">
                          {statusIcon(row.status)}
                          <span className="text-xs">{statusLabel(row.status)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-800">{row.guest || '—'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{row.dates || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{row.room || '—'}</td>
                      <td className="px-4 py-2 text-right text-gray-700 font-medium">{row.total ? `$${row.total.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-2">
                        {row.estado && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            row.estado === 'Confirmada' ? 'bg-green-100 text-green-700' :
                            row.estado === 'Hospedado' ? 'bg-blue-100 text-blue-700' :
                            row.estado === 'Check-Out' ? 'bg-gray-100 text-gray-700' :
                            row.estado === 'Cancelada' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{row.estado}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {row.errors?.map((e, j) => (
                          <span key={j} className="text-red-600 block">{e}</span>
                        ))}
                        {row.warnings?.map((w, j) => (
                          <span key={j} className="text-amber-600 block">{w}</span>
                        ))}
                        {row.existingId && (
                          <span className="text-amber-600">Ya existe (ID: {row.existingId})</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <button onClick={reset} className="px-4 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Empezar de nuevo
            </button>
            <div className="flex gap-3">
              {preview.summary.will_import! > 0 && (
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium inline-flex items-center gap-2 shadow-lg shadow-green-600/20"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                  Importar {preview.summary.will_import} Reservas
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Importing Phase */}
      {phase === 'importing' && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <RefreshCw size={48} className="mx-auto text-mahana-500 animate-spin mb-4" />
          <p className="text-lg font-semibold text-gray-800">Importando reservas...</p>
          <p className="text-sm text-gray-500 mt-2">Esto puede tomar unos segundos. No cierres esta página.</p>
        </div>
      )}

      {/* Done Phase */}
      {phase === 'done' && result && (
        <div className="space-y-4">
          {/* Success Header */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle2 size={48} className="mx-auto text-green-500 mb-3" />
            <h2 className="text-xl font-bold text-green-800">¡Importación Completada!</h2>
            <p className="text-sm text-green-600 mt-1">{result.filename}</p>
          </div>

          {/* Final Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-800">{result.summary.total}</div>
              <div className="text-sm text-gray-500">Total en archivo</div>
            </div>
            <div className="bg-white border border-green-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{result.summary.imported}</div>
              <div className="text-sm text-gray-500">Importadas ✓</div>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-500">{result.summary.duplicates}</div>
              <div className="text-sm text-gray-500">Duplicadas</div>
            </div>
            <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-red-500">{result.summary.errors}</div>
              <div className="text-sm text-gray-500">Errores</div>
            </div>
          </div>

          {/* Detail Table */}
          {result.details && result.details.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Detalle de Importación</h3>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">#</th>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">Resultado</th>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">Huésped</th>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">Fechas</th>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">Habitación</th>
                      <th className="px-4 py-2 text-right text-gray-500 font-medium">Total</th>
                      <th className="px-4 py-2 text-left text-gray-500 font-medium">ID PMS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {result.details.map((row, i) => (
                      <tr key={i} className={row.status === 'error' ? 'bg-red-50/50' : row.status === 'duplicate' ? 'bg-amber-50/50' : ''}>
                        <td className="px-4 py-2 text-gray-400">{row.row}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1">
                            {statusIcon(row.status)}
                            <span className="text-xs font-medium">{statusLabel(row.status)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-800">{row.guest || '—'}</td>
                        <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{row.dates || '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{row.room || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{row.total ? `$${row.total.toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{(row as any).reservaId || (row.existingId ? `dup:${row.existingId}` : '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center">
            <button onClick={reset} className="px-4 py-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Importar otro archivo
            </button>
            <a href="/reservas" className="px-6 py-2.5 bg-mahana-600 text-white rounded-lg hover:bg-mahana-700 font-medium inline-flex items-center gap-2">
              Ver Reservas →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
