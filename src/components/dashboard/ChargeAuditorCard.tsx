import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { FileSearch, DollarSign, AlertTriangle, ArrowRight } from "lucide-react";

interface AuditStats {
  totalAudits: number;
  potentialRevenue: number;
  missingCharges: number;
  pendingReview: number;
}

export function ChargeAuditorCard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AuditStats>({
    totalAudits: 0,
    potentialRevenue: 0,
    missingCharges: 0,
    pendingReview: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      const data = await awsCrud.select('charge_audits', user?.id);

      if (data) {
        const totalRevenue = data.reduce((sum, a) => sum + (a.potential_revenue || 0), 0);
        const totalMissing = data.reduce((sum, a) => sum + (a.missing_count || 0), 0);
        const pending = data.filter(a => a.status === "completed").length;

        setStats({
          totalAudits: data.length,
          potentialRevenue: totalRevenue,
          missingCharges: totalMissing,
          pendingReview: pending
        });
      }
    } catch (error) {
      console.error("Error fetching audit stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Charge Auditor</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/charge-auditor")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>AI-powered charge capture analysis</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading...</div>
        ) : stats.totalAudits === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No audits yet. Analyze clinical notes to find missed revenue.
            </p>
            <Button onClick={() => navigate("/charge-auditor")}>
              Run First Audit
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Audits</p>
                <p className="text-2xl font-bold">{stats.totalAudits}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Potential Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  ${stats.potentialRevenue.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Missing Charges</p>
                <p className="text-2xl font-bold text-red-600">{stats.missingCharges}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pendingReview}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate("/audit-history")}>
                View History
              </Button>
              <Button size="sm" className="flex-1" onClick={() => navigate("/charge-auditor")}>
                New Audit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
