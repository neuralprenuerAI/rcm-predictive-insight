import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { colombiaApi, triggerAutoFix } from "@/integrations/aws/colombiaApi";
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Clock,
  RefreshCw, ChevronDown, ChevronUp, Send, Download,
  ExternalLink, Loader2, AlertCircle, Search, Wrench
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Radicacion {
  id:                   string;
  ips_id:               string;
  periodo_facturacion:  string;
  numero_facturas:      number;
  radicacion_number:    string | null;
  status:               string;
  total_value:          number;
  validation_passed:    boolean;
  validation_errors:    string[];
  error_codes:          string[];
  rips_s3_key:          string | null;
  certificate_pdf_s3:   string | null;
  auto_fix_attempts:    number;
  submitted_at:         string | null;
  accepted_at:          string | null;
  created_at:           string;
  updated_at:           string;
  encounter_ids:        string[];
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_RADICACIONES: Radicacion[] = [
  {
    id: "rad-001", ips_id: "ips-001",
    periodo_facturacion: "2026-03", numero_facturas: 3,
    radicacion_number: "RAD-2026-004521",
    status: "ACCEPTED", total_value: 950000,
    validation_passed: true, validation_errors: [], error_codes: [],
    rips_s3_key: "rips/ips-001/2026-03/MF-IPS-001-202603-001.json",
    certificate_pdf_s3: "certificates/rad-001/RAD-2026-004521_certificate.pdf",
    auto_fix_attempts: 0,
    submitted_at: new Date(Date.now() - 86400000).toISOString(),
    accepted_at:  new Date(Date.now() - 82800000).toISOString(),
    created_at:   new Date(Date.now() - 90000000).toISOString(),
    updated_at:   new Date(Date.now() - 82800000).toISOString(),
    encounter_ids: ["enc-001", "enc-002", "enc-003"],
  },
  {
    id: "rad-002", ips_id: "ips-001",
    periodo_facturacion: "2026-03", numero_facturas: 1,
    radicacion_number: null,
    status: "DEVUELTA", total_value: 280000,
    validation_passed: true, validation_errors: [],
    error_codes: ["DE4401", "SO3701"],
    rips_s3_key: "rips/ips-001/2026-03/MF-IPS-001-202603-002.json",
    certificate_pdf_s3: null,
    auto_fix_attempts: 1,
    submitted_at: new Date(Date.now() - 43200000).toISOString(),
    accepted_at: null,
    created_at:  new Date(Date.now() - 50000000).toISOString(),
    updated_at:  new Date(Date.now() - 43200000).toISOString(),
    encounter_ids: ["enc-004"],
  },
  {
    id: "rad-003", ips_id: "ips-001",
    periodo_facturacion: "2026-03", numero_facturas: 2,
    radicacion_number: null,
    status: "READY", total_value: 430000,
    validation_passed: true, validation_errors: [], error_codes: [],
    rips_s3_key: "rips/ips-001/2026-03/MF-IPS-001-202603-003.json",
    certificate_pdf_s3: null,
    auto_fix_attempts: 0,
    submitted_at: null, accepted_at: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    encounter_ids: ["enc-005", "enc-006"],
  },
  {
    id: "rad-004", ips_id: "ips-001",
    periodo_facturacion: "2026-02", numero_facturas: 4,
    radicacion_number: null,
    status: "ESCALATED", total_value: 720000,
    validation_passed: true, validation_errors: [],
    error_codes: ["SO3701", "DE4405"],
    rips_s3_key: "rips/ips-001/2026-02/MF-IPS-001-202602-004.json",
    certificate_pdf_s3: null,
    auto_fix_attempts: 3,
    submitted_at: new Date(Date.now() - 259200000).toISOString(),
    accepted_at: null,
    created_at:  new Date(Date.now() - 270000000).toISOString(),
    updated_at:  new Date(Date.now() - 180000000).toISOString(),
    encounter_ids: ["enc-007", "enc-008", "enc-009", "enc-010"],
  },
];

// ─── Error code descriptions ──────────────────────────────────────────────────
const ERROR_DESCRIPTIONS: Record<string, string> = {
  "DE4401": "NIT del prestador no corresponde al habilitado",
  "DE4402": "Código CUPS no existe o no está vigente",
  "DE4403": "Código CIE-10 inválido",
  "DE4404": "Fecha de prestación fuera del período",
  "DE4405": "Número de autorización no encontrado o vencido",
  "DE4406": "Valor unitario excede tarifa manual ISS 2001",
  "DE4407": "Identificación del paciente no coincide con BDUA",
  "DE4408": "Tipo de documento del paciente inválido",
  "DE4409": "Código de diagnóstico principal requerido",
  "DE4410": "Duplicado: radicación previa con mismo período",
  "SO3701": "Servicio no cubierto por el PBS",
  "SO3702": "Cantidad de servicios excede límite autorizado",
  "SO3703": "Servicio requiere autorización médica previa",
  "AD0001": "Error en estructura del archivo RIPS",
  "AD0002": "Período de facturación ya radicado",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(v: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}
function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}
function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60)   return `Hace ${mins}m`;
    if (mins < 1440) return `Hace ${Math.floor(mins / 60)}h`;
    return `Hace ${Math.floor(mins / 1440)}d`;
  } catch { return iso; }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  DRAFT:     { label: "Borrador",    color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-200",   icon: <FileText className="w-3.5 h-3.5" /> },
  READY:     { label: "Listo",       color: "text-blue-600",   bg: "bg-blue-100",   border: "border-blue-200",   icon: <FileText className="w-3.5 h-3.5" /> },
  IN_PROGRESS:{ label: "Enviando...",color: "text-indigo-600", bg: "bg-indigo-100", border: "border-indigo-200", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  SUBMITTED: { label: "Enviado",     color: "text-indigo-600", bg: "bg-indigo-100", border: "border-indigo-200", icon: <Send className="w-3.5 h-3.5" /> },
  ACCEPTED:  { label: "Aceptado",    color: "text-green-600",  bg: "bg-green-100",  border: "border-green-200",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  DEVUELTA:  { label: "Devuelta",    color: "text-red-600",    bg: "bg-red-100",    border: "border-red-200",    icon: <XCircle className="w-3.5 h-3.5" /> },
  GLOSA:     { label: "En Glosa",    color: "text-amber-600",  bg: "bg-amber-100",  border: "border-amber-200",  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  ESCALATED: { label: "Escalada",    color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-200", icon: <Clock className="w-3.5 h-3.5" /> },
  ERROR:     { label: "Error",       color: "text-red-600",    bg: "bg-red-100",    border: "border-red-200",    icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RadicacionTracker() {
  const navigate = useNavigate();
  const [radicaciones, setRadicaciones] = useState<Radicacion[]>(DEMO_RADICACIONES);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [submitting,   setSubmitting]   = useState<Set<string>>(new Set());
  const [fixing,       setFixing]       = useState<Set<string>>(new Set());
  const [filter,       setFilter]       = useState("ALL");
  const [search,       setSearch]       = useState("");
  const [isDemo,       setIsDemo]       = useState(true);
  const [loading,      setLoading]      = useState(false);

  useEffect(() => { loadRadicaciones(); }, []);

  async function loadRadicaciones() {
    setLoading(true);
    try {
      const res = await colombiaApi.invoke("mediflow-radicaciones-list", { ips_id: "ips-001" });
      if (res.success && res.radicaciones?.length > 0) {
        setRadicaciones(res.radicaciones);
        setIsDemo(false);
      } else {
        setRadicaciones(DEMO_RADICACIONES);
        setIsDemo(true);
      }
    } catch {
      setRadicaciones(DEMO_RADICACIONES);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }

  // Radicar — submit fresh radicacion
  async function handleRadicar(rad: Radicacion) {
    setSubmitting(prev => new Set(prev).add(rad.id));
    setRadicaciones(prev => prev.map(r => r.id === rad.id ? { ...r, status: "IN_PROGRESS" } : r));
    try {
      const res = await colombiaApi.invoke("mediflow-factramed-submit", { radicacion_id: rad.id, ips_id: "ips-001" });
      setRadicaciones(prev => prev.map(r => r.id === rad.id ? {
        ...r,
        status:             res.status || "SUBMITTED",
        radicacion_number:  res.radicacion_number || r.radicacion_number,
        certificate_pdf_s3: res.certificate_s3 || r.certificate_pdf_s3,
        error_codes:        res.error_codes || [],
        submitted_at:       new Date().toISOString(),
      } : r));
      setExpanded(prev => new Set(prev).add(rad.id));
    } catch {
      setRadicaciones(prev => prev.map(r => r.id === rad.id ? { ...r, status: "ERROR" } : r));
    } finally {
      setSubmitting(prev => { const n = new Set(prev); n.delete(rad.id); return n; });
    }
  }

  // Auto-fix — trigger Gemini correction on DEVUELTA
  async function handleAutoFix(rad: Radicacion) {
    setFixing(prev => new Set(prev).add(rad.id));
    try {
      const res = await triggerAutoFix(rad.id, "ips-001", rad.error_codes);
      if (res.action === "RESUBMITTED") {
        setRadicaciones(prev => prev.map(r => r.id === rad.id ? {
          ...r,
          status:            "SUBMITTED",
          auto_fix_attempts: (r.auto_fix_attempts || 0) + 1,
          submitted_at:      new Date().toISOString(),
        } : r));
      } else if (res.action === "ESCALATED" || res.action === "UNFIXABLE") {
        setRadicaciones(prev => prev.map(r => r.id === rad.id ? {
          ...r,
          status: "ESCALATED",
          auto_fix_attempts: (r.auto_fix_attempts || 0) + 1,
        } : r));
      }
      setExpanded(prev => new Set(prev).add(rad.id));
    } catch {
      // silent — status unchanged
    } finally {
      setFixing(prev => { const n = new Set(prev); n.delete(rad.id); return n; });
    }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const filtered = radicaciones.filter(r => {
    const matchFilter = filter === "ALL" || r.status === filter;
    const matchSearch = !search ||
      r.radicacion_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.periodo_facturacion.includes(search) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalValue    = filtered.reduce((s, r) => s + r.total_value, 0);
  const acceptedValue = radicaciones.filter(r => r.status === "ACCEPTED").reduce((s, r) => s + r.total_value, 0);
  const escalatedCount = radicaciones.filter(r => r.status === "ESCALATED").length;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radicaciones FACTRAMED</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {radicaciones.length} radicación{radicaciones.length !== 1 ? "es" : ""} · {fmtCOP(acceptedValue)} aceptado
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDemo && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              DATOS DEMO
            </span>
          )}
          <button onClick={loadRadicaciones}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
          <button onClick={() => navigate("/colombia/facturacion")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
            <FileText className="w-3.5 h-3.5" /> Nueva Radicación
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total",       value: radicaciones.length,                                              color: "text-gray-900" },
          { label: "Aceptadas",   value: radicaciones.filter(r => r.status === "ACCEPTED").length,         color: "text-green-600" },
          { label: "Devueltas",   value: radicaciones.filter(r => r.status === "DEVUELTA").length,         color: "text-red-500" },
          { label: "Escaladas",   value: escalatedCount,                                                   color: escalatedCount > 0 ? "text-purple-600" : "text-gray-400" },
          { label: "Valor Acept.", value: fmtCOP(acceptedValue),                                           color: "text-green-600" },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Escalated alert banner */}
      {escalatedCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            <strong>{escalatedCount} radicación{escalatedCount > 1 ? "es" : ""}</strong> escalada{escalatedCount > 1 ? "s" : ""} — requieren revisión manual del equipo de facturación.
          </span>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por número, período..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["ALL", "READY", "IN_PROGRESS", "SUBMITTED", "ACCEPTED", "DEVUELTA", "GLOSA", "ESCALATED", "ERROR"].map(f => {
            const count = f === "ALL" ? radicaciones.length : radicaciones.filter(r => r.status === f).length;
            if (count === 0 && f !== "ALL" && f !== "READY") return null;
            const cfg = f === "ALL" ? null : STATUS_CONFIG[f];
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filter === f ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
                }`}>
                {f === "ALL" ? "Todas" : cfg?.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No hay radicaciones en este estado.</div>
        )}
        {filtered.map(rad => {
          const status = rad.status || "DRAFT";
          const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
          const isExp  = expanded.has(rad.id);
          const isSub  = submitting.has(rad.id);
          const isFix  = fixing.has(rad.id);

          return (
            <div key={rad.id} className={`bg-white border rounded-xl shadow-sm transition-all ${cfg.border}`}>
              <div className="flex items-center gap-3 p-4">

                {/* Status icon */}
                <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center ${cfg.color} shrink-0`}>
                  {cfg.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {rad.radicacion_number
                      ? <span className="font-mono font-semibold text-gray-900 text-sm">{rad.radicacion_number}</span>
                      : <span className="font-mono text-gray-400 text-sm">Sin número</span>
                    }
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                    {rad.auto_fix_attempts > 0 && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                        {rad.auto_fix_attempts} intento{rad.auto_fix_attempts > 1 ? "s" : ""} corrección IA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
                    <span>Período: {rad.periodo_facturacion}</span>
                    <span>·</span>
                    <span>{rad.numero_facturas} encuentro{rad.numero_facturas !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>Creado {fmtRelative(rad.created_at)}</span>
                    {rad.submitted_at && <><span>·</span><span>Enviado {fmtDateTime(rad.submitted_at)}</span></>}
                  </div>
                </div>

                {/* Value */}
                <div className="text-sm font-semibold text-gray-900 text-right min-w-[100px]">
                  {fmtCOP(rad.total_value)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">

                  {/* Radicar — READY or DRAFT */}
                  {(status === "READY" || status === "DRAFT") && rad.validation_passed && (
                    <button onClick={() => handleRadicar(rad)} disabled={isSub}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {isSub ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</> : <><Send className="w-3.5 h-3.5" /> Radicar</>}
                    </button>
                  )}

                  {/* Auto-fix — DEVUELTA with attempts < 3 */}
                  {status === "DEVUELTA" && rad.auto_fix_attempts < 3 && (
                    <button onClick={() => handleAutoFix(rad)} disabled={isFix}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                      title="Corregir con IA y reenviar">
                      {isFix
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Corrigiendo...</>
                        : <><Wrench className="w-3.5 h-3.5" /> Corregir IA</>
                      }
                    </button>
                  )}

                  {/* Manual resubmit — DEVUELTA when AI exhausted */}
                  {status === "DEVUELTA" && rad.auto_fix_attempts >= 3 && (
                    <button onClick={() => handleRadicar(rad)} disabled={isSub}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      title="Reenviar manualmente (sin corrección IA)">
                      {isSub ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</> : <><RefreshCw className="w-3.5 h-3.5" /> Reenviar</>}
                    </button>
                  )}

                  {/* Certificate download */}
                  {rad.certificate_pdf_s3 && (
                    <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 border border-green-200 rounded-lg hover:bg-green-50"
                      title="Descargar certificado">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  )}

                  {/* Expand */}
                  <button onClick={() => toggleExpand(rad.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Timeline */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline</h4>
                      <div className="space-y-2">
                        {[
                          { label: "Creado",   time: rad.created_at,   done: true },
                          { label: "Enviado",  time: rad.submitted_at, done: !!rad.submitted_at },
                          { label: "Aceptado", time: rad.accepted_at,  done: !!rad.accepted_at },
                        ].map((step, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${step.done ? "bg-green-500" : "bg-gray-300"}`} />
                            <span className={step.done ? "text-gray-700" : "text-gray-400"}>{step.label}</span>
                            <span className="text-gray-400">{fmtDateTime(step.time)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Error codes */}
                    {rad.error_codes?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Códigos de Error FACTRAMED
                        </h4>
                        <div className="space-y-2">
                          {rad.error_codes.map((code, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 font-mono text-xs rounded font-semibold shrink-0">{code}</span>
                              <span className="text-xs text-gray-600">{ERROR_DESCRIPTIONS[code] || "Error de validación FACTRAMED"}</span>
                            </div>
                          ))}
                        </div>
                        {(status === "DEVUELTA" || status === "GLOSA") && (
                          <button onClick={() => navigate("/colombia/glosas")}
                            className="mt-3 flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700">
                            <ExternalLink className="w-3.5 h-3.5" /> Ver en gestión de glosas
                          </button>
                        )}
                      </div>
                    )}

                    {/* Validation errors */}
                    {rad.validation_errors?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Errores de Validación RIPS</h4>
                        <div className="space-y-1">
                          {rad.validation_errors.map((err, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {err}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Archivos</h4>
                      <div className="space-y-1.5 text-xs">
                        {rad.rips_s3_key && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span className="font-mono truncate">{rad.rips_s3_key.split("/").pop()}</span>
                            <span className="text-gray-400 shrink-0">RIPS JSON</span>
                          </div>
                        )}
                        {rad.certificate_pdf_s3 && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Download className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            <span className="font-mono truncate">{rad.certificate_pdf_s3.split("/").pop()}</span>
                            <span className="text-gray-400 shrink-0">Certificado</span>
                          </div>
                        )}
                        {!rad.rips_s3_key && !rad.certificate_pdf_s3 && (
                          <span className="text-gray-400">Sin archivos</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
        <span>{filtered.length} radicación{filtered.length !== 1 ? "es" : ""} mostrada{filtered.length !== 1 ? "s" : ""}</span>
        <span className="font-medium text-gray-700">Total: {fmtCOP(totalValue)}</span>
      </div>
    </div>
  );
}
