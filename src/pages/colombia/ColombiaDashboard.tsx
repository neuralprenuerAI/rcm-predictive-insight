import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { colombiaApi } from "@/integrations/aws/colombiaApi";
import {
  Calendar, Users, FileText, AlertTriangle, TrendingUp,
  CheckCircle, XCircle, Clock, RefreshCw, ArrowRight,
  DollarSign, Activity, Bell, ChevronRight
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardKpis {
  appointments_today: number;
  appointments_week: number;
  active_patients: number;
  radicaciones_submitted: number;
  radicaciones_accepted: number;
  radicaciones_devuelta: number;
  radicaciones_glosa: number;
  glosas_pending: number;
  glosas_total_value: number;
  glosas_deadline_urgent: number;
  payments_this_month: number;
  revenue_collected: number;
  total_billed: number;
}

interface DashboardCharts {
  radicaciones_by_status: { status: string; count: number }[];
  appointments_by_specialty: { especialidad: string; count: number }[];
  revenue_by_month: { mes: string; total: number }[];
  glosa_win_rate: number;
  glosa_won: number;
  glosa_lost: number;
  glosa_total: number;
  appointments_by_day: { dia: string; count: number }[];
}

interface DashboardAlert {
  type: string;
  message: string;
  count: number;
  urgency: "HIGH" | "MEDIUM" | "LOW";
}

interface RecentActivity {
  type: string;
  description: string;
  status: string;
  timestamp: string;
}

interface DashboardData {
  kpis: DashboardKpis;
  charts: DashboardCharts;
  alerts: DashboardAlert[];
  recent_activity: RecentActivity[];
  periodo: string;
  generated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCOP(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60)  return `Hace ${diffMins}m`;
    if (diffMins < 1440) return `Hace ${Math.floor(diffMins/60)}h`;
    return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  } catch { return iso; }
}

const STATUS_COLORS: Record<string, string> = {
  ACCEPTED:  "bg-green-500",
  SUBMITTED: "bg-blue-500",
  DEVUELTA:  "bg-red-500",
  GLOSA:     "bg-amber-500",
  DRAFT:     "bg-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  ACCEPTED:  "Aceptado",
  SUBMITTED: "Enviado",
  DEVUELTA:  "Devuelta",
  GLOSA:     "En Glosa",
  DRAFT:     "Borrador",
};

const URGENCY_STYLES: Record<string, string> = {
  HIGH:   "border-red-200 bg-red-50 text-red-800",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-800",
  LOW:    "border-blue-200 bg-blue-50 text-blue-800",
};

const URGENCY_ICONS: Record<string, string> = {
  HIGH:   "🔴",
  MEDIUM: "🟡",
  LOW:    "🔵",
};

