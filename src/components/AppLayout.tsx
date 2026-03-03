import { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Derive activeView from current path
  const pathToView: Record<string, string> = {
    "/": "dashboard",
    "/scrubber": "scrubber",
    "/scrub-history": "scrub-history",
    "/charge-auditor": "charge-auditor",
    "/audit-history": "audit-history",
    "/denial-management": "denial-management",
    "/appeals": "appeals",
    "/analytics": "analytics",
    "/patient-intake": "patient-intake",
    "/practice-profile": "practice-profile",
    "/settings": "settings",
    "/upload": "claim-review",
    "/claims": "claim-review",
    "/admin": "admin",
  };

  const searchParams = new URLSearchParams(location.search);
  const viewParam = searchParams.get("view");
  const activeView = viewParam || pathToView[location.pathname] || "dashboard";

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" } as any);
      if (error) console.error("Sign out error:", error);
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setIsSigningOut(false);
      navigate("/auth");
    }
  };

  const handleViewChange = (view: string) => {
    // For views handled on the Index page via query param
    const viewRoutes: Record<string, string> = {
      dashboard: "/",
      patients: "/?view=patients",
      "claim-review": "/",
      analytics: "/analytics",
      denials: "/?view=denials",
      authorizations: "/?view=authorizations",
      "payment-posting": "/?view=payment-posting",
      settings: "/settings",
    };
    const route = viewRoutes[view];
    if (route) {
      navigate(route);
    } else {
      navigate(`/?view=${view}`);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="flex-1 overflow-auto">
        <div className="flex justify-end p-4 pb-0">
          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="gap-2"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
        <div className="p-8 pt-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
