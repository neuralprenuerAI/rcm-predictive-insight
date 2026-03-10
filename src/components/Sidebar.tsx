import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileUp, AlertCircle, DollarSign, BarChart3, Settings, FileText, Users, Shield, TrendingDown, ClipboardCheck, History, ShieldCheck, UserPlus, ChevronDown, ChevronRight, Search, CalendarPlus, Receipt, FileWarning, Send, PieChart, Wrench } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useRole();
  const isColombiaPath = location.pathname.startsWith("/colombia");
  const [colombiaOpen, setColombaOpen] = useState(isColombiaPath);

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "patients", label: "Patients", icon: Users },
    { id: "patient-intake", label: "Patient Intake", icon: UserPlus, isRoute: true, route: "/patient-intake" },
    { id: "claim-review", label: "Claim Review", icon: FileUp },
    { id: "scrubber", label: "Claim Scrubber", icon: Shield, isRoute: true, route: "/scrubber" },
    { id: "scrub-history", label: "Scrub History", icon: TrendingDown, isRoute: true, route: "/scrub-history" },
    { id: "charge-auditor", label: "Charge Auditor", icon: ClipboardCheck, isRoute: true, route: "/charge-auditor" },
    { id: "audit-history", label: "Audit History", icon: History, isRoute: true, route: "/audit-history" },
    { id: "denial-management", label: "Denial Management", icon: AlertCircle, isRoute: true, route: "/denial-management" },
    { id: "appeals", label: "Appeals", icon: FileText, isRoute: true, route: "/appeals" },
    { id: "analytics", label: "Analytics", icon: BarChart3, isRoute: true, route: "/analytics" },
    { id: "authorizations", label: "Authorizations", icon: FileText },
    { id: "payment-posting", label: "Payment Posting", icon: DollarSign },
    { id: "practice-profile", label: "Practice Profile", icon: ClipboardCheck, isRoute: true, route: "/practice-profile" },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const colombiaItems = [
    { id: "colombia-dashboard",     label: "Dashboard",           icon: LayoutDashboard, route: "/colombia" },
    { id: "colombia-pacientes",     label: "Buscar Paciente",     icon: Search,          route: "/colombia/pacientes" },
    { id: "colombia-agendar",       label: "Agendar Cita",        icon: CalendarPlus,    route: "/colombia/agendar" },
    { id: "colombia-facturacion",   label: "Cola de Facturación", icon: Receipt,         route: "/colombia/facturacion" },
    { id: "colombia-radicaciones",  label: "Radicaciones",        icon: Send,            route: "/colombia/radicaciones" },
    { id: "colombia-glosas",        label: "Glosas",              icon: FileWarning,     route: "/colombia/glosas" },
    { id: "colombia-reportes",      label: "Reportes",            icon: PieChart,        route: "/colombia/reportes" },
    { id: "colombia-configuracion", label: "Configuración",       icon: Wrench,          route: "/colombia/configuracion" },
  ];

  const activeColombiaId = colombiaItems.find(
    (item) => location.pathname === item.route || location.pathname.startsWith(item.route + "/")
  )?.id;

  return (
    <div className="w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col">
      <div className="p-6 shrink-0">
        <h1 className="text-xl font-bold text-sidebar-foreground mb-1">
          AI RCM Platform
        </h1>
        <p className="text-xs text-sidebar-foreground/60">Revenue Cycle Management</p>
      </div>

      <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-[var(--transition-smooth)]",
                isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
              )}
              onClick={() => { if (item.isRoute && item.route) { navigate(item.route); } else { onViewChange(item.id); } }}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          );
        })}
        {isAdmin && (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-[var(--transition-smooth)]",
              activeView === "admin" && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
              "border-t border-sidebar-border mt-2 pt-3"
            )}
            onClick={() => navigate("/admin")}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-medium">Admin Center</span>
          </Button>
        )}
        <div className="border-t border-sidebar-border mt-3 pt-3">
          <button onClick={() => setColombaOpen((prev) => !prev)} className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-sidebar-accent transition-colors">
            <div className="flex items-center gap-2 text-sm font-semibold text-sidebar-foreground">
              <span>🇨🇴</span>
              <span>COLOMBIA</span>
              <span className="text-[10px] font-normal text-sidebar-foreground/50">RCM</span>
            </div>
            {colombiaOpen ? <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" /> : <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />}
          </button>
          {colombiaOpen && (
            <div className="mt-1 space-y-1 pl-2">
              {colombiaItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeColombiaId === item.id;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-[var(--transition-smooth)]",
                      isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
                    )}
                    onClick={() => navigate(item.route)}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="shrink-0 p-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground">
          © 2025 AI RCM Platform
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          HIPAA Compliant | v2.1.3
        </p>
      </div>
    </div>
  );
}
