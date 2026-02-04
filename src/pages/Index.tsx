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
import { NotificationFeed, ActionAlerts, ScrubberActivityCard, ChargeAuditorCard, DenialManagementCard } from "@/components/dashboard";
import { LogOut, Loader2, Zap } from "lucide-react";
import { awsApi } from "@/integrations/aws/awsApi";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isTestingAws, setIsTestingAws] = useState(false);

  const handleTestAwsConnection = async () => {
    setIsTestingAws(true);
    console.log("=== TESTING AWS API GATEWAY CONNECTION ===");
    console.log("Calling: awsApi.invoke('ecw-get-token', { body: { connectionId: 'test', environment: 'sandbox' } })");
    
    try {
      const { data, error } = await awsApi.invoke('ecw-get-token', { 
        body: { connectionId: 'test', environment: 'sandbox' } 
      });
      
      console.log("=== AWS API RESPONSE ===");
      console.log("Data:", data);
      console.log("Error:", error);
      console.log("=== END AWS API RESPONSE ===");
      
      if (error) {
        toast({
          title: "AWS Connection Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "AWS Connection Success!",
          description: "Check console for full response details",
        });
      }
    } catch (err) {
      console.error("AWS test failed:", err);
      toast({
        title: "AWS Test Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsTestingAws(false);
    }
  };

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
      // Local signout clears this browser immediately (avoids “stuck signed-in”)
      const { error } = await supabase.auth.signOut({ scope: "local" } as any);
      if (error) console.error("Sign out error:", error);
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setIsSigningOut(false);
      navigate("/auth");
    }
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
            
            {/* Notifications at top - Priority alerts first */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActionAlerts />
              <NotificationFeed />
            </div>
            
            <DashboardMetrics />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecentClaims />
              <AnalyticsCharts />
            </div>
            
            {/* Bottom Row: Scrubber Activity + Denials */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScrubberActivityCard />
              <DenialsList />
            </div>
            
            {/* Bottom Row: Charge Auditor + Denial Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChargeAuditorCard />
              <DenialManagementCard />
            </div>
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
        <div className="flex justify-end mb-4 gap-2">
          <Button 
            variant="outline" 
            onClick={handleTestAwsConnection}
            disabled={isTestingAws}
            className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
          >
            {isTestingAws ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {isTestingAws ? "Testing..." : "Test AWS Connection"}
          </Button>
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
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
