import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CalendarPlus, Receipt, FileWarning, Send, TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle, ArrowRight, LayoutDashboard, PieChart } from "lucide-react";

export default function ColombiaDashboard() {
  const navigate = useNavigate();

  const kpis = [
    { label: "Encuentros Pendientes", value: "8", sub: "por facturar", icon: Receipt, color: "text-amber-400", bg: "bg-amber-400/10", action: () => navigate("/colombia/facturacion") },
    { label: "Radicaciones Enviadas", value: "—", sub: "este mes", icon: Send, color: "text-blue-400", bg: "bg-blue-400/10", action: () => navigate("/colombia/radicaciones") },
    { label: "Glosas Activas", value: "—", sub: "requieren atención", icon: FileWarning, color: "text-red-400", bg: "bg-red-400/10", action: () => navigate("/colombia/glosas") },
    { label: "Tasa de Recaudo", value: "—", sub: "este mes", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10", action: () => navigate("/colombia/reportes") },
  ];

  const quickActions = [
    { label: "Buscar Paciente", description: "Verificar afiliación EPS + historial", icon: Search, route: "/colombia/pacientes", color: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5" },
    { label: "Agendar Cita", description: "Nueva cita con verificación ADRES", icon: CalendarPlus, route: "/colombia/agendar", color: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5" },
    { label: "Cola de Facturación", description: "8 encuentros pendientes de RIPS", icon: Receipt, route: "/colombia/facturacion", color: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5", badge: "8" },
    { label: "Gestionar Glosas", description: "Revisar y responder glosas EPS", icon: FileWarning, route: "/colombia/glosas", color: "border-red-500/30 hover:border-red-500/60 hover:bg-red-500/5" },
  ];

  const systemStatus = [
    { label: "ADRES BDUA",          status: "active",  note: "Mock activo" },
    { label: "DGH Dinámica",        status: "active",  note: "Mock activo" },
    { label: "FACTRAMED Nueva EPS", status: "pending", note: "Por configurar" },
    { label: "WhatsApp / Twilio",   status: "pending", note: "Por configurar" },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🇨🇴</span>
            <h1 className="text-2xl font-bold text-foreground">MediFlow Colombia</h1>
            <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">RCM</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Gestión del Ciclo de Ingresos · Nueva EPS · IPS-001</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/colombia/configuracion")} className="gap-2 text-xs">
          Configurar IPS <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={kpi.action}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-sm font-medium text-foreground/80">{kpi.label}</p>
                <p className="text-xs text-muted-foreground">{kpi.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions + System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.label} onClick={() => navigate(action.route)} className={`relative text-left p-4 rounded-lg border transition-all ${action.color}`}>
                    {action.badge && <Badge className="absolute top-2 right-2 bg-amber-500 text-white">{action.badge}</Badge>}
                    <Icon className="h-5 w-5 mb-2 text-foreground/70" />
                    <p className="font-medium text-sm text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estado del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {systemStatus.map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.note}</p>
                  </div>
                  {s.status === "active" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <Clock className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-border">
                <button onClick={() => navigate("/colombia/configuracion")} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                  Completar configuración <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Marco Regulatorio</p>
                  <p className="text-xs text-muted-foreground mt-1">RIPS según Res. 1557/2023 · Glosas per Res. 3047/2008 · Ley 100/1993</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
