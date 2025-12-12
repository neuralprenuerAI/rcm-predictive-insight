import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle } from "lucide-react";

interface ECWTokenDisplayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenData: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  } | null;
}

export default function ECWTokenDisplay({ open, onOpenChange, tokenData }: ECWTokenDisplayProps) {
  if (!tokenData) return null;

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const formatExpiresIn = () => {
    if (tokenData.expires_in >= 60) {
      const minutes = Math.floor(tokenData.expires_in / 60);
      return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `in ${tokenData.expires_in} seconds`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="text-center py-4">
          <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-green-700 dark:text-green-400">
            Connected Successfully!
          </DialogTitle>
          <p className="text-muted-foreground mt-2">ECW FHIR connection is working</p>
        </div>

        <div className="bg-muted rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <span className="text-green-600 dark:text-green-400 font-medium">Active ✓</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Token Type</span>
            <span className="font-mono text-sm">{tokenData.token_type}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground">Scope</span>
            <span className="font-mono text-sm text-right max-w-[200px]">{tokenData.scope}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Expires</span>
            <span className="text-sm">
              {formatExpiresIn()} ({expiresAt.toLocaleTimeString()})
            </span>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
