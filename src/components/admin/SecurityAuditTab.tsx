import React, { useState } from "react";
import { useRole } from "@/contexts/RoleContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Lock,
  Key,
  Users,
  Database,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Download,
} from "lucide-react";

// Security checklist items with their current status
const SECURITY_CATEGORIES = [
  {
    id: "authentication",
    name: "Authentication & Access Control",
    icon: Lock,
    score: 5,
    maxScore: 10,
    status: "warning" as const,
    items: [
      { id: "auth-1", label: "Unique user identification", status: "complete", required: true },
      { id: "auth-2", label: "Email/password authentication", status: "complete", required: true },
      { id: "auth-3", label: "OAuth integration (Google/GitHub)", status: "complete", required: false },
      { id: "auth-4", label: "Magic link authentication", status: "complete", required: false },
      { id: "auth-5", label: "Invitation-only registration", status: "complete", required: true },
      { id: "auth-6", label: "Leaked password protection", status: "critical", required: true, action: "Enable in Auth settings" },
      { id: "auth-7", label: "Multi-factor authentication (MFA)", status: "critical", required: true, action: "Implement TOTP/SMS MFA" },
      { id: "auth-8", label: "Automatic session timeout (15 min)", status: "critical", required: true, action: "Configure auth timeout" },
      { id: "auth-9", label: "Password complexity requirements (8+ chars)", status: "pending", required: true, action: "Increase minimum to 8" },
      { id: "auth-10", label: "Account lockout after failed attempts", status: "pending", required: false, action: "Implement lockout policy" },
    ],
  },
  {
    id: "authorization",
    name: "Authorization & Role-Based Access",
    icon: Users,
    score: 8,
    maxScore: 10,
    status: "good" as const,
    items: [
      { id: "authz-1", label: "Role-based access control (RBAC)", status: "complete", required: true },
      { id: "authz-2", label: "Super Admin / Admin / User roles", status: "complete", required: true },
      { id: "authz-3", label: "Row Level Security on all tables", status: "complete", required: true },
      { id: "authz-4", label: "User data isolation (user_id)", status: "complete", required: true },
      { id: "authz-5", label: "Admin oversight access", status: "complete", required: true },
      { id: "authz-6", label: "Role management by super_admin only", status: "complete", required: true },
      { id: "authz-7", label: "Organization-level isolation", status: "pending", required: true, action: "Add organization_id to PHI tables" },
      { id: "authz-8", label: "Role change audit logging", status: "pending", required: false, action: "Log all role changes" },
    ],
  },
  {
    id: "encryption",
    name: "Data Encryption",
    icon: Key,
    score: 9,
    maxScore: 10,
    status: "good" as const,
    items: [
      { id: "enc-1", label: "Data at rest encryption (AES-256)", status: "complete", required: true },
      { id: "enc-2", label: "Data in transit encryption (TLS 1.3)", status: "complete", required: true },
      { id: "enc-3", label: "Database connection SSL enforcement", status: "complete", required: true },
      { id: "enc-4", label: "API communication encryption (HTTPS)", status: "complete", required: true },
      { id: "enc-5", label: "File storage encryption", status: "complete", required: true },
      { id: "enc-6", label: "API credentials encrypted storage", status: "warning", required: true, action: "Audit JSONB credential fields" },
    ],
  },
  {
    id: "audit",
    name: "Audit Controls & Logging",
    icon: FileText,
    score: 6,
    maxScore: 10,
    status: "warning" as const,
    items: [
      { id: "audit-1", label: "Activity logging infrastructure", status: "complete", required: true },
      { id: "audit-2", label: "Error logging infrastructure", status: "complete", required: true },
      { id: "audit-3", label: "User login/logout tracking", status: "complete", required: true },
      { id: "audit-4", label: "Admin access logging", status: "complete", required: true },
      { id: "audit-5", label: "PHI access logging", status: "critical", required: true, action: "Log patient record access" },
      { id: "audit-6", label: "6-year log retention", status: "pending", required: true, action: "Configure retention policy" },
      { id: "audit-7", label: "Immutable audit logs", status: "pending", required: true, action: "Move logging to server-side" },
      { id: "audit-8", label: "Error log PHI sanitization", status: "pending", required: true, action: "Remove PHI from error data" },
    ],
  },
  {
    id: "phi",
    name: "PHI Data Handling",
    icon: Database,
    score: 6,
    maxScore: 10,
    status: "warning" as const,
    items: [
      { id: "phi-1", label: "PHI data inventory documented", status: "complete", required: true },
      { id: "phi-2", label: "RLS policies on all PHI tables", status: "complete", required: true },
      { id: "phi-3", label: "User-based data isolation", status: "complete", required: true },
      { id: "phi-4", label: "PHI access tracking", status: "critical", required: true, action: "Implement access logging" },
      { id: "phi-5", label: "Data masking in list views", status: "pending", required: false, action: "Mask SSN, DOB in lists" },
      { id: "phi-6", label: "PHI de-identification in logs", status: "pending", required: true, action: "Sanitize log data" },
    ],
  },
  {
    id: "api",
    name: "API & External Integrations",
    icon: Shield,
    score: 6,
    maxScore: 10,
    status: "warning" as const,
    items: [
      { id: "api-1", label: "OAuth 2.0 with eCW FHIR API", status: "complete", required: true },
      { id: "api-2", label: "JWT-based token authentication", status: "complete", required: true },
      { id: "api-3", label: "Secrets stored securely", status: "complete", required: true },
      { id: "api-4", label: "BAA with Supabase", status: "critical", required: true, action: "Sign BAA with Supabase" },
      { id: "api-5", label: "BAA with AI providers (Gemini)", status: "critical", required: true, action: "Review AI provider compliance" },
      { id: "api-6", label: "API rate limiting", status: "pending", required: false, action: "Add Edge Function throttling" },
    ],
  },
  {
    id: "incident",
    name: "Incident Response",
    icon: AlertTriangle,
    score: 3,
    maxScore: 10,
    status: "critical" as const,
    items: [
      { id: "inc-1", label: "Error monitoring active", status: "complete", required: true },
      { id: "inc-2", label: "Incident response plan documented", status: "critical", required: true, action: "Create IRP document" },
      { id: "inc-3", label: "Breach notification process", status: "critical", required: true, action: "Document 60-day notification" },
      { id: "inc-4", label: "Anomaly detection", status: "pending", required: false, action: "Monitor unusual access" },
      { id: "inc-5", label: "Real-time security alerts", status: "pending", required: false, action: "Set up admin notifications" },
    ],
  },
];

