import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { awsApi } from "@/integrations/aws/awsApi";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";

import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Send,
  Sparkles,
  Shield,
  Scale,
  TrendingUp,
  Eye,
  Copy,
  Download,
  ChevronDown,
  ChevronRight,
  ArrowUpCircle,
  Wrench,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

interface DenialReviewModalProps {
  denialId: string | null;
  denial: {
    id: string;
    patient_name?: string | null;
    payer_name?: string;
    claim?: { claim_id: string } | null;
    patient?: { first_name: string; last_name: string } | null;
  } | null;
  open: boolean;
  onClose: () => void;
  onGenerateAppeal: (denial: any) => void;
  /** If set, open directly to this view */
  initialView?: "analysis" | "letter" | "fix" | null;
  /** Pre-loaded appeal letter data (from parent cache) */
  cachedLetter?: { subjectLine: string; letterBody: string; appealNumber?: string; payerName?: string; appealDate?: string } | null;
  /** Callback when content is generated */
  onContentGenerated?: (denialId: string, type: "analysis" | "letter" | "fix", data?: any) => void;
}

interface AnalysisData {
  claim_summary?: { overview?: string; billed_amount?: number; paid_amount?: number; denied_amount?: number; total_billed?: number; total_paid?: number; total_denied?: number; net_recovery_opportunity?: number };
  code_analysis?: Array<{ code?: string; description?: string; plain_english?: string; is_legitimate?: boolean; challengeable?: boolean; win_probability?: number; action_required?: string }>;
  ncci_analysis?: { applies?: boolean; bundling_explanation?: string; modifier_exception_available?: boolean; applicable_modifiers?: string[]; modifier_guidance?: string };
  modifier_opportunities?: Array<{ modifier_code?: string; description?: string; application_guidance?: string; expected_impact?: string }>;
  timely_filing?: { appeal_deadline?: string; days_remaining?: number; warning?: string };
  win_probability?: { overall?: number; factors_for?: string[]; factors_against?: string[] };
  full_analysis_text?: string;
  recommended_action?: string;
  recommended_reasoning?: string;
  alternative_actions?: Array<{ action?: string; description?: string; pros?: string[]; cons?: string[]; success_likelihood?: number }>;
}

interface FixStep {
  step_number?: number; title: string; description?: string; action_type?: string; who?: string; urgent?: boolean; details?: string; if_blocked?: string;
}
interface FixPhase {
  phase_number?: number; title: string; description?: string; steps: FixStep[];
}
interface FixData {
  summary?: string; difficulty?: string; estimated_time?: string; estimated_recovery?: number | string;
  phases?: FixPhase[]; common_mistakes?: string[]; success_indicators?: string[]; escalation_path?: string;
}

interface LetterData {
  subjectLine: string; letterBody: string; appealNumber?: string; payerName?: string; appealDate?: string;
}

type ActivePanel = "analysis" | "letter" | "fix";

/** Format snake_case/underscore values for display: replace _ with space, title-case, and handle "&" for "and" */
const formatLabel = (value: string): string =>
  value
    .replace(/_/g, " ")
    .replace(/\band\b/gi, "&")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const ACTION_TYPE_COLORS: Record<string, string> = {
  verify: "bg-blue-100 text-blue-800 border-blue-200",
  call: "bg-orange-100 text-orange-800 border-orange-200",
  correct_claim: "bg-purple-100 text-purple-800 border-purple-200",
  add_modifier: "bg-teal-100 text-teal-800 border-teal-200",
  resubmit: "bg-green-100 text-green-800 border-green-200",
  appeal: "bg-red-100 text-red-800 border-red-200",
};
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  hard: "bg-red-100 text-red-800 border-red-200",
};

// ── Component ──────────────────────────────────────────

