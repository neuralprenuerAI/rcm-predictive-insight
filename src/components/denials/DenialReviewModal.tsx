import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { awsApi } from "@/integrations/aws/awsApi";
import { supabase } from "@/integrations/supabase/client";
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
  X,
  Shield,
  Scale,
  TrendingUp,
} from "lucide-react";

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
}

interface AnalysisData {
  claim_summary?: {
    overview?: string;
    billed_amount?: number;
    paid_amount?: number;
    denied_amount?: number;
    net_recovery_opportunity?: number;
  };
  code_analysis?: Array<{
    code?: string;
    description?: string;
    plain_english?: string;
    is_legitimate?: boolean;
    challengeable?: boolean;
    win_probability?: number;
    action_required?: string;
  }>;
  ncci_analysis?: {
    applies?: boolean;
    bundling_explanation?: string;
    modifier_exception_available?: boolean;
    applicable_modifiers?: string[];
    modifier_guidance?: string;
  };
  modifier_opportunities?: Array<{
    modifier_code?: string;
    description?: string;
    application_guidance?: string;
    expected_impact?: string;
  }>;
  timely_filing?: {
    appeal_deadline?: string;
    days_remaining?: number;
    warning?: string;
  };
  win_probability?: {
    overall?: number;
    factors_for?: string[];
    factors_against?: string[];
  };
  full_analysis_text?: string;
  recommended_action?: string;
  recommended_reasoning?: string;
  alternative_actions?: Array<{
    action?: string;
    description?: string;
    pros?: string[];
    cons?: string[];
    success_likelihood?: number;
  }>;
}