const STATUS_CONFIG = {
  complete: { color: "bg-green-500", icon: CheckCircle2, label: "Complete" },
  warning: { color: "bg-yellow-500", icon: Clock, label: "Needs Review" },
  pending: { color: "bg-orange-500", icon: Clock, label: "Pending" },
  critical: { color: "bg-red-500", icon: XCircle, label: "Critical" },
  good: { color: "bg-green-500", icon: ShieldCheck, label: "Good" },
};

function CategoryScoreCard({ category }: { category: typeof SECURITY_CATEGORIES[0] }) {
  const Icon = category.icon;
  const percentage = (category.score / category.maxScore) * 100;
  
  const statusColors = {
    good: "border-green-500 bg-green-50 dark:bg-green-950",
    warning: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
    critical: "border-red-500 bg-red-50 dark:bg-red-950",
  };

  const statusIcons = {
    good: <ShieldCheck className="h-5 w-5 text-green-600" />,
    warning: <ShieldAlert className="h-5 w-5 text-yellow-600" />,
    critical: <ShieldX className="h-5 w-5 text-red-600" />,
  };

  return (
    <Card className={`border-l-4 ${statusColors[category.status]}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{category.name}</span>
          </div>
          {statusIcons[category.status]}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score</span>
            <span className="font-bold">{category.score}/{category.maxScore}</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityItemRow({ item }: { item: typeof SECURITY_CATEGORIES[0]["items"][0] }) {
  const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className={`mt-0.5 p-1 rounded-full ${config.color}`}>
        <Icon className="h-3 w-3 text-white" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${item.status === 'complete' ? 'text-muted-foreground' : ''}`}>
            {item.label}
          </span>
          {item.required && (
            <Badge variant="outline" className="text-xs">Required</Badge>
          )}
        </div>
        {item.action && (
          <p className="text-xs text-muted-foreground mt-1">
            Action: {item.action}
          </p>
        )}
      </div>
      <Badge 
        variant={item.status === 'complete' ? 'default' : item.status === 'critical' ? 'destructive' : 'secondary'}
        className="text-xs"
      >
        {config.label}
      </Badge>
    </div>
  );
}

