import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FileUp, 
  AlertCircle, 
  DollarSign, 
  BarChart3, 
  Settings,
  FileText,
  Users,
  Shield,
  TrendingDown,
  ClipboardCheck,
  History,
  ShieldCheck,
  UserPlus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRole } from "@/contexts/RoleContext";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  
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
    { id: "settings", label: "Settings", icon: Settings }
  ];

  return (
    <div className="w-64 min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="p-6">
        <h1 className="text-xl font-bold text-sidebar-foreground mb-1">
          AI RCM Platform
        </h1>
        <p className="text-xs text-sidebar-foreground/60">Revenue Cycle Management</p>
      </div>
      
      <nav className="px-3 space-y-1">
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
              onClick={() => {
                if (item.isRoute && item.route) {
                  navigate(item.route);
                } else {
                  onViewChange(item.id);
                }
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{item.label}</span>
            </Button>
          );
        })}
        
        {/* Admin Center - Only visible to admins */}
        {isAdmin && (
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-[var(--transition-smooth)]",
              "border-t border-sidebar-border mt-2 pt-3"
            )}
            onClick={() => navigate("/admin")}
          >
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-medium">Admin Center</span>
          </Button>
        )}
      </nav>

      <div className="absolute bottom-0 w-64 p-4 border-t border-sidebar-border bg-sidebar">
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
