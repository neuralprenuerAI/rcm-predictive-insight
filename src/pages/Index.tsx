import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import DashboardMetrics from "@/components/DashboardMetrics";
import ClaimUploadReview from "@/components/ClaimUploadReview";
import DenialsList from "@/components/DenialsList";
import AnalyticsCharts from "@/components/AnalyticsCharts";

const Index = () => {
  const [activeView, setActiveView] = useState("dashboard");

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Revenue Cycle Dashboard</h1>
              <p className="text-muted-foreground">Real-time overview of your RCM performance</p>
            </div>
            <DashboardMetrics />
            <DenialsList />
          </div>
        );
      case "claim-review":
        return <ClaimUploadReview />;
      case "analytics":
        return <AnalyticsCharts />;
      case "denials":
      case "authorizations":
      case "payment-posting":
      case "settings":
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                {activeView.charAt(0).toUpperCase() + activeView.slice(1).replace("-", " ")}
              </h2>
              <p className="text-muted-foreground">Module coming soon</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 p-8">
        {renderView()}
      </main>
    </div>
  );
};

export default Index;
