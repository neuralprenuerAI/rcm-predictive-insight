import React, { useState } from "react";
import { useAdminErrors, AdminError } from "@/hooks/useAdminErrors";
import { ErrorDetailModal } from "./ErrorDetailModal";
import { useRole } from "@/contexts/RoleContext";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  Loader2,
  AlertCircle,
  Info,
  AlertOctagon
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Severity Badge Component
function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    critical: { bg: "bg-red-100", text: "text-red-800", icon: AlertOctagon },
    error: { bg: "bg-orange-100", text: "text-orange-800", icon: XCircle },
    warning: { bg: "bg-yellow-100", text: "text-yellow-800", icon: AlertTriangle },
    info: { bg: "bg-blue-100", text: "text-blue-800", icon: Info },
  };

  const { bg, text, icon: Icon } = config[severity] || config.error;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {severity.toUpperCase()}
    </span>
  );
}

// Main Errors Tab Component
export function ErrorsTab() {
  const [resolvedFilter, setResolvedFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedError, setSelectedError] = useState<AdminError | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { isSuperAdmin } = useRole();

  const { data: errors, isLoading, refetch } = useAdminErrors({
    severity: severityFilter !== "all" ? severityFilter : undefined,
    resolved: resolvedFilter === "all" ? undefined : resolvedFilter === "resolved",
  });

  // Calculate stats
  const allErrors = errors || [];
  const criticalCount = allErrors.filter(e => e.severity === "critical" && !e.resolved).length;
  const errorCount = allErrors.filter(e => e.severity === "error" && !e.resolved).length;
  const warningCount = allErrors.filter(e => e.severity === "warning" && !e.resolved).length;
  const unresolvedCount = allErrors.filter(e => !e.resolved).length;

  const handleViewError = (error: AdminError) => {
    setSelectedError(error);
    setIsDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertOctagon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{criticalCount}</p>
              <p className="text-sm text-muted-foreground">Critical</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <XCircle className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{warningCount}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${unresolvedCount > 0 ? "bg-red-100" : "bg-green-100"} rounded-lg`}>
              {unresolvedCount > 0 ? (
                <AlertCircle className="h-5 w-5 text-red-600" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
            </div>
            <div>
              <p className={`text-2xl font-bold ${unresolvedCount > 0 ? "text-red-600" : "text-green-600"}`}>
                {unresolvedCount}
              </p>
              <p className="text-sm text-muted-foreground">Unresolved</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Tabs value={resolvedFilter} onValueChange={(v) => setResolvedFilter(v as "unresolved" | "resolved" | "all")}>
          <TabsList>
            <TabsTrigger value="unresolved">Unresolved</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Errors Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Severity</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Component</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allErrors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 text-green-500" />
                    <p className="font-medium">No errors found</p>
                    <p className="text-sm">
                      {resolvedFilter === "unresolved" 
                        ? "All errors have been resolved!" 
                        : "No errors match your filters"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              allErrors.map((error) => (
                <TableRow key={error.id}>
                  <TableCell>
                    <SeverityBadge severity={error.severity} />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium truncate max-w-[300px]" title={error.error_message}>
                      {error.error_message}
                    </p>
                    <p className="text-xs text-muted-foreground">{error.error_type}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {error.user_email || "System"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {error.component || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {formatDistanceToNow(new Date(error.created_at), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {error.resolved ? (
                      <span className="inline-flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        Open
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewError(error)}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Admin Note */}
      {!isSuperAdmin && (
        <div className="bg-muted/50 border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Only Super Admins can mark errors as resolved. 
            Contact a Super Admin if you need to resolve an error.
          </p>
        </div>
      )}

      {/* Error Detail Modal */}
      <ErrorDetailModal
        error={selectedError}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedError(null);
        }}
        onResolved={() => refetch()}
      />
    </div>
  );
}

export default ErrorsTab;
