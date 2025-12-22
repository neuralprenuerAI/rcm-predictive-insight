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
import Patients from "./Patients";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NotificationFeed, ScrubberStatsCard, RecentScrubsCard, DailyDigest, ActionAlerts } from "@/components/dashboard";
import { Shield, Zap, ArrowRight } from "lucide-react";

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

  // Quick Action Card for Scrubber
  const QuickActionCard = () => (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-xl">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">AI Claim Scrubber</h3>
              <p className="text-sm text-muted-foreground">
                Prevent denials before submission
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/scrubber')} className="gap-2">
            <Zap className="h-4 w-4" />
            Scrub Claim
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

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
            <DailyDigest />
            <QuickActionCard />
            <DashboardMetrics />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecentClaims />
              <AnalyticsCharts />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <RecentScrubsCard />
              </div>
              <div className="space-y-6">
                <ActionAlerts />
                <NotificationFeed />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScrubberStatsCard />
            </div>
            <DenialsList />
          </div>
        );
      case "patients":
        return <Patients />;
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
