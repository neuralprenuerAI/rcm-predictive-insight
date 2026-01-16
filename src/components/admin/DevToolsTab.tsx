import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/contexts/RoleContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Database,
  Table as TableIcon,
  Play,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Shield,
  Server,
  Settings,
  Trash2,
  Copy,
  Check,
  Wrench
} from "lucide-react";

interface TableInfo {
  name: string;
  rowCount: number;
}

// Database Explorer Component
function DatabaseExplorer() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const knownTables = [
    "user_roles",
    "activity_logs",
    "error_logs",
    "pending_invites",
    "api_connections",
    "patients",
    "claims",
    "profiles",
    "documents",
    "authorizations",
    "appeals",
    "denial_queue",
  ];

  const fetchTableCounts = async () => {
    setIsLoading(true);
    const tableInfos: TableInfo[] = [];

    for (const tableName of knownTables) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (supabase as any)
          .from(tableName)
          .select("*", { count: "exact", head: true });

        if (!error) {
          tableInfos.push({ name: tableName, rowCount: count || 0 });
        }
      } catch {
        // Table might not exist or no access
      }
    }

    setTables(tableInfos.sort((a, b) => b.rowCount - a.rowCount));
    setIsLoading(false);
  };

  const fetchTableData = async (tableName: string) => {
    setIsLoadingData(true);
    setSelectedTable(tableName);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select("*")
        .limit(50);

      if (error) throw error;
      setTableData((data || []) as Record<string, unknown>[]);
    } catch (err) {
      console.error("Error fetching table data:", err);
      setTableData([]);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchTableCounts();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Database Explorer
        </CardTitle>
        <CardDescription>View tables and their contents (read-only)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Tables List */}
          <div className="lg:col-span-1 border rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-sm">Tables</p>
              <Button variant="ghost" size="icon" onClick={fetchTableCounts}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {tables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => fetchTableData(table.name)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                      selectedTable === table.name
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <TableIcon className="h-3 w-3" />
                      {table.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {table.rowCount.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table Data */}
          <div className="lg:col-span-3 border rounded-lg p-3">
            {!selectedTable ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="text-center text-muted-foreground">
                  <TableIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a table to view its data</p>
                </div>
              </div>
            ) : isLoadingData ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium">{selectedTable}</p>
                  <span className="text-xs text-muted-foreground">
                    Showing up to 50 rows
                  </span>
                </div>
                <div className="overflow-auto max-h-[350px]">
                  {tableData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No data in this table</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(tableData[0]).slice(0, 6).map((key) => (
                            <TableHead key={key} className="text-xs whitespace-nowrap">
                              {key}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).slice(0, 6).map((value, j) => (
                              <TableCell key={j} className="text-xs max-w-[150px] truncate">
                                {typeof value === "object" 
                                  ? JSON.stringify(value).slice(0, 30) + "..."
                                  : String(value ?? "").slice(0, 30)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Query Component
function QuickQuery() {
  const { toast } = useToast();
  const [query, setQuery] = useState("SELECT * FROM user_roles LIMIT 10");
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const runQuery = async () => {
    // Safety check - only allow SELECT queries
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith("SELECT")) {
      setError("Only SELECT queries are allowed for safety");
      setResults(null);
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      // Parse the table name from the query
      const tableMatch = query.match(/FROM\s+(\w+)/i);
      if (!tableMatch) {
        throw new Error("Could not parse table name from query");
      }

      const tableName = tableMatch[1];
      
      // For safety, we'll use the Supabase client instead of raw SQL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: queryError } = await (supabase as any)
        .from(tableName)
        .select("*")
        .limit(100);

      if (queryError) throw queryError;
      
      setResults((data || []) as Record<string, unknown>[]);
      toast({
        title: "Query Executed",
        description: `Returned ${data?.length || 0} rows`,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Query failed";
      setError(errorMessage);
      toast({
        title: "Query Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const copyResults = async () => {
    if (!results) return;
    await navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Quick Query
        </CardTitle>
        <CardDescription>Run read-only queries (SELECT only)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT * FROM table_name LIMIT 10"
            className="font-mono text-sm"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            ⚠️ Only SELECT queries are allowed. Queries are limited to 100 rows.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={runQuery} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Query
              </>
            )}
          </Button>
          {results && (
            <Button variant="outline" onClick={copyResults}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy Results
            </Button>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">
            {error}
          </div>
        )}

        {results && (
          <div className="bg-muted rounded-lg p-3 overflow-auto max-h-[300px]">
            <pre className="text-xs font-mono">{JSON.stringify(results, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// System Info Component
function SystemInfo() {
  const [info, setInfo] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    setInfo({
      browser: navigator.userAgent.slice(0, 100),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.slice(0, 50) || "Not configured",
      nodeEnv: import.meta.env.MODE,
      buildTime: new Date().toISOString(),
    });
  }, []);

  if (!info) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          System Information
        </CardTitle>
        <CardDescription>Environment and configuration details</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {Object.entries(info).map(([key, value]) => (
            <div key={key} className="flex justify-between py-2 border-b last:border-0">
              <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <span className="font-mono text-xs truncate max-w-[200px]" title={value}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Feature Flags Component
function FeatureFlags() {
  const [flags, setFlags] = useState({
    enableBetaFeatures: false,
    enableDebugMode: false,
    enableMaintenanceMode: false,
    enableNewPatientUI: true,
    enableAIAssistant: false,
  });

  const toggleFlag = (key: keyof typeof flags) => {
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Feature Flags
        </CardTitle>
        <CardDescription>Toggle features on/off (UI only - not persisted)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.entries(flags) as [keyof typeof flags, boolean][]).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key} className="capitalize">
                {key.replace(/([A-Z])/g, ' $1').replace('enable ', '')}
              </Label>
              <Switch
                id={key}
                checked={value}
                onCheckedChange={() => toggleFlag(key)}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Note: These flags are for demonstration only and reset on page reload.
        </p>
      </CardContent>
    </Card>
  );
}

// Danger Zone Component
function DangerZone() {
  const { toast } = useToast();

  const handleClearLogs = (type: string) => {
    toast({
      title: "Not Implemented",
      description: `Clear ${type} is disabled for safety. Implement with caution.`,
      variant: "destructive",
    });
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>Destructive actions - use with extreme caution</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg">
          <div>
            <p className="font-medium">Clear Activity Logs</p>
            <p className="text-sm text-muted-foreground">Delete all activity logs from the database</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete ALL activity logs. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleClearLogs("activity logs")} className="bg-destructive">
                  Yes, Delete All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="flex items-center justify-between p-4 bg-destructive/5 rounded-lg">
          <div>
            <p className="font-medium">Clear Error Logs</p>
            <p className="text-sm text-muted-foreground">Delete all resolved error logs</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all resolved error logs. Unresolved errors will be kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleClearLogs("error logs")} className="bg-destructive">
                  Yes, Delete Resolved
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dev Tools Tab Component
export function DevToolsTab() {
  const { isSuperAdmin } = useRole();

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Access Denied</h3>
          <p className="text-muted-foreground mt-1">
            Developer Tools are only available to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-purple-100 p-2 rounded-lg">
          <Wrench className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Developer Tools</h2>
          <p className="text-sm text-muted-foreground">Advanced tools for debugging and system management</p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-800 font-medium">Super Admin Access Only</p>
        </div>
        <p className="text-yellow-700 text-sm mt-1">
          These tools can affect system behavior. Use with caution.
        </p>
      </div>

      {/* Tools Grid */}
      <div className="space-y-6">
        <DatabaseExplorer />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickQuery />
          <SystemInfo />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <FeatureFlags />
          <DangerZone />
        </div>
      </div>
    </div>
  );
}

export default DevToolsTab;
