import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePDFParser } from "@/hooks/usePDFParser";
import { toast } from "sonner";

interface ClaimData {
  claimId: string;
  patientName: string;
  dos: string;
  provider: string;
  diagnosisCode: string;
  procedureCode: string;
  billedAmount: number;
}

interface ReviewResult {
  deniabilityProbability: number;
  riskCategory: "low" | "medium" | "high";
  riskFactors: {
    category: string;
    severity: "low" | "medium" | "high";
    description: string;
    impact: string;
  }[];
  recommendations: {
    action: string;
    priority: "low" | "medium" | "high";
    rationale: string;
  }[];
  complianceIssues: string[];
  strengths: string[];
}

const ClaimUploadReview = () => {
  const navigate = useNavigate();
  const { parsePDF, isParsing } = usePDFParser();
  const [user, setUser] = useState<any>(null);
  const [uploadedClaim, setUploadedClaim] = useState<ClaimData | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [claimFile, setClaimFile] = useState<File | null>(null);
  const [notesFile, setNotesFile] = useState<File | null>(null);

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

  const analyzeClaim = async () => {
    if (!claimFile || !notesFile || !user) {
      toast.error("Please upload both claim and notes files");
      return;
    }

    setIsAnalyzing(true);
    setReviewResult(null);

    try {
      // Parse PDFs
      const claimText = await parsePDF(claimFile);
      const notesText = await parsePDF(notesFile);

      // Upload files to storage
      const claimPath = `${user.id}/${Date.now()}_claim.pdf`;
      const notesPath = `${user.id}/${Date.now()}_notes.pdf`;

      const [claimUpload, notesUpload] = await Promise.all([
        supabase.storage.from('claim-files').upload(claimPath, claimFile),
        supabase.storage.from('claim-files').upload(notesPath, notesFile)
      ]);

      if (claimUpload.error) throw claimUpload.error;
      if (notesUpload.error) throw notesUpload.error;

      // Get public URLs
      const { data: claimUrlData } = supabase.storage.from('claim-files').getPublicUrl(claimPath);
      const { data: notesUrlData } = supabase.storage.from('claim-files').getPublicUrl(notesPath);

      // Analyze with AI
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-claim', {
        body: { claimText, notesText }
      });

      if (analysisError) throw analysisError;

      // Save to database
      const claimData = {
        user_id: user.id,
        claim_id: `CLM-${Date.now()}`,
        patient_name: "Extracted from PDF",
        date_of_service: new Date().toISOString().split('T')[0],
        provider: "Extracted from PDF",
        billed_amount: 0,
        claim_file_url: claimUrlData.publicUrl,
        notes_file_url: notesUrlData.publicUrl,
        ai_analysis: analysisData,
        deniability_probability: analysisData.deniabilityProbability,
        risk_category: analysisData.riskCategory
      };

      const { data: insertedClaim, error: insertError } = await supabase
        .from('claims')
        .insert(claimData)
        .select()
        .single();

      if (insertError) throw insertError;

      setUploadedClaim({
        claimId: insertedClaim.claim_id,
        patientName: insertedClaim.patient_name,
        dos: insertedClaim.date_of_service,
        provider: insertedClaim.provider,
        diagnosisCode: insertedClaim.diagnosis_code || 'N/A',
        procedureCode: insertedClaim.procedure_code || 'N/A',
        billedAmount: insertedClaim.billed_amount
      });

      setReviewResult(analysisData);
      toast.success("Claim analyzed successfully!");

    } catch (error: any) {
      console.error('Error analyzing claim:', error);
      toast.error(error.message || "Failed to analyze claim");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskColor = (category: string) => {
    switch (category.toLowerCase()) {
      case "low": return "text-success";
      case "medium": return "text-warning";
      case "high": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string): "outline" | "default" | "destructive" => {
    const variants: Record<string, "outline" | "default" | "destructive"> = {
      low: "outline",
      medium: "default",
      high: "destructive"
    };
    return variants[severity] || "default";
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Claim Upload & AI Review</h1>
        <p className="text-muted-foreground">Upload claim and doctor notes for intelligent deniability analysis</p>
      </div>

      {!uploadedClaim ? (
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
              <div 
                className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={() => handleFileUpload('claim')}
              >
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-1">
                  {claimFile ? claimFile.name : "Upload Claim File"}
                </p>
                <p className="text-sm text-muted-foreground">PDF format</p>
              </div>

              <div 
                className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                onClick={() => handleFileUpload('notes')}
              >
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="font-medium mb-1">
                  {notesFile ? notesFile.name : "Upload Doctor's Notes"}
                </p>
                <p className="text-sm text-muted-foreground">PDF format</p>
              </div>
            </div>

            <Button 
              onClick={analyzeClaim} 
              disabled={!claimFile || !notesFile || isAnalyzing || isParsing}
              className="w-full"
            >
              {isAnalyzing || isParsing ? "Processing..." : "Analyze Claim"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Claim Details</CardTitle>
              <CardDescription>Claim ID: {uploadedClaim.claimId}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Patient</p>
                  <p className="font-medium">{uploadedClaim.patientName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Service</p>
                  <p className="font-medium">{uploadedClaim.dos}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{uploadedClaim.provider}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billed Amount</p>
                  <p className="font-medium">${uploadedClaim.billedAmount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isAnalyzing && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Analyzing with AI...</span>
                    <TrendingUp className="h-5 w-5 animate-pulse" />
                  </div>
                  <Progress value={66} />
                </div>
              </CardContent>
            </Card>
          )}

          {reviewResult && !isAnalyzing && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Analysis Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="text-sm text-muted-foreground">Deniability Probability</p>
                        <span className={`text-3xl font-bold ${getRiskColor(reviewResult.riskCategory)}`}>
                          {reviewResult.deniabilityProbability}%
                        </span>
                        <Badge className="ml-2" variant={getSeverityBadge(reviewResult.riskCategory)}>
                          {reviewResult.riskCategory.toUpperCase()} Risk
                        </Badge>
                      </div>
                      <Progress value={reviewResult.deniabilityProbability} className="w-32" />
                    </div>

                    {reviewResult.riskFactors.length > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Risk Factors:</strong>
                          <ul className="mt-2 space-y-1">
                            {reviewResult.riskFactors.map((factor, idx) => (
                              <li key={idx} className="text-sm">• {factor.description}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reviewResult.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <CheckCircle className="h-4 w-4" />
                              <h4 className="font-semibold">{rec.action}</h4>
                              <Badge variant={getSeverityBadge(rec.priority)}>
                                {rec.priority.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setUploadedClaim(null);
                    setReviewResult(null);
                    setClaimFile(null);
                    setNotesFile(null);
                  }}
                >
                  Upload Another Claim
                </Button>
                <Button onClick={() => toast.success("Claim exported")}>
                  Export Claim
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ClaimUploadReview;
