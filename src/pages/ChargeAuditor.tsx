import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { 
  Upload, 
  FileText, 
  Plus, 
  Trash2, 
  Play, 
  Loader2, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  ArrowLeft
} from "lucide-react";

interface ActualCharge {
  id: string;
  cptCode: string;
  description: string;
  units: number;
  modifiers: string[];
  chargeAmount: number;
}

interface PredictedCharge {
  cptCode: string;
  cptDescription: string;
  units: number;
  modifiers: string[];
  confidenceScore: number;
  confidenceLevel: string;
  supportingText: string;
  reasoning: string;
  estimatedValue: number;
  category: string;
}

interface Discrepancy {
  type: string;
  severity: string;
  predictedCpt: string | null;
  actualCpt: string | null;
  revenueImpact: number;
  description: string;
  aiExplanation: string;
}

interface AuditResult {
  auditId: string;
  predictions: PredictedCharge[];
  summary: {
    predictedCount: number;
    actualCount: number;
    matchedCount: number;
    missingCount: number;
    undercodedCount: number;
    overcodedCount: number;
    potentialRevenue: number;
  };
  discrepancies: Discrepancy[];
}

const NOTE_TYPES = [
  { value: "progress_note", label: "Progress Note" },
  { value: "procedure_note", label: "Procedure Note" },
  { value: "h_and_p", label: "H&P" },
  { value: "consult", label: "Consultation" },
  { value: "operative_note", label: "Operative Note" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "other", label: "Other" },
];

const SPECIALTIES = [
  { value: "family_medicine", label: "Family Medicine" },
  { value: "internal_medicine", label: "Internal Medicine" },
  { value: "cardiology", label: "Cardiology" },
  { value: "orthopedics", label: "Orthopedics" },
  { value: "dermatology", label: "Dermatology" },
  { value: "neurology", label: "Neurology" },
  { value: "gastroenterology", label: "Gastroenterology" },
  { value: "pulmonology", label: "Pulmonology" },
  { value: "endocrinology", label: "Endocrinology" },
  { value: "rheumatology", label: "Rheumatology" },
  { value: "urgent_care", label: "Urgent Care" },
  { value: "other", label: "Other" },
];

const COMMON_MODIFIERS = ["25", "26", "50", "51", "59", "76", "77", "RT", "LT", "TC"];

