import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import DashboardMetrics from "@/components/DashboardMetrics";
import ClaimUploadReview from "@/components/ClaimUploadReview";
import DenialsList from "@/components/DenialsList";
import RecentClaims from "@/components/RecentClaims";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import DenialsAppeals from "./DenialsAppeals";
import Authorizations from "./Authorizations";
import PaymentPosting from "./PaymentPosting";
import Settings from "./Settings";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("dashboard");
  const [user, setUser] = useState<any>(null);

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
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Healthcare RCM Dashboard</h1>
              <p className="text-muted-foreground">Real-time revenue cycle performance metrics</p>
            </div>
            <DashboardMetrics />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecentClaims />
              <AnalyticsCharts />
            </div>
            <DenialsList />
          </div>
        );
      case "claim-review":
        return <ClaimUploadReview />;
      case "analytics":
        return <AnalyticsCharts />;
      case "denials":
        return <DenialsAppeals />;
      case "authorizations":
        return <Authorizations />;
      case "payment-posting":
        return <PaymentPosting />;
      case "settings":
        return <Settings />;
      default:
        return null;
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 p-8">
        <div className="flex justify-end mb-4">
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
        </div>
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
