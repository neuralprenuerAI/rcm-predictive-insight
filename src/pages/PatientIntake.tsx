import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";
import { findEcwConnectionByScope } from "@/lib/ecwConnectionResolver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, User, FileText, CheckCircle, AlertCircle, Send, UserPlus, ArrowLeft, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import Sidebar from "@/components/Sidebar";
import { useNavigate } from "react-router-dom";

interface ExtractedPatient {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  prefix: string | null;
  suffix: string | null;
  dateOfBirth: string | null;
  gender: "male" | "female" | "other" | "unknown" | null;
  ssn: string | null;
  maritalStatus: string | null;
  email: string | null;
  phoneHome: string | null;
  phoneWork: string | null;
  phoneMobile: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  insuranceName: string | null;
  insurancePolicyNumber: string | null;
  insuranceGroupNumber: string | null;
  insuranceSubscriberId: string | null;
  insuranceSubscriberName: string | null;
  insuranceSubscriberDob: string | null;
  insuranceRelationship: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelationship: string | null;
  preferredLanguage: string | null;
  race: string | null;
  ethnicity: string | null;
  confidence: number;
  extractedFields: string[];
  rawText: string;
}

interface EcwConnection {
  id: string;
  name: string | null;
  connection_name: string;
}

type ProcessingStep = "idle" | "uploading" | "ocr" | "extracting" | "review" | "saving" | "syncing" | "complete" | "error";

