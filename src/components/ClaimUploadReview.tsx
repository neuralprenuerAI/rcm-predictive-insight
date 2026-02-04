import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload, 
  FileText, 
  Brain, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  AlertCircle,
  Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { toast } from "sonner";

interface ExtractedData {
  patient?: {
    name?: string;
    first_name?: string;
    last_name?: string;
    dob?: string;
    sex?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    phone?: string;
    account_number?: string;
  };
  insured?: {
    id?: string;
    name?: string;
    group_number?: string;
    plan_name?: string;
  };
  payer?: {
    name?: string;
    address?: string;
    type?: string;
  };
  claim?: {
    claim_number?: string;
    date_of_service?: string;
    date_of_service_to?: string;
    place_of_service?: string;
    prior_auth_number?: string;
  };
  diagnoses?: {
    icd_indicator?: string;
    codes?: string[];
    primary?: string;
  };
  procedures?: {
    line?: number;
    cpt_code?: string;
    modifiers?: string[];
    diagnosis_pointer?: string;
    charge?: number;
    units?: number;
    description?: string;
  }[];
  charges?: {
    total_charge?: number;
    amount_paid?: number;
    balance_due?: number;
  };
  provider?: {
    billing_name?: string;
    billing_npi?: string;
    billing_address?: string;
    billing_phone?: string;
    rendering_name?: string;
    rendering_npi?: string;
    tax_id?: string;
    tax_id_type?: string;
  };
  facility?: {
    name?: string;
    npi?: string;
    address?: string;
  };
}

interface AnalysisResult {
  approval_probability: number;
  risk_level: string;
  confidence_score: number;
  executive_summary: string;
  clinical_support_analysis?: {
    has_sufficient_documentation: boolean;
    documentation_score: number;
    findings: string[];
    gaps: string[];
  };
  coding_analysis?: {
    cpt_icd_alignment: string;
    issues_found: any[];
    coding_score: number;
  };
  medical_necessity_analysis?: {
    is_supported: boolean;
    supporting_evidence: string[];
    concerns: string[];
    necessity_score: number;
  };
  critical_issues?: {
    priority: number;
    issue: string;
    impact: string;
    resolution: string;
  }[];
  recommendations?: {
    category: string;
    recommendation: string;
    expected_impact: string;
    effort: string;
  }[];
  missing_documentation?: {
    document_type: string;
    why_needed: string;
    impact_without: string;
  }[];
  next_steps?: string[];
}

interface FullAnalysisResult {
  extracted_data?: ExtractedData;
  analysis?: AnalysisResult;
  clinical_data?: any;
}

