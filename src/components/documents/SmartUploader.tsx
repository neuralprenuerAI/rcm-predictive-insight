import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Brain,
  Link2,
  X,
} from "lucide-react";
import { AIRiskBadge } from "@/components/claims/AIRiskBadge";

interface UploadedFile {
  file: File;
  content: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  result?: any;
  error?: string;
}

interface SmartUploaderProps {
  onComplete?: (results: any) => void;
}

export function SmartUploader({ onComplete }: SmartUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

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

  // Helper to detect OXPS/XPS files
  const isOxpsFile = (file: File): boolean => {
    const filename = file.name.toLowerCase();
    return filename.endsWith('.oxps') || 
           filename.endsWith('.xps') ||
           file.type === 'application/oxps' ||
           file.type === 'application/vnd.ms-xpsdocument';
  };

  // Convert OXPS to PDF via CloudConvert
  const convertOxpsIfNeeded = async (file: File, content: string): Promise<{ content: string; filename: string; mimeType: string }> => {
    if (!isOxpsFile(file)) {
      return { content, filename: file.name, mimeType: file.type || 'application/pdf' };
    }

    console.log(`[SmartUploader] Converting OXPS file via CloudConvert: ${file.name}`);
    
    const convertResponse = await supabase.functions.invoke("convert-oxps", {
      body: {
        content,
        filename: file.name
      }
    });

    if (convertResponse.error || !convertResponse.data?.success) {
      throw new Error("Failed to convert OXPS file: " + 
        (convertResponse.data?.error || convertResponse.error?.message || "Unknown error"));
    }

    console.log(`[SmartUploader] OXPS converted to PDF successfully`);
    
    return {
      content: convertResponse.data.content,
      filename: convertResponse.data.convertedFilename,
      mimeType: convertResponse.data.mimeType  // "application/pdf"
    };
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = [];
    
    for (const file of acceptedFiles) {
      const content = await fileToBase64(file);
      newFiles.push({
        file,
        content,
        status: 'pending',
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff', '.tif'],
      'application/oxps': ['.oxps'],
      'application/vnd.ms-xpsdocument': ['.xps', '.oxps'],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processMutation = useMutation({
    mutationFn: async () => {
      setIsProcessing(true);
      setProgress(10);

      // Convert OXPS files to PDF before processing
      const documents = [];
      for (const f of files) {
        const converted = await convertOxpsIfNeeded(f.file, f.content);
        documents.push({
          content: converted.content,
          filename: converted.filename,
          mimeType: converted.mimeType,
        });
      }
      
      setProgress(25);

      setProgress(30);

      const response = await supabase.functions.invoke('smart-process', {
        body: {
          documents,
          autoLink: true,
          autoReview: true,
        },
      });

      setProgress(90);

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setProgress(100);
      setResults(data);
      setFiles(prev => prev.map(f => ({ ...f, status: 'done' as const })));
      
      toast({
        title: "Processing Complete!",
        description: `${data.processed_count} documents processed, ${data.documents_linked} auto-linked`,
      });
      
      onComplete?.(data);
    },
    onError: (error) => {
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' as const, error: error.message })));
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  const handleProcess = () => {
    if (files.length === 0) return;
    processMutation.mutate();
  };

  const clearAll = () => {
    setFiles([]);
    setResults(null);
    setProgress(0);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop files here...</p>
            ) : (
              <>
                <p className="text-lg font-medium">Drop CMS-1500 claims & clinical documents</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, PNG, JPG, TIFF, OXPS supported • Documents will be auto-linked
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Upload Queue ({files.length} files)
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear All
                </Button>
                <Button 
                  onClick={handleProcess}
                  disabled={isProcessing || files.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Process & Auto-Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isProcessing && (
              <div className="mb-4">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Processing documents... {progress}%
                </p>
              </div>
            )}
            
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{file.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.status === 'pending' && (
                    <span className="text-xs text-muted-foreground">Pending</span>
                  )}
                  {file.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {file.status === 'done' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {file.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {results && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Processing Complete!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">{results.processed_count}</p>
                <p className="text-xs text-muted-foreground">Documents Processed</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold">{results.claims_created}</p>
                <p className="text-xs text-muted-foreground">Claims Created</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold flex items-center justify-center gap-1">
                  <Link2 className="h-5 w-5" />
                  {results.documents_linked}
                </p>
                <p className="text-xs text-muted-foreground">Auto-Linked</p>
              </div>
            </div>

            {results.reviews && results.reviews.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Review Results
                </h4>
                {results.reviews.map((review: any, index: number) => (
                  <div key={index} className="p-3 bg-background rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Claim Review</span>
                      <AIRiskBadge 
                        riskScore={100 - (review.approval_probability || 0)}
                        riskLevel={review.risk_level}
                      />
                    </div>
                    {review.summary && (
                      <p className="text-sm text-muted-foreground">{review.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Processed Documents</h4>
              {results.documents?.map((doc: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{doc.filename}</span>
                    <span className="text-xs px-2 py-0.5 bg-muted rounded">
                      {doc.document_type}
                    </span>
                  </div>
                  {doc.claim_id && (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      Linked to claim
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