export default function DenialReviewModal({
  denialId,
  denial,
  open,
  onClose,
  onGenerateAppeal,
}: DenialReviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (!denialId) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const res = await awsApi.invoke("denial-analysis", {
        body: { user_id: user.id, denialId },
      });
      if (res.error) throw res.error;
      const d = res.data?.analysis || res.data;
      if (!d) throw new Error("No analysis data returned");
      setAnalysis(d);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // Trigger analysis when modal opens with a new denialId
  const [lastAnalyzedId, setLastAnalyzedId] = useState<string | null>(null);

  if (open && denialId && denialId !== lastAnalyzedId && !loading) {
    setLastAnalyzedId(denialId);
    runAnalysis();
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setTimeout(() => {
        setAnalysis(null);
        setError(null);
        setLastAnalyzedId(null);
      }, 300);
    }
  };

  const patientName =
    denial?.patient_name ||
    (denial?.patient ? `${denial.patient.first_name} ${denial.patient.last_name}` : "Unknown");
  const claimNumber = denial?.claim?.claim_id || "N/A";

  const winProb = analysis?.win_probability?.overall ?? 0;
  const winColor = winProb > 60 ? "text-green-600" : winProb >= 40 ? "text-yellow-600" : "text-red-600";
  const winBg = winProb > 60 ? "bg-green-100" : winProb >= 40 ? "bg-yellow-100" : "bg-red-100";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 px-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Running Expert Analysis</h2>
            <p className="text-muted-foreground text-center">
              This may take 15–30 seconds. Analyzing denial codes, NCCI edits, modifier opportunities, and win probability…
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-32 px-8">
            <XCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Analysis Failed</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={runAnalysis}>Retry</Button>
            </div>
          </div>
        )}

        {/* Analysis results */}
        {analysis && !loading && (
          <>
            {/* Sticky Header */}
            <div className="border-b bg-card px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Denial Review</h2>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{patientName}</span>
                    <span>·</span>
                    <span>{denial?.payer_name}</span>
                    <span>·</span>
                    <span>Claim {claimNumber}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`${winBg} rounded-lg px-4 py-2 text-center`}>
                    <p className="text-xs text-muted-foreground">Win Probability</p>
                    <p className={`text-2xl font-bold ${winColor}`}>{winProb}%</p>
                  </div>
                  {analysis.recommended_action && (
                    <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1.5">
                      {analysis.recommended_action}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <ScrollArea className="max-h-[calc(95vh-10rem)]">
              <div className="p-6 space-y-6">

                {/* Section 1: Claim Summary */}
                {analysis.claim_summary && (
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Claim Summary
                    </h3>
                    {analysis.claim_summary.overview && (
                      <p className="text-sm text-foreground mb-3">{analysis.claim_summary.overview}</p>
                    )}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Billed", value: analysis.claim_summary.billed_amount },
                        { label: "Paid", value: analysis.claim_summary.paid_amount },
                        { label: "Denied", value: analysis.claim_summary.denied_amount },
                        { label: "Recovery Opportunity", value: analysis.claim_summary.net_recovery_opportunity },
                      ].map((item) => (
                        <Card key={item.label}>
                          <CardContent className="py-3 px-4">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-lg font-bold">
                              ${(item.value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                <Separator />

                {/* Section 2: Denial Code Analysis */}
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
                                <code className="text-sm font-semibold bg-muted px-2 py-0.5 rounded">
                                  {code.code}
                                </code>
                                <span className="text-sm ml-2">{code.description}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {code.is_legitimate !== undefined && (
                                  <div className="flex items-center gap-1 text-xs">
                                    {code.is_legitimate ? (
                                      <><CheckCircle className="h-3.5 w-3.5 text-green-600" /><span className="text-green-700">Legitimate</span></>
                                    ) : (
                                      <><XCircle className="h-3.5 w-3.5 text-red-600" /><span className="text-red-700">Questionable</span></>
                                    )}
                                  </div>
                                )}
                                {code.challengeable !== undefined && (
                                  <Badge variant={code.challengeable ? "default" : "secondary"} className="text-xs">
                                    {code.challengeable ? "Challengeable" : "Not Challengeable"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {code.plain_english && (
                              <p className="text-sm text-muted-foreground">{code.plain_english}</p>
                            )}
                            {code.win_probability !== undefined && (
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-24">Win Prob:</span>
                                <Progress value={code.win_probability} className="h-2 flex-1" />
                                <span className="text-xs font-medium w-10 text-right">{code.win_probability}%</span>
                              </div>
                            )}
                            {code.action_required && (
                              <p className="text-xs font-medium text-primary">→ {code.action_required}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Section 3: NCCI Analysis */}
                {analysis.ncci_analysis?.applies && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" /> NCCI Analysis
                      </h3>
                      <Card>
                        <CardContent className="py-4 px-4 space-y-3">
                          {analysis.ncci_analysis.bundling_explanation && (
                            <p className="text-sm">{analysis.ncci_analysis.bundling_explanation}</p>
                          )}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <span className="text-muted-foreground">Modifier Exception:</span>
                              {analysis.ncci_analysis.modifier_exception_available ? (
                                <Badge className="bg-green-600 text-xs">Available</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Not Available</Badge>
                              )}
                            </div>
                          </div>
                          {analysis.ncci_analysis.applicable_modifiers && analysis.ncci_analysis.applicable_modifiers.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground">Modifiers:</span>
                              {analysis.ncci_analysis.applicable_modifiers.map((m) => (
                                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                              ))}
                            </div>
                          )}
                          {analysis.ncci_analysis.modifier_guidance && (
                            <p className="text-sm text-muted-foreground">{analysis.ncci_analysis.modifier_guidance}</p>
                          )}
                        </CardContent>
                      </Card>
                    </section>
                  </>
                )}

                {/* Section 4: Modifier Opportunities */}
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
                              {mod.application_guidance && (
                                <p className="text-xs text-muted-foreground">{mod.application_guidance}</p>
                              )}
                              {mod.expected_impact && (
                                <p className="text-xs font-medium text-green-700">Impact: {mod.expected_impact}</p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                <Separator />

                {/* Section 5: Timely Filing */}
                {analysis.timely_filing && (
                  <section>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Timely Filing
                    </h3>
                    <Card>
                      <CardContent className="py-4 px-4 flex items-center gap-6">
                        {analysis.timely_filing.appeal_deadline && (
                          <div>
                            <p className="text-xs text-muted-foreground">Appeal Deadline</p>
                            <p className="text-sm font-semibold">{analysis.timely_filing.appeal_deadline}</p>
                          </div>
                        )}
                        {analysis.timely_filing.days_remaining !== undefined && (
                          <div>
                            <p className="text-xs text-muted-foreground">Days Remaining</p>
                            <Badge className={
                              analysis.timely_filing.days_remaining > 30
                                ? "bg-green-600"
                                : analysis.timely_filing.days_remaining >= 10
                                  ? "bg-yellow-500"
                                  : "bg-red-600"
                            }>
                              {analysis.timely_filing.days_remaining} days
                            </Badge>
                          </div>
                        )}
                        {analysis.timely_filing.warning && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4" />
                            {analysis.timely_filing.warning}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                )}

                <Separator />

                {/* Section 6: Win Probability Breakdown */}
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
                              <ul className="space-y-1">
                                {analysis.win_probability.factors_for.map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-sm">
                                    <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {analysis.win_probability.factors_against && analysis.win_probability.factors_against.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-red-700 mb-2">Factors Against</p>
                              <ul className="space-y-1">
                                {analysis.win_probability.factors_against.map((f, i) => (
                                  <li key={i} className="flex items-start gap-1.5 text-sm">
                                    <XCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </section>
                )}

                {/* Section 7: Full Expert Analysis */}
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

                {/* Section 8: Recommended Action */}
                {analysis.recommended_action && (
                  <>
                    <Separator />
                    <section>
                      <Card className="border-primary/30 bg-primary/5">
                        <CardContent className="py-5 px-5">
                          <div className="flex items-start gap-3">
                            <div className="bg-primary rounded-lg p-2 shrink-0">
                              <Sparkles className="h-5 w-5 text-primary-foreground" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground mb-1">Recommended: {analysis.recommended_action}</h4>
                              {analysis.recommended_reasoning && (
                                <p className="text-sm text-muted-foreground">{analysis.recommended_reasoning}</p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </section>
                  </>
                )}

                {/* Section 9: Alternative Actions */}
                {analysis.alternative_actions && analysis.alternative_actions.length > 0 && (
                  <>
                    <Separator />
                    <section>
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                        Alternative Actions
                      </h3>
                      <div className="space-y-3">
                        {analysis.alternative_actions.map((alt, i) => (
                          <Card key={i}>
                            <CardContent className="py-4 px-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">{alt.action}</h4>
                                {alt.success_likelihood !== undefined && (
                                  <Badge variant="outline" className="text-xs">
                                    {alt.success_likelihood}% likelihood
                                  </Badge>
                                )}
                              </div>
                              {alt.description && (
                                <p className="text-sm text-muted-foreground">{alt.description}</p>
                              )}
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                {alt.pros && alt.pros.length > 0 && (
                                  <div>
                                    <p className="font-medium text-green-700 mb-1">Pros</p>
                                    <ul className="space-y-0.5">
                                      {alt.pros.map((p, j) => (
                                        <li key={j} className="flex items-start gap-1">
                                          <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                                          <span>{p}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {alt.cons && alt.cons.length > 0 && (
                                  <div>
                                    <p className="font-medium text-red-700 mb-1">Cons</p>
                                    <ul className="space-y-0.5">
                                      {alt.cons.map((c, j) => (
                                        <li key={j} className="flex items-start gap-1">
                                          <XCircle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
                                          <span>{c}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Sticky Footer */}
            <div className="border-t bg-card px-6 py-3 flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Placeholder for future fix instructions flow
                }}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Get Fix Instructions
              </Button>
              <Button
                onClick={() => {
                  if (denial) onGenerateAppeal(denial);
                  onClose();
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Generate Appeal
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
