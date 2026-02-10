import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { IdleTimeoutWarning } from "@/components/IdleTimeoutWarning";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import DocumentUpload from "./pages/DocumentUpload";
import Claims from "./pages/Claims";
import ClaimScrubber from "./pages/ClaimScrubber";
import ScrubHistory from "./pages/ScrubHistory";
import Analytics from "./pages/Analytics";
import ChargeAuditor from "./pages/ChargeAuditor";
import AuditHistory from "./pages/AuditHistory";
import DenialManagement from "./pages/DenialManagement";
import AppealsManagement from "./pages/AppealsManagement";
import PatientIntake from "./pages/PatientIntake";
import Admin from "./pages/Admin";
import { ProtectedAdminRoute } from "@/components/auth/ProtectedAdminRoute";

const queryClient = new QueryClient();

function IdleTimeoutWrapper() {
  const { showWarning, stayActive, performLogout } = useIdleTimeout();
  return (
    <IdleTimeoutWarning
      open={showWarning}
      onStayActive={stayActive}
      onLogout={performLogout}
    />
  );
}

function PasswordRecoveryHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        navigate("/settings");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RoleProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <IdleTimeoutWrapper />
        <BrowserRouter>
          <PasswordRecoveryHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/upload" element={<DocumentUpload />} />
            <Route path="/claims" element={<Claims />} />
            <Route path="/scrubber" element={<ClaimScrubber />} />
            <Route path="/scrub-history" element={<ScrubHistory />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/charge-auditor" element={<ChargeAuditor />} />
            <Route path="/audit-history" element={<AuditHistory />} />
            <Route path="/denial-management" element={<DenialManagement />} />
            <Route path="/appeals" element={<AppealsManagement />} />
            <Route path="/patient-intake" element={<PatientIntake />} />
            <Route
              path="/admin"
              element={
                <ProtectedAdminRoute>
                  <Admin />
                </ProtectedAdminRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </RoleProvider>
  </QueryClientProvider>
);

export default App;
