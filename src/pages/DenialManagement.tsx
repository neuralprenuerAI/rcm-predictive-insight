import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";
import { 
  ArrowLeft,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  Upload,
  Sparkles
} from "lucide-react";
import { format } from "date-fns";

interface DenialRecord {
  id: string;
  denial_date: string;
  service_date: string | null;
  payer_name: string;
  reason_code: string;
  reason_description: string | null;
  classified_category: string | null;
  root_cause: string | null;
  billed_amount: number;
  denied_amount: number;
  cpt_code: string | null;
  icd_codes: string[] | null;
  status: string;
  priority: string;
  appeal_deadline: string | null;
  days_until_deadline: number | null;
  ai_confidence: number | null;
  patient: {
    first_name: string;
    last_name: string;
  } | null;
  claim: {
    claim_id: string;
  } | null;
}

interface Stats {
  total: number;
  newCount: number;
  appealingCount: number;
  totalDeniedAmount: number;
  urgentCount: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "appealing", label: "Appealing" },
  { value: "correcting", label: "Correcting" },
  { value: "resubmitting", label: "Resubmitting" },
  { value: "resolved", label: "Resolved" },
  { value: "written_off", label: "Written Off" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "medical_necessity", label: "Medical Necessity" },
  { value: "coding_error", label: "Coding Error" },
  { value: "authorization", label: "Authorization" },
  { value: "eligibility", label: "Eligibility" },
  { value: "timely_filing", label: "Timely Filing" },
  { value: "duplicate", label: "Duplicate" },
  { value: "bundling", label: "Bundling/NCCI" },
  { value: "coordination_of_benefits", label: "COB" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "All Priority" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export default function DenialManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [denials, setDenials] = useState<DenialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, newCount: 0, appealingCount: 0, totalDeniedAmount: 0, urgentCount: 0 });

  // Manual entry dialog
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    payerName: "",
    reasonCode: "",
    reasonDescription: "",
    billedAmount: "",
    deniedAmount: "",
    cptCode: "",
    serviceDate: "",
    denialDate: new Date().toISOString().split("T")[0],
  });
  const [submitting, setSubmitting] = useState(false);

  // Appeal generation
  const [generatingAppeal, setGeneratingAppeal] = useState<string | null>(null);

  // Fix instructions
  const [fixInstructions, setFixInstructions] = useState<Record<string, any>>({});
  const [loadingFix, setLoadingFix] = useState<string | null>(null);

  // 835 Import
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [detectedType, setDetectedType] = useState<string>('');

  useEffect(() => {
    fetchDenials();
  }, [statusFilter, categoryFilter, priorityFilter]);

  const fetchDenials = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const result = await awsCrud.select('denial_queue', user.id);
      setDenials((result || []) as DenialRecord[]);
    } catch (error) {
      console.error('Error fetching denials:', error);
      toast({ title: 'Error', description: 'Failed to load denials', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualEntry.payerName || !manualEntry.reasonCode || !manualEntry.deniedAmount) {
      toast({ title: "Error", description: "Please fill in required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const denialData = {
        payer_name: manualEntry.payerName,
        reason_code: manualEntry.reasonCode,
        reason_description: manualEntry.reasonDescription,
        billed_amount: parseFloat(manualEntry.billedAmount) || parseFloat(manualEntry.deniedAmount),
        denied_amount: parseFloat(manualEntry.deniedAmount),
        cpt_code: manualEntry.cptCode,
        service_date: manualEntry.serviceDate || null,
        denial_date: manualEntry.denialDate,
        status: 'new',
      };

      await awsCrud.insert('denial_queue', { ...denialData, user_id: user.id }, user.id);

      toast({ title: "Success", description: "Denial added successfully" });
      setShowManualEntry(false);
      setManualEntry({
        payerName: "",
        reasonCode: "",
        reasonDescription: "",
        billedAmount: "",
        deniedAmount: "",
        cptCode: "",
        serviceDate: "",
        denialDate: new Date().toISOString().split("T")[0],
      });
      fetchDenials();
    } catch (error) {
      console.error("Error adding denial:", error);
      toast({ title: "Error", description: "Failed to add denial", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (denialId: string, newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await awsCrud.update('denial_queue', { status: newStatus }, { id: denialId }, user.id);
      setDenials(denials.map(d => d.id === denialId ? { ...d, status: newStatus } : d));
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const generateAppeal = async (denial: DenialRecord) => {
    setGeneratingAppeal(denial.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const response = await awsApi.invoke("generate-appeal", {
        body: {
          user_id: user.id,
          denialQueueId: denial.id,
        },
      });

      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || "Failed");

      toast({
        title: "Appeal Generated",
        description: `Appeal ${response.data.appealNumber} created successfully`
      });

      fetchDenials();
    } catch (error) {
      console.error("Error generating appeal:", error);
      toast({ title: "Error", description: "Failed to generate appeal", variant: "destructive" });
    } finally {
      setGeneratingAppeal(null);
    }
  };

  const handleImport835 = async () => {
    if (!importFile) {
      toast({ title: 'Error', description: 'Please select a file', variant: 'destructive' });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const ext = importFile.name.split('.').pop()?.toLowerCase();
      let remittanceData: any = null;

      if (['json', 'txt'].includes(ext || '')) {
        const text = await importFile.text();
        try { remittanceData = JSON.parse(text); }
        catch { throw new Error('Invalid JSON format. Please upload a valid 835 JSON file.'); }

      } else if (['835', 'x12', 'edi'].includes(ext || '')) {
        const text = await importFile.text();
        const parseRes = await awsApi.invoke('parse-835', { body: { raw_content: text } });
        if (parseRes.error) throw parseRes.error;
        remittanceData = parseRes.data;

      } else if (ext === 'pdf') {
        throw new Error('PDF import is processing upgrade. Please export as 835 JSON or X12 EDI file from your clearinghouse.');

      } else if (['csv', 'xlsx'].includes(ext || '')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(importFile);
        });
        const parseRes = await awsApi.invoke('rcm-parse-spreadsheet', {
          body: { file_content: base64, file_name: importFile.name }
        });
        if (parseRes.error) throw parseRes.error;
        remittanceData = parseRes.data;

      } else {
        throw new Error('Unsupported file type. Please upload a JSON, X12 835, PDF, CSV, or XLSX file.');
      }

      // Guard against empty parsed data
      if (!remittanceData || (typeof remittanceData === 'object' && Object.keys(remittanceData).length === 0)) {
        throw new Error('Could not extract remittance data from file');
      }

      const response = await awsApi.invoke('import-denials-from-835', {
        body: { remittanceData, autoClassify: true },
      });
      if (response.error) throw response.error;

      setImportResult({
        imported: response.data.imported || 0,
        skipped: response.data.skipped || 0,
        errors: response.data.errors || [],
      });
      if (response.data.imported > 0) {
        toast({ title: 'Import Successful', description: `Imported ${response.data.imported} denials` });
        fetchDenials();
      } else {
        toast({ title: 'No Denials Found', description: 'No new denials were found in the file' });
      }
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Import Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const getFixInstructions = async (denial: DenialRecord) => {
    setLoadingFix(denial.id);
    try {
      const { data, error } = await awsApi.invoke('scrub-claim', {
        body: {
          era_denial_codes: [denial.reason_code],
          save_results: false,
          claim_data: {
            procedures: [{ cpt_code: denial.cpt_code || '99214', units: 1, modifiers: [] }],
            icd_codes: denial.icd_codes || [],
            payer: denial.payer_name,
            patient_name: denial.patient ? `${denial.patient.first_name} ${denial.patient.last_name}` : '',
            billed_amount: denial.billed_amount,
          }
        }
      });
      if (error) throw error;
      setFixInstructions(prev => ({ ...prev, [denial.id]: data }));
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to get fix instructions', variant: 'destructive' });
    } finally {
      setLoadingFix(null);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "high": return <Badge className="bg-orange-500">High</Badge>;
      case "medium": return <Badge className="bg-yellow-500">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new": return <Badge className="bg-blue-500">New</Badge>;
      case "reviewing": return <Badge className="bg-purple-500">Reviewing</Badge>;
      case "appealing": return <Badge className="bg-orange-500">Appealing</Badge>;
      case "correcting": return <Badge className="bg-yellow-500">Correcting</Badge>;
      case "resolved": return <Badge className="bg-green-500">Resolved</Badge>;
      case "written_off": return <Badge variant="secondary">Written Off</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryLabel = (category: string | null) => {
    const cat = CATEGORY_OPTIONS.find(c => c.value === category);
    return cat?.label || category || "Unclassified";
  };

  const filteredDenials = denials.filter(denial => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      denial.payer_name?.toLowerCase().includes(search) ||
      denial.reason_code?.toLowerCase().includes(search) ||
      denial.cpt_code?.toLowerCase().includes(search) ||
      denial.patient?.first_name?.toLowerCase().includes(search) ||
      denial.patient?.last_name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Denial Management</h1>
              <p className="text-sm text-muted-foreground">Track, classify, and appeal denied claims</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchDenials}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import 835
            </Button>
            <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Denial
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Denial Manually</DialogTitle>
                  <DialogDescription>Enter denial details for classification</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Payer Name *</Label>
                    <Input
                      value={manualEntry.payerName}
                      onChange={(e) => setManualEntry({...manualEntry, payerName: e.target.value})}
                      placeholder="e.g., Blue Cross"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Reason Code *</Label>
                      <Input
                        value={manualEntry.reasonCode}
                        onChange={(e) => setManualEntry({...manualEntry, reasonCode: e.target.value})}
                        placeholder="e.g., CO-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPT Code</Label>
                      <Input
                        value={manualEntry.cptCode}
                        onChange={(e) => setManualEntry({...manualEntry, cptCode: e.target.value})}
                        placeholder="e.g., 99214"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason Description</Label>
                    <Textarea
                      value={manualEntry.reasonDescription}
                      onChange={(e) => setManualEntry({...manualEntry, reasonDescription: e.target.value})}
                      placeholder="e.g., Not medically necessary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Billed Amount</Label>
                      <Input
                        type="number"
                        value={manualEntry.billedAmount}
                        onChange={(e) => setManualEntry({...manualEntry, billedAmount: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Denied Amount *</Label>
                      <Input
                        type="number"
                        value={manualEntry.deniedAmount}
                        onChange={(e) => setManualEntry({...manualEntry, deniedAmount: e.target.value})}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Service Date</Label>
                      <Input
                        type="date"
                        value={manualEntry.serviceDate}
                        onChange={(e) => setManualEntry({...manualEntry, serviceDate: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Denial Date</Label>
                      <Input
                        type="date"
                        value={manualEntry.denialDate}
                        onChange={(e) => setManualEntry({...manualEntry, denialDate: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowManualEntry(false)}>Cancel</Button>
                  <Button onClick={handleManualSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Add & Classify
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Denials</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New</p>
                <p className="text-3xl font-bold text-blue-600">{stats.newCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Appealing</p>
                <p className="text-3xl font-bold text-orange-600">{stats.appealingCount}</p>
              </div>
              <Send className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Denied</p>
                <p className="text-3xl font-bold">${stats.totalDeniedAmount.toFixed(0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={stats.urgentCount > 0 ? "border-destructive bg-destructive/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent (≤7 days)</p>
                <p className="text-3xl font-bold text-destructive">{stats.urgentCount}</p>
              </div>
              <Clock className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="px-6 pb-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by payer, reason code, CPT, or patient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Denials Table */}
      <div className="px-6 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Denial Queue</CardTitle>
            <CardDescription>{filteredDenials.length} denials</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
              </div>
            ) : filteredDenials.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No denials found. Add denials manually or import from 835 remittance files.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>CPT</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDenials.map((denial) => (
                    <>
                      <TableRow 
                        key={denial.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(expandedId === denial.id ? null : denial.id)}
                      >
                        <TableCell>
                          {expandedId === denial.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(denial.denial_date), "MM/dd/yy")}
                        </TableCell>
                        <TableCell>{denial.payer_name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{denial.reason_code}</code>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{getCategoryLabel(denial.classified_category)}</span>
                        </TableCell>
                        <TableCell>{denial.cpt_code || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          ${denial.denied_amount?.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {denial.appeal_deadline ? (
                            <span className={denial.days_until_deadline !== null && denial.days_until_deadline <= 7 ? "text-destructive font-medium" : ""}>
                              {denial.days_until_deadline}d
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{getPriorityBadge(denial.priority)}</TableCell>
                        <TableCell>{getStatusBadge(denial.status)}</TableCell>
                        <TableCell>
                          <div onClick={(e) => e.stopPropagation()}>
                            {denial.status === "new" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => generateAppeal(denial)}
                                disabled={generatingAppeal === denial.id}
                              >
                                {generatingAppeal === denial.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row */}
                      {expandedId === denial.id && (
                        <TableRow key={`${denial.id}-expanded`}>
                          <TableCell colSpan={11} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-6 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-muted-foreground">Patient</p>
                                <p className="text-sm font-medium">
                                  {denial.patient ? `${denial.patient.first_name} ${denial.patient.last_name}` : "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Service Date</p>
                                <p className="text-sm font-medium">
                                  {denial.service_date ? format(new Date(denial.service_date), "MM/dd/yyyy") : "N/A"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Billed Amount</p>
                                <p className="text-sm font-medium">${denial.billed_amount?.toFixed(2) || "0.00"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">AI Confidence</p>
                                <p className="text-sm font-medium">{denial.ai_confidence || 0}%</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Root Cause</p>
                                <p className="text-sm font-medium">{denial.root_cause || "Not analyzed"}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Reason Description</p>
                                <p className="text-sm font-medium">{denial.reason_description || denial.reason_code}</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {denial.status !== "resolved" && denial.status !== "written_off" && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => updateStatus(denial.id, "reviewing")}>
                                    Start Review
                                  </Button>
                                  <Button size="sm" onClick={() => generateAppeal(denial)} disabled={generatingAppeal === denial.id}>
                                    {generatingAppeal === denial.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                                    Generate Appeal
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => updateStatus(denial.id, "correcting")}>
                                    Correct & Resubmit
                                  </Button>
                                  <Button size="sm" variant="secondary" onClick={() => updateStatus(denial.id, "written_off")}>
                                    Write Off
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="outline" onClick={() => getFixInstructions(denial)} disabled={loadingFix === denial.id}>
                                {loadingFix === denial.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                Get Fix Instructions
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => navigate('/claim-scrubber')}>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Send to Scrubber
                              </Button>
                              {denial.status === "appealing" && (
                                <>
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStatus(denial.id, "resolved")}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Appeal Won
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => updateStatus(denial.id, "new")}>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Appeal Denied
                                  </Button>
                                </>
                              )}
                            </div>

                            {fixInstructions[denial.id] && (
                              <div className="mt-4 space-y-3">
                                {fixInstructions[denial.id].era_denial_analysis?.map((era: any, i: number) => (
                                  <div key={i} className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className="bg-amber-600 text-white text-xs">{era.denial_code}</Badge>
                                      <span className="font-medium">{era.description}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1"><span className="font-medium">Root cause:</span> {era.root_cause}</p>
                                    <p className="text-xs text-amber-800"><span className="font-medium">Fix:</span> {era.fix}</p>
                                  </div>
                                ))}
                                {fixInstructions[denial.id].ai_corrections?.map((fix: any, i: number) => (
                                  <div key={i} className="border border-green-200 bg-green-50 rounded-lg p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge className="bg-green-600 text-white text-xs">Step {i + 1}</Badge>
                                      <span className="font-medium">{fix.target_code} — {fix.action}</span>
                                    </div>
                                    {fix.step_by_step && <p className="text-xs text-muted-foreground mb-1">{fix.step_by_step}</p>}
                                    {fix.expected_outcome && <p className="text-xs text-green-700">✓ {fix.expected_outcome}</p>}
                                    {fix.revenue_impact && <p className="text-xs font-medium text-green-800">💰 {fix.revenue_impact}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
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

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Denials</DialogTitle>
            <DialogDescription>
              Upload an 835 remittance, EOB PDF, X12 EDI file, or CSV spreadsheet to automatically import and classify denials.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Remittance / Denial File</Label>
              <Input
                type="file"
                accept=".json,.txt,.835,.x12,.edi,.pdf,.csv,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setImportFile(file);
                  setImportResult(null);
                  if (file) {
                    const ext = file.name.split('.').pop()?.toLowerCase();
                    if (['json','txt'].includes(ext || '')) setDetectedType('835 JSON Remittance');
                    else if (['835','x12','edi'].includes(ext || '')) setDetectedType('X12 EDI 835');
                    else if (ext === 'pdf') setDetectedType('PDF Remittance/EOB');
                    else if (['csv','xlsx'].includes(ext || '')) setDetectedType('Spreadsheet');
                    else setDetectedType('Unknown format');
                  } else {
                    setDetectedType('');
                  }
                }}
                className="mt-2"
              />
              {detectedType && (
                <p className="text-xs text-primary font-medium mt-1">Detected: {detectedType}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Supports JSON, X12 835, PDF EOB, CSV, and XLSX files.
              </p>
            </div>

            {importResult && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Imported:</span>
                  <span className="font-medium text-green-600">{importResult.imported}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Skipped (duplicates):</span>
                  <span className="font-medium text-yellow-600">{importResult.skipped}</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <span className="text-sm text-red-600">Errors:</span>
                    <ul className="text-xs text-red-500 mt-1">
                      {importResult.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportFile(null);
              setImportResult(null);
              setDetectedType('');
            }}>
              Close
            </Button>
            <Button onClick={handleImport835} disabled={!importFile || importing}>
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import {detectedType || 'File'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