// ─── Empty state mock data for demo ──────────────────────────────────────────
const DEMO_DATA: DashboardData = {
  periodo: new Date().toISOString().slice(0, 7),
  generated_at: new Date().toISOString(),
  kpis: {
    appointments_today: 12, appointments_week: 47, active_patients: 234,
    radicaciones_submitted: 18, radicaciones_accepted: 14, radicaciones_devuelta: 2,
    radicaciones_glosa: 2, glosas_pending: 5, glosas_total_value: 4250000,
    glosas_deadline_urgent: 2, payments_this_month: 3, revenue_collected: 28500000,
    total_billed: 32000000,
  },
  charts: {
    radicaciones_by_status: [
      { status: "ACCEPTED", count: 14 },
      { status: "SUBMITTED", count: 2 },
      { status: "DEVUELTA", count: 2 },
    ],
    appointments_by_specialty: [
      { especialidad: "MEDICINA GENERAL", count: 21 },
      { especialidad: "PEDIATRÍA", count: 10 },
      { especialidad: "CARDIOLOGÍA", count: 8 },
      { especialidad: "GINECOLOGÍA", count: 6 },
      { especialidad: "DERMATOLOGÍA", count: 2 },
    ],
    revenue_by_month: [
      { mes: "2025-10", total: 18200000 },
      { mes: "2025-11", total: 22400000 },
      { mes: "2025-12", total: 19800000 },
      { mes: "2026-01", total: 25100000 },
      { mes: "2026-02", total: 27300000 },
      { mes: "2026-03", total: 28500000 },
    ],
    glosa_win_rate: 72,
    glosa_won: 18,
    glosa_lost: 7,
    glosa_total: 25,
    appointments_by_day: [
      { dia: "Lun", count: 9 },
      { dia: "Mar", count: 11 },
      { dia: "Mié", count: 8 },
      { dia: "Jue", count: 12 },
      { dia: "Vie", count: 7 },
    ],
  },
  alerts: [
    { type: "GLOSA_DEADLINE", message: "2 glosas con vencimiento en menos de 5 días", count: 2, urgency: "HIGH" },
    { type: "DEVUELTA_PENDING", message: "2 radicaciones devueltas pendientes de corrección", count: 2, urgency: "MEDIUM" },
  ],
  recent_activity: [
    { type: "APPOINTMENT", description: "Cita agendada: MARIA CAMILA HERNANDEZ — MEDICINA GENERAL", status: "CONFIRMADA", timestamp: new Date(Date.now() - 300000).toISOString() },
    { type: "RADICACION", description: "Radicación RAD-2026-001 — ACCEPTED", status: "ACCEPTED", timestamp: new Date(Date.now() - 3600000).toISOString() },
    { type: "APPOINTMENT", description: "Cita agendada: JUAN PABLO GARCIA — CARDIOLOGÍA", status: "CONFIRMADA", timestamp: new Date(Date.now() - 7200000).toISOString() },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ColombiaDashboard() {
  const navigate = useNavigate();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [isDemo,  setIsDemo]  = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await colombiaApi.invoke("mediflow-dashboard-stats", { body: { ips_id: "ips-001" } });
      if (res.data && (res.data as any).success) {
        const parsed = res.data as any;
        const kpis = parsed.kpis as DashboardKpis;
        const allZero = Object.values(kpis).every(v => v === 0);
        if (allZero) {
          setData(DEMO_DATA);
          setIsDemo(true);
        } else {
          setData(parsed as DashboardData);
          setIsDemo(false);
        }
      } else {
        setData(DEMO_DATA);
        setIsDemo(true);
      }
    } catch {
      setData(DEMO_DATA);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Cargando métricas...
      </div>
    );
  }

  const { kpis, charts, alerts, recent_activity } = data!;
  const maxRevenue = Math.max(...charts.revenue_by_month.map(r => r.total), 1);
  const maxSpecialty = Math.max(...charts.appointments_by_specialty.map(s => s.count), 1);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Colombia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Período: {data!.periodo} · Actualizado{" "}
            {new Date(data!.generated_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full border border-amber-200">
              DATOS DEMO
            </span>
          )}
          <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-accent transition-colors text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
            Actualizar
          </button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${URGENCY_STYLES[alert.urgency]}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{URGENCY_ICONS[alert.urgency]}</span>
                <span>{alert.message}</span>
              </div>
              <button
                onClick={() => alert.type.includes("GLOSA") ? navigate("/colombia/glosas") : navigate("/colombia/radicaciones")}
                className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100"
              >
                Ver <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* KPI Row 1 — Scheduling */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Agendamiento</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Calendar className="w-4 h-4 text-green-600" />}
            label="Citas Hoy"
            value={kpis.appointments_today}
            bg="bg-green-50"
            onClick={() => navigate("/colombia/agendar")}
          />
          <KpiCard
            icon={<Calendar className="w-4 h-4 text-blue-600" />}
            label="Citas Esta Semana"
            value={kpis.appointments_week}
            bg="bg-blue-50"
          />
          <KpiCard
            icon={<Users className="w-4 h-4 text-purple-600" />}
            label="Pacientes Activos"
            value={kpis.active_patients}
            bg="bg-purple-50"
            onClick={() => navigate("/colombia/pacientes")}
          />
          <KpiCard
            icon={<FileText className="w-4 h-4 text-indigo-600" />}
            label="Radicaciones Enviadas"
            value={kpis.radicaciones_submitted}
            bg="bg-indigo-50"
            onClick={() => navigate("/colombia/radicaciones")}
          />
        </div>
      </div>

      {/* KPI Row 2 — Billing */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Facturación</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<CheckCircle className="w-4 h-4 text-green-600" />}
            label="Aceptadas"
            value={kpis.radicaciones_accepted}
            bg="bg-green-50"
            sub={kpis.radicaciones_submitted > 0
              ? `${Math.round(kpis.radicaciones_accepted / kpis.radicaciones_submitted * 100)}% tasa`
              : undefined}
          />
          <KpiCard
            icon={<XCircle className="w-4 h-4 text-red-600" />}
            label="Devueltas"
            value={kpis.radicaciones_devuelta}
            bg="bg-red-50"
            onClick={() => navigate("/colombia/radicaciones")}
          />
          <KpiCard
            icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
            label="En Glosa"
            value={kpis.glosas_pending}
            bg="bg-amber-50"
            sub={kpis.glosas_total_value > 0 ? fmtCOP(kpis.glosas_total_value) : undefined}
            onClick={() => navigate("/colombia/glosas")}
            urgent={kpis.glosas_deadline_urgent > 0}
          />
          <KpiCard
            icon={<DollarSign className="w-4 h-4 text-green-600" />}
            label="Recaudado Este Mes"
            value={fmtCOP(kpis.revenue_collected)}
            bg="bg-green-50"
            sub={kpis.total_billed > 0 ? `de ${fmtCOP(kpis.total_billed)} facturado` : undefined}
            onClick={() => navigate("/colombia/reportes")}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Ingresos Recaudados</p>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
            </div>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </div>
          {charts.revenue_by_month.length > 0 ? (
            <div className="flex items-end gap-2 h-32">
              {charts.revenue_by_month.map((r, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex justify-center">
                    <div
                      className="w-8 bg-gradient-to-t from-green-500 to-green-300 rounded-t"
                      style={{ height: `${(r.total / maxRevenue) * 100}%`, minHeight: 4 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.mes.slice(5)}</span>
                  <span className="text-[10px] font-medium text-foreground">{fmtCOP(r.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="Sin datos de ingresos" />
          )}
        </div>

        {/* Glosa win rate */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Tasa de Éxito Glosas</p>
              <p className="text-xs text-muted-foreground">{charts.glosa_total} glosas totales</p>
            </div>
          </div>
          {charts.glosa_total > 0 ? (
            <div className="flex items-center gap-6">
              {/* Donut-style ring */}
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/20" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-500" strokeDasharray={`${charts.glosa_win_rate} ${100 - charts.glosa_win_rate}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-foreground">{charts.glosa_win_rate}%</span>
                  <span className="text-[10px] text-muted-foreground">ganadas</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Ganadas</span>
                  <span className="font-semibold text-foreground ml-auto">{charts.glosa_won}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Perdidas</span>
                  <span className="font-semibold text-foreground ml-auto">{charts.glosa_lost}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-muted-foreground">Pendientes</span>
                  <span className="font-semibold text-foreground ml-auto">{charts.glosa_total - charts.glosa_won - charts.glosa_lost}</span>
                </div>
              </div>
            </div>
          ) : (
            <EmptyChart label="Sin datos de glosas" />
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Specialties */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Citas por Especialidad</p>
            <span className="text-xs text-muted-foreground">Últimos 30 días</span>
          </div>
          {charts.appointments_by_specialty.length > 0 ? (
            <div className="space-y-3">
              {charts.appointments_by_specialty.slice(0, 5).map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground truncate">{s.especialidad}</span>
                    <span className="font-semibold text-foreground">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(s.count / maxSpecialty) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="Sin datos de citas" />
          )}
        </div>

        {/* Radicaciones status */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Estado Radicaciones</p>
            <button
              onClick={() => navigate("/colombia/radicaciones")}
              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5"
            >
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {charts.radicaciones_by_status.length > 0 ? (
            <div className="space-y-3">
              {charts.radicaciones_by_status.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[r.status] || "bg-gray-400"}`} />
                    <span className="text-sm text-muted-foreground">{STATUS_LABELS[r.status] || r.status}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{r.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="Sin radicaciones" />
          )}
          <button
            onClick={() => navigate("/colombia/facturacion")}
            className="mt-4 w-full py-2 text-xs text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors font-medium"
          >
            + Nueva Radicación
          </button>
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-foreground">Actividad Reciente</p>
            <Bell className="w-4 h-4 text-muted-foreground" />
          </div>
          {recent_activity.length > 0 ? (
            <div className="space-y-3">
              {recent_activity.slice(0, 5).map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-foreground leading-relaxed">{a.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(a.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart label="Sin actividad reciente" />
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Buscar Paciente",      icon: "🔍", path: "/colombia/pacientes"     },
          { label: "Agendar Cita",         icon: "📅", path: "/colombia/agendar"        },
          { label: "Cola de Facturación",  icon: "📋", path: "/colombia/facturacion"    },
          { label: "Gestión de Glosas",    icon: "⚖️", path: "/colombia/glosas"         },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent hover:border-primary/20 transition-all shadow-sm"
          >
            <span>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function KpiCard({
  icon, label, value, bg, sub, onClick, urgent
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
  sub?: string;
  onClick?: () => void;
  urgent?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border border-border bg-card ${onClick ? "cursor-pointer hover:border-primary/30 hover:shadow-sm" : ""} transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`p-1.5 rounded-lg ${bg}`}>
          {icon}
        </div>
        {urgent && <span className="text-xs text-red-600 font-medium">⚠️ Urgente</span>}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
      {label}
    </div>
  );
}