const ClaimUploadReview = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [claimFile, setClaimFile] = useState<File | null>(null);
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<FullAnalysisResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedClaimId, setSavedClaimId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleFileUpload = async (type: 'claim' | 'notes') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (type === 'claim') {
        setClaimFile(file);
        toast.success("Claim file uploaded");
      } else {
        setNotesFile(file);
        toast.success("Notes file uploaded");
      }
    };
    
    input.click();
  };

  const handleAnalyze = async () => {
    if (!claimFile) {
      toast.error("Please upload a claim file");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      // Convert files to base64
      setProcessingStep("Preparing files for analysis...");
      const claimBase64 = await fileToBase64(claimFile);
      
      let notesBase64 = null;
      if (notesFile) {
        notesBase64 = await fileToBase64(notesFile);
      }

      // Send directly to Gemini Vision analysis
      setProcessingStep("AI analyzing claim and clinical documentation...");
      
      const { data: analysisData, error: analysisError } = await awsApi.invoke('analyze-claim-combined', {
        body: {
          claimContent: claimBase64,
          clinicalNotesContent: notesBase64,
          claimFilename: claimFile.name,
          notesFilename: notesFile?.name || null,
        },
      });

      if (analysisError) throw new Error(`Analysis failed: ${analysisError.message}`);

      if (!analysisData?.success) {
        throw new Error(analysisData?.error || "Invalid analysis response");
      }

      // Store full result including extracted_data and analysis
      setAnalysisResult({
        extracted_data: analysisData.extracted_data,
        analysis: analysisData.analysis,
        clinical_data: analysisData.clinical_data,
      });
      
      toast.success(`Analysis Complete! Approval probability: ${analysisData.analysis?.approval_probability || 0}%`);

    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsAnalyzing(false);
      setProcessingStep("");
    }
  };

  // Get risk badge styling
  const getRiskBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle2 };
      case 'medium':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: AlertTriangle };
      case 'high':
        return { bg: 'bg-orange-100', text: 'text-orange-800', icon: AlertOctagon };
      case 'critical':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: XCircle };
      default:
        return { bg: 'bg-muted', text: 'text-muted-foreground', icon: AlertTriangle };
    }
  };

  const clearAll = () => {
    setClaimFile(null);
    setNotesFile(null);
    setAnalysisResult(null);
    setProcessingStep("");
    setSavedClaimId(null);
  };

  const handleSaveClaim = async () => {
    if (!analysisResult) {
      toast.error("No analysis to save");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");

      // Use extracted data from the AI
      const extracted = analysisResult.extracted_data || {};
      const analysis = analysisResult.analysis;
      const patient = extracted.patient || {};
      const charges = extracted.charges || {};
      const procedures = extracted.procedures || [];
      const diagnoses = extracted.diagnoses || {};
      const payer = extracted.payer || {};
      const provider = extracted.provider || {};
      const facility = extracted.facility || {};
      const claim = extracted.claim || {};

      // Build patient address
      const patientAddress = patient.address ? 
        `${patient.address.street || ''}, ${patient.address.city || ''}, ${patient.address.state || ''} ${patient.address.zip || ''}`.trim().replace(/^,\s*/, '') : null;

      // Build patient name
      const patientName = patient.name || 
        (patient.last_name && patient.first_name ? `${patient.last_name}, ${patient.first_name}` : null) || 
        'Unknown Patient';

      const claimData = {
        user_id: currentUser.id,
        claim_id: claim.claim_number || patient.account_number || `CLM-${Date.now()}`,
        
        // Patient info - from extracted data
        patient_name: patientName,
        patient_dob: patient.dob || null,
        patient_address: patientAddress,
        patient_phone: patient.phone || null,
        
        // Provider info
        provider: provider.rendering_name || provider.billing_name || 'Unknown Provider',
        provider_name: provider.rendering_name || provider.billing_name || null,
        provider_npi: provider.billing_npi || null,
        
        // Facility info
        service_facility_name: facility.name || null,
        service_facility_npi: facility.npi || null,
        
        // Claim info
        date_of_service: claim.date_of_service || new Date().toISOString().split('T')[0],
        
        // Procedure/Diagnosis - from extracted data
        procedure_code: procedures[0]?.cpt_code || null,
        procedure_codes: procedures.map((p: any) => p.cpt_code).filter(Boolean),
        diagnosis_code: diagnoses.primary || diagnoses.codes?.[0] || null,
        diagnosis_codes: diagnoses.codes || [],
        
        // Charges - from extracted data (convert to number)
        billed_amount: typeof charges.total_charge === 'string' 
          ? parseFloat((charges.total_charge as string).replace(/[^0-9.]/g, '')) || 0 
          : (charges.total_charge as number) || 0,
        
        // Payer - from extracted data
        payer: payer.name || extracted.insured?.plan_name || null,
        payer_id: extracted.insured?.id || null,
        payer_type: payer.type || null,
        
        // Status
        status: 'reviewed',
        source: 'upload_analysis',
        
        // AI Analysis
        ai_analysis: analysis as any,
        approval_probability: analysis?.approval_probability || 0,
        risk_category: analysis?.risk_level || null,
        risk_level: analysis?.risk_level || null,
        documentation_score: analysis?.clinical_support_analysis?.documentation_score || 0,
        executive_summary: analysis?.executive_summary || null,
        clinical_findings: (analysis?.clinical_support_analysis?.findings || []) as any,
        ai_recommendations: (analysis?.recommendations?.map((r: any) => r.recommendation) || []) as any,
        next_steps: (analysis?.next_steps || []) as any,
        
        // File info
        claim_filename: claimFile?.name || null,
        notes_filename: notesFile?.name || null,
        ai_reviewed_at: new Date().toISOString(),
        
        // Store full extracted data for reference
        extracted_claim_data: extracted as any,
      };

      const { data, error } = await supabase
        .from('claims')
        .insert(claimData)
        .select('id')
        .single();

      if (error) throw error;

      setSavedClaimId(data.id);
      toast.success(`Claim saved! ${patientName}`);

    } catch (error) {
      console.error("Save error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save claim");
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Claim Upload & AI Review</h1>
        <p className="text-muted-foreground">Upload claim and doctor notes for intelligent deniability analysis</p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Files
          </CardTitle>
          <CardDescription>Upload both claim file and doctor's notes (PDF format)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Claim File Upload */}
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${claimFile ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted hover:border-primary'}`}
              onClick={() => handleFileUpload('claim')}
            >
              <FileText className={`h-10 w-10 mx-auto mb-2 ${claimFile ? 'text-green-500' : 'text-muted-foreground'}`} />
              <p className="font-medium">
                {claimFile ? claimFile.name : 'Upload Claim File'}
              </p>
              <p className="text-xs text-muted-foreground">PDF format</p>
              {claimFile && (
                <p className="text-xs text-green-600 mt-1">✓ File selected</p>
              )}
            </div>

            {/* Notes File Upload */}
            <div 
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${notesFile ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted hover:border-primary'}`}
              onClick={() => handleFileUpload('notes')}
            >
              <FileText className={`h-10 w-10 mx-auto mb-2 ${notesFile ? 'text-green-500' : 'text-muted-foreground'}`} />
              <p className="font-medium">
                {notesFile ? notesFile.name : "Upload Doctor's Notes"}
              </p>
              <p className="text-xs text-muted-foreground">PDF format</p>
              {notesFile && (
                <p className="text-xs text-green-600 mt-1">✓ File selected</p>
              )}
            </div>
          </div>

          {/* Analyze Button */}
          <Button 
            onClick={handleAnalyze}
            disabled={!claimFile || isAnalyzing}
            className="w-full"
            size="lg"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {processingStep || "Analyzing..."}
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 mr-2" />
                Analyze Claim
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold text-green-600">
                  {analysisResult.analysis?.approval_probability || 0}%
                </p>
                <p className="text-sm text-muted-foreground">Approval Probability</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                {(() => {
                  const badge = getRiskBadge(analysisResult.analysis?.risk_level || '');
                  const Icon = badge.icon;
                  return (
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                      <Icon className="h-4 w-4" />
                      <span className="font-medium capitalize">{analysisResult.analysis?.risk_level || 'N/A'}</span>
                    </div>
                  );
                })()}
                <p className="text-sm text-muted-foreground mt-2">Risk Level</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">
                  {analysisResult.analysis?.clinical_support_analysis?.documentation_score || 0}%
                </p>
                <p className="text-sm text-muted-foreground">Documentation Score</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-3xl font-bold">
                  {analysisResult.analysis?.critical_issues?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Issues Found</p>
              </div>
            </div>

            {/* Executive Summary */}
            {analysisResult.analysis?.executive_summary && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-medium mb-2">Executive Summary</h4>
                <p className="text-sm">{analysisResult.analysis.executive_summary}</p>
              </div>
            )}

            {/* Clinical Support Analysis */}
            {analysisResult.analysis?.clinical_support_analysis && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  Clinical Documentation Analysis
                  {analysisResult.analysis.clinical_support_analysis.has_sufficient_documentation ? (
                    <span className="text-green-600 text-sm">✓ Sufficient</span>
                  ) : (
                    <span className="text-red-600 text-sm">✗ Insufficient</span>
                  )}
                </h4>
                
                {analysisResult.analysis.clinical_support_analysis.findings?.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">Findings (What's documented):</p>
                    <ul className="text-sm text-green-700 dark:text-green-300 list-disc list-inside">
                      {analysisResult.analysis.clinical_support_analysis.findings.map((f: string, i: number) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysisResult.analysis.clinical_support_analysis.gaps?.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Gaps (What's missing):</p>
                    <ul className="text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                      {analysisResult.analysis.clinical_support_analysis.gaps.map((g: string, i: number) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Critical Issues */}
            {analysisResult.analysis?.critical_issues && analysisResult.analysis.critical_issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-700 dark:text-red-400">Critical Issues</h4>
                {analysisResult.analysis.critical_issues.map((issue, i) => (
                  <div key={i} className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                    <div className="flex items-start gap-2">
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded">P{issue.priority}</span>
                      <div>
                        <p className="font-medium text-sm">{issue.issue}</p>
                        <p className="text-xs text-red-600 dark:text-red-400">Impact: {issue.impact}</p>
                        <p className="text-xs text-green-700 dark:text-green-400 mt-1">Fix: {issue.resolution}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {analysisResult.analysis?.recommendations && analysisResult.analysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Recommendations</h4>
                {analysisResult.analysis.recommendations.map((rec, i) => (
                  <div key={i} className="p-3 bg-muted rounded flex justify-between items-start">
                    <div>
                      <p className="text-sm">{rec.recommendation}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">Expected: {rec.expected_impact}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      rec.effort === 'low' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      rec.effort === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {rec.effort} effort
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Next Steps */}
            {analysisResult.analysis?.next_steps && analysisResult.analysis.next_steps.length > 0 && (
              <div className="p-4 bg-primary/10 rounded-lg">
                <h4 className="font-medium mb-2">Recommended Next Steps</h4>
                <ol className="space-y-2">
                  {analysisResult.analysis.next_steps.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                {!savedClaimId ? (
                  <Button 
                    onClick={handleSaveClaim}
                    disabled={isSaving}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Save Claim</>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={() => navigate('/claims')}
                    variant="outline"
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" /> View Saved Claims
                  </Button>
                )}
                
                <Button variant="outline" onClick={clearAll}>
                  New Analysis
                </Button>
              </div>

              {savedClaimId && (
                <div className="text-center text-sm text-green-600 bg-green-50 dark:bg-green-950 p-2 rounded">
                  ✓ Claim saved successfully!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClaimUploadReview;
