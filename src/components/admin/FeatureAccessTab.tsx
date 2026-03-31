import { useState, useEffect } from "react";
import { awsApi } from "@/integrations/aws/awsApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ToggleRight } from "lucide-react";
import { toast } from "sonner";

const MODULE_LABELS: Record<string, string> = {
  denial_management: "Denial Management",
  patient_intake: "Patient Intake",
  claim_scrubber: "Claim Scrubber",
  colombia: "Colombia Billing",
  analytics: "Analytics",
  appeals: "Appeals",
};

interface OrgModule {
  id: string;
  org_id: string;
  org_name?: string;
  module_key: string;
  is_enabled: boolean;
}

interface OrgGroup {
  org_id: string;
  org_name: string;
  modules: OrgModule[];
}

export function FeatureAccessTab() {
  const [modules, setModules] = useState<OrgModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchModules = async () => {
    setLoading(true);
    try {
      const result = await awsApi.invoke("crud", {
        body: { action: "select", table: "org_modules" },
      });
      if (result.error) throw result.error;
      setModules(result.data?.data || result.data || []);
    } catch (err: any) {
      toast.error("Failed to load modules: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModules(); }, []);

  const toggleModule = async (mod: OrgModule) => {
    setToggling(mod.id);
    try {
      const result = await awsApi.invoke("crud", {
        body: {
          action: "update",
          table: "org_modules",
          data: { is_enabled: !mod.is_enabled },
          where: { id: mod.id },
        },
      });
      if (result.error) throw result.error;
      setModules((prev) =>
        prev.map((m) => (m.id === mod.id ? { ...m, is_enabled: !m.is_enabled } : m))
      );
      toast.success(`${MODULE_LABELS[mod.module_key] || mod.module_key} ${!mod.is_enabled ? "enabled" : "disabled"}`);
    } catch (err: any) {
      toast.error("Failed to toggle module: " + err.message);
    } finally {
      setToggling(null);
    }
  };

  // Group modules by org
  const grouped: OrgGroup[] = Object.values(
    modules.reduce<Record<string, OrgGroup>>((acc, m) => {
      const key = m.org_id;
      if (!acc[key]) acc[key] = { org_id: key, org_name: m.org_name || key, modules: [] };
      acc[key].modules.push(m);
      return acc;
    }, {})
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ToggleRight className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-foreground">Feature Access</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchModules} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No module configurations found</CardContent></Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.org_id}>
            <CardHeader>
              <CardTitle className="text-lg">{group.org_name}</CardTitle>
              <CardDescription>Manage module access for this organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.modules.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center justify-between rounded-lg border p-4 bg-background"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {MODULE_LABELS[mod.module_key] || mod.module_key}
                      </p>
                      <Badge variant={mod.is_enabled ? "default" : "secondary"} className="text-xs">
                        {mod.is_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <Switch
                      checked={mod.is_enabled}
                      onCheckedChange={() => toggleModule(mod)}
                      disabled={toggling === mod.id}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