export function SecurityAuditTab() {
  const { isSuperAdmin } = useRole();
  const [lastScanTime] = useState(new Date().toISOString());

  // Calculate overall score
  const totalScore = SECURITY_CATEGORIES.reduce((sum, cat) => sum + cat.score, 0);
  const maxScore = SECURITY_CATEGORIES.reduce((sum, cat) => sum + cat.maxScore, 0);
  const overallPercentage = (totalScore / maxScore) * 100;

  // Count items by status
  const allItems = SECURITY_CATEGORIES.flatMap(cat => cat.items);
  const criticalCount = allItems.filter(i => i.status === 'critical').length;
  const pendingCount = allItems.filter(i => i.status === 'pending').length;
  const completeCount = allItems.filter(i => i.status === 'complete').length;

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            HIPAA Security Audit
          </h2>
          <p className="text-muted-foreground">
            Security compliance status and action items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-scan
          </Button>
        </div>
      </div>

      {/* Overall Score Card */}
      <Card>
        <CardHeader>
          <CardTitle>HIPAA Readiness Score</CardTitle>
          <CardDescription>
            Last scanned: {new Date(lastScanTime).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2 flex items-center gap-6">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${overallPercentage * 3.52} 352`}
                    className={getScoreColor(overallPercentage)}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(overallPercentage)}`}>
                    {totalScore}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-4xl font-bold">{Math.round(overallPercentage)}%</p>
                <p className="text-muted-foreground">HIPAA Compliant</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Score: {totalScore} / {maxScore}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-950">
                  <XCircle className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-red-600">{criticalCount}</p>
                  <p className="text-xs text-muted-foreground">Critical Issues</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-950">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <p className="font-bold text-orange-600">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Items</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100 dark:bg-green-950">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-green-600">{completeCount}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-muted">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-bold">57</p>
                  <p className="text-xs text-muted-foreground">Tables with RLS</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SECURITY_CATEGORIES.slice(0, 4).map((category) => (
          <CategoryScoreCard key={category.id} category={category} />
        ))}
      </div>

      {/* Critical Actions */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <ShieldX className="h-5 w-5" />
            Critical Actions Required
          </CardTitle>
          <CardDescription>
            These items must be addressed before production deployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {allItems
              .filter(item => item.status === 'critical')
              .map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/50">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium">{item.label}</p>
                      {item.action && (
                        <p className="text-sm text-muted-foreground">{item.action}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="destructive">Critical</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Security Checklist</CardTitle>
          <CardDescription>
            Complete breakdown of all security controls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {SECURITY_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const completeItems = category.items.filter(i => i.status === 'complete').length;
              
              return (
                <AccordionItem key={category.id} value={category.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{category.name}</span>
                      <Badge variant="outline" className="ml-auto mr-4">
                        {completeItems}/{category.items.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2">
                      {category.items.map((item) => (
                        <SecurityItemRow key={item.id} item={item} />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>HIPAA Compliance Resources</CardTitle>
          <CardDescription>
            External documentation and guides
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="https://supabase.com/docs/guides/platform/hipaa"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Database className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Supabase HIPAA Guide</p>
                <p className="text-sm text-muted-foreground">Configuration requirements</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            <a
              href="https://supabase.com/security"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Shield className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">Supabase Security</p>
                <p className="text-sm text-muted-foreground">Security documentation</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
            <a
              href="https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="font-medium">HHS HIPAA Guidance</p>
                <p className="text-sm text-muted-foreground">Official regulations</p>
              </div>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            This automated security audit provides guidance but does not constitute legal compliance advice. 
            Please consult with qualified HIPAA compliance professionals for official certification. 
            Regular manual security audits and penetration testing are recommended.
          </span>
        </p>
      </div>
    </div>
  );
}

export default SecurityAuditTab;
