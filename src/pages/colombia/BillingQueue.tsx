import { useState, useEffect } from "react";
import { colombiaApi } from "@/integrations/aws/colombiaApi";
import {
  FileText, CheckCircle, XCircle, AlertTriangle, Clock,
  RefreshCw, ChevronDown, ChevronUp, Send, Eye, Loader2,
  AlertCircle, Download
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Procedure {
  cups_code:      string;
  descripcion:    string;
  cantidad:       number;
  valor_unitario: number;
}

interface Diagnosis {
  cie10_code: string;
  descripcion: string;
  tipo: "P" | "R";
}

interface Encounter {
  id:                string;
  dgh_encounter_id:  string;
  fecha_atencion:    string;
  especialidad:      string;
  medico_nombre:     string;
  sede:              string;
  total_billed:      number;
  eps_nombre:        string;
  billing_status:    string;
  diagnoses:         Diagnosis[];
  procedures:        Procedure[];
  patient: {
    nombres:   string;
    apellidos: string;
    cedula:    string;
    tipo_doc:  string;
    eps_nombre: string;
  };
}

interface ValidationResult {
  passed:        boolean;
  errors:        string[];
  warnings:      string[];
  error_count:   number;
  warning_count: number;
}

interface RipsResult {
  success:         boolean;
  radicacion_id:   string | null;
  factura_num:     string;
  rips_json:       object;
  validation:      ValidationResult;
  s3_key:          string | null;
  encounter_count: number;
  total_value:     number;
  ready_to_submit: boolean;
  preview?:        boolean;
}

type EncounterStatus =
  | "PENDING"
  | "RIPS_GENERATED"
  | "SUBMITTED"
  | "ACCEPTED"
  | "DEVUELTA"
  | "GLOSA";

// ─── Demo encounters ──────────────────────────────────────────────────────────
const DEMO_ENCOUNTERS: Encounter[] = [
  {
    id: "enc-001", dgh_encounter_id: "ATN-2026-001",
    fecha_atencion: "2026-03-10", especialidad: "MEDICINA GENERAL",
    medico_nombre: "DR. CARLOS RAMIREZ", sede: "SEDE PRINCIPAL",
    total_billed: 150000, eps_nombre: "NUEVA EPS S.A.",
    billing_status: "PENDING",
    diagnoses: [{ cie10_code: "J06.9", descripcion: "Infección respiratoria aguda", tipo: "P" }],
    procedures: [{ cups_code: "8902011", descripcion: "Consulta médica general", cantidad: 1, valor_unitario: 150000 }],
    patient: { nombres: "MARIA CAMILA", apellidos: "HERNANDEZ TORRES", cedula: "1020304050", tipo_doc: "CC", eps_nombre: "NUEVA EPS S.A." },
  },
  {
    id: "enc-002", dgh_encounter_id: "ATN-2026-002",
    fecha_atencion: "2026-03-09", especialidad: "PEDIATRÍA",
    medico_nombre: "DRA. ANA LOPEZ", sede: "SEDE PRINCIPAL",
    total_billed: 280000, eps_nombre: "NUEVA EPS S.A.",
    billing_status: "PENDING",
    diagnoses: [{ cie10_code: "J18.9", descripcion: "Neumonía no especificada", tipo: "P" }],
    procedures: [
      { cups_code: "8902013", descripcion: "Consulta pediátrica", cantidad: 1, valor_unitario: 180000 },
      { cups_code: "9050401", descripcion: "Radiografía tórax", cantidad: 1, valor_unitario: 100000 },
    ],
    patient: { nombres: "SAMUEL", apellidos: "GARCIA PEREZ", cedula: "1122334455", tipo_doc: "TI", eps_nombre: "NUEVA EPS S.A." },
  },
  {
    id: "enc-003", dgh_encounter_id: "ATN-2026-003",
    fecha_atencion: "2026-03-08", especialidad: "CARDIOLOGÍA",
    medico_nombre: "DR. JORGE MENDEZ", sede: "SEDE NORTE",
    total_billed: 520000, eps_nombre: "NUEVA EPS S.A.",
    billing_status: "RIPS_GENERATED",
    diagnoses: [
      { cie10_code: "I10.X", descripcion: "Hipertensión esencial", tipo: "P" },
      { cie10_code: "E11.9", descripcion: "Diabetes mellitus tipo 2", tipo: "R" },
    ],
    procedures: [
      { cups_code: "8902019", descripcion: "Consulta cardiología", cantidad: 1, valor_unitario: 280000 },
      { cups_code: "8911021", descripcion: "Electrocardiograma", cantidad: 1, valor_unitario: 240000 },
    ],
    patient: { nombres: "ROBERTO", apellidos: "VILLA MORA", cedula: "7788990011", tipo_doc: "CC", eps_nombre: "NUEVA EPS S.A." },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(v: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function fmtDate(d: string): string {
  try { return new Date(d + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const STATUS_CONFIG: Record<EncounterStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:        { label: "Pendiente",      color: "text-gray-600",   bg: "bg-gray-100",   icon: <Clock className="w-3.5 h-3.5" /> },
  RIPS_GENERATED: { label: "RIPS Generado",  color: "text-blue-600",   bg: "bg-blue-100",   icon: <FileText className="w-3.5 h-3.5" /> },
  SUBMITTED:      { label: "Enviado",        color: "text-indigo-600", bg: "bg-indigo-100", icon: <Send className="w-3.5 h-3.5" /> },
  ACCEPTED:       { label: "Aceptado",       color: "text-green-600",  bg: "bg-green-100",  icon: <CheckCircle className="w-3.5 h-3.5" /> },
  DEVUELTA:       { label: "Devuelta",       color: "text-red-600",    bg: "bg-red-100",    icon: <XCircle className="w-3.5 h-3.5" /> },
  GLOSA:          { label: "En Glosa",       color: "text-amber-600",  bg: "bg-amber-100",  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BillingQueue() {
  const [encounters,  setEncounters]  = useState<Encounter[]>(DEMO_ENCOUNTERS);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [generating,  setGenerating]  = useState<Set<string>>(new Set());
  const [ripsResults, setRipsResults] = useState<Record<string, RipsResult>>({});
  const [isDemo,      setIsDemo]      = useState(true);
  const [loading,     setLoading]     = useState(false);
  const [filter,      setFilter]      = useState<string>("ALL");

  // Select all pending
  function toggleSelectAll() {
    const pending = filtered.filter(e => e.billing_status === "PENDING").map(e => e.id);
    if (pending.every(id => selected.has(id))) {
      setSelected(prev => { const n = new Set(prev); pending.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); pending.forEach(id => n.add(id)); return n; });
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function generateRips(encounterIds: string[], preview = false) {
    const ids = encounterIds.filter(id => {
      const enc = encounters.find(e => e.id === id);
      return enc && enc.billing_status === "PENDING";
    });
    if (!ids.length) return;

    ids.forEach(id => setGenerating(prev => new Set(prev).add(id)));

    try {
      const { data: res, error: apiError } = await colombiaApi.invoke("mediflow-rips-generator", {
        body: {
          action:        preview ? "preview" : "generate",
          ips_id:        "ips-001",
          encounter_ids: ids,
          periodo:       new Date().toISOString().slice(0, 7),
          save_to_db:    !preview,
        },
      });

      if (apiError) {
        console.error("RIPS generation error:", apiError);
        return;
      }

      const result = res as RipsResult;

      ids.forEach(id => {
        setRipsResults(prev => ({ ...prev, [id]: result }));
        setExpanded(prev => new Set(prev).add(id));
      });

      if (!preview && result.ready_to_submit) {
        setEncounters(prev =>
          prev.map(e => ids.includes(e.id) ? { ...e, billing_status: "RIPS_GENERATED" } : e)
        );
        setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
      }
    } catch (err) {
      console.error("RIPS generation failed:", err);
    } finally {
      ids.forEach(id => setGenerating(prev => { const n = new Set(prev); n.delete(id); return n; }));
    }
  }

  const filtered = encounters.filter(e => filter === "ALL" || e.billing_status === filter);
  const pendingCount = encounters.filter(e => e.billing_status === "PENDING").length;
  const totalSelected = [...selected].filter(id => encounters.find(e => e.id === id)?.billing_status === "PENDING").length;
  const totalValueSelected = [...selected]
    .map(id => encounters.find(e => e.id === id)?.total_billed || 0)
    .reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4 p-4 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cola de Facturación</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount} encuentro{pendingCount !== 1 ? "s" : ""} pendiente{pendingCount !== 1 ? "s" : ""} de radicación
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full border border-amber-200">
              DATOS DEMO
            </span>
          )}
          <button
            onClick={() => setLoading(l => !l)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["ALL", "PENDING", "RIPS_GENERATED", "SUBMITTED", "ACCEPTED", "DEVUELTA", "GLOSA"] as const).map(f => {
          const count = f === "ALL" ? encounters.length : encounters.filter(e => e.billing_status === f).length;
          const cfg = f === "ALL" ? null : STATUS_CONFIG[f];
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {f === "ALL" ? "Todos" : cfg?.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Bulk action bar */}
      {totalSelected > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-sm font-medium text-foreground">
            {totalSelected} encuentro{totalSelected !== 1 ? "s" : ""} seleccionado{totalSelected !== 1 ? "s" : ""}
            {totalValueSelected > 0 && (
              <span className="ml-2 text-muted-foreground">— {fmtCOP(totalValueSelected)}</span>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => generateRips([...selected], true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10"
            >
              <Eye className="w-3.5 h-3.5" /> Previsualizar RIPS
            </button>
            <button
              onClick={() => generateRips([...selected])}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
            >
              <FileText className="w-3.5 h-3.5" /> Generar RIPS ({totalSelected})
            </button>
          </div>
        </div>
      )}

      {/* Encounter list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No hay encuentros en este estado.
          </div>
        )}

        {filtered.map(enc => {
          const status = (enc.billing_status || "PENDING") as EncounterStatus;
          const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
          const isExp  = expanded.has(enc.id);
          const isGen  = generating.has(enc.id);
          const result = ripsResults[enc.id];
          const isPending = status === "PENDING";

          return (
            <div key={enc.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
                {/* Checkbox */}
                {isPending && (
                  <input
                    type="checkbox"
                    checked={selected.has(enc.id)}
                    onChange={() => toggleSelect(enc.id)}
                    className="w-4 h-4 text-primary rounded border-border cursor-pointer"
                  />
                )}
                {!isPending && <div className="w-4" />}

                {/* Patient */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {enc.patient.nombres} {enc.patient.apellidos}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {enc.patient.tipo_doc} {enc.patient.cedula}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <span>{enc.especialidad}</span>
                    <span>·</span>
                    <span>{enc.medico_nombre}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">{fmtDate(enc.fecha_atencion)}</span>
                  </div>
                </div>

                {/* EPS */}
                <div className="hidden md:block text-xs text-muted-foreground max-w-[140px] truncate">
                  {enc.eps_nombre}
                </div>

                {/* Value */}
                <div className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {fmtCOP(enc.total_billed)}
                </div>

                {/* Status badge */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} shrink-0`}>
                  {cfg.icon}
                  {cfg.label}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPending && (
                    <button
                      onClick={() => generateRips([enc.id])}
                      disabled={isGen}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isGen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                      {isGen ? "Generando..." : "RIPS"}
                    </button>
                  )}
                  {status === "RIPS_GENERATED" && (
                    <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90">
                      <Send className="w-3.5 h-3.5" /> Radicar
                    </button>
                  )}
                  <button
                    onClick={() => toggleExpand(enc.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
                  >
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExp && (
                <div className="border-t border-border bg-muted/30 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Diagnoses */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2">Diagnósticos CIE-10</h4>
                      <div className="space-y-1.5">
                        {(enc.diagnoses || []).map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-mono text-[10px]">
                              {d.cie10_code}
                            </span>
                            <span className="text-foreground">{d.descripcion}</span>
                            <span className="text-muted-foreground">({d.tipo === "P" ? "Principal" : "Relacionado"})</span>
                          </div>
                        ))}
                        {(!enc.diagnoses || enc.diagnoses.length === 0) && (
                          <p className="text-xs text-muted-foreground italic">
                            <AlertCircle className="w-3 h-3 inline mr-1" /> Sin diagnósticos registrados
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Procedures */}
                    <div>
                      <h4 className="text-xs font-semibold text-foreground mb-2">Procedimientos CUPS</h4>
                      <div className="space-y-1.5">
                        {(enc.procedures || []).map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-mono text-[10px]">
                                {p.cups_code}
                              </span>
                              <span className="text-foreground">{p.descripcion}</span>
                              {p.cantidad > 1 && <span className="text-muted-foreground">×{p.cantidad}</span>}
                            </div>
                            <span className="text-foreground font-medium">{fmtCOP(p.valor_unitario * p.cantidad)}</span>
                          </div>
                        ))}
                        {(!enc.procedures || enc.procedures.length === 0) && (
                          <p className="text-xs text-muted-foreground italic">
                            <AlertCircle className="w-3 h-3 inline mr-1" /> Sin procedimientos — se usará consulta genérica
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIPS validation result */}
                  {result && (
                    <div className="mt-4 p-3 border border-border rounded-lg bg-card">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {result.validation.passed
                            ? <CheckCircle className="w-4 h-4 text-green-600" />
                            : <XCircle className="w-4 h-4 text-red-600" />
                          }
                          <span className="text-sm font-medium text-foreground">
                            {result.validation.passed ? "✅ RIPS Válido — Listo para radicar" : "❌ RIPS con errores — Corrija antes de radicar"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.s3_key && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Download className="w-3 h-3" /> Guardado en S3
                            </span>
                          )}
                          {result.preview && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">PREVIEW</span>
                          )}
                        </div>
                      </div>

                      {/* Errors */}
                      {result.validation.errors.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {result.validation.errors.map((e, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                              <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                              {e}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Warnings */}
                      {result.validation.warnings.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {result.validation.warnings.map((w, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                              {w}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Summary */}
                      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                        <span>{result.encounter_count} encuentro{result.encounter_count !== 1 ? "s" : ""}</span>
                        <span>Valor total: {fmtCOP(result.total_value)}</span>
                        <span>Factura: {result.factura_num}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <span>{filtered.length} encuentro{filtered.length !== 1 ? "s" : ""} mostrado{filtered.length !== 1 ? "s" : ""}</span>
        <span className="font-medium text-foreground">
          Total: {fmtCOP(filtered.reduce((s, e) => s + (e.total_billed || 0), 0))}
        </span>
      </div>
    </div>
  );
}
