import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { RoleProvider } from "@/contexts/RoleContext";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RoleProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
