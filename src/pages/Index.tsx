import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { NotificationFeed, ActionAlerts, ScrubberActivityCard, ChargeAuditorCard, DenialManagementCard, InsuranceVerificationCard } from "@/components/dashboard";

const Index = () => {
  const [searchParams] = useSearchParams();
  const activeView = searchParams.get("view") || "dashboard";

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Healthcare RCM Dashboard</h1>
              <p className="text-muted-foreground">Real-time revenue cycle performance metrics</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ActionAlerts />
              <NotificationFeed />
            </div>
            
            <DashboardMetrics />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecentClaims />
              <AnalyticsCharts />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScrubberActivityCard />
              <DenialsList />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChargeAuditorCard />
              <DenialManagementCard />
            </div>
            
            <InsuranceVerificationCard />
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

  return <>{renderView()}</>;
};

export default Index;
