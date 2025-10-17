import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, AlertCircle, CheckCircle2, TrendingUp, FileText, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface ClaimData {
  claimId: string;
  patientName: string;
  dos: string;
  cptCodes: string[];
  icd10Codes: string[];
  chargeAmount: number;
  payer: string;
}

interface ReviewResult {
  deniabilityProbability: number;
  riskCategory: "Low" | "Medium" | "High";
  topRiskFactors: string[];
  recommendations: {
    rank: number;
    actionType: string;
    title: string;
    description: string;
    severity: "low" | "medium" | "high";
  }[];
}

export default function ClaimUploadReview() {
  const [uploadedClaim, setUploadedClaim] = useState<ClaimData | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Mock claim data extraction
    const mockClaim: ClaimData = {
      claimId: `CLM${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      patientName: "John Doe",
      dos: "2025-01-15",
      cptCodes: ["99213", "97110", "97140"],
      icd10Codes: ["M54.5", "M25.511"],
      chargeAmount: 285.00,
      payer: "Blue Cross Blue Shield"
    };

    setUploadedClaim(mockClaim);
    toast.success("Claim uploaded successfully");
    
    // Auto-analyze
    setTimeout(() => analyzeClaim(mockClaim), 500);
  };

  const analyzeClaim = (claim: ClaimData) => {
    setIsAnalyzing(true);
    
    // Mock AI analysis
    setTimeout(() => {
      const mockResult: ReviewResult = {
        deniabilityProbability: 0.42,
        riskCategory: "Medium",
        topRiskFactors: [
          "NCCI edit detected: 97110 + 97140 require modifier 59",
          "Missing prior authorization for physical therapy",
          "ICD-10 code M25.511 lacks specificity for payer"
        ],
        recommendations: [
          {
            rank: 1,
            actionType: "MODIFIER",
            title: "Add Modifier 59 to CPT 97140",
            description: "NCCI edit requires modifier 59 to indicate distinct procedural service. Document services were performed at different anatomical sites.",
            severity: "high"
          },
          {
            rank: 2,
            actionType: "AUTH_REQUEST",
            title: "Obtain Prior Authorization",
            description: "Blue Cross Blue Shield requires prior auth for physical therapy services exceeding 12 visits per year. Generate auth request with treatment plan.",
            severity: "high"
          },
          {
            rank: 3,
            actionType: "EDIT_CODE",
            title: "Specify Laterality in ICD-10",
            description: "Replace M25.511 with more specific code (e.g., M25.512 for left shoulder). Improves first-pass acceptance rate by 23%.",
            severity: "medium"
          }
        ]
      };
      
      setReviewResult(mockResult);
      setIsAnalyzing(false);
    }, 2000);
  };

  const getRiskColor = (category: string) => {
    switch (category) {
      case "Low": return "text-success";
      case "Medium": return "text-warning";
      case "High": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, any> = {
      low: "outline",
      medium: "default",
      high: "destructive"
    };
    return variants[severity] || "default";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Claim Upload & AI Review</h1>
        <p className="text-muted-foreground">Upload claims for pre-submission AI validation and deniability scoring</p>
      </div>

      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Upload Claim
          </CardTitle>
          <CardDescription>
            Supported formats: JSON, CSV, X12 837 files, or paste claim data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
              <Input
                type="file"
                onChange={handleFileUpload}
                accept=".json,.csv,.txt,.837"
                className="hidden"
                id="claim-upload"
              />
              <Label htmlFor="claim-upload" className="cursor-pointer">
                <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">Drop claim file here or click to browse</p>
                <p className="text-xs text-muted-foreground">JSON, CSV, or X12 837 format</p>
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {uploadedClaim && (
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>Claim Details</CardTitle>
            <CardDescription>Claim ID: {uploadedClaim.claimId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Patient</Label>
                <p className="font-medium">{uploadedClaim.patientName}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Date of Service</Label>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {uploadedClaim.dos}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">CPT Codes</Label>
                <div className="flex gap-2 flex-wrap">
                  {uploadedClaim.cptCodes.map(code => (
                    <Badge key={code} variant="outline">{code}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">ICD-10 Codes</Label>
                <div className="flex gap-2 flex-wrap">
                  {uploadedClaim.icd10Codes.map(code => (
                    <Badge key={code} variant="outline">{code}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Charge Amount</Label>
                <p className="font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  ${uploadedClaim.chargeAmount.toFixed(2)}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Payer</Label>
                <p className="font-medium">{uploadedClaim.payer}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isAnalyzing && (
        <Card className="border-border shadow-[var(--shadow-card)]">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Analyzing claim with AI...</span>
                <TrendingUp className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <Progress value={66} className="h-2" />
              <p className="text-xs text-muted-foreground">Running pre-submission edits, NCCI checks, and ML deniability model</p>
            </div>
          </CardContent>
        </Card>
      )}

      {reviewResult && !isAnalyzing && (
        <div className="space-y-6">
          <Card className="border-border shadow-[var(--shadow-elevated)]">
            <CardHeader>
              <CardTitle>AI Review Results</CardTitle>
              <CardDescription>Pre-submission risk assessment and recommendations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Deniability Probability</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-bold ${getRiskColor(reviewResult.riskCategory)}`}>
                        {(reviewResult.deniabilityProbability * 100).toFixed(1)}%
                      </span>
                      <Badge variant={reviewResult.riskCategory === "High" ? "destructive" : reviewResult.riskCategory === "Medium" ? "default" : "outline"}>
                        {reviewResult.riskCategory} Risk
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <Progress value={reviewResult.deniabilityProbability * 100} className="h-3 w-32" />
                    <p className="text-xs text-muted-foreground mt-2">ML Model v2.1.3</p>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong className="font-semibold">Top Risk Factors:</strong>
                    <ul className="mt-2 space-y-1">
                      {reviewResult.topRiskFactors.map((factor, idx) => (
                        <li key={idx} className="text-sm">• {factor}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
              <CardDescription>Ordered by impact on approval probability</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reviewResult.recommendations.map((rec) => (
                  <div key={rec.rank} className="p-4 border border-border rounded-lg space-y-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                            {rec.rank}
                          </span>
                          <h4 className="font-semibold text-foreground">{rec.title}</h4>
                          <Badge variant={getSeverityBadge(rec.severity)} className="text-xs">
                            {rec.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-[var(--gradient-primary)]" onClick={() => toast.success("Fix applied to claim")}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Apply Fix
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Task created for review")}>
                        <FileText className="h-4 w-4 mr-2" />
                        Create Task
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              setUploadedClaim(null);
              setReviewResult(null);
            }}>
              Upload Another Claim
            </Button>
            <Button className="bg-[var(--gradient-success)]" onClick={() => toast.success("Clean claim exported for submission")}>
              Export Clean Claim
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