export default function PatientIntake() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [documentType, setDocumentType] = useState("patient_intake");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  
  const [patientData, setPatientData] = useState<ExtractedPatient | null>(null);
  const [editedData, setEditedData] = useState<Partial<ExtractedPatient>>({});
  
  const [saveToLocal, setSaveToLocal] = useState(true);
  const [syncToEcw, setSyncToEcw] = useState(false);
  const [isNewPatient, setIsNewPatient] = useState(true);
  const [ecwConnectionId, setEcwConnectionId] = useState<string | null>(null);
  
  const [ecwConnections, setEcwConnections] = useState<EcwConnection[]>([]);
  const [isTestingEcw, setIsTestingEcw] = useState(false);

  useEffect(() => {
    loadEcwConnections();
  }, []);

  async function loadEcwConnections() {
    // Get current user first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from("api_connections")
      .select("id, name, connection_name")
      .eq("connection_type", "ecw")
      .eq("user_id", user.id)  // Only load current user's connections
      .eq("is_active", true);
    
    if (data && data.length > 0) {
      setEcwConnections(data);
      setEcwConnectionId(data[0].id);
    }
  }

  // Test function for ECW Patient Create
  async function testEcwCreate() {
    if (!ecwConnectionId) {
      toast({
        title: "No ECW Connection",
        description: "Please configure an ECW connection first",
        variant: "destructive"
      });
      return;
    }

    setIsTestingEcw(true);
    
    try {
      const testAccountNumber = `TEST${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      
      console.log("🧪 Testing ECW Patient Create...");
      console.log("📋 Connection ID:", ecwConnectionId);
      console.log("🔢 Account Number:", testAccountNumber);
      
      const response = await awsApi.invoke("ecw-patient-create", {
        body: {
          connectionId: ecwConnectionId,
          accountNumber: testAccountNumber,
          data: {
            firstName: "Test",
            middleName: "ECW",
            lastName: "Integration",
            birthDate: "1990-05-15",
            gender: "male",
            homePhone: "5551234567",
            mobilePhone: "5559876543",
            email: "test.integration@example.com",
            addressLine1: "123 Test Street",
            addressLine2: "Suite 100",
            city: "Houston",
            state: "TX",
            postalCode: "77001",
            country: "US",
            maritalStatus: "single",
            preferredLanguage: "en",
            emergencyContactName: "Emergency Contact",
            emergencyContactPhone: "5551112222"
          }
        }
      });

      console.log("📨 ECW Response:", response);
      
      if (response.error) {
        console.error("❌ ECW Error:", response.error);
        toast({
          title: "ECW Test Failed",
          description: response.error.message || JSON.stringify(response.error),
          variant: "destructive"
        });
      } else if (response.data?.success) {
        console.log("✅ ECW Success! Patient ID:", response.data.ecwPatientId);
        toast({
          title: "ECW Test Successful! 🎉",
          description: `Patient created with ECW ID: ${response.data.ecwPatientId || response.data.accountNumber}`,
        });
      } else {
        console.warn("⚠️ ECW Response:", response.data);
        toast({
          title: "ECW Test Result",
          description: response.data?.error || JSON.stringify(response.data),
          variant: "destructive"
        });
      }
      
      return response;
    } catch (err: unknown) {
      console.error("❌ ECW Test Error:", err);
      toast({
        title: "ECW Test Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsTestingEcw(false);
    }
  }

  // Helper to detect OXPS/XPS files
  const isOxpsFile = (file: File): boolean => {
    const filename = file.name.toLowerCase();
    return filename.endsWith('.oxps') || 
           filename.endsWith('.xps') ||
           file.type === 'application/oxps' ||
           file.type === 'application/vnd.ms-xpsdocument';
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setError(null);
    setStep("uploading");
    setProgress(10);

    try {
      let base64 = await fileToBase64(file);
      let mimeType = file.type || 'application/pdf';
      let filename = file.name;
      setProgress(15);

      // Check if OXPS/XPS file - convert to PDF via CloudConvert
      if (isOxpsFile(file)) {
        console.log("[PatientIntake] Converting OXPS file to PDF via CloudConvert...");
        setProgress(20);
        
        const convertResponse = await awsApi.invoke("convert-oxps", {
          body: {
            content: base64,
            filename: file.name
          }
        });

        if (convertResponse.error || !convertResponse.data?.success) {
          throw new Error("Failed to convert OXPS file: " + 
            (convertResponse.data?.error || convertResponse.error?.message || "Unknown error"));
        }

        console.log(`[PatientIntake] OXPS converted to PDF successfully`);
        base64 = convertResponse.data.content;
        mimeType = convertResponse.data.mimeType;  // "application/pdf"
        filename = convertResponse.data.convertedFilename;
      }

      setProgress(25);

      setStep("ocr");
      setProgress(30);
      
      // === OCR REQUEST DEBUG ===
      console.log("=== OCR REQUEST DEBUG ===");
      console.log("Filename being sent:", filename);
      console.log("MimeType being sent:", mimeType);
      console.log("Content length:", base64.length);
      console.log("First 50 chars:", base64.substring(0, 50));
      // Check if content looks like valid base64 PDF
      if (base64.startsWith("JVBERi")) {
        console.log("✅ Content starts with PDF header (JVBERi = %PDF)");
      } else {
        console.log("❌ Content does NOT start with PDF header. First chars:", base64.substring(0, 20));
      }
      console.log("=== END DEBUG ===");

      const ocrResponse = await awsApi.invoke("ocr-document", {
        body: {
          content: base64,
          filename: filename,
          mimeType: mimeType,
          provider: "aws"
        }
      });

      if (ocrResponse.error || !ocrResponse.data?.success) {
        throw new Error(ocrResponse.data?.error || "OCR failed");
      }

      const extractedText = ocrResponse.data.ocr.text;
      setOcrText(extractedText);
      setProgress(50);

      setStep("extracting");
      setProgress(60);

      const extractResponse = await awsApi.invoke("extract-patient-from-document", {
        body: {
          ocrText: extractedText,
          documentType: documentType
        }
      });

      if (extractResponse.error || !extractResponse.data?.success) {
        throw new Error(extractResponse.data?.error || "Extraction failed");
      }

      setPatientData(extractResponse.data.patient);
      setEditedData(extractResponse.data.patient);
      setProgress(100);
      setStep("review");

      toast({
        title: "Document Processed",
        description: `Extracted ${extractResponse.data.patient.extractedFields.length} fields with ${Math.round(extractResponse.data.patient.confidence * 100)}% confidence`,
      });

    } catch (err: unknown) {
      console.error("Processing error:", err);
      const message = err instanceof Error ? err.message : "Failed to process document";
      setError(message);
      setStep("error");
      toast({
        title: "Processing Failed",
        description: message,
        variant: "destructive"
      });
    }
  }, [documentType, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".tif"],
      "application/oxps": [".oxps"],
      "application/vnd.ms-xpsdocument": [".xps", ".oxps"]
    },
    maxFiles: 1,
    disabled: step !== "idle" && step !== "error" && step !== "complete"
  });

  const handleFieldChange = (field: keyof ExtractedPatient, value: string | null) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  async function handleSave() {
    if (!editedData.firstName || !editedData.lastName) {
      toast({
        title: "Required Fields Missing",
        description: "First name and last name are required",
        variant: "destructive"
      });
      return;
    }

    setStep("saving");
    setProgress(10);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to save patients");
      }

      let localPatientId: string | null = null;

      if (saveToLocal) {
        const patientRecord = {
          user_id: user.id,
          first_name: editedData.firstName,
          last_name: editedData.lastName,
          middle_name: editedData.middleName || null,
          prefix: editedData.prefix || null,
          suffix: editedData.suffix || null,
          date_of_birth: editedData.dateOfBirth || null,
          gender: editedData.gender || null,
          email: editedData.email || null,
          phone: editedData.phoneMobile || editedData.phoneHome || null,
          address_line1: editedData.addressLine1 || null,
          address_line2: editedData.addressLine2 || null,
          city: editedData.city || null,
          state: editedData.state || null,
          postal_code: editedData.postalCode || null,
          source: "document_intake",
          insurance_info: {
            name: editedData.insuranceName,
            policyNumber: editedData.insurancePolicyNumber,
            groupNumber: editedData.insuranceGroupNumber,
            subscriberId: editedData.insuranceSubscriberId,
            subscriberName: editedData.insuranceSubscriberName,
            subscriberDob: editedData.insuranceSubscriberDob,
            relationship: editedData.insuranceRelationship
          }
        };

        const result = await awsCrud.insert("patients", patientRecord, user.id);
        localPatientId = result.data?.id || result.data?.[0]?.id;

        setProgress(50);
      }

      if (syncToEcw) {
        setStep("syncing");
        setProgress(60);

        // Auto-resolve the correct ECW connection based on action
        const requiredScope = isNewPatient ? "Patient.create" : "Patient.update";
        const resolvedEcwId = ecwConnectionId || await findEcwConnectionByScope(requiredScope as any);
        
        if (!resolvedEcwId) {
          throw new Error(`No ECW connection found with ${requiredScope} scope. Please create one in Connections.`);
        }

        // Generate a unique account number for ECW patient matching
        const accountNumber = `DOC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
        const ecwFunction = isNewPatient ? "ecw-patient-create" : "ecw-patient-update";
        
        const ecwResponse = await awsApi.invoke(ecwFunction, {
          body: {
            connectionId: resolvedEcwId,
            accountNumber: accountNumber,
            patientLocalId: localPatientId,
            patientExternalId: isNewPatient ? undefined : localPatientId,
            data: {
              firstName: editedData.firstName,
              middleName: editedData.middleName,
              lastName: editedData.lastName,
              prefix: editedData.prefix,
              suffix: editedData.suffix,
              birthDate: editedData.dateOfBirth,  // Edge function expects birthDate
              gender: editedData.gender || "unknown",
              email: editedData.email,
              homePhone: editedData.phoneHome,    // Edge function expects homePhone
              workPhone: editedData.phoneWork,    // Edge function expects workPhone
              mobilePhone: editedData.phoneMobile, // Edge function expects mobilePhone
              addressLine1: editedData.addressLine1,
              addressLine2: editedData.addressLine2,
              city: editedData.city,
              state: editedData.state,
              postalCode: editedData.postalCode,
              country: editedData.country || "US",
              maritalStatus: editedData.maritalStatus,
              emergencyContactName: editedData.emergencyContactName,
              emergencyContactPhone: editedData.emergencyContactPhone,
              emergencyContactRelationship: editedData.emergencyContactRelationship
            }
          }
        });

        if (ecwResponse.error || !ecwResponse.data?.success) {
          console.warn("ECW sync failed:", ecwResponse.data?.error);
          toast({
            title: "ECW Sync Warning",
            description: ecwResponse.data?.error || "Failed to sync to ECW, but local save succeeded",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Synced to ECW",
            description: `Patient ${isNewPatient ? "created" : "updated"} in eClinicalWorks`,
          });
        }
      }

      setProgress(100);
      setStep("complete");

      toast({
        title: isNewPatient ? "Patient Created" : "Patient Updated",
        description: `${editedData.firstName} ${editedData.lastName} has been saved`,
      });

    } catch (err: unknown) {
      console.error("Save error:", err);
      const message = err instanceof Error ? err.message : "Failed to save patient";
      setError(message);
      setStep("error");
      toast({
        title: "Save Failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  function handleReset() {
    setStep("idle");
    setProgress(0);
    setError(null);
    setUploadedFile(null);
    setOcrText("");
    setPatientData(null);
    setEditedData({});
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderProgress() {
    const steps = [
      { key: "uploading", label: "Uploading" },
      { key: "ocr", label: "OCR Processing" },
      { key: "extracting", label: "Extracting Data" },
      { key: "review", label: "Review" },
      { key: "saving", label: "Saving" },
      { key: "syncing", label: "Syncing to ECW" },
      { key: "complete", label: "Complete" }
    ];

    const currentIndex = steps.findIndex(s => s.key === step);

    return (
      <div className="mb-6">
        <Progress value={progress} className="h-2 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          {steps.map((s, idx) => (
            <span
              key={s.key}
              className={idx <= currentIndex ? "text-primary font-medium" : ""}
            >
              {s.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView="patient-intake" onViewChange={() => {}} />
      
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <UserPlus className="h-6 w-6" />
                  Patient Intake
                </h1>
                <p className="text-muted-foreground">
                  Upload documents to automatically extract and create patient records
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ecwConnections.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={testEcwCreate}
                  disabled={isTestingEcw}
                  className="bg-accent/50 border-primary/30 hover:bg-accent"
                >
                  {isTestingEcw ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FlaskConical className="h-4 w-4 mr-2" />
                  )}
                  Test ECW Create
                </Button>
              )}
              {step !== "idle" && (
                <Button variant="outline" onClick={handleReset}>
                  Start Over
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {step !== "idle" && step !== "error" && renderProgress()}

          {/* Error display */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  {error}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Upload */}
          {(step === "idle" || step === "error") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Document
                </CardTitle>
                <CardDescription>
                  Upload a patient intake form, insurance card, or other document
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Document Type</Label>
                  <Select value={documentType} onValueChange={setDocumentType}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient_intake">Patient Intake Form</SelectItem>
                      <SelectItem value="insurance_card">Insurance Card</SelectItem>
                      <SelectItem value="cms1500">CMS-1500 Claim</SelectItem>
                      <SelectItem value="drivers_license">Driver's License / ID</SelectItem>
                      <SelectItem value="unknown">Other Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  {isDragActive ? (
                    <p className="text-lg">Drop the file here...</p>
                  ) : (
                    <div>
                      <p className="text-lg mb-1">Drag & drop a file here</p>
                      <p className="text-muted-foreground">or click to select</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Supports: PDF, PNG, JPG, TIFF
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing indicator */}
          {(step === "uploading" || step === "ocr" || step === "extracting") && (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-medium">
                      {step === "uploading" && "Uploading document..."}
                      {step === "ocr" && "Extracting text with AWS Textract..."}
                      {step === "extracting" && "Analyzing document with AI..."}
                    </p>
                    <p className="text-muted-foreground">
                      {uploadedFile?.name}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Review & Edit */}
          {(step === "review" || step === "saving" || step === "syncing") && patientData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Review Patient Information
                </CardTitle>
                <CardDescription>
                  <div className="flex items-center gap-2">
                    <Badge variant={patientData.confidence > 0.8 ? "default" : "secondary"}>
                      {Math.round(patientData.confidence * 100)}% Confidence
                    </Badge>
                    {patientData.extractedFields.length} fields extracted
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="demographics" className="space-y-6">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="demographics">Demographics</TabsTrigger>
                    <TabsTrigger value="contact">Contact</TabsTrigger>
                    <TabsTrigger value="insurance">Insurance</TabsTrigger>
                    <TabsTrigger value="other">Other</TabsTrigger>
                  </TabsList>

                  {/* Demographics Tab */}
                  <TabsContent value="demographics" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>First Name *</Label>
                        <Input
                          value={editedData.firstName || ""}
                          onChange={(e) => handleFieldChange("firstName", e.target.value)}
                          className={patientData.extractedFields.includes("firstName") ? "border-green-500" : ""}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Middle Name</Label>
                        <Input
                          value={editedData.middleName || ""}
                          onChange={(e) => handleFieldChange("middleName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name *</Label>
                        <Input
                          value={editedData.lastName || ""}
                          onChange={(e) => handleFieldChange("lastName", e.target.value)}
                          className={patientData.extractedFields.includes("lastName") ? "border-green-500" : ""}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Date of Birth</Label>
                        <Input
                          type="date"
                          value={editedData.dateOfBirth || ""}
                          onChange={(e) => handleFieldChange("dateOfBirth", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select
                          value={editedData.gender || "none"}
                          onValueChange={(v) => handleFieldChange("gender", v === "none" ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>SSN (Last 4)</Label>
                        <Input
                          value={editedData.ssn || ""}
                          onChange={(e) => handleFieldChange("ssn", e.target.value)}
                          maxLength={4}
                          placeholder="****"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Marital Status</Label>
                        <Select
                          value={editedData.maritalStatus || "none"}
                          onValueChange={(v) => handleFieldChange("maritalStatus", v === "none" ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Contact Tab */}
                  <TabsContent value="contact" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Home Phone</Label>
                        <Input
                          value={editedData.phoneHome || ""}
                          onChange={(e) => handleFieldChange("phoneHome", e.target.value)}
                          placeholder="5551234567"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Work Phone</Label>
                        <Input
                          value={editedData.phoneWork || ""}
                          onChange={(e) => handleFieldChange("phoneWork", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Mobile Phone</Label>
                        <Input
                          value={editedData.phoneMobile || ""}
                          onChange={(e) => handleFieldChange("phoneMobile", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={editedData.email || ""}
                        onChange={(e) => handleFieldChange("email", e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Address Line 1</Label>
                        <Input
                          value={editedData.addressLine1 || ""}
                          onChange={(e) => handleFieldChange("addressLine1", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Address Line 2</Label>
                        <Input
                          value={editedData.addressLine2 || ""}
                          onChange={(e) => handleFieldChange("addressLine2", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input
                          value={editedData.city || ""}
                          onChange={(e) => handleFieldChange("city", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>State</Label>
                        <Input
                          value={editedData.state || ""}
                          onChange={(e) => handleFieldChange("state", e.target.value)}
                          maxLength={2}
                          placeholder="TX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>ZIP Code</Label>
                        <Input
                          value={editedData.postalCode || ""}
                          onChange={(e) => handleFieldChange("postalCode", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Input
                          value={editedData.country || "US"}
                          onChange={(e) => handleFieldChange("country", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-medium mb-3">Emergency Contact</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={editedData.emergencyContactName || ""}
                            onChange={(e) => handleFieldChange("emergencyContactName", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone</Label>
                          <Input
                            value={editedData.emergencyContactPhone || ""}
                            onChange={(e) => handleFieldChange("emergencyContactPhone", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Relationship</Label>
                          <Input
                            value={editedData.emergencyContactRelationship || ""}
                            onChange={(e) => handleFieldChange("emergencyContactRelationship", e.target.value)}
                            placeholder="Spouse, Parent, etc."
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Insurance Tab */}
                  <TabsContent value="insurance" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Insurance Name</Label>
                        <Input
                          value={editedData.insuranceName || ""}
                          onChange={(e) => handleFieldChange("insuranceName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Policy Number</Label>
                        <Input
                          value={editedData.insurancePolicyNumber || ""}
                          onChange={(e) => handleFieldChange("insurancePolicyNumber", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Group Number</Label>
                        <Input
                          value={editedData.insuranceGroupNumber || ""}
                          onChange={(e) => handleFieldChange("insuranceGroupNumber", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subscriber ID</Label>
                        <Input
                          value={editedData.insuranceSubscriberId || ""}
                          onChange={(e) => handleFieldChange("insuranceSubscriberId", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Subscriber Name</Label>
                        <Input
                          value={editedData.insuranceSubscriberName || ""}
                          onChange={(e) => handleFieldChange("insuranceSubscriberName", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subscriber DOB</Label>
                        <Input
                          type="date"
                          value={editedData.insuranceSubscriberDob || ""}
                          onChange={(e) => handleFieldChange("insuranceSubscriberDob", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Relationship to Subscriber</Label>
                        <Select
                          value={editedData.insuranceRelationship || "none"}
                          onValueChange={(v) => handleFieldChange("insuranceRelationship", v === "none" ? null : v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select relationship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Not specified</SelectItem>
                            <SelectItem value="self">Self</SelectItem>
                            <SelectItem value="spouse">Spouse</SelectItem>
                            <SelectItem value="child">Child</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Other Tab */}
                  <TabsContent value="other" className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Preferred Language</Label>
                        <Input
                          value={editedData.preferredLanguage || ""}
                          onChange={(e) => handleFieldChange("preferredLanguage", e.target.value)}
                          placeholder="English"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Race</Label>
                        <Input
                          value={editedData.race || ""}
                          onChange={(e) => handleFieldChange("race", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Ethnicity</Label>
                        <Input
                          value={editedData.ethnicity || ""}
                          onChange={(e) => handleFieldChange("ethnicity", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Raw OCR Text */}
                    <div className="space-y-2">
                      <Label>Raw OCR Text (Reference)</Label>
                      <Textarea
                        value={ocrText}
                        readOnly
                        className="h-40 font-mono text-xs"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Save Options */}
                <div className="border-t pt-6 mt-6 space-y-4">
                  <h4 className="font-medium">Save Options</h4>
                  
                  <div className="flex items-center gap-6">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="saveLocal"
                        checked={saveToLocal}
                        onCheckedChange={(c) => setSaveToLocal(c === true)}
                      />
                      <Label htmlFor="saveLocal">Save to local database</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="syncEcw"
                        checked={syncToEcw}
                        onCheckedChange={(c) => setSyncToEcw(c === true)}
                        disabled={ecwConnections.length === 0}
                      />
                      <Label htmlFor="syncEcw">
                        Sync to ECW
                        {ecwConnections.length === 0 && " (No connection configured)"}
                      </Label>
                    </div>
                  </div>

                  {syncToEcw && ecwConnections.length > 0 && (
                    <div className="pl-6">
                      <Label>ECW Connection</Label>
                      <Select value={ecwConnectionId || ""} onValueChange={setEcwConnectionId}>
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ecwConnections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id}>
                              {conn.name || conn.connection_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="newPatient"
                      checked={isNewPatient}
                      onCheckedChange={(c) => setIsNewPatient(c === true)}
                    />
                    <Label htmlFor="newPatient">Create as new patient</Label>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={step === "saving" || step === "syncing"}
                      className="w-40"
                    >
                      {(step === "saving" || step === "syncing") ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {step === "syncing" ? "Syncing..." : "Saving..."}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Save Patient
                        </>
                      )}
                    </Button>

                    {syncToEcw && (
                      <Button variant="outline" disabled>
                        <Send className="mr-2 h-4 w-4" />
                        Will sync to ECW
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Complete */}
          {step === "complete" && (
            <Card className="border-primary">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <CheckCircle className="h-12 w-12 text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-medium">Patient Saved Successfully!</p>
                    <p className="text-muted-foreground">
                      {editedData.firstName} {editedData.lastName}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Button onClick={handleReset}>
                      Process Another Document
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/")}>
                      View All Patients
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
