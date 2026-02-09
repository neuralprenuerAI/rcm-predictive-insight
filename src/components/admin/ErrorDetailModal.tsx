import React, { useState } from "react";
import { AdminError } from "@/hooks/useAdminErrors";
import { useRole } from "@/contexts/RoleContext";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User, 
  Code,
  FileText,
  Loader2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface ErrorDetailModalProps {
  error: AdminError | null;
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export function ErrorDetailModal({ 
  error, 
  isOpen, 
  onClose,
  onResolved 
}: ErrorDetailModalProps) {
  const { isSuperAdmin } = useRole();
  const { toast } = useToast();
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  if (!error) return null;

  const severityConfig: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
    error: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
    warning: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
    info: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  };

  const config = severityConfig[error.severity] || severityConfig.error;

  const handleResolve = async () => {
    if (!isSuperAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only Super Admins can resolve errors",
        variant: "destructive",
      });
      return;
    }

    setIsResolving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await awsCrud.update("error_logs", {
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: resolutionNotes || null,
      }, { id: error.id }, user.id);

      toast({
        title: "Error Resolved",
        description: "The error has been marked as resolved",
      });

      onResolved();
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      toast({
        title: "Failed to Resolve",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Error Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Banner */}
          {error.resolved ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800">Resolved</p>
                <p className="text-sm text-green-600">
                  {error.resolved_at && format(new Date(error.resolved_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-2 p-3 ${config.bg} border ${config.border} rounded-lg`}>
              <XCircle className={`h-5 w-5 ${config.text}`} />
              <div>
                <p className={`font-medium ${config.text}`}>Unresolved - {error.severity.toUpperCase()}</p>
                <p className={`text-sm ${config.text} opacity-80`}>This error needs attention</p>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Error Type</p>
              <p className="font-medium">{error.error_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Severity</p>
              <div className="mt-1">
                <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
                  {error.severity.toUpperCase()}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User</p>
              <p className="font-medium flex items-center gap-1">
                <User className="h-4 w-4" />
                {error.user_email || "System / Anonymous"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timestamp</p>
              <p className="font-medium flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(error.created_at), "MMM d, yyyy 'at' h:mm:ss a")}
              </p>
            </div>
          </div>

          {/* Component & Action */}
          {(error.component || error.action) && (
            <div className="grid grid-cols-2 gap-4">
              {error.component && (
                <div>
                  <p className="text-sm text-muted-foreground">Component</p>
                  <p className="font-medium">{error.component}</p>
                </div>
              )}
              {error.action && (
                <div>
                  <p className="text-sm text-muted-foreground">Action</p>
                  <p className="font-medium">{error.action}</p>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          <div>
            <p className="text-sm text-muted-foreground">Error Message</p>
            <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 font-mono">{error.error_message}</p>
            </div>
          </div>

          {/* Stack Trace */}
          {error.error_stack && (
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Code className="h-4 w-4" />
                Stack Trace
              </p>
              <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48 font-mono">
                {error.error_stack}
              </pre>
            </div>
          )}

          {/* Request Data */}
          {error.request_data && Object.keys(error.request_data).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Request Data
              </p>
              <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-32 font-mono">
                {JSON.stringify(error.request_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Response Data */}
          {error.response_data && Object.keys(error.response_data).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Response Data
              </p>
              <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-32 font-mono">
                {JSON.stringify(error.response_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Resolution Notes (if resolved) */}
          {error.resolved && error.resolution_notes && (
            <div>
              <p className="text-sm text-muted-foreground">Resolution Notes</p>
              <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">{error.resolution_notes}</p>
              </div>
            </div>
          )}

          {/* Resolve Section (super_admin only, if not resolved) */}
          {isSuperAdmin && !error.resolved && (
            <div className="pt-4 border-t">
              <Label htmlFor="resolution-notes">Mark as Resolved</Label>
              <Textarea
                id="resolution-notes"
                placeholder="Add resolution notes (optional)..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isSuperAdmin && !error.resolved && (
            <Button onClick={handleResolve} disabled={isResolving} className="bg-green-600 hover:bg-green-700">
              {isResolving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resolving...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Resolved
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ErrorDetailModal;
