import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { awsApi } from "@/integrations/aws/awsApi";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  ArrowUpCircle,
  Clock,
  DollarSign,
  Sparkles,
  Send,
} from "lucide-react";

interface Step {
  step_number?: number;
  title: string;
  description?: string;
  action_type?: string;
  who?: string;
  urgent?: boolean;
  details?: string;
  if_blocked?: string;
}

interface Phase {
  phase_number?: number;
  title: string;
  description?: string;
  steps: Step[];
}

interface FixData {
  summary?: string;
  difficulty?: string;
  estimated_time?: string;
  estimated_recovery?: number | string;
  phases?: Phase[];
  common_mistakes?: string[];
  success_indicators?: string[];
  escalation_path?: string;
}

interface FixInstructionsModalProps {
  denialId: string | null;
  open: boolean;
  onClose: () => void;
  onGenerateAppeal: () => void;
}

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

export default function FixInstructionsModal({
  denialId,
  open,
  onClose,
  onGenerateAppeal,
}: FixInstructionsModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set());
  const [openPhases, setOpenPhases] = useState<Set<number>>(new Set());
  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && denialId && denialId !== lastFetchedId) {
      setLastFetchedId(denialId);
      setCheckedSteps(new Set());
      setOpenPhases(new Set());
      fetchInstructions(denialId);
    }
  }, [open, denialId]);

  const fetchInstructions = async (id: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await awsApi.invoke("fix-instructions", { body: { denialId: id } });
      if (res.error) throw res.error;
      const d = res.data?.instructions || res.data;
      if (!d) throw new Error("No instructions returned");
      setData(d);
      // Auto-expand first phase
      setOpenPhases(new Set([0]));
    } catch (err: any) {
      setError(err.message || "Failed to generate fix instructions");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
      setTimeout(() => {
        setData(null);
        setError(null);
        setLastFetchedId(null);
      }, 300);
    }
  };

  const toggleStep = (key: string) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const togglePhase = (idx: number) => {
    setOpenPhases((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const totalSteps = data?.phases?.reduce((sum, p) => sum + (p.steps?.length || 0), 0) || 0;

  const markAllComplete = () => {
    const all = new Set<string>();
    data?.phases?.forEach((phase, pi) => {
      phase.steps?.forEach((_, si) => all.add(`${pi}-${si}`));
    });
    setCheckedSteps(all);
  };

  const difficultyLabel = data?.difficulty?.toLowerCase() || "medium";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] p-0 gap-0 overflow-hidden">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 px-8">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Generating fix instructions...</h2>
            <p className="text-muted-foreground text-center text-sm">
              Analyzing denial and building step-by-step resolution plan
            </p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-32 px-8">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to Load</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => denialId && fetchInstructions(denialId)}>Retry</Button>
            </div>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Header */}
            <div className="border-b bg-card px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-foreground">Fix Instructions</h2>
                  {data.summary && (
                    <p className="text-sm text-muted-foreground max-w-lg">{data.summary}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`border ${DIFFICULTY_COLORS[difficultyLabel] || DIFFICULTY_COLORS.medium}`}>
                    {data.difficulty || "Medium"}
                  </Badge>
                  {data.estimated_time && (
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {data.estimated_time}
                    </Badge>
                  )}
                  {data.estimated_recovery && (
                    <Badge variant="outline" className="gap-1">
                      <DollarSign className="h-3 w-3" />
                      {typeof data.estimated_recovery === "number"
                        ? `$${data.estimated_recovery.toLocaleString()}`
                        : data.estimated_recovery}
                    </Badge>
                  )}
                </div>
              </div>
              {/* Progress */}
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: totalSteps ? `${(checkedSteps.size / totalSteps) * 100}%` : "0%" }}
                  />
                </div>
                <span>{checkedSteps.size}/{totalSteps} steps</span>
              </div>
            </div>

            {/* Scrollable body */}
            <ScrollArea className="max-h-[calc(95vh-12rem)]">
              <div className="p-6 space-y-4">
                {/* Phases */}
                {data.phases?.map((phase, pi) => (
                  <Collapsible key={pi} open={openPhases.has(pi)} onOpenChange={() => togglePhase(pi)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                        {openPhases.has(pi) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex-1 text-left">
                          <p className="text-sm font-semibold text-foreground">
                            Phase {phase.phase_number ?? pi + 1}: {phase.title}
                          </p>
                          {phase.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {phase.steps?.filter((_, si) => checkedSteps.has(`${pi}-${si}`)).length || 0}/{phase.steps?.length || 0}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-2">
                        {phase.steps?.map((step, si) => {
                          const key = `${pi}-${si}`;
                          const checked = checkedSteps.has(key);
                          return (
                            <StepItem
                              key={key}
                              step={step}
                              checked={checked}
                              onToggle={() => toggleStep(key)}
                            />
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}

                {/* Common Mistakes */}
                {data.common_mistakes && data.common_mistakes.length > 0 && (
                  <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4">
                    <h4 className="text-sm font-semibold text-yellow-800 flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Common Mistakes
                    </h4>
                    <ul className="space-y-1.5">
                      {data.common_mistakes.map((m, i) => (
                        <li key={i} className="text-sm text-yellow-900 flex items-start gap-2">
                          <span className="text-yellow-600 mt-1 shrink-0">•</span>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Success Indicators */}
                {data.success_indicators && data.success_indicators.length > 0 && (
                  <div className="rounded-lg border border-green-300 bg-green-50 p-4">
                    <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4" />
                      Success Indicators
                    </h4>
                    <ul className="space-y-1.5">
                      {data.success_indicators.map((s, i) => (
                        <li key={i} className="text-sm text-green-900 flex items-start gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Escalation Path */}
                {data.escalation_path && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
                      <ArrowUpCircle className="h-4 w-4" />
                      Escalation Path
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.escalation_path}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t bg-card px-6 py-3 flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button variant="outline" onClick={markAllComplete}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark All Complete
              </Button>
              <Button onClick={onGenerateAppeal}>
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

function StepItem({
  step,
  checked,
  onToggle,
}: {
  step: Step;
  checked: boolean;
  onToggle: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const actionClass = step.action_type ? ACTION_TYPE_COLORS[step.action_type] || "bg-muted text-foreground" : "";

  return (
    <div className={`rounded-lg border p-3 transition-colors ${checked ? "bg-muted/30 opacity-70" : "bg-card"}`}>
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {step.title}
            </span>
            {step.action_type && (
              <Badge className={`text-[10px] px-1.5 py-0 border ${actionClass}`}>
                {step.action_type.replace(/_/g, " ")}
              </Badge>
            )}
            {step.who && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {step.who}
              </Badge>
            )}
            {step.urgent && (
              <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0 border-0">
                URGENT
              </Badge>
            )}
          </div>
          {step.description && (
            <p className="text-xs text-muted-foreground">{step.description}</p>
          )}
          {(step.details || step.if_blocked) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
              className="text-xs text-primary hover:underline font-medium"
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
          )}
          {showDetails && (
            <div className="text-xs space-y-2 mt-1 pl-2 border-l-2 border-muted">
              {step.details && (
                <p className="text-muted-foreground">{step.details}</p>
              )}
              {step.if_blocked && (
                <div>
                  <span className="font-medium text-destructive">If blocked: </span>
                  <span className="text-muted-foreground">{step.if_blocked}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
