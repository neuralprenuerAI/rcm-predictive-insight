import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock } from "lucide-react";

interface IdleTimeoutWarningProps {
  open: boolean;
  onStayActive: () => void;
  onLogout: () => void;
}

export function IdleTimeoutWarning({ open, onStayActive, onLogout }: IdleTimeoutWarningProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-destructive" />
            Session Timeout Warning
          </AlertDialogTitle>
          <AlertDialogDescription>
            You will be logged out in <strong>1 minute</strong> due to inactivity.
            Click "Stay Logged In" to continue your session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onLogout}>Log Out Now</AlertDialogCancel>
          <AlertDialogAction onClick={onStayActive}>Stay Logged In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
