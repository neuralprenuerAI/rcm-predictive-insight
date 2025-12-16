import { SmartUploader } from "@/components/documents/SmartUploader";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function DocumentUpload() {
  const navigate = useNavigate();

  const handleComplete = (results: any) => {
    console.log("Upload complete:", results);
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Smart Document Upload</h1>
        <p className="text-muted-foreground mt-2">
          Upload CMS-1500 claims and supporting documents. The system will automatically
          detect document types, link related files, and run AI analysis.
        </p>
      </div>

      <SmartUploader onComplete={handleComplete} />

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-medium mb-2">How it works:</h3>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">1.</span>
            <span>Upload CMS-1500 claims and progress notes together</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">2.</span>
            <span>System auto-detects: CMS-1500 → creates claim, Progress Note → links to matching claim</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">3.</span>
            <span>Documents are matched by patient name, date of service, and account number</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">4.</span>
            <span>AI automatically reviews claims with linked documents</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
