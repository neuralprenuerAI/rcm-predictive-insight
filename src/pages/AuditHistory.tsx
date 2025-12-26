import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft,
  Search,
  Filter,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";

interface ClinicalNote {
  patient_name: string | null;
  encounter_date: string | null;
  provider_name: string | null;
  note_type: string | null;
}

interface AuditRecord {
  id: string;
  audit_date: string;
  status: string;
  predicted_count: number;
  actual_count: number;
  matched_count: number;
  missing_count: number;
  undercoded_count: number;
  overcoded_count: number;
  potential_revenue: number;
  confirmed_revenue: number;
  overall_confidence: number;
  reviewer_notes: string | null;
  clinical_note: ClinicalNote | null;
}

interface Discrepancy {
  id: string;
  discrepancy_type: string;
  severity: string;
  predicted_cpt: string | null;
  actual_cpt: string | null;
  revenue_impact: number;
  description: string;
  ai_explanation: string;
  status: string;
}

export default function AuditHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Record<string, Discrepancy[]>>({});

  // Stats
  const [stats, setStats] = useState({
    totalAudits: 0,
    totalPotentialRevenue: 0,
    totalMissingCharges: 0,
    avgConfidence: 0
  });

  useEffect(() => {
    fetchAudits();
  }, [statusFilter]);

  const fetchAudits = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("charge_audits")
        .select(`
          *,
          clinical_note:clinical_notes(
            patient_name,
            encounter_date,
            provider_name,
            note_type
          )
        `)
        .order("audit_date", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Handle the clinical_note array from Supabase join
      const formattedData: AuditRecord[] = (data || []).map((item: any) => ({
        ...item,
        clinical_note: Array.isArray(item.clinical_note) ? item.clinical_note[0] || null : item.clinical_note
      }));

      setAudits(formattedData);

      // Calculate stats
      if (formattedData && formattedData.length > 0) {
        const totalRevenue = formattedData.reduce((sum, a) => sum + (a.potential_revenue || 0), 0);
        const totalMissing = formattedData.reduce((sum, a) => sum + (a.missing_count || 0), 0);
        const avgConf = formattedData.reduce((sum, a) => sum + (a.overall_confidence || 0), 0) / formattedData.length;
        
        setStats({
          totalAudits: formattedData.length,
          totalPotentialRevenue: totalRevenue,
          totalMissingCharges: totalMissing,
          avgConfidence: Math.round(avgConf)
        });
      }
    } catch (error) {
      console.error("Error fetching audits:", error);
      toast({
        title: "Error",
        description: "Failed to load audit history",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscrepancies = async (auditId: string) => {
    if (discrepancies[auditId]) return;

    try {
      const { data, error } = await supabase
        .from("audit_discrepancies")
        .select("*")
        .eq("audit_id", auditId)
        .order("severity", { ascending: true });

      if (error) throw error;

      setDiscrepancies(prev => ({
        ...prev,
        [auditId]: data || []
      }));
    } catch (error) {
      console.error("Error fetching discrepancies:", error);
    }
  };

  const toggleExpand = (auditId: string) => {
    if (expandedAuditId === auditId) {
      setExpandedAuditId(null);
    } else {
      setExpandedAuditId(auditId);
      fetchDiscrepancies(auditId);
    }
  };

  const updateAuditStatus = async (auditId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("charge_audits")
        .update({ 
          status: newStatus,
          reviewed_at: new Date().toISOString()
        })
        .eq("id", auditId);

      if (error) throw error;

      setAudits(audits.map(a => 
        a.id === auditId ? { ...a, status: newStatus } : a
      ));

      toast({
        title: "Status Updated",
        description: `Audit marked as ${newStatus}`
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case "reviewed":
        return <Badge className="bg-blue-500"><FileText className="h-3 w-3 mr-1" />Reviewed</Badge>;
      case "actioned":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Actioned</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-500">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low":
        return <Badge className="bg-blue-500">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const filteredAudits = audits.filter(audit => {
    if (!searchTerm) return true;
    const patientName = audit.clinical_note?.patient_name?.toLowerCase() || "";
    const providerName = audit.clinical_note?.provider_name?.toLowerCase() || "";
    return patientName.includes(searchTerm.toLowerCase()) || 
           providerName.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center">

        <div className="flex items-center gap-4">

          <Button variant="ghost" size="icon" onClick={() => navigate("/charge-auditor")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>

            <h1 className="text-3xl font-bold tracking-tight">Audit History</h1>

            <p className="text-muted-foreground">Review past charge capture audits</p>

          </div>

        </div>

        <div className="flex gap-2">

          <Button variant="outline" onClick={fetchAudits}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate("/charge-auditor")}>
            New Audit
          </Button>
        </div>

      </div>


      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

        <Card>
          <CardContent className="pt-6">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-xs text-muted-foreground">Total Audits</p>

                <p className="text-2xl font-bold">{stats.totalAudits}</p>

              </div>

              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-xs text-muted-foreground">Potential Revenue</p>

                <p className="text-2xl font-bold text-green-600">
                  ${stats.totalPotentialRevenue.toFixed(2)}
                </p>

              </div>

              <DollarSign className="h-5 w-5 text-green-500" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-xs text-muted-foreground">Missing Charges</p>

                <p className="text-2xl font-bold text-red-600">{stats.totalMissingCharges}</p>

              </div>

              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>

          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">

            <div className="flex justify-between items-start">

              <div>

                <p className="text-xs text-muted-foreground">Avg Confidence</p>

                <p className="text-2xl font-bold">{stats.avgConfidence}%</p>

              </div>

              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </div>

          </CardContent>
        </Card>
      </div>


      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">

            <div className="flex-1">

              <div className="relative">

                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by patient or provider..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="actioned">Actioned</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </CardContent>
      </Card>

      {/* Audits Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Records</CardTitle>
          <CardDescription>
            {filteredAudits.length} audit{filteredAudits.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filteredAudits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audits found. Run your first audit from the Charge Auditor page.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Predicted</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Missing</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudits.map((audit) => (
                  <>
                    <TableRow 
                      key={audit.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleExpand(audit.id)}
                    >
                      <TableCell>
                        {expandedAuditId === audit.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(audit.audit_date), "MMM d, yyyy")}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(audit.audit_date), "h:mm a")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {audit.clinical_note?.patient_name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {audit.clinical_note?.provider_name || ""}
                        </p>
                      </TableCell>
                      <TableCell>{audit.predicted_count}</TableCell>
                      <TableCell>{audit.actual_count}</TableCell>
                      <TableCell>
                        <span className={audit.missing_count > 0 ? "text-red-600 font-medium" : ""}>
                          {audit.missing_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={audit.potential_revenue > 0 ? "text-green-600 font-medium" : ""}>
                          ${audit.potential_revenue?.toFixed(2) || "0.00"}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(audit.status)}</TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          {audit.status === "completed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateAuditStatus(audit.id, "reviewed")}
                            >
                              Mark Reviewed
                            </Button>
                          )}
                          {audit.status === "reviewed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateAuditStatus(audit.id, "actioned")}
                            >
                              Mark Actioned
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Details */}
                    {expandedAuditId === audit.id && (
                      <TableRow key={`${audit.id}-details`}>
                        <TableCell colSpan={9} className="bg-muted/30">
                          <div className="p-4">

                            <div className="flex items-center justify-between mb-3">

                              <h4 className="font-medium">Discrepancies Found</h4>
                              <Badge variant="outline">
                                Confidence: {audit.overall_confidence || 0}%
                              </Badge>
                            </div>

                            
                            {discrepancies[audit.id]?.length > 0 ? (
                              <div className="space-y-2">

                                {discrepancies[audit.id].map((disc) => (
                                  <div 
                                    key={disc.id}
                                    className="flex items-start gap-3 p-3 bg-background rounded-lg border"
                                  >
                                    <div className="mt-0.5">

                                      {getSeverityBadge(disc.severity)}
                                    </div>

                                    <div className="flex-1">

                                      <div className="flex items-center gap-2">

                                        <span className="font-medium">
                                          {disc.discrepancy_type.replace(/_/g, " ")}
                                        </span>
                                        {disc.revenue_impact > 0 && (
                                          <Badge variant="outline" className="text-green-600">
                                            +${disc.revenue_impact.toFixed(2)}
                                          </Badge>
                                        )}
                                      </div>

                                      <p className="text-sm text-muted-foreground">

                                        {disc.description}
                                      </p>

                                      {disc.predicted_cpt && (
                                        <p className="text-xs text-muted-foreground mt-1">

                                          Predicted: {disc.predicted_cpt} | Actual: {disc.actual_cpt || "Not billed"}
                                        </p>

                                      )}
                                    </div>

                                  </div>

                                ))}
                              </div>

                            ) : (
                              <p className="text-sm text-muted-foreground">

                                No discrepancies recorded for this audit.
                              </p>

                            )}
                          </div>

                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
