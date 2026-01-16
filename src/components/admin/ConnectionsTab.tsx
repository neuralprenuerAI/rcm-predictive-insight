import React, { useState } from "react";
import { useAdminConnections, AdminConnection } from "@/hooks/useAdminConnections";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Plug, 
  Search, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Clock,
  User,
  Eye,
  Loader2,
  Globe,
  Settings
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

// Connection Status Badge
function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <CheckCircle className="h-3 w-3" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      <XCircle className="h-3 w-3" />
      Inactive
    </span>
  );
}

// Connection Detail Modal
function ConnectionDetailModal({ 
  connection, 
  isOpen, 
  onClose 
}: { 
  connection: AdminConnection | null; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  if (!connection) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Connection Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{connection.name || connection.connection_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium">{connection.connection_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge isActive={connection.is_active} />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Owner</p>
              <p className="font-medium">{connection.user_email}</p>
            </div>
          </div>

          {/* API URL */}
          <div>
            <p className="text-sm text-muted-foreground">API URL</p>
            <p className="font-mono text-sm bg-muted px-2 py-1 rounded mt-1 break-all">
              {connection.api_url || "Not configured"}
            </p>
          </div>

          {/* Configuration */}
          {connection.configuration && Object.keys(connection.configuration).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground">Configuration</p>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto max-h-32">
                {JSON.stringify(connection.configuration, null, 2)}
              </pre>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="text-sm">
                {format(new Date(connection.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sync</p>
              <p className="text-sm">
                {connection.last_sync 
                  ? formatDistanceToNow(new Date(connection.last_sync), { addSuffix: true })
                  : "Never"
                }
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main Connections Tab Component
export function ConnectionsTab() {
  const { data: connections, isLoading, refetch } = useAdminConnections();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedConnection, setSelectedConnection] = useState<AdminConnection | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Filter connections
  const filteredConnections = (connections || []).filter((conn) => {
    const matchesSearch = 
      (conn.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      conn.connection_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conn.api_url.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "active" && conn.is_active) ||
      (statusFilter === "inactive" && !conn.is_active);
    
    const matchesType = typeFilter === "all" || conn.connection_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Get unique types for filter
  const connectionTypes = [...new Set((connections || []).map(c => c.connection_type))];

  // Calculate summary stats
  const totalConnections = connections?.length || 0;
  const activeConnections = connections?.filter(c => c.is_active).length || 0;

  const handleViewDetails = (connection: AdminConnection) => {
    setSelectedConnection(connection);
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
            <div className="p-2 bg-primary/10 rounded-lg">
              <Plug className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalConnections}</p>
              <p className="text-sm text-muted-foreground">Total Connections</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeConnections}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <XCircle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalConnections - activeConnections}</p>
              <p className="text-sm text-muted-foreground">Inactive</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{connectionTypes.length}</p>
              <p className="text-sm text-muted-foreground">Connection Types</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {connectionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Connections Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connection</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>API URL</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConnections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                    ? "No connections match your filters"
                    : "No connections found"
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredConnections.map((connection) => (
                <TableRow key={connection.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {connection.name || connection.connection_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{connection.connection_type}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{connection.user_email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge isActive={connection.is_active} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 max-w-[200px]">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate" title={connection.api_url}>
                        {connection.api_url}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {connection.last_sync
                        ? formatDistanceToNow(new Date(connection.last_sync), { addSuffix: true })
                        : "Never"
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDetails(connection)}
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

      {/* Connection Detail Modal */}
      <ConnectionDetailModal
        connection={selectedConnection}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedConnection(null);
        }}
      />
    </div>
  );
}

export default ConnectionsTab;
