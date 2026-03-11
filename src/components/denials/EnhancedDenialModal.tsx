import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, FileText, FileImage, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { useToast } from "@/hooks/use-toast";

const FILE_TAGS = ["Denial / EOB", "Clinical Notes", "Original Claim"] as const;
type FileTag = typeof FILE_TAGS[number];

const DEFAULT_TAG_ORDER: FileTag[] = ["Denial / EOB", "Clinical Notes", "Original Claim"];

interface TaggedFile {
  file: File;
  tag: FileTag;
}

interface EnhancedDenialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  classifyDenial: (claim: any, checkDate: string, payerName: string) => Promise<any>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  return <FileImage className="h-5 w-5 text-blue-500 shrink-0" />;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EnhancedDenialModal({
  open,
  onOpenChange,
  onImportComplete,
  classifyDenial,
}: EnhancedDenialModalProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<TaggedFile[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState("");

  const onDrop = useCallback((accepted: File[]) => {
    setFiles(prev => {
      const next = [...prev];
      accepted.forEach((file, i) => {
        const idx = next.length + i;
        const tag = DEFAULT_TAG_ORDER[idx] || "Original Claim";
        next.push({ file, tag });
      });
      return next;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    multiple: true,
  });

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const updateTag = (idx: number, tag: FileTag) => {
    setFiles(prev => prev.map((f, i) => (i === idx ? { ...f, tag } : f)));
  };

  const hasEob = files.some(f => f.tag === "Denial / EOB");

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setStatusText("Preparing files...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build payload
      const eobFile = files.find(f => f.tag === "Denial / EOB");
      const clinicalFile = files.find(f => f.tag === "Clinical Notes");
      const claimFile = files.find(f => f.tag === "Original Claim");

      const [denialB64, clinicalB64, claimB64] = await Promise.all([
        eobFile ? fileToBase64(eobFile.file) : Promise.resolve(null),
        clinicalFile ? fileToBase64(clinicalFile.file) : Promise.resolve(null),
        claimFile ? fileToBase64(claimFile.file) : Promise.resolve(null),
      ]);

      setStatusText("Submitting for analysis...");

      const { data: submitRes, error: submitErr } = await awsApi.invoke("analyze-denial-enhanced", {
        body: {
          user_id: user.id,
          denial_file: denialB64,
          denial_file_name: eobFile!.file.name,
          clinical_file: clinicalB64 || null,
          clinical_file_name: clinicalFile?.file.name || null,
          claim_file: claimB64 || null,
          claim_file_name: claimFile?.file.name || null,
        },
      });

      if (submitErr) throw submitErr;

      // If async, poll
      if (submitRes?.async && submitRes?.master_job_id) {
        setStatusText("Analyzing documents... this takes 30–60 seconds");
        const result = await pollForCompletion(user.id, submitRes.master_job_id);
        await processAnalysisResult(result);
      } else if (submitRes?.status === "complete" && submitRes?.result) {
        await processAnalysisResult(submitRes.result);
      } else {
        // Treat the response itself as the result
        await processAnalysisResult(submitRes);
      }

    } catch (err) {
      console.error("Enhanced analysis error:", err);
      toast({
        title: "Analysis Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
      setStatusText("");
    }
  };

  const pollForCompletion = async (userId: string, masterJobId: string): Promise<any> => {
    const maxAttempts = 24; // 24 * 5s = 2 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const { data, error } = await awsApi.invoke("analyze-denial-enhanced", {
        body: { user_id: userId, master_job_id: masterJobId },
      });
      if (error) throw error;
      if (data?.status === "complete" && data?.result) return data.result;
      if (data?.status === "error") throw new Error(data.error || "Analysis failed");
      // Update status text with progress if available
      if (data?.progress) {
        setStatusText(`Analyzing documents... ${data.progress}`);
      }
    }
    throw new Error("Analysis timed out after 2 minutes. Please try again.");
  };

  const processAnalysisResult = async (result: any) => {
    const analysis = result.analysis || result;
    const denials = analysis.denials || [];

    if (!denials.length) {
      toast({
        title: "No Denials Found",
        description: "The analysis did not find any denial data in the uploaded documents.",
        variant: "destructive",
      });
      return;
    }

    setStatusText(`Classifying ${denials.length} denial${denials.length > 1 ? "s" : ""}...`);

    const payerName = analysis.payer?.name || "Unknown Payer";

    const { data: { user } } = await supabase.auth.getUser();

    const classifyResults = await Promise.allSettled(
      denials.map((denial: any) =>
        classifyDenial(
          {
            user_id: user?.id,
            reasonCode: denial.primaryCarcCode,
            reasonDescription: denial.primaryCarcDescription,
            deniedAmount: denial.deniedAmount,
            billedAmount: denial.billedAmount,
            payerName,
            cptCode: denial.serviceLines?.[0]?.cptCode,
            serviceDate: denial.dateOfService,
            fixInstructions: denial.fixInstructions,
            appealSuccessProbability: denial.appealAssessment?.appealSuccessProbability,
            recommendedAction: denial.appealAssessment?.recommendedAction,
            crossReferenceFindings: denial.crossReferenceFindings,
          },
          denial.dateOfService || new Date().toISOString().split("T")[0],
          payerName
        )
      )
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    classifyResults.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const res = r.value;
        if (res.error) {
          errors.push(`Denial ${i + 1}: ${res.error.message}`);
        } else if (res.data?.duplicate || res.data?.conflict) {
          skipped++;
        } else {
          imported++;
        }
      } else {
        errors.push(`Denial ${i + 1}: ${r.reason?.message || "Unknown error"}`);
      }
    });

    if (imported > 0) {
      toast({
        title: "Import Successful",
        description: `Imported ${imported} denial${imported > 1 ? "s" : ""}${skipped ? `, ${skipped} duplicate${skipped > 1 ? "s" : ""}` : ""}`,
      });
      onImportComplete();
    } else if (skipped > 0) {
      toast({ title: "All Duplicates", description: `${skipped} denial(s) already exist` });
    } else if (errors.length > 0) {
      toast({ title: "Import Failed", description: errors[0], variant: "destructive" });
    }

    // Close modal
    handleClose();
  };

  const handleClose = () => {
    if (!analyzing) {
      setFiles([]);
      setStatusText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">Enhanced Denial Analysis</span>
          </DialogTitle>
          <DialogDescription>
            Upload your denial EOB plus any supporting documents. AI will cross-reference everything.
          </DialogDescription>
        </DialogHeader>

        {/* Analyzing state */}
        {analyzing ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground animate-pulse text-center">
              {statusText}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">
                Drop all files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, PNG, JPG — multiple files supported
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((tf, idx) => (
                  <div
                    key={`${tf.file.name}-${idx}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    {getFileIcon(tf.file.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tf.file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(tf.file.size)}</p>
                    </div>
                    <Select value={tf.tag} onValueChange={(v) => updateTag(idx, v as FileTag)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILE_TAGS.map(tag => (
                          <SelectItem key={tag} value={tag} className="text-xs">
                            {tag}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Hint */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>At least one <strong>Denial / EOB</strong> file is required to proceed.</span>
            </div>

            {/* Analyze button */}
            <Button
              className="w-full"
              disabled={!hasEob}
              onClick={handleAnalyze}
            >
              <Upload className="h-4 w-4 mr-2" />
              Analyze Documents
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
