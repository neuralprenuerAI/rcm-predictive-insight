import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Download, X } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { format } from "date-fns";

interface AppealLetterModalProps {
  open: boolean;
  onClose: () => void;
  subjectLine: string;
  letterBody: string;
  appealNumber?: string;
  payerName?: string;
  appealDate?: string;
}

export default function AppealLetterModal({
  open,
  onClose,
  subjectLine,
  letterBody,
  appealNumber,
  payerName,
  appealDate,
}: AppealLetterModalProps) {
  const copyToClipboard = () => {
    const fullText = `${subjectLine}\n\n${letterBody}`;
    navigator.clipboard.writeText(fullText);
    toast.success("Appeal letter copied to clipboard");
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    if (appealNumber) {
      doc.text(`Appeal Number: ${appealNumber}`, margin, 20);
    }
    if (appealDate) {
      doc.text(`Date: ${format(new Date(appealDate), "MMMM d, yyyy")}`, margin, 28);
    }
    if (payerName) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`To: ${payerName}`, margin, 38);
    }

    // Subject
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const subjectLines = doc.splitTextToSize(subjectLine, maxWidth);
    doc.text(subjectLines, margin, 50);

    // Body
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(letterBody, maxWidth);
    let y = 65;
    const lh = 5;

    for (const line of lines) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += lh;
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text(
        `${appealNumber || "Appeal"} - Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    const fileName = `Appeal_${appealNumber || "Letter"}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(fileName);
    toast.success(`Downloaded ${fileName}`);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Header - hidden when printing */}
        <div className="flex items-center justify-between border-b px-6 py-4 print:hidden">
          <h2 className="text-lg font-semibold text-foreground">Appeal Letter</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download as PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Letter Content */}
        <ScrollArea className="max-h-[calc(90vh-8rem)] print:max-h-none print:overflow-visible">
          <div className="px-10 py-8 bg-white text-black print:px-0 print:py-0">
            {/* Subject Line */}
            <h3 className="text-base font-bold mb-6 leading-snug">{subjectLine}</h3>

            {/* Letter Body */}
            <pre className="whitespace-pre-wrap font-[Georgia,_'Times_New_Roman',_serif] text-sm leading-relaxed m-0 p-0">
              {letterBody}
            </pre>
          </div>
        </ScrollArea>

        {/* Footer - hidden when printing */}
        <div className="border-t px-6 py-3 flex justify-end print:hidden">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
