import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  AlertOctagon,
  Loader2 
} from "lucide-react";

interface AIRiskBadgeProps {
  riskScore?: number | null;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical' | null;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function AIRiskBadge({ 
  riskScore, 
  riskLevel, 
  showScore = true,
  size = 'md',
  isLoading = false
}: AIRiskBadgeProps) {
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyzing...
      </Badge>
    );
  }

  if (!riskLevel && riskScore === undefined) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        Not Reviewed
      </Badge>
    );
  }

  // Calculate risk level from score if not provided
  const calculatedLevel = riskLevel || (
    riskScore !== undefined && riskScore !== null
      ? riskScore <= 25 ? 'low'
        : riskScore <= 50 ? 'medium'
        : riskScore <= 75 ? 'high'
        : 'critical'
      : null
  );

  const config = {
    low: {
      className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
      icon: CheckCircle,
      label: 'Low Risk'
    },
    medium: {
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-200',
      icon: AlertTriangle,
      label: 'Medium Risk'
    },
    high: {
      className: 'bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200',
      icon: AlertOctagon,
      label: 'High Risk'
    },
    critical: {
      className: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-200',
      icon: XCircle,
      label: 'Critical'
    }
  };

  const { className, icon: Icon, label } = config[calculatedLevel || 'low'];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  return (
    <Badge 
      variant="outline" 
      className={`gap-1 ${className} ${sizeClasses[size]}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      {showScore && riskScore !== undefined && riskScore !== null ? (
        <span>{100 - riskScore}% Approval</span>
      ) : (
        <span>{label}</span>
      )}
    </Badge>
  );
}