export default function DenialReviewModal({
  denialId,
  denial,
  open,
  onClose,
  onGenerateAppeal,
  initialView,
  cachedLetter,
  onContentGenerated,
}: DenialReviewModalProps) {
  // Analysis
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Appeal letter
  const [loadingLetter, setLoadingLetter] = useState(false);
  const [letter, setLetter] = useState<LetterData | null>(null);

  // Fix instructions
  const [loadingFix, setLoadingFix] = useState(false);
  const [fixData, setFixData] = useState<FixData | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set());

  // Active inline panel
  const [activePanel, setActivePanel] = useState<ActivePanel>("analysis");

  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);

  // ── On open: run analysis + check cached data ──
  useEffect(() => {
    if (!open || !denialId) return;
    if (denialId === lastOpenedId) {
      // Same denial, just switch view if needed
      if (initialView) setActivePanel(initialView);
      return;
    }
    setLastOpenedId(denialId);
    // Reset state
    setAnalysis(null);
    setAnalysisError(null);
    setLetter(cachedLetter || null);
    setFixData(null);
    setCheckedSteps(new Set());
    setOpenPhases(new Set());
    setActivePanel(initialView || "analysis");

    // Run analysis
    runAnalysis(denialId);
    // Check cached fix instructions
    checkCachedFix(denialId);
    // Check cached letter
    if (!cachedLetter) checkCachedLetter(denialId);
  }, [open, denialId]);

  const runAnalysis = async (id: string) => {
    setLoadingAnalysis(true);
    setAnalysisError(null);
    try {
      const res = await awsApi.invoke("rcm-denial-analysis", { body: { denialId: id } });
      if (res.error) throw res.error;
      const d = res.data?.analysis || res.data;
      if (!d) throw new Error("No analysis data returned");
      setAnalysis(d);
      if (denialId) onContentGenerated?.(denialId, "analysis");
    } catch (err: any) {
      setAnalysisError(err.message || "Analysis failed");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const checkCachedFix = async (id: string) => {
    try {
      const res = await awsApi.invoke("fix-instructions", { body: { denialId: id, checkOnly: true } });
      if (!res.error && res.data) {
        const d = res.data?.instructions || res.data;
        if (d?.phases) setFixData(d);
      }
    } catch { /* no cached data */ }
  };

  const checkCachedLetter = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Check appeals table for existing letter
      const { data } = await supabase
        .from("appeals")
        .select("subject_line, letter_body, appeal_number, payer_name, appeal_date")
        .eq("denial_queue_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.letter_body) {
        setLetter({
          subjectLine: data.subject_line || "",
          letterBody: data.letter_body,
          appealNumber: data.appeal_number || undefined,
          payerName: data.payer_name || undefined,
          appealDate: data.appeal_date || undefined,
        });
      }
    } catch { /* no cached letter */ }
  };

  // ── Generate Fix Instructions ──
  const generateFix = async () => {
    if (!denialId) return;
    setLoadingFix(true);
    try {
      const res = await awsApi.invoke("fix-instructions", { body: { denialId } });
      if (res.error) throw res.error;
      const d = res.data?.instructions || res.data;
      if (!d) throw new Error("No instructions returned");
      setFixData(d);
      if (denialId) onContentGenerated?.(denialId, "fix");
      setOpenPhases(new Set([0]));
      setActivePanel("fix");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate fix instructions");
    } finally {
      setLoadingFix(false);
    }
  };

  // ── Generate Appeal Letter ──
  const generateLetter = async () => {
    if (!denial) return;
    setLoadingLetter(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let practiceInfo: Record<string, unknown> | undefined;
      let providerInfo: Record<string, unknown> | undefined;
      try {
        const profileRes = await awsApi.invoke("practice-profile", { body: { action: "get" } });
        if (profileRes.data && !profileRes.error) {
          const p = profileRes.data.profile || profileRes.data;
          practiceInfo = {
            name: p.practice_name,
            address: `${p.practice_address || ""}, ${p.practice_city || ""}, ${p.practice_state || ""} ${p.practice_zip || ""}`.replace(/^,\s*/, "").trim(),
            phone: p.practice_phone, fax: p.practice_fax, tin: p.practice_tin,
            billingContact: { name: p.billing_contact_name, phone: p.billing_contact_phone, email: p.billing_contact_email },
          };
          providerInfo = {
            name: p.provider_name, npi: p.provider_npi, specialty: p.provider_specialty,
            credentials: p.provider_credentials, placeOfService: p.place_of_service,
          };
        }
      } catch { /* proceed without */ }

      const response = await awsApi.invoke("generate-appeal", {
        body: {
          user_id: user.id,
          denialQueueId: denial.id,
          ...(practiceInfo ? { practiceInfo } : {}),
          ...(providerInfo ? { providerInfo } : {}),
        },
      });
      if (response.error) throw response.error;
      if (!response.data?.success) throw new Error(response.data?.error || "Failed");

      const newLetter: LetterData = {
        subjectLine: response.data.subjectLine || response.data.subject_line || `Appeal for Claim`,
        letterBody: response.data.letterBody || response.data.letter_body || "",
        appealNumber: response.data.appealNumber || response.data.appeal_number,
        payerName: denial.payer_name,
        appealDate: response.data.appealDate || response.data.appeal_date || new Date().toISOString(),
      };
      setLetter(newLetter);
      if (denialId) onContentGenerated?.(denialId, "letter", newLetter);
      setActivePanel("letter");
      toast.success(`Appeal ${newLetter.appealNumber || ""} generated`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate appeal");
    } finally {
      setLoadingLetter(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setTimeout(() => {
        setAnalysis(null); setAnalysisError(null); setLetter(null); setFixData(null);
        setLastOpenedId(null); setActivePanel("analysis");
      }, 300);
    }
  };

  // ── Letter helpers ──
  const copyLetter = useCallback(() => {
    if (!letter) return;
    navigator.clipboard.writeText(`${letter.subjectLine}\n\n${letter.letterBody}`);
    toast.success("Copied to clipboard");
  }, [letter]);

  const downloadPDF = useCallback(() => {
    if (!letter) return;
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const m = 20;
    const mw = pw - m * 2;
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    if (letter.appealNumber) doc.text(`Appeal Number: ${letter.appealNumber}`, m, 20);
    if (letter.appealDate) doc.text(`Date: ${format(new Date(letter.appealDate), "MMMM d, yyyy")}`, m, 28);
    if (letter.payerName) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`To: ${letter.payerName}`, m, 38); }
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(doc.splitTextToSize(letter.subjectLine, mw), m, 50);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(letter.letterBody, mw);
    let y = 65;
    for (const line of lines) { if (y > ph - 30) { doc.addPage(); y = 20; } doc.text(line, m, y); y += 5; }
    const tp = doc.getNumberOfPages();
    for (let i = 1; i <= tp; i++) { doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.text(`${letter.appealNumber || "Appeal"} - Page ${i} of ${tp}`, pw / 2, ph - 10, { align: "center" }); }
    doc.save(`Appeal_${letter.appealNumber || "Letter"}_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("PDF downloaded");
  }, [letter]);

  // ── Fix step helpers ──
  const toggleStep = (key: string) => setCheckedSteps(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const togglePhase = (idx: number) => setOpenPhases(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  const totalSteps = fixData?.phases?.reduce((s, p) => s + (p.steps?.length || 0), 0) || 0;
  const markAllComplete = () => { const all = new Set<string>(); fixData?.phases?.forEach((p, pi) => p.steps?.forEach((_, si) => all.add(`${pi}-${si}`))); setCheckedSteps(all); };

  // Derived
  const patientName = denial?.patient_name || (denial?.patient ? `${denial.patient.first_name} ${denial.patient.last_name}` : "Unknown");
  const claimNumber = denial?.claim?.claim_id || "N/A";
  const winProb = analysis?.win_probability?.overall ?? 0;
  const winColor = winProb > 60 ? "text-green-600" : winProb >= 40 ? "text-yellow-600" : "text-red-600";
  const winBg = winProb > 60 ? "bg-green-100" : winProb >= 40 ? "bg-yellow-100" : "bg-red-100";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden">
        {/* ── Global Loading (initial analysis) ── */}
        {loadingAnalysis && !analysis && (
          <div className="flex flex-col items-center justify-center py-32 px-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Running Expert Analysis</h2>
            <p className="text-muted-foreground text-center">Analyzing denial codes, NCCI edits, modifier opportunities, and win probability…</p>
          </div>
        )}

        {/* ── Error ── */}
        {analysisError && !loadingAnalysis && !analysis && (
          <div className="flex flex-col items-center justify-center py-32 px-8">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Analysis Failed</h2>
            <p className="text-muted-foreground mb-6">{analysisError}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => denialId && runAnalysis(denialId)}>Retry</Button>
            </div>
          </div>
        )}

        {/* ── Main Content (once analysis loaded or we have cached data) ── */}
        {(analysis || (activePanel !== "analysis")) && !loadingAnalysis && (
          <>
            {/* ── Sticky Header ── */}
            <div className="border-b bg-card px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Denial Review</h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{patientName}</span><span>·</span><span>{denial?.payer_name}</span><span>·</span><span>Claim {claimNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {analysis && (
                    <div className={`${winBg} rounded-lg px-4 py-2 text-center`}>
                      <p className="text-xs text-muted-foreground">Win Probability</p>
                      <p className={`text-2xl font-bold ${winColor}`}>{winProb}%</p>
                    </div>
                  )}
                  {analysis?.recommended_action && (
                    <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1.5">{formatLabel(analysis.recommended_action)}</Badge>
                  )}
                </div>
              </div>

              {/* ── Panel Nav Tabs ── */}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant={activePanel === "analysis" ? "default" : "outline"}
                  onClick={() => setActivePanel("analysis")}
                  className="gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Analysis
                  {analysis && <Badge variant="secondary" className="ml-1 text-[10px] bg-green-100 text-green-800 border-0">✓</Badge>}
                </Button>
                <Button
                  size="sm"
                  variant={activePanel === "letter" ? "default" : "outline"}
                  onClick={() => letter ? setActivePanel("letter") : generateLetter()}
                  disabled={loadingLetter}
                  className="gap-1.5"
                >
                  {loadingLetter ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : letter ? <Eye className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  {letter ? "View Letter" : "Generate Appeal"}
                  {letter && <Badge variant="secondary" className="ml-1 text-[10px] bg-green-100 text-green-800 border-0">Generated</Badge>}
                </Button>
                <Button
                  size="sm"
                  variant={activePanel === "fix" ? "default" : "outline"}
                  onClick={() => fixData ? setActivePanel("fix") : generateFix()}
                  disabled={loadingFix}
                  className="gap-1.5"
                >
                  {loadingFix ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : fixData ? <Eye className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                  {fixData ? "View Instructions" : "Get Fix Instructions"}
                  {fixData && <Badge variant="secondary" className="ml-1 text-[10px] bg-green-100 text-green-800 border-0">Generated</Badge>}
                </Button>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <ScrollArea className="max-h-[calc(95vh-13rem)]">
              {/* ═══ ANALYSIS PANEL ═══ */}
              {activePanel === "analysis" && analysis && (
                <div className="p-6 space-y-6">
                  <AnalysisContent analysis={analysis} winProb={winProb} winColor={winColor} />
                </div>
              )}
              {activePanel === "analysis" && !analysis && !loadingAnalysis && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-3 opacity-40" />
                  <p>Analysis not available yet</p>
                </div>
              )}

              {/* ═══ LETTER PANEL ═══ */}
              {activePanel === "letter" && letter && (
                <div className="p-6">
                  <div className="flex items-center justify-end gap-2 mb-4">
                    <Button variant="outline" size="sm" onClick={copyLetter}><Copy className="h-4 w-4 mr-2" />Copy</Button>
                    <Button variant="outline" size="sm" onClick={downloadPDF}><Download className="h-4 w-4 mr-2" />PDF</Button>
                  </div>
                  <div className="bg-white text-black rounded-lg border p-8">
                    <h3 className="text-base font-bold mb-6 leading-snug">{letter.subjectLine}</h3>
                    <pre className="whitespace-pre-wrap font-[Georgia,_'Times_New_Roman',_serif] text-sm leading-relaxed m-0 p-0">{letter.letterBody}</pre>
                  </div>
                </div>
              )}
              {activePanel === "letter" && !letter && !loadingLetter && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-3 opacity-40" />
                  <p>No appeal letter generated yet</p>
                  <Button className="mt-4" onClick={generateLetter}>Generate Appeal Letter</Button>
                </div>
              )}
              {activePanel === "letter" && loadingLetter && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Generating appeal letter...</p>
                </div>
              )}

              {/* ═══ FIX INSTRUCTIONS PANEL ═══ */}
              {activePanel === "fix" && fixData && (
                <div className="p-6 space-y-4">
                  <FixInstructionsContent
                    data={fixData}
                    checkedSteps={checkedSteps}
                    openPhases={openPhases}
                    toggleStep={toggleStep}
                    togglePhase={togglePhase}
                    totalSteps={totalSteps}
                  />
                </div>
              )}
              {activePanel === "fix" && !fixData && !loadingFix && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Wrench className="h-8 w-8 mb-3 opacity-40" />
                  <p>No fix instructions generated yet</p>
                  <Button className="mt-4" onClick={generateFix}>Generate Fix Instructions</Button>
                </div>
              )}
              {activePanel === "fix" && loadingFix && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Generating fix instructions...</p>
                </div>
              )}
            </ScrollArea>

            {/* ── Footer ── */}
            <div className="border-t bg-card px-6 py-3 flex justify-between">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <div className="flex gap-2">
                {activePanel === "fix" && fixData && (
                  <Button variant="outline" onClick={markAllComplete}>
                    <CheckCircle className="h-4 w-4 mr-2" />Mark All Complete
                  </Button>
                )}
                {!letter && (
                  <Button onClick={generateLetter} disabled={loadingLetter}>
                    {loadingLetter ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Generate Appeal
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Analysis Content Sub-component ──

function AnalysisContent({ analysis, winProb, winColor }: { analysis: AnalysisData; winProb: number; winColor: string }) {
  return (
    <>
      {analysis.claim_summary && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Claim Summary
          </h3>
          {analysis.claim_summary.overview && <p className="text-sm text-foreground mb-3">{analysis.claim_summary.overview}</p>}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Billed", value: analysis.claim_summary.total_billed ?? analysis.claim_summary.billed_amount },
              { label: "Paid", value: analysis.claim_summary.total_paid ?? analysis.claim_summary.paid_amount },
              { label: "Denied", value: analysis.claim_summary.total_denied ?? analysis.claim_summary.denied_amount },
              { label: "Recovery Opportunity", value: analysis.claim_summary.net_recovery_opportunity },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="py-3 px-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-bold">${(item.value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {analysis.code_analysis && analysis.code_analysis.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" /> Denial Code Analysis
          </h3>
          <div className="space-y-3">
            {analysis.code_analysis.map((code, i) => (
              <Card key={i}>
                <CardContent className="py-4 px-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">{code.code}</code>
                      <span className="text-sm ml-2">{code.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {code.is_legitimate !== undefined && (
                        <div className="flex items-center gap-1 text-xs">
                          {code.is_legitimate ? <><CheckCircle className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Legitimate</span></> : <><XCircle className="h-3.5 w-3.5 text-red-600" /><span className="text-red-700">Questionable</span></>}
                        </div>
                      )}
                      {code.challengeable !== undefined && (
                        <Badge variant={code.challengeable ? "default" : "secondary"} className="text-xs">{code.challengeable ? "Challengeable" : "Not Challengeable"}</Badge>
                      )}
                    </div>
                  </div>
                  {code.plain_english && <p className="text-sm text-muted-foreground">{code.plain_english}</p>}
                  {code.win_probability !== undefined && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-24">Win Prob:</span>
                      <Progress value={code.win_probability} className="h-2 flex-1" />
                      <span className="text-xs font-medium w-10 text-right">{code.win_probability}%</span>
                    </div>
                  )}
                  {code.action_required && <p className="text-xs font-medium text-primary">→ {code.action_required}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {analysis.ncci_analysis?.applies && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" /> NCCI Analysis
            </h3>
            <Card>
              <CardContent className="py-4 px-4 space-y-3">
                {analysis.ncci_analysis.bundling_explanation && <p className="text-sm">{analysis.ncci_analysis.bundling_explanation}</p>}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="text-muted-foreground">Modifier Exception:</span>
                    {analysis.ncci_analysis.modifier_exception_available ? <Badge className="bg-green-600 text-xs">Available</Badge> : <Badge variant="secondary" className="text-xs">Not Available</Badge>}
                  </div>
                </div>
                {analysis.ncci_analysis.applicable_modifiers && analysis.ncci_analysis.applicable_modifiers.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Modifiers:</span>
                    {analysis.ncci_analysis.applicable_modifiers.map((m) => <Badge key={m} variant="outline" className="text-xs">{m}</Badge>)}
                  </div>
                )}
                {analysis.ncci_analysis.modifier_guidance && <p className="text-sm text-muted-foreground">{analysis.ncci_analysis.modifier_guidance}</p>}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {analysis.modifier_opportunities && analysis.modifier_opportunities.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Scale className="h-4 w-4" /> Modifier Opportunities
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {analysis.modifier_opportunities.map((mod, i) => (
                <Card key={i}>
                  <CardContent className="py-3 px-4 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{mod.modifier_code}</Badge>
                      <span className="text-sm font-medium">{mod.description}</span>
                    </div>
                    {mod.application_guidance && <p className="text-xs text-muted-foreground">{mod.application_guidance}</p>}
                    {mod.expected_impact && <p className="text-xs font-medium text-green-700">Impact: {mod.expected_impact}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      <Separator />

      {analysis.timely_filing && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Timely Filing
          </h3>
          <Card>
            <CardContent className="py-4 px-4 flex items-center gap-6">
              {analysis.timely_filing.appeal_deadline && (
                <div><p className="text-xs text-muted-foreground">Appeal Deadline</p><p className="text-sm font-semibold">{analysis.timely_filing.appeal_deadline}</p></div>
              )}
              {analysis.timely_filing.days_remaining !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground">Days Remaining</p>
                  <Badge className={analysis.timely_filing.days_remaining > 30 ? "bg-green-600" : analysis.timely_filing.days_remaining >= 10 ? "bg-yellow-500" : "bg-red-600"}>{analysis.timely_filing.days_remaining} days</Badge>
                </div>
              )}
              {analysis.timely_filing.warning && (
                <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{analysis.timely_filing.warning}</div>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <Separator />

      {analysis.win_probability && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Win Probability Breakdown
          </h3>
          <Card>
            <CardContent className="py-4 px-4 space-y-4">
              <div className="flex items-center gap-4">
                <Progress value={winProb} className="h-3 flex-1" />
                <span className={`text-lg font-bold ${winColor}`}>{winProb}%</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {analysis.win_probability.factors_for && analysis.win_probability.factors_for.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-2">Factors For</p>
                    <ul className="space-y-1">{analysis.win_probability.factors_for.map((f, i) => <li key={i} className="flex items-start gap-1.5 text-sm"><CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" /><span>{f}</span></li>)}</ul>
                  </div>
                )}
                {analysis.win_probability.factors_against && analysis.win_probability.factors_against.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-700 mb-2">Factors Against</p>
                    <ul className="space-y-1">{analysis.win_probability.factors_against.map((f, i) => <li key={i} className="flex items-start gap-1.5 text-sm"><XCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" /><span>{f}</span></li>)}</ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {analysis.full_analysis_text && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Full Expert Analysis
            </h3>
            <div className="bg-muted/50 border rounded-lg p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.full_analysis_text}</p>
            </div>
          </section>
        </>
      )}

      {analysis.recommended_action && (
        <>
          <Separator />
          <section>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-5 px-5">
                <div className="flex items-start gap-3">
                  <div className="bg-primary rounded-lg p-2 shrink-0"><Sparkles className="h-5 w-5 text-primary-foreground" /></div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">Recommended: {formatLabel(analysis.recommended_action)}</h4>
                    {analysis.recommended_reasoning && <p className="text-sm text-muted-foreground">{analysis.recommended_reasoning}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {analysis.alternative_actions && analysis.alternative_actions.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Alternative Actions</h3>
            <div className="space-y-3">
              {analysis.alternative_actions.map((alt, i) => (
                <Card key={i}>
                  <CardContent className="py-4 px-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{alt.action ? formatLabel(alt.action) : ""}</h4>
                      {alt.success_likelihood !== undefined && <Badge variant="outline" className="text-xs">{alt.success_likelihood}% likelihood</Badge>}
                    </div>
                    {alt.description && <p className="text-sm text-muted-foreground">{alt.description}</p>}
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      {alt.pros && alt.pros.length > 0 && (
                        <div><p className="font-medium text-green-700 mb-1">Pros</p><ul className="space-y-0.5">{alt.pros.map((p, j) => <li key={j} className="flex items-start gap-1"><CheckCircle className="h-3 w-3 text-green-600 mt-0.5 shrink-0" /><span>{p}</span></li>)}</ul></div>
                      )}
                      {alt.cons && alt.cons.length > 0 && (
                        <div><p className="font-medium text-red-700 mb-1">Cons</p><ul className="space-y-0.5">{alt.cons.map((c, j) => <li key={j} className="flex items-start gap-1"><XCircle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" /><span>{c}</span></li>)}</ul></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

// ── Fix Instructions Content Sub-component ──

function FixInstructionsContent({
  data, checkedSteps, openPhases, toggleStep, togglePhase, totalSteps,
}: {
  data: FixData; checkedSteps: Set<string>; openPhases: Set<number>;
  toggleStep: (k: string) => void; togglePhase: (i: number) => void; totalSteps: number;
}) {
  const difficultyLabel = data.difficulty?.toLowerCase() || "medium";
  return (
    <>
      {/* Header info */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-1">
          {data.summary && <p className="text-sm text-muted-foreground max-w-lg">{data.summary}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`border ${DIFFICULTY_COLORS[difficultyLabel] || DIFFICULTY_COLORS.medium}`}>{data.difficulty || "Medium"}</Badge>
          {data.estimated_time && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{data.estimated_time}</Badge>}
          {data.estimated_recovery && <Badge variant="outline" className="gap-1"><DollarSign className="h-3 w-3" />{typeof data.estimated_recovery === "number" ? `$${data.estimated_recovery.toLocaleString()}` : data.estimated_recovery}</Badge>}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: totalSteps ? `${(checkedSteps.size / totalSteps) * 100}%` : "0%" }} />
        </div>
        <span>{checkedSteps.size}/{totalSteps} steps</span>
      </div>

      {/* Phases */}
      {data.phases?.map((phase, pi) => (
        <Collapsible key={pi} open={openPhases.has(pi)} onOpenChange={() => togglePhase(pi)}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
              {openPhases.has(pi) ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Phase {phase.phase_number ?? pi + 1}: {phase.title}</p>
                {phase.description && <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>}
              </div>
              <Badge variant="outline" className="text-xs shrink-0">{phase.steps?.filter((_, si) => checkedSteps.has(`${pi}-${si}`)).length || 0}/{phase.steps?.length || 0}</Badge>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-4 mt-2 space-y-2">
              {phase.steps?.map((step, si) => {
                const key = `${pi}-${si}`;
                return <FixStepItem key={key} step={step} checked={checkedSteps.has(key)} onToggle={() => toggleStep(key)} />;
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* Common Mistakes */}
      {data.common_mistakes && data.common_mistakes.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
          <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4" />Common Mistakes</h4>
          <ul className="space-y-1.5">{data.common_mistakes.map((m, i) => <li key={i} className="text-sm text-yellow-900 flex items-start gap-2"><span className="text-yellow-600 mt-1 shrink-0">•</span>{m}</li>)}</ul>
        </div>
      )}

      {/* Success Indicators */}
      {data.success_indicators && data.success_indicators.length > 0 && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4">
          <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2"><CheckCircle className="h-4 w-4" />Success Indicators</h4>
          <ul className="space-y-1.5">{data.success_indicators.map((s, i) => <li key={i} className="text-sm text-green-900 flex items-start gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />{s}</li>)}</ul>
        </div>
      )}

      {/* Escalation */}
      {data.escalation_path && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2"><ArrowUpCircle className="h-4 w-4" />Escalation Path</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.escalation_path}</p>
        </div>
      )}
    </>
  );
}

// ── Fix Step Item ──

function FixStepItem({ step, checked, onToggle }: { step: FixStep; checked: boolean; onToggle: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const actionClass = step.action_type ? ACTION_TYPE_COLORS[step.action_type] || "bg-muted text-foreground" : "";

  return (
    <div className={`rounded-lg border p-3 transition-colors ${checked ? "bg-muted/30 opacity-70" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>{step.title}</span>
            {step.action_type && <Badge className={`text-[10px] px-1.5 py-0 border ${actionClass}`}>{formatLabel(step.action_type)}</Badge>}
            {step.who && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{step.who}</Badge>}
            {step.urgent && <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0 border-0">URGENT</Badge>}
          </div>
          {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
          {(step.details || step.if_blocked) && (
            <button onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }} className="text-xs text-primary hover:underline font-medium">
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
          )}
          {showDetails && (
            <div className="text-xs space-y-2 mt-1 pl-2 border-l-2 border-muted">
              {step.details && <p className="text-muted-foreground">{step.details}</p>}
              {step.if_blocked && <div><span className="font-medium text-destructive">If blocked: </span><span className="text-muted-foreground">{step.if_blocked}</span></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
