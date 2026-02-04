import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  Loader2,
  ArrowLeft,
  Sparkles,
  Shield,
  Zap,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  ClipboardCheck,
  TrendingDown,
  Layers,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Issue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  code?: string;
  code_pair?: string[];
  message: string;
  correction?: string;
  details?: any;
}

interface Correction {
  type?: string;
  action?: string;
  issue_type?: string;
  target_code?: string;
  new_value?: string;
  value?: any;
  explanation?: string;
  reason?: string;
  compliance_note?: string;
}

interface ScrubResult {
  success: boolean;
  scrub_result_id?: string;
  denial_risk_score: number;
  risk_level: string;
  all_issues: Issue[];
  corrections: Correction[];
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_issues: number;
  claim_info?: any;
  message?: string;
}

interface Procedure {
  cpt_code: string;
  units: number;
  modifiers: string;
}

const COMMON_PAYERS = [
  "Medicare",
  "Medicaid", 
  "BCBS",
  "UnitedHealthcare",
  "Aetna",
  "Cigna",
  "Humana",
  "Other"
];

export default function ClaimScrubber() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ScrubResult | null>(null);
  const [expandedIssues, setExpandedIssues] = useState<string[]>([]);
  
  // Manual entry state
  const [procedures, setProcedures] = useState<Procedure[]>([
    { cpt_code: '', units: 1, modifiers: '' }
  ]);
  const [icdCodes, setIcdCodes] = useState('');
  const [payer, setPayer] = useState('');
  const [patientName, setPatientName] = useState('');

  // Batch scrub state
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Fetch user's claims for batch selection
  const { data: userClaims, isLoading: claimsLoading } = useQuery({
    queryKey: ['user-claims-for-scrub'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('claims')
        .select('id, patient_name, payer, procedure_codes, diagnosis_codes, billed_amount, created_at, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) return [];
      return data || [];
    },
  });

  // File upload handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process claim
  const handleScrub = async () => {
    setIsProcessing(true);
    setResult(null);

    try {
      let body: any = {};

      if (activeTab === "manual") {
        // Validate manual entry
        const validProcedures = procedures.filter(p => p.cpt_code.trim());
        if (validProcedures.length === 0) {
          throw new Error("Please enter at least one CPT code");
        }

        body.claim_data = {
          procedures: validProcedures.map(p => ({
            cpt_code: p.cpt_code.trim(),
            units: p.units || 1,
            modifiers: p.modifiers ? p.modifiers.split(',').map(m => m.trim()).filter(Boolean) : []
          })),
          icd_codes: icdCodes.split(',').map(c => c.trim()).filter(Boolean),
          payer: payer || undefined,
          patient_name: patientName || undefined
        };
      } else if (file) {
        // PDF upload
        const base64 = await fileToBase64(file);
        body.pdf_content = base64;
      } else {
        throw new Error("Please upload a file or enter claim data");
      }

      const { data, error } = await awsApi.invoke('scrub-claim', { body });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Scrub failed");

      setResult(data);

      toast({
        title: data.total_issues === 0 ? "✅ Claim Passed!" : "⚠️ Issues Found",
        description: data.message || `Risk Score: ${data.denial_risk_score}%`,
        variant: data.denial_risk_score > 50 ? "destructive" : "default"
      });

    } catch (error) {
      console.error("Scrub error:", error);
      toast({
        title: "Scrub Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Procedure management
  const addProcedure = () => {
    setProcedures([...procedures, { cpt_code: '', units: 1, modifiers: '' }]);
  };

  const updateProcedure = (index: number, field: keyof Procedure, value: any) => {
    const updated = [...procedures];
    updated[index] = { ...updated[index], [field]: value };
    setProcedures(updated);
  };

  const removeProcedure = (index: number) => {
    if (procedures.length > 1) {
      setProcedures(procedures.filter((_, i) => i !== index));
    }
  };

  // Toggle issue expansion
  const toggleIssue = (id: string) => {
    setExpandedIssues(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'high': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default: return <AlertCircle className="h-5 w-5 text-blue-500" />;
    }
  };

  // Get severity colors
  const getSeverityColors = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'high': return 'border-orange-200 bg-orange-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  // Get risk color
  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600';
    if (score >= 50) return 'text-orange-500';
    if (score >= 25) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Get risk background
  const getRiskBg = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  // Export report
  const exportReport = () => {
    if (!result) return;
    
    const report = `
CLAIM SCRUB REPORT
==================
Generated: ${new Date().toLocaleString()}
${result.scrub_result_id ? `Report ID: ${result.scrub_result_id}` : ''}

RISK ASSESSMENT
---------------
Denial Risk Score: ${result.denial_risk_score}%
Risk Level: ${result.risk_level.toUpperCase()}

ISSUES SUMMARY
--------------
Critical: ${result.critical_count}
High: ${result.high_count}
Medium: ${result.medium_count}
Low: ${result.low_count}
Total: ${result.total_issues}

DETAILED ISSUES
---------------
${result.all_issues.length === 0 ? 'No issues found - claim is ready to submit!' : 
result.all_issues.map((issue, i) => `
${i + 1}. [${issue.severity.toUpperCase()}] ${issue.type}
   Code: ${issue.code || issue.code_pair?.join(' + ') || 'N/A'}
   Issue: ${issue.message}
   Fix: ${issue.correction || 'N/A'}
`).join('\n')}

RECOMMENDED CORRECTIONS
-----------------------
${result.corrections.length === 0 ? 'No corrections needed.' :
result.corrections.map((c, i) => `
${i + 1}. ${c.explanation || c.reason || c.type}
   Action: ${c.action || c.type}
   Target: ${c.target_code}
   Value: ${c.new_value || c.value || 'N/A'}
   ${c.compliance_note ? `Note: ${c.compliance_note}` : ''}
`).join('\n')}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrub_report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Report Downloaded",
      description: "Scrub report saved to your downloads"
    });
  };

  // Reset form
  const handleReset = () => {
    setResult(null);
    setFile(null);
    setProcedures([{ cpt_code: '', units: 1, modifiers: '' }]);
    setIcdCodes('');
    setPayer('');
    setPatientName('');
  };

  // Batch scrub handler
  const handleBatchScrub = async () => {
    if (selectedClaims.length === 0) {
      toast({
        title: "No claims selected",
        description: "Please select at least one claim to scrub",
        variant: "destructive"
      });
      return;
    }

    setIsBatchProcessing(true);
    setBatchResults([]);
    setBatchProgress(0);

    const results: any[] = [];
    
    for (let i = 0; i < selectedClaims.length; i++) {
      const claimId = selectedClaims[i];
      
      try {
        const { data, error } = await awsApi.invoke('scrub-claim', {
          body: { claim_id: claimId }
        });

        if (error) {
          results.push({
            claim_id: claimId,
            success: false,
            error: error.message,
            claim: userClaims?.find(c => c.id === claimId)
          });
        } else {
          results.push({
            claim_id: claimId,
            success: true,
            ...data,
            claim: userClaims?.find(c => c.id === claimId)
          });
        }
      } catch (err) {
        results.push({
          claim_id: claimId,
          success: false,
          error: 'Unknown error',
          claim: userClaims?.find(c => c.id === claimId)
        });
      }

      setBatchProgress(Math.round(((i + 1) / selectedClaims.length) * 100));
    }

    setBatchResults(results);
    setIsBatchProcessing(false);
    setSelectedClaims([]);

    const successCount = results.filter(r => r.success).length;
    const highRiskCount = results.filter(r => r.success && (r.risk_level === 'high' || r.risk_level === 'critical')).length;

    toast({
      title: "Batch Scrub Complete",
      description: `Scrubbed ${successCount}/${selectedClaims.length} claims. ${highRiskCount} high-risk claims found.`,
      variant: highRiskCount > 0 ? "destructive" : "default"
    });
  };

  // Toggle claim selection
  const toggleClaimSelection = (claimId: string) => {
    setSelectedClaims(prev => 
      prev.includes(claimId) 
        ? prev.filter(id => id !== claimId)
        : [...prev, claimId]
    );
  };

  // Select all claims
  const toggleSelectAll = () => {
    if (selectedClaims.length === userClaims?.length) {
      setSelectedClaims([]);
    } else {
      setSelectedClaims(userClaims?.map(c => c.id) || []);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">

        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <div>

          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Claim Scrubber
          </h1>

          <p className="text-sm text-muted-foreground">
            AI-powered claim validation & denial prevention
          </p>

        </div>

      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column - Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Claim Input
            </CardTitle>
            <CardDescription>Upload a CMS-1500 or enter claim data manually</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload PDF
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Manual Entry
                </TabsTrigger>
                <TabsTrigger value="batch" className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Batch Scrub
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    file ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onClick={() => document.getElementById('claim-file-input')?.click()}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="claim-file-input"
                  />
                  {file ? (
                    <div className="flex flex-col items-center">
                      <FileText className="h-10 w-10 text-primary mb-2" />
                      <span className="font-medium text-primary">{file.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        Click to change file
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">
                        Click to upload CMS-1500 PDF
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        PDF files only
                      </span>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Manual Entry Tab */}
              <TabsContent value="manual" className="space-y-4">
                {/* Patient Name */}
                <div className="space-y-2">
                  <Label>Patient Name (optional)</Label>
                  <Input
                    placeholder="John Smith"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                  />
                </div>


                {/* Procedures */}
                <div className="space-y-2">
                  <Label>Procedures (CPT Codes)</Label>
                  <div className="space-y-2">

                    {procedures.map((proc, index) => (
                      <div key={index} className="flex gap-2 items-center">

                        <Input
                          placeholder="CPT Code"
                          value={proc.cpt_code}
                          onChange={(e) => updateProcedure(index, 'cpt_code', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          placeholder="Units"
                          value={proc.units}
                          onChange={(e) => updateProcedure(index, 'units', parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <Input
                          placeholder="Modifiers"
                          value={proc.modifiers}
                          onChange={(e) => updateProcedure(index, 'modifiers', e.target.value)}
                          className="w-28"
                        />
                        {procedures.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProcedure(index)}
                            className="shrink-0"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                    ))}
                  </div>

                  <Button variant="outline" size="sm" onClick={addProcedure}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Procedure
                  </Button>
                </div>


                {/* ICD Codes */}
                <div className="space-y-2">
                  <Label>Diagnosis Codes (comma separated)</Label>
                  <Input
                    placeholder="R55, R00.2, I10"
                    value={icdCodes}
                    onChange={(e) => setIcdCodes(e.target.value)}
                  />
                </div>


                {/* Payer */}
                <div className="space-y-2">
                  <Label>Payer</Label>
                  <Select value={payer} onValueChange={setPayer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payer" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_PAYERS.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* Batch Scrub Tab */}
              <TabsContent value="batch" className="space-y-4">
                {batchResults.length > 0 ? (
                  // Show batch results
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">Batch Results</p>
                      <Button variant="outline" size="sm" onClick={() => setBatchResults([])}>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        New Batch
                      </Button>
                    </div>
                    <ScrollArea className="h-[280px]">
                      <div className="space-y-2">
                        {batchResults.map((result, idx) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {!result.success ? <XCircle className="h-5 w-5 text-destructive" /> :
                                 result.risk_level === 'critical' ? <XCircle className="h-5 w-5 text-red-600" /> :
                                 result.risk_level === 'high' ? <AlertCircle className="h-5 w-5 text-orange-500" /> :
                                 result.risk_level === 'medium' ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> :
                                 <CheckCircle2 className="h-5 w-5 text-green-600" />}
                                <div>
                                  <p className="font-medium text-sm">
                                    {result.claim?.patient_name || 'Unknown Patient'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {result.claim?.payer || 'Unknown Payer'}
                                  </p>
                                </div>
                              </div>
                              {result.success ? (
                                <div className="text-right">
                                  <Badge className={`${
                                    result.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                                    result.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                                    result.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {result.denial_risk_score}%
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {result.total_issues} issues
                                  </p>
                                </div>
                              ) : (
                                <Badge variant="destructive">Failed</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                    
                    {/* Batch Summary */}
                    <div className="grid grid-cols-4 gap-2 text-center bg-muted/50 rounded-lg p-3">
                      <div>
                        <p className="text-lg font-bold">{batchResults.length}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-600">
                          {batchResults.filter(r => r.success && r.risk_level === 'low').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Clean</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-orange-600">
                          {batchResults.filter(r => r.success && (r.risk_level === 'high' || r.risk_level === 'critical')).length}
                        </p>
                        <p className="text-xs text-muted-foreground">High Risk</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-red-600">
                          {batchResults.filter(r => !r.success).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                    </div>
                  </div>
                ) : isBatchProcessing ? (
                  // Show progress
                  <div className="text-center py-12 space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
                    <p className="font-medium">Scrubbing {selectedClaims.length} claims...</p>
                    <div className="max-w-xs mx-auto space-y-2">
                      <Progress value={batchProgress} />
                      <p className="text-sm text-muted-foreground">{batchProgress}% complete</p>
                    </div>
                  </div>
                ) : claimsLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
                  </div>
                ) : userClaims && userClaims.length > 0 ? (
                  // Show claim selection
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          checked={selectedClaims.length === userClaims.length}
                          onCheckedChange={toggleSelectAll}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedClaims.length} of {userClaims.length} selected
                        </span>
                      </div>
                    </div>
                    
                    <ScrollArea className="h-[240px]">
                      <div className="space-y-2">
                        {userClaims.map((claim) => (
                          <div 
                            key={claim.id}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                              selectedClaims.includes(claim.id) ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                            onClick={() => toggleClaimSelection(claim.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={selectedClaims.includes(claim.id)}
                                onCheckedChange={() => toggleClaimSelection(claim.id)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {claim.patient_name || 'Unknown Patient'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {claim.payer || 'Unknown Payer'} • {
                                    Array.isArray(claim.procedure_codes) 
                                      ? claim.procedure_codes.join(', ')
                                      : claim.procedure_codes || 'No CPT'
                                  }
                                </p>
                              </div>
                              <div>
                                <Badge variant="outline" className="text-xs">
                                  {claim.status || 'pending'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>

                    <Button 
                      className="w-full" 
                      onClick={handleBatchScrub}
                      disabled={selectedClaims.length === 0}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Scrub {selectedClaims.length} Claim{selectedClaims.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No claims found</p>
                    <p className="text-sm">Add claims first, then come back to batch scrub</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Scrub Button - only show for upload/manual tabs */}
            {activeTab !== 'batch' && (
              <Button
                className="w-full mt-6"
                size="lg"
                onClick={handleScrub}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Scrubbing Claim...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Scrub Claim
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Right Column - Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Scrub Results
            </CardTitle>
            <CardDescription>Issues detected & recommended corrections</CardDescription>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-12">
                <TrendingDown className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-medium text-muted-foreground">No results yet</p>
                <p className="text-sm text-muted-foreground/60">Upload or enter a claim to see scrub results</p>
              </div>

            ) : (
              <div className="space-y-6">

                {/* Risk Score Card */}
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Denial Risk Score</p>
                  <p className={`text-5xl font-bold ${getRiskColor(result.denial_risk_score)}`}>
                    {result.denial_risk_score}%
                  </p>

                  <Badge className={`mt-3 ${getRiskBg(result.risk_level)}`}>
                    {result.risk_level.toUpperCase()} RISK
                  </Badge>
                </div>


                {/* Issue Counts */}
                <div className="grid grid-cols-4 gap-2 text-center">

                  <div className="bg-red-50 rounded p-2">
                    <p className="text-2xl font-bold text-red-600">{result.critical_count}</p>
                    <p className="text-xs text-red-600/80">Critical</p>
                  </div>

                  <div className="bg-orange-50 rounded p-2">
                    <p className="text-2xl font-bold text-orange-500">{result.high_count}</p>
                    <p className="text-xs text-orange-500/80">High</p>
                  </div>

                  <div className="bg-yellow-50 rounded p-2">
                    <p className="text-2xl font-bold text-yellow-600">{result.medium_count}</p>
                    <p className="text-xs text-yellow-600/80">Medium</p>
                  </div>

                  <div className="bg-blue-50 rounded p-2">
                    <p className="text-2xl font-bold text-blue-500">{result.low_count}</p>
                    <p className="text-xs text-blue-500/80">Low</p>
                  </div>

                </div>


                {/* Issues List */}
                {result.all_issues.length > 0 ? (
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">

                      {result.all_issues.map((issue, index) => {
                        const issueId = `${issue.type}-${index}`;
                        const isExpanded = expandedIssues.includes(issueId);
                        
                        return (
                          <Collapsible key={issueId} open={isExpanded} onOpenChange={() => toggleIssue(issueId)}>
                            <div className={`border rounded-lg p-3 ${getSeverityColors(issue.severity)}`}>
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between">

                                  <div className="flex items-center gap-3">
                                    {getSeverityIcon(issue.severity)}
                                    <div className="text-left">
                                      <p className="font-medium text-sm">
                                        {issue.code || issue.code_pair?.join(' + ') || 'General'}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {issue.type.replace(/_/g, ' ')}
                                      </p>
                                    </div>

                                  </div>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <p className="text-sm mt-3 pt-3 border-t">{issue.message}</p>
                                {issue.correction && (
                                  <div className="mt-2 p-2 bg-background/50 rounded text-sm">
                                    <div className="flex items-start gap-2">
                                      <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                      <p>
                                        <span className="font-medium">Recommended Fix: </span>
                                        {issue.correction}
                                      </p>
                                    </div>

                                  </div>

                                )}
                              </CollapsibleContent>
                            </div>

                          </Collapsible>
                        );
                      })}
                    </div>

                  </ScrollArea>
                ) : (
                  <div className="text-center py-6 bg-green-50 rounded-lg">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-700">All Checks Passed!</p>
                    <p className="text-sm text-green-600">Claim is ready to submit</p>
                  </div>

                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={exportReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export Report
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    New Scrub
                  </Button>
                </div>

              </div>

            )}
          </CardContent>
        </Card>
      </div>

    </div>

  );
}
