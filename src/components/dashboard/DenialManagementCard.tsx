import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { AlertTriangle, ArrowRight, Clock, DollarSign, Send, CheckCircle } from "lucide-react";

interface DenialStats {
  totalDenials: number;
  newDenials: number;
  appealing: number;
  totalDeniedAmount: number;
  urgentCount: number;
  appealsWon: number;
  recoveredAmount: number;
}

export function DenialManagementCard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DenialStats>({
    totalDenials: 0,
    newDenials: 0,
    appealing: 0,
    totalDeniedAmount: 0,
    urgentCount: 0,
    appealsWon: 0,
    recoveredAmount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [denials, appeals] = await Promise.all([
        awsCrud.select('denial_queue', user.id),
        awsCrud.select('appeals', user.id),
      ]);

      const denialList = denials || [];
      const appealList = appeals || [];

      setStats({
        totalDenials: denialList.length,
        newDenials: denialList.filter(d => d.status === "new").length,
        appealing: denialList.filter(d => d.status === "appealing").length,
        totalDeniedAmount: denialList.reduce((sum, d) => sum + (d.denied_amount || 0), 0),
        urgentCount: denialList.filter(d => d.days_until_deadline !== null && d.days_until_deadline <= 7 && d.status !== "resolved").length,
        appealsWon: appealList.filter(a => a.status === "won").length,
        recoveredAmount: appealList.filter(a => a.status === "won").reduce((sum, a) => sum + (a.outcome_amount || 0), 0),
      });
    } catch (error) {
      console.error("Error fetching denial stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg">Denial Management</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/denial-management")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Track denials and appeals</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : stats.totalDenials === 0 && stats.appealsWon === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              No denials tracked yet. Import from 835 files or add manually.
            </p>
            <Button size="sm" onClick={() => navigate("/denial-management")}>
              Get Started
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Denial Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span className="text-xs">New Denials</span>
                </div>
                <p className="text-xl font-semibold">{stats.newDenials}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span className="text-xs">Total Denied</span>
                </div>
                <p className="text-xl font-semibold text-red-600">${stats.totalDeniedAmount.toFixed(0)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Send className="h-3.5 w-3.5" />
                  <span className="text-xs">Appealing</span>
                </div>
                <p className="text-xl font-semibold text-blue-600">{stats.appealing}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="text-xs">Recovered</span>
                </div>
                <p className="text-xl font-semibold text-green-600">${stats.recoveredAmount.toFixed(0)}</p>
              </div>
            </div>

            {/* Urgent Alert */}
            {stats.urgentCount > 0 && (
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-md">
                <Clock className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700">
                  {stats.urgentCount} denial{stats.urgentCount > 1 ? "s" : ""} with deadline ≤7 days
                </span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate("/denial-management")}>
                View Denials
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => navigate("/appeals")}>
                View Appeals
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
