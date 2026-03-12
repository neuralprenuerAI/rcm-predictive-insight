import { useState, useEffect } from "react";
import { colombiaApi, classifyGlosa, respondGlosa } from "@/integrations/aws/colombiaApi";
import {
  AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, Loader2, Search, Brain,
  FileText, Send, Trash2, TrendingUp, DollarSign,
  AlertCircle, Filter, Eye
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Glosa {
  id:                  string;
  ips_id:              string;
  radicacion_id:       string;
  factramed_glosa_id:  string;
  glosa_code:          string;
  amount_glosed:       number;
  status:              string;
  deadline_at:         string | null;
  win_probability:     number | null;
  ai_classification:   AiClassification | null;
  response_letter_s3:  string | null;
  excel_response_s3:   string | null;
  created_at:          string;
  updated_at:          string;
}

interface AiClassification {
  type:             string;
  root_cause:       string;
  win_probability:  number;
  required_docs:    string[];
  strategy:         string;
  auto_submit:      boolean;
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_GLOSAS: Glosa[] = [
  {
    id: "gl-001", ips_id: "ips-001", radicacion_id: "rad-002",
    factramed_glosa_id: "GLOSA-2026-008821",
    glosa_code: "DE4401", amount_glosed: 280000, status: "CLASSIFIED",
    deadline_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    win_probability: 82,
    ai_classification: {
      type: "DOCUMENTATION", root_cause: "NIT del prestador no corresponde al habilitado en el sistema FACTRAMED",
      win_probability: 82, required_docs: ["Certificado habilitación IPS", "RUT actualizado", "Resolución habilitación"],
      strategy: "Adjuntar certificado de habilitación vigente y RUT. El NIT es correcto pero el sistema tiene un registro desactualizado.",
      auto_submit: true,
    },
    response_letter_s3: null, excel_response_s3: null,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "gl-002", ips_id: "ips-001", radicacion_id: "rad-002",
    factramed_glosa_id: "GLOSA-2026-008822",
    glosa_code: "SO3701", amount_glosed: 450000, status: "PENDING",
    deadline_at: new Date(Date.now() + 12 * 86400000).toISOString(),
    win_probability: null, ai_classification: null,
    response_letter_s3: null, excel_response_s3: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "gl-003", ips_id: "ips-001", radicacion_id: "rad-005",
    factramed_glosa_id: "GLOSA-2026-008799",
    glosa_code: "SO3704", amount_glosed: 920000, status: "CLASSIFIED",
    deadline_at: new Date(Date.now() + 8 * 86400000).toISOString(),
    win_probability: 41,
    ai_classification: {
      type: "CLINICAL", root_cause: "Diagnóstico no justifica el procedimiento facturado según criterios PBS",
      win_probability: 41, required_docs: ["Historia clínica completa", "Concepto médico especialista", "Soporte técnico-científico"],
      strategy: "Probabilidad media. Adjuntar historia clínica y concepto del especialista tratante justificando la necesidad del procedimiento.",
      auto_submit: false,
    },
    response_letter_s3: null, excel_response_s3: null,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "gl-004", ips_id: "ips-001", radicacion_id: "rad-006",
    factramed_glosa_id: "GLOSA-2026-008750",
    glosa_code: "DE4407", amount_glosed: 175000, status: "CLASSIFIED",
    deadline_at: new Date(Date.now() + 25 * 86400000).toISOString(),
    win_probability: 91,
    ai_classification: {
      type: "ADMINISTRATIVE", root_cause: "Número de identificación del paciente no coincide con BDUA — error tipográfico en cédula",
      win_probability: 91, required_docs: ["Copia cédula paciente", "Soporte atención con dato corregido"],
      strategy: "Alta probabilidad. Error tipográfico corregible. Adjuntar copia del documento de identidad del paciente.",
      auto_submit: true,
    },
    response_letter_s3: "glosas/gl-004/carta_respuesta.pdf",
    excel_response_s3: "glosas/gl-004/SO3701_respuesta.xlsx",
    created_at: new Date(Date.now() - 432000000).toISOString(),
    updated_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "gl-005", ips_id: "ips-001", radicacion_id: "rad-007",
    factramed_glosa_id: "GLOSA-2026-008701",
    glosa_code: "SO3703", amount_glosed: 1250000, status: "CLASSIFIED",
    deadline_at: new Date(Date.now() + 1 * 86400000).toISOString(),
    win_probability: 11,
    ai_classification: {
      type: "CLINICAL", root_cause: "Servicio requiere autorización médica previa — autorización no tramitada antes de la prestación",
      win_probability: 11, required_docs: [],
      strategy: "Probabilidad muy baja. La autorización no fue solicitada antes de prestar el servicio. Considerar castigo contable.",
      auto_submit: false,
    },
    response_letter_s3: null, excel_response_s3: null,
    created_at: new Date(Date.now() - 518400000).toISOString(),
    updated_at: new Date(Date.now() - 432000000).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(v: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  return `Hace ${days}d`;
}

// Win probability bar color
function probColor(p: number): string {
  if (p >= 60) return "bg-green-500";
  if (p >= 30) return "bg-amber-500";
  return "bg-red-500";
}
function probTextColor(p: number): string {
  if (p >= 60) return "text-green-700";
  if (p >= 30) return "text-amber-700";
  return "text-red-700";
}
function probBg(p: number): string {
  if (p >= 60) return "bg-green-50";
  if (p >= 30) return "bg-amber-50";
  return "bg-red-50";
}

// Deadline badge
function DeadlineBadge({ deadline_at }: { deadline_at: string | null }) {
  const days = daysUntil(deadline_at);
  if (days === null) return null;
  if (days < 0)  return <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full"><AlertCircle className="w-3 h-3" /> Vencida</span>;
  if (days <= 5) return <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full animate-pulse"><Clock className="w-3 h-3" /> {days}d</span>;
  if (days <= 10) return <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full"><Clock className="w-3 h-3" /> {days}d</span>;
  return <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"><Clock className="w-3 h-3" /> {days}d</span>;
}

// Glosa type badge
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DOCUMENTATION: { label: "Documentación", color: "text-blue-700",   bg: "bg-blue-50" },
  CLINICAL:      { label: "Clínica",        color: "text-purple-700", bg: "bg-purple-50" },
  ADMINISTRATIVE:{ label: "Administrativa", color: "text-gray-700",   bg: "bg-gray-100" },
  CODING:        { label: "Codificación",   color: "text-indigo-700", bg: "bg-indigo-50" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: "Pendiente",     color: "text-gray-600",  bg: "bg-gray-100" },
  CLASSIFIED: { label: "Clasificada",   color: "text-blue-700",  bg: "bg-blue-100" },
  RESPONDING: { label: "Respondiendo",  color: "text-indigo-700",bg: "bg-indigo-100" },
  SUBMITTED:  { label: "Respondida",    color: "text-green-700", bg: "bg-green-100" },
  WON:        { label: "Ganada",        color: "text-green-700", bg: "bg-green-100" },
  LOST:       { label: "Perdida",       color: "text-red-700",   bg: "bg-red-100" },
  WRITTEN_OFF:{ label: "Castigada",     color: "text-gray-500",  bg: "bg-gray-100" },
};

// ─── Glosa Review Modal ───────────────────────────────────────────────────────
function GlosaReviewModal({
  glosa, onClose, onSubmit, onWriteOff
}: {
  glosa: Glosa;
  onClose: () => void;
  onSubmit: (glosa: Glosa) => void;
  onWriteOff: (glosa: Glosa) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const ai = glosa.ai_classification;
  const prob = glosa.win_probability ?? 0;

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(glosa);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Revisión de Glosa</h2>
            <p className="text-sm text-gray-500 mt-0.5">{glosa.factramed_glosa_id} · Código {glosa.glosa_code}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Amount + deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Valor Glosado</p>
              <p className="text-2xl font-bold text-gray-900">{fmtCOP(glosa.amount_glosed)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Días al Vencimiento</p>
              <p className={`text-2xl font-bold ${(daysUntil(glosa.deadline_at) ?? 99) <= 5 ? "text-red-600" : "text-gray-900"}`}>
                {daysUntil(glosa.deadline_at) ?? "—"} días
              </p>
            </div>
          </div>

          {/* Win probability */}
          {ai && (
            <div className={`rounded-xl p-4 ${probBg(prob)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">Probabilidad de Éxito</span>
                <span className={`text-2xl font-bold ${probTextColor(prob)}`}>{prob}%</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-3 mb-3">
                <div className={`h-3 rounded-full transition-all ${probColor(prob)}`} style={{ width: `${prob}%` }} />
              </div>
              {prob < 15 && (
                <p className="text-xs text-red-700 font-medium">
                  ⚠️ Probabilidad muy baja — se recomienda castigo contable
                </p>
              )}
            </div>
          )}

          {/* AI Analysis */}
          {ai ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-gray-800">Análisis IA</h3>
                {ai.type && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${TYPE_CONFIG[ai.type]?.bg} ${TYPE_CONFIG[ai.type]?.color}`}>
                    {TYPE_CONFIG[ai.type]?.label || ai.type}
                  </span>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Causa Raíz</p>
                  <p className="text-sm text-gray-700">{ai.root_cause}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Estrategia de Respuesta</p>
                  <p className="text-sm text-gray-700">{ai.strategy}</p>
                </div>
              </div>

              {/* Required docs */}
              {ai.required_docs?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Documentos Requeridos</p>
                  <div className="space-y-1.5">
                    {ai.required_docs.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shrink-0" />
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response files */}
              {(glosa.response_letter_s3 || glosa.excel_response_s3) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Archivos Generados</p>
                  <div className="space-y-2">
                    {glosa.response_letter_s3 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="font-mono truncate">{glosa.response_letter_s3.split("/").pop()}</span>
                        <span className="text-blue-500 shrink-0">Carta</span>
                      </div>
                    )}
                    {glosa.excel_response_s3 && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">
                        <FileText className="w-4 h-4 shrink-0" />
                        <span className="font-mono truncate">{glosa.excel_response_s3.split("/").pop()}</span>
                        <span className="text-green-500 shrink-0">Excel SO3701</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl text-sm text-gray-500">
              <Brain className="w-4 h-4 text-gray-400" />
              Pendiente clasificación IA — usa el botón "Clasificar" en la lista
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-100">
          <button
            onClick={() => { onWriteOff(glosa); onClose(); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            disabled={prob > 15}
            title={prob > 15 ? "Solo disponible cuando probabilidad < 15%" : "Registrar como castigo contable"}
          >
            <Trash2 className="w-4 h-4" /> Castigo Contable
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Cerrar
            </button>
            {ai && prob >= 15 && (
              <button
                onClick={handleSubmit}
                disabled={submitting || !ai}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  : <><Send className="w-4 h-4" /> Enviar Respuesta</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GlosaManagement() {
  const [glosas,        setGlosas]        = useState<Glosa[]>(DEMO_GLOSAS);
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());
  const [classifying,   setClassifying]   = useState<Set<string>>(new Set());
  const [responding,    setResponding]    = useState<Set<string>>(new Set());
  const [filter,        setFilter]        = useState("ALL");
  const [search,        setSearch]        = useState("");
  const [isDemo,        setIsDemo]        = useState(true);
  const [loading,       setLoading]       = useState(false);
  const [reviewGlosa,   setReviewGlosa]   = useState<Glosa | null>(null);

  useEffect(() => { loadGlosas(); }, []);

  async function loadGlosas() {
    setLoading(true);
    try {
      const res = await colombiaApi.invoke("mediflow-glosa-fetcher", { ips_id: "ips-001" });
      if (res.success && res.glosas?.length > 0) {
        setGlosas(res.glosas);
        setIsDemo(false);
      } else {
        setGlosas(DEMO_GLOSAS);
        setIsDemo(true);
      }
    } catch {
      setGlosas(DEMO_GLOSAS);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleClassify(glosa: Glosa) {
    setClassifying(prev => new Set(prev).add(glosa.id));
    try {
      const res = await classifyGlosa(glosa.id, "ips-001");
      if (res.success && res.classification) {
        setGlosas(prev => prev.map(g => g.id === glosa.id ? {
          ...g,
          status:            "CLASSIFIED",
          win_probability:   res.classification.win_probability,
          ai_classification: res.classification,
        } : g));
      }
    } catch {
      // silent
    } finally {
      setClassifying(prev => { const n = new Set(prev); n.delete(glosa.id); return n; });
    }
  }

  async function handleRespond(glosa: Glosa) {
    setResponding(prev => new Set(prev).add(glosa.id));
    setReviewGlosa(null);
    try {
      const res = await respondGlosa(glosa.id, "ips-001", false);
      if (res.success) {
        setGlosas(prev => prev.map(g => g.id === glosa.id ? {
          ...g,
          status:             "SUBMITTED",
          response_letter_s3: res.response_letter_s3 || g.response_letter_s3,
          excel_response_s3:  res.excel_response_s3  || g.excel_response_s3,
        } : g));
      }
    } catch {
      // silent
    } finally {
      setResponding(prev => { const n = new Set(prev); n.delete(glosa.id); return n; });
    }
  }

  function handleWriteOff(glosa: Glosa) {
    setGlosas(prev => prev.map(g => g.id === glosa.id ? { ...g, status: "WRITTEN_OFF" } : g));
  }

  function toggleExpand(id: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // KPIs
  const totalGlosed     = glosas.reduce((s, g) => s + g.amount_glosed, 0);
  const urgentCount     = glosas.filter(g => (daysUntil(g.deadline_at) ?? 99) <= 5 && !["WON","LOST","WRITTEN_OFF","SUBMITTED"].includes(g.status)).length;
  const pendingValue    = glosas.filter(g => !["WON","LOST","WRITTEN_OFF"].includes(g.status)).reduce((s, g) => s + g.amount_glosed, 0);
  const highProbValue   = glosas.filter(g => (g.win_probability ?? 0) >= 60).reduce((s, g) => s + g.amount_glosed, 0);

  // Filter + search
  const filtered = glosas.filter(g => {
    const matchFilter = filter === "ALL" || g.status === filter ||
      (filter === "URGENT" && (daysUntil(g.deadline_at) ?? 99) <= 5);
    const matchSearch = !search ||
      g.glosa_code.toLowerCase().includes(search.toLowerCase()) ||
      g.factramed_glosa_id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Glosas</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {glosas.length} glosa{glosas.length !== 1 ? "s" : ""} · {fmtCOP(totalGlosed)} en disputa
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDemo && (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              DATOS DEMO
            </span>
          )}
          <button onClick={loadGlosas}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Glosado",      value: fmtCOP(totalGlosed),  color: "text-gray-900",   icon: <DollarSign className="w-4 h-4" /> },
          { label: "Pendiente Respuesta",value: fmtCOP(pendingValue), color: "text-amber-600",  icon: <Clock className="w-4 h-4" /> },
          { label: "Alta Probabilidad",  value: fmtCOP(highProbValue),color: "text-green-600",  icon: <TrendingUp className="w-4 h-4" /> },
          { label: "Vencen en 5 días",   value: urgentCount,          color: urgentCount > 0 ? "text-red-600" : "text-gray-400", icon: <AlertTriangle className="w-4 h-4" /> },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400">{kpi.icon}</span>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Urgent alert */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{urgentCount} glosa{urgentCount > 1 ? "s" : ""}</strong> vence{urgentCount > 1 ? "n" : ""} en 5 días o menos — responder con urgencia.
          </span>
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por código, ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-400"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "ALL",        label: "Todas" },
            { key: "URGENT",     label: "🔴 Urgentes" },
            { key: "PENDING",    label: "Pendientes" },
            { key: "CLASSIFIED", label: "Clasificadas" },
            { key: "SUBMITTED",  label: "Respondidas" },
            { key: "WRITTEN_OFF",label: "Castigadas" },
          ].map(({ key, label }) => {
            const count = key === "ALL" ? glosas.length
              : key === "URGENT" ? urgentCount
              : glosas.filter(g => g.status === key).length;
            if (count === 0 && key !== "ALL") return null;
            return (
              <button key={key} onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filter === key ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
                }`}>
                {label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Glosa list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No hay glosas en este estado.</div>
        )}

        {filtered.map(glosa => {
          const prob    = glosa.win_probability;
          const isExp   = expanded.has(glosa.id);
          const isCls   = classifying.has(glosa.id);
          const isResp  = responding.has(glosa.id);
          const days    = daysUntil(glosa.deadline_at);
          const statusCfg = STATUS_CONFIG[glosa.status] || STATUS_CONFIG.PENDING;

          return (
            <div key={glosa.id}
              className={`bg-white border rounded-xl shadow-sm transition-all ${
                days !== null && days <= 5 && !["WON","LOST","WRITTEN_OFF","SUBMITTED"].includes(glosa.status)
                  ? "border-red-300" : "border-gray-200"
              }`}>

              <div className="flex items-center gap-3 p-4">

                {/* Win probability bar — left accent */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-12">
                  {prob !== null ? (
                    <>
                      <span className={`text-sm font-bold ${probTextColor(prob)}`}>{prob}%</span>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${probColor(prob)}`} style={{ width: `${prob}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">éxito</span>
                    </>
                  ) : (
                    <div className="w-full flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-xs text-gray-400 text-center">Sin IA</span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="w-px h-12 bg-gray-100 shrink-0" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold text-gray-900 text-sm">{glosa.glosa_code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    {glosa.ai_classification?.type && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_CONFIG[glosa.ai_classification.type]?.bg} ${TYPE_CONFIG[glosa.ai_classification.type]?.color}`}>
                        {TYPE_CONFIG[glosa.ai_classification.type]?.label}
                      </span>
                    )}
                    <DeadlineBadge deadline_at={glosa.deadline_at} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap text-xs text-gray-500">
                    <span>{glosa.factramed_glosa_id}</span>
                    <span>·</span>
                    <span>Creada {fmtRelative(glosa.created_at)}</span>
                    {glosa.ai_classification?.root_cause && (
                      <><span>·</span>
                      <span className="text-gray-600 truncate max-w-xs">{glosa.ai_classification.root_cause}</span></>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-sm font-bold text-gray-900 text-right min-w-[110px]">
                  {fmtCOP(glosa.amount_glosed)}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">

                  {/* Classify — PENDING */}
                  {glosa.status === "PENDING" && (
                    <button onClick={() => handleClassify(glosa)} disabled={isCls}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {isCls ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analizando...</> : <><Brain className="w-3.5 h-3.5" /> Clasificar</>}
                    </button>
                  )}

                  {/* Review — CLASSIFIED */}
                  {glosa.status === "CLASSIFIED" && (
                    <button onClick={() => setReviewGlosa(glosa)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                      <Eye className="w-3.5 h-3.5" /> Revisar
                    </button>
                  )}

                  {/* Write-off — low prob */}
                  {glosa.status === "CLASSIFIED" && (prob ?? 100) < 15 && (
                    <button onClick={() => handleWriteOff(glosa)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <Trash2 className="w-3.5 h-3.5" /> Castigo
                    </button>
                  )}

                  {/* Expand */}
                  <button onClick={() => toggleExpand(glosa.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Detalles</p>
                      <div className="space-y-1.5 text-xs text-gray-600">
                        <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">ID FACTRAMED</span><span className="font-mono">{glosa.factramed_glosa_id}</span></div>
                        <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Radicación</span><span className="font-mono">{glosa.radicacion_id}</span></div>
                        <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Código</span><span className="font-mono font-semibold">{glosa.glosa_code}</span></div>
                        <div className="flex gap-2"><span className="text-gray-400 w-24 shrink-0">Vencimiento</span><span>{glosa.deadline_at ? new Date(glosa.deadline_at).toLocaleDateString("es-CO") : "—"}</span></div>
                      </div>
                    </div>
                    {glosa.ai_classification && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Documentos Requeridos</p>
                        <div className="space-y-1">
                          {glosa.ai_classification.required_docs.map((doc, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0" />{doc}
                            </div>
                          ))}
                          {glosa.ai_classification.required_docs.length === 0 && (
                            <span className="text-xs text-gray-400">Sin documentos adicionales requeridos</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
        <span>{filtered.length} glosa{filtered.length !== 1 ? "s" : ""} mostrada{filtered.length !== 1 ? "s" : ""}</span>
        <span className="font-medium text-gray-700">En disputa: {fmtCOP(filtered.reduce((s, g) => s + g.amount_glosed, 0))}</span>
      </div>

      {/* Review Modal */}
      {reviewGlosa && (
        <GlosaReviewModal
          glosa={reviewGlosa}
          onClose={() => setReviewGlosa(null)}
          onSubmit={handleRespond}
          onWriteOff={handleWriteOff}
        />
      )}
    </div>
  );
}