export default function ChargeAuditor() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [inputMode, setInputMode] = useState<"upload" | "paste">("paste");
  const [noteContent, setNoteContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState("");
  const [encounterDate, setEncounterDate] = useState("");
  const [providerName, setProviderName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [noteType, setNoteType] = useState("progress_note");
  const [isNewPatient, setIsNewPatient] = useState(false);

  // Actual charges state
  const [actualCharges, setActualCharges] = useState<ActualCharge[]>([
    { id: crypto.randomUUID(), cptCode: "", description: "", units: 1, modifiers: [], chargeAmount: 0 }
  ]);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);

  const addChargeRow = () => {
    setActualCharges([
      ...actualCharges,
      { id: crypto.randomUUID(), cptCode: "", description: "", units: 1, modifiers: [], chargeAmount: 0 }
    ]);
  };

  const removeChargeRow = (id: string) => {
    if (actualCharges.length > 1) {
      setActualCharges(actualCharges.filter(c => c.id !== id));
    }
  };

  const updateCharge = (id: string, field: keyof ActualCharge, value: any) => {
    setActualCharges(actualCharges.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    
    // For now, we'll extract text from the file using AI when running audit
    toast({
      title: "File uploaded",
      description: `${file.name} ready for analysis`,
    });
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        
        try {
          // Use Gemini to extract text from document
          const response = await awsApi.invoke("ai-claim-review", {
            body: {
              action: "extract_text",
              document: base64,
              mimeType: file.type,
            },
          });

          if (response.error) throw response.error;
          resolve(response.data?.text || "");
        } catch (error) {
          console.error("Error extracting text:", error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const runAudit = async () => {
    // Validate inputs
    let contentToAnalyze = noteContent;
    
    if (inputMode === "upload") {
      if (!uploadedFile) {
        toast({ title: "Error", description: "Please upload a clinical note", variant: "destructive" });
        return;
      }
      setProcessingStep("Extracting text from document...");
      setIsProcessing(true);
      try {
        contentToAnalyze = await extractTextFromFile(uploadedFile);
      } catch (error) {
        toast({ title: "Error", description: "Failed to extract text from document", variant: "destructive" });
        setIsProcessing(false);
        return;
      }
    } else {
      if (!noteContent.trim() || noteContent.length < 50) {
        toast({ title: "Error", description: "Please enter clinical note content (at least 50 characters)", variant: "destructive" });
        return;
      }
    }

    const validCharges = actualCharges.filter(c => c.cptCode.trim());
    if (validCharges.length === 0) {
      toast({ title: "Error", description: "Please enter at least one actual charge", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    setAuditResult(null);

    try {
      // Step 1: Analyze clinical note
      setProcessingStep("Analyzing clinical note...");
      const analyzeResponse = await awsApi.invoke("analyze-clinical-note", {
        body: {
          noteContent: contentToAnalyze,
          noteType,
          patientName,
          encounterDate,
          providerName,
          specialty,
          source: inputMode,
        },
      });

      if (analyzeResponse.error) throw analyzeResponse.error;
      if (!analyzeResponse.data?.success) throw new Error(analyzeResponse.data?.error || "Analysis failed");

      const { clinicalNoteId, extractedData } = analyzeResponse.data;
      console.log("Note analyzed:", clinicalNoteId);

      // Step 2: Predict CPT codes
      setProcessingStep("Predicting CPT codes...");
      const predictResponse = await awsApi.invoke("predict-cpt-codes", {
        body: {
          clinicalNoteId,
          extractedData,
          rawContent: contentToAnalyze,
          isNewPatient,
        },
      });

      if (predictResponse.error) throw predictResponse.error;
      if (!predictResponse.data?.success) throw new Error(predictResponse.data?.error || "Prediction failed");

      const predictions: PredictedCharge[] = predictResponse.data.predictions;
      console.log("Predictions:", predictions.length);

      // Step 3: Compare charges
      setProcessingStep("Comparing charges...");
      const compareResponse = await awsApi.invoke("compare-charges", {
        body: {
          clinicalNoteId,
          predictions,
          actualCharges: validCharges.map(c => ({
            cptCode: c.cptCode,
            cptDescription: c.description,
            units: c.units,
            modifiers: c.modifiers,
            chargeAmount: c.chargeAmount,
          })),
        },
      });

      if (compareResponse.error) throw compareResponse.error;
      if (!compareResponse.data?.success) throw new Error(compareResponse.data?.error || "Comparison failed");

      setAuditResult({
        auditId: compareResponse.data.auditId,
        predictions,
        summary: compareResponse.data.summary,
        discrepancies: compareResponse.data.discrepancies,
      });

      toast({
        title: "Audit Complete",
        description: `Found ${compareResponse.data.summary.missingCount} missing charges worth $${compareResponse.data.summary.potentialRevenue}`,
      });

    } catch (error) {
      console.error("Audit error:", error);
      toast({
        title: "Audit Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  };

  const resetForm = () => {
    setNoteContent("");
    setUploadedFile(null);
    setPatientName("");
    setEncounterDate("");
    setProviderName("");
    setSpecialty("");
    setNoteType("progress_note");
    setIsNewPatient(false);
    setActualCharges([
      { id: crypto.randomUUID(), cptCode: "", description: "", units: 1, modifiers: [], chargeAmount: 0 }
    ]);
    setAuditResult(null);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getDiscrepancyIcon = (type: string) => {
    switch (type) {
      case "missing_charge": return <XCircle className="h-5 w-5 text-red-500" />;
      case "undercoded": return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case "overcoded": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">

      <div className="flex justify-between items-center">

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>

            <h1 className="text-3xl font-bold tracking-tight">AI Charge Capture Auditor</h1>

            <p className="text-muted-foreground">Analyze clinical notes to find missed revenue opportunities</p>

          </div>
        </div>

        <Button variant="outline" onClick={() => navigate("/audit-history")}>
          View Audit History
        </Button>
      </div>


      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Clinical Note Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Clinical Note
            </CardTitle>
            <CardDescription>Upload or paste the clinical documentation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "upload" | "paste")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="paste">Paste Text</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
              </TabsList>
              
              <TabsContent value="paste" className="space-y-4">

                <div>

                  <Label htmlFor="noteContent">Clinical Note Content</Label>
                  <Textarea
                    id="noteContent"
                    placeholder="Paste the clinical note content here..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="min-h-[200px] mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {noteContent.length} characters
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="upload" className="space-y-4">
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <Label htmlFor="fileUpload" className="cursor-pointer">
                    <span className="text-primary hover:underline">Click to upload</span>
                    <span className="text-muted-foreground"> or drag and drop</span>
                  </Label>
                  <Input
                    id="fileUpload"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground mt-2">PDF, images, or documents</p>
                  {uploadedFile && (
                    <p className="text-sm text-primary mt-2">✓ {uploadedFile.name}</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Encounter Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="patientName">Patient Name</Label>
                <Input
                  id="patientName"
                  placeholder="John Doe"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="encounterDate">Encounter Date</Label>
                <Input
                  id="encounterDate"
                  type="date"
                  value={encounterDate}
                  onChange={(e) => setEncounterDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="providerName">Provider Name</Label>
                <Input
                  id="providerName"
                  placeholder="Dr. Smith"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="specialty">Specialty</Label>
                <Select value={specialty} onValueChange={setSpecialty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="noteType">Note Type</Label>
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <input
                  type="checkbox"
                  id="isNewPatient"
                  checked={isNewPatient}
                  onChange={(e) => setIsNewPatient(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="isNewPatient">New Patient</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actual Charges Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Actual Charges
            </CardTitle>
            <CardDescription>Enter the charges that were actually billed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {actualCharges.map((charge, index) => (
                <div key={charge.id} className="flex gap-2 items-start p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <div>
                      <Label className="text-xs">CPT Code</Label>
                      <Input
                        placeholder="99213"
                        value={charge.cptCode}
                        onChange={(e) => updateCharge(charge.id, "cptCode", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Units</Label>
                      <Input
                        type="number"
                        min="1"
                        value={charge.units}
                        onChange={(e) => updateCharge(charge.id, "units", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Modifiers</Label>
                      <Select
                        value={charge.modifiers[0] || "none"}
                        onValueChange={(v) => updateCharge(charge.id, "modifiers", v === "none" ? [] : [v])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {COMMON_MODIFIERS.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Amount</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={charge.chargeAmount || ""}
                        onChange={(e) => updateCharge(charge.id, "chargeAmount", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeChargeRow(charge.id)}
                    disabled={actualCharges.length === 1}
                    className="mt-5"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button variant="outline" onClick={addChargeRow} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Charge
            </Button>

            <Separator />

            <div className="flex gap-2">
              <Button 
                onClick={runAudit} 
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {processingStep}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Audit
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results Section */}
      {auditResult && (
        <div className="space-y-6">
          <Separator />
          
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{auditResult.summary.predictedCount}</div>
                <p className="text-xs text-muted-foreground">Predicted Charges</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{auditResult.summary.actualCount}</div>
                <p className="text-xs text-muted-foreground">Actual Charges</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{auditResult.summary.missingCount}</div>
                <p className="text-xs text-muted-foreground">Missing Charges</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">
                  ${auditResult.summary.potentialRevenue.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">Potential Revenue</p>
              </CardContent>
            </Card>
          </div>

          {/* Discrepancies */}
          {auditResult.discrepancies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discrepancies Found</CardTitle>
                <CardDescription>
                  Review these items for potential corrections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditResult.discrepancies.map((disc, index) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-4 border rounded-lg"
                    >
                      <div className="mt-1">{getDiscrepancyIcon(disc.type)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getSeverityColor(disc.severity)}>
                            {disc.severity}
                          </Badge>
                          <span className="font-medium">{disc.type.replace(/_/g, " ")}</span>
                          {disc.revenueImpact > 0 && (
                            <Badge variant="outline" className="text-green-600">
                              +${disc.revenueImpact.toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{disc.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{disc.aiExplanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Predicted Charges Detail */}
          <Card>
            <CardHeader>
              <CardTitle>Predicted Charges</CardTitle>
              <CardDescription>
                CPT codes identified from the clinical documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditResult.predictions.map((pred, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-mono font-bold">{pred.cptCode}</div>
                      <div className="text-sm">{pred.cptDescription}</div>
                      {pred.modifiers.length > 0 && (
                        <Badge variant="outline">{pred.modifiers.join(", ")}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        pred.confidenceLevel === "high" ? "default" :
                        pred.confidenceLevel === "medium" ? "secondary" : "outline"
                      }>
                        {pred.confidenceScore}%
                      </Badge>
                      <span className="text-sm font-medium">${pred.estimatedValue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
