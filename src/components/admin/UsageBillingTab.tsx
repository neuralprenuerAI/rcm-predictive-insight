import { useState, useEffect } from "react";
import { awsApi } from "@/integrations/aws/awsApi";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Activity, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface UsageSummary {
  total_calls: number;
  by_event_type: Record<string, number>;
  period: string;
}

interface RecentActivity {
  id: string;
  event_type: string;
  created_at: string;
  metadata?: any;
}

export function UsageBillingTab() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        console.error("UsageBillingTab: No authenticated user found");
        toast.error("You must be logged in to view usage data");
        setLoading(false);
        return;
      }

      console.log("UsageBillingTab: Fetching usage for user", userId, "month", selectedMonth);

      const [summaryRes, recentRes] = await Promise.all([
        awsApi.invoke("rcm-usage-query", {
          body: { action: "get_summary", user_id: userId, month_year: selectedMonth },
        }),
        awsApi.invoke("rcm-usage-query", {
          body: { action: "get_recent", user_id: userId },
        }),
      ]);

      console.log("UsageBillingTab: summary response", JSON.stringify(summaryRes));
      console.log("UsageBillingTab: recent response", JSON.stringify(recentRes));

      if (summaryRes.error) throw summaryRes.error;
      if (recentRes.error) throw recentRes.error;

      // Lambda returns { success, summary: [...], total_this_month: N } directly
      const raw = summaryRes.data as any;
      const byEventType: Record<string, number> = {};
      if (Array.isArray(raw?.summary)) {
        raw.summary.forEach((item: any) => {
          byEventType[item.event_type || item.name || 'unknown'] = item.count || item.total || 0;
        });
      }

      setSummary({
        total_calls: raw?.total_this_month ?? 0,
        by_event_type: byEventType,
        period: selectedMonth,
      });

      const recentRaw = recentRes.data as any;
      setRecent(recentRaw?.recent || recentRaw?.records || recentRaw?.data || []);
    } catch (err: any) {
      console.error("UsageBillingTab: fetch failed", err);
      toast.error("Failed to load usage data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsage(); }, [selectedMonth]);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const eventEntries = summary?.by_event_type
    ? Object.entries(summary.by_event_type).sort(([, a], [, b]) => b - a)
    : [];

  const maxCount = eventEntries.length > 0 ? eventEntries[0][1] : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Usage & Billing</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchUsage} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Total calls card */}
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Total API Calls — {monthLabel(selectedMonth)}</p>
            <p className="text-5xl font-bold text-primary">
              {loading ? "—" : (summary?.total_calls ?? 0).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Calls by event type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Calls by Event Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-4">Loading…</p>
          ) : eventEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No usage data for this period</p>
          ) : (
            <div className="space-y-3">
              {eventEntries.map(([type, count]) => (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate mr-4">{type}</span>
                    <span className="text-muted-foreground">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <CardDescription>Latest API calls</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Type</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-6 text-muted-foreground">No recent activity</TableCell>
                </TableRow>
              ) : (
                recent.slice(0, 20).map((item, i) => (
                  <TableRow key={item.id || i}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{item.event_type}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(item.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
