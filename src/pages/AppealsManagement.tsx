import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { 
  ArrowLeft,
  Search,
  RefreshCw,
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Copy,
  Download,
  Printer,
  DollarSign,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface AppealRecord {
  id: string;
  appeal_number: string;
  appeal_date: string;
  appeal_type: string;
  payer_name: string | null;
  subject_line: string | null;
  letter_body: string | null;
  disputed_amount: number | null;
  requested_amount: number | null;
  status: string;
  submission_method: string | null;
  submitted_at: string | null;
  response_deadline: string | null;
  response_date: string | null;
  response_notes: string | null;
  outcome_amount: number | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  supporting_documents: string[] | null;
  denial_queue_id: string | null;
  denial: {
    reason_code: string;
    cpt_code: string | null;
    classified_category: string | null;
  } | null;
  patient: {
    first_name: string;
    last_name: string;
  } | null;
}

interface Stats {
  total: number;
  drafts: number;
  submitted: number;
  won: number;
  denied: number;
  totalRecovered: number;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In Review" },
  { value: "won", label: "Won" },
  { value: "denied", label: "Denied" },
  { value: "partial", label: "Partial" },
];

const SUBMISSION_METHODS = [
  { value: "mail", label: "Mail" },
  { value: "fax", label: "Fax" },
  { value: "portal", label: "Portal" },
  { value: "email", label: "Email" },
  { value: "electronic", label: "Electronic" },
];

export default function AppealsManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [appeals, setAppeals] = useState<AppealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState<Stats>({ total: 0, drafts: 0, submitted: 0, won: 0, denied: 0, totalRecovered: 0 });

  // View/Edit Dialog
  const [selectedAppeal, setSelectedAppeal] = useState<AppealRecord | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedLetter, setEditedLetter] = useState("");

  // Submit Dialog
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submissionMethod, setSubmissionMethod] = useState("portal");
  const [confirmationNumber, setConfirmationNumber] = useState("");

  // Outcome Dialog
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState("won");
  const [outcomeAmount, setOutcomeAmount] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState("");

  useEffect(() => {
    fetchAppeals();
  }, [statusFilter]);

  const fetchAppeals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("appeals")
        .select(`
          *,
          denial:denial_queue(reason_code, cpt_code, classified_category),
          patient:patients(first_name, last_name)
        `)
        .order("appeal_date", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAppeals((data as AppealRecord[]) || []);

      // Calculate stats
      const all = (data as AppealRecord[]) || [];
      setStats({
        total: all.length,
        drafts: all.filter(a => a.status === "draft").length,
        submitted: all.filter(a => ["submitted", "in_review", "acknowledged"].includes(a.status)).length,
        won: all.filter(a => a.status === "won").length,
        denied: all.filter(a => a.status === "denied").length,
        totalRecovered: all.filter(a => a.status === "won").reduce((sum, a) => sum + (a.outcome_amount || 0), 0),
      });
    } catch (error) {
      console.error("Error fetching appeals:", error);
      toast({ title: "Error", description: "Failed to load appeals", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openViewDialog = (appeal: AppealRecord) => {
    setSelectedAppeal(appeal);
    setEditedLetter(appeal.letter_body || "");
    setEditMode(false);
    setShowViewDialog(true);
  };

  const saveEdits = async () => {
    if (!selectedAppeal) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.update("appeals", { letter_body: editedLetter }, { id: selectedAppeal.id }, user.id);

      setAppeals(appeals.map(a => 
        a.id === selectedAppeal.id ? { ...a, letter_body: editedLetter } : a
      ));
      setSelectedAppeal({ ...selectedAppeal, letter_body: editedLetter });
      setEditMode(false);
      toast({ title: "Saved", description: "Appeal letter updated" });
    } catch (error) {
      console.error("Error saving appeal:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    }
  };

  const openSubmitDialog = (appeal: AppealRecord) => {
    setSelectedAppeal(appeal);
    setSubmissionMethod("portal");
    setConfirmationNumber("");
    setShowSubmitDialog(true);
  };

  const submitAppeal = async () => {
    if (!selectedAppeal) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.update("appeals", {
        status: "submitted",
        submission_method: submissionMethod,
        submitted_at: new Date().toISOString(),
        confirmation_number: confirmationNumber || null,
      }, { id: selectedAppeal.id }, user.id);

      // Also update denial status
      if (selectedAppeal.denial_queue_id) {
        await awsCrud.update("denial_queue", { status: "appealing" }, { id: selectedAppeal.denial_queue_id }, user.id);
      }

      toast({ title: "Appeal Submitted", description: `Confirmation: ${confirmationNumber || "N/A"}` });
      setShowSubmitDialog(false);
      fetchAppeals();
    } catch (error) {
      console.error("Error submitting appeal:", error);
      toast({ title: "Error", description: "Failed to mark as submitted", variant: "destructive" });
    }
  };

  const openOutcomeDialog = (appeal: AppealRecord) => {
    setSelectedAppeal(appeal);
    setOutcomeStatus("won");
    setOutcomeAmount(appeal.disputed_amount?.toString() || "");
    setOutcomeNotes("");
    setShowOutcomeDialog(true);
  };

  const recordOutcome = async () => {
    if (!selectedAppeal) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.update("appeals", {
        status: outcomeStatus,
        response_date: new Date().toISOString().split("T")[0],
        outcome_amount: outcomeStatus === "won" || outcomeStatus === "partial" ? parseFloat(outcomeAmount) : 0,
        response_notes: outcomeNotes,
      }, { id: selectedAppeal.id }, user.id);

      // Update denial status
      if (selectedAppeal.denial_queue_id) {
        const denialStatus = outcomeStatus === "won" ? "resolved" : outcomeStatus === "denied" ? "new" : "reviewing";
        await awsCrud.update("denial_queue", { 
          status: denialStatus,
          resolution_type: outcomeStatus === "won" ? "appeal_won" : outcomeStatus === "denied" ? "appeal_denied" : null,
          resolution_amount: outcomeStatus === "won" ? parseFloat(outcomeAmount) : null,
          resolution_date: new Date().toISOString().split("T")[0],
        }, { id: selectedAppeal.denial_queue_id }, user.id);
      }

      toast({ title: "Outcome Recorded", description: `Appeal marked as ${outcomeStatus}` });
      setShowOutcomeDialog(false);
      fetchAppeals();
    } catch (error) {
      console.error("Error recording outcome:", error);
      toast({ title: "Error", description: "Failed to record outcome", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Appeal letter copied to clipboard" });
  };

  const exportToPDF = (appeal: AppealRecord) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    
    // Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Appeal Number: ${appeal.appeal_number}`, margin, 20);
    doc.text(`Date: ${format(new Date(appeal.appeal_date), "MMMM d, yyyy")}`, margin, 28);
    
    // Payer info
    if (appeal.payer_name) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`To: ${appeal.payer_name}`, margin, 38);
    }
    
    // Subject line
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const subjectLines = doc.splitTextToSize(appeal.subject_line || "Appeal Letter", maxWidth);
    doc.text(subjectLines, margin, 50);
    
    // Letter body
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const bodyText = appeal.letter_body || "";
    const lines = doc.splitTextToSize(bodyText, maxWidth);
    
    let yPosition = 65;
    const lineHeight = 5;
    const pageHeight = doc.internal.pageSize.getHeight();
    
    for (let i = 0; i < lines.length; i++) {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(lines[i], margin, yPosition);
      yPosition += lineHeight;
    }
    
    // Footer with appeal number on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(
        `${appeal.appeal_number} - Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }
    
    // Save the PDF
    const fileName = `Appeal_${appeal.appeal_number}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(fileName);
    
    toast({
      title: "PDF Downloaded",
      description: `Saved as ${fileName}`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "pending_review": return <Badge variant="outline" className="border-yellow-500 text-yellow-700">Pending Review</Badge>;
      case "approved": return <Badge variant="outline" className="border-blue-500 text-blue-700">Approved</Badge>;
      case "submitted": return <Badge className="bg-blue-600">Submitted</Badge>;
      case "in_review": return <Badge variant="outline" className="border-purple-500 text-purple-700">In Review</Badge>;
      case "won": return <Badge className="bg-green-600">Won</Badge>;
      case "denied": return <Badge variant="destructive">Denied</Badge>;
      case "partial": return <Badge className="bg-yellow-600">Partial</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredAppeals = appeals.filter(appeal => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      appeal.appeal_number?.toLowerCase().includes(search) ||
      appeal.payer_name?.toLowerCase().includes(search) ||
      appeal.patient?.first_name?.toLowerCase().includes(search) ||
      appeal.patient?.last_name?.toLowerCase().includes(search) ||
      appeal.denial?.reason_code?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/denial-management")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Appeals Management</h1>
            <p className="text-sm text-muted-foreground">Track and manage appeal letters</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAppeals}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate("/denial-management")}>
            View Denials
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Appeals</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="text-2xl font-bold text-gray-600">{stats.drafts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Submitted</p>
            <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Won</p>
            <p className="text-2xl font-bold text-green-600">{stats.won}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Denied</p>
            <p className="text-2xl font-bold text-red-600">{stats.denied}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Recovered</p>
            <p className="text-2xl font-bold text-green-600">${stats.totalRecovered.toFixed(0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search appeals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Appeals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Appeals</CardTitle>
          <CardDescription>{filteredAppeals.length} appeals</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">Loading...</p>
          ) : filteredAppeals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No appeals found. Generate appeals from the Denial Management page.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Appeal #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Reason Code</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppeals.map((appeal) => (
                  <TableRow key={appeal.id}>
                    <TableCell className="font-mono text-sm">{appeal.appeal_number}</TableCell>
                    <TableCell>{format(new Date(appeal.appeal_date), "MM/dd/yy")}</TableCell>
                    <TableCell>
                      {appeal.patient ? `${appeal.patient.first_name} ${appeal.patient.last_name}` : "N/A"}
                    </TableCell>
                    <TableCell>{appeal.payer_name || "N/A"}</TableCell>
                    <TableCell className="font-mono">{appeal.denial?.reason_code || "N/A"}</TableCell>
                    <TableCell className="font-semibold">
                      ${appeal.disputed_amount?.toFixed(2) || "0.00"}
                    </TableCell>
                    <TableCell>
                      {appeal.response_deadline ? format(new Date(appeal.response_deadline), "MM/dd/yy") : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(appeal.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openViewDialog(appeal)} title="View Appeal">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => exportToPDF(appeal)} title="Download PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                        {appeal.status === "draft" && (
                          <Button variant="ghost" size="icon" onClick={() => openSubmitDialog(appeal)} title="Submit Appeal">
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {(appeal.status === "submitted" || appeal.status === "in_review") && (
                          <Button variant="ghost" size="icon" onClick={() => openOutcomeDialog(appeal)} title="Record Outcome">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View/Edit Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appeal: {selectedAppeal?.appeal_number}</DialogTitle>
            <DialogDescription>
              {selectedAppeal?.payer_name} - {selectedAppeal?.denial?.reason_code}
            </DialogDescription>
          </DialogHeader>
          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusBadge(selectedAppeal?.status || "draft")}
                {selectedAppeal?.ai_generated && (
                  <Badge variant="outline">AI Generated ({selectedAppeal.ai_confidence}%)</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(selectedAppeal?.letter_body || "")}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => selectedAppeal && exportToPDF(selectedAppeal)}>
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditMode(!editMode)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {editMode ? "Cancel" : "Edit"}
                </Button>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm text-muted-foreground">Subject Line</Label>
              <p className="mt-1 font-medium">{selectedAppeal?.subject_line}</p>
            </div>

            <Separator />

            <div>
              <Label className="text-sm text-muted-foreground">Letter Body</Label>
              {editMode ? (
                <Textarea
                  value={editedLetter}
                  onChange={(e) => setEditedLetter(e.target.value)}
                  className="min-h-[300px] mt-2 font-mono text-sm"
                />
              ) : (
                <div className="mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap font-mono text-sm">
                  {selectedAppeal?.letter_body}
                </div>
              )}
            </div>

            {selectedAppeal?.supporting_documents && selectedAppeal.supporting_documents.length > 0 && (
              <div>
                <Label className="text-sm text-muted-foreground">Required Documents</Label>
                <ul className="mt-2 list-disc list-inside text-sm">
                  {selectedAppeal.supporting_documents.map((doc, i) => (
                    <li key={i}>{doc}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            {editMode && (
              <Button onClick={saveEdits}>Save Changes</Button>
            )}
            {selectedAppeal?.status === "draft" && !editMode && (
              <Button onClick={() => { setShowViewDialog(false); openSubmitDialog(selectedAppeal); }}>
                <Send className="h-4 w-4 mr-2" />
                Mark as Submitted
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Appeal as Submitted</DialogTitle>
            <DialogDescription>Record submission details for tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Submission Method</Label>
              <Select value={submissionMethod} onValueChange={setSubmissionMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBMISSION_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Confirmation Number (optional)</Label>
              <Input
                value={confirmationNumber}
                onChange={(e) => setConfirmationNumber(e.target.value)}
                placeholder="e.g., REF-123456"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
            <Button onClick={submitAppeal}>
              <Send className="h-4 w-4 mr-2" />
              Mark Submitted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome Dialog */}
      <Dialog open={showOutcomeDialog} onOpenChange={setShowOutcomeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Appeal Outcome</DialogTitle>
            <DialogDescription>Enter the payer's response to this appeal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Outcome</Label>
              <Select value={outcomeStatus} onValueChange={setOutcomeStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="won">Won - Full Payment</SelectItem>
                  <SelectItem value="partial">Partial Payment</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(outcomeStatus === "won" || outcomeStatus === "partial") && (
              <div>
                <Label>Amount Recovered ($)</Label>
                <Input
                  type="number"
                  value={outcomeAmount}
                  onChange={(e) => setOutcomeAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea
                value={outcomeNotes}
                onChange={(e) => setOutcomeNotes(e.target.value)}
                placeholder="Any additional notes about the response..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutcomeDialog(false)}>Cancel</Button>
            <Button onClick={recordOutcome} className={outcomeStatus === "won" ? "bg-green-600" : ""}>
              {outcomeStatus === "won" ? <CheckCircle className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Record Outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
