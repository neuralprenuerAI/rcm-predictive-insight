import { 
  CheckCircle2, 
  FileText, 
  ArrowRight,
  Lightbulb,
  AlertOctagon,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface CriticalIssue {
  priority: number;
  issue: string;
  impact: string;
  resolution: string;
}

interface Recommendation {
  category: string;
  recommendation: string;
  expected_impact: string;
  effort: 'low' | 'medium' | 'high';
}

interface MissingDoc {
  document_type: string;
  why_needed: string;
  impact_without: string;
}

interface AIRecommendationsProps {
  criticalIssues?: CriticalIssue[];
  recommendations?: Recommendation[];
  missingDocumentation?: MissingDoc[];
  nextSteps?: string[];
  appealStrategy?: {
    should_appeal: boolean;
    success_likelihood: number;
    appeal_type: string;
    key_arguments: string[];
    required_documents: string[];
  };
}

export function AIRecommendations({
  criticalIssues = [],
  recommendations = [],
  missingDocumentation = [],
  nextSteps = [],
  appealStrategy
}: AIRecommendationsProps) {
  const effortColors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800'
  };

  return (
    <div className="space-y-6">
      {/* Next Steps - Always show prominently */}
      {nextSteps.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Recommended Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {nextSteps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertOctagon className="h-5 w-5" />
              Critical Issues ({criticalIssues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {criticalIssues
              .sort((a, b) => a.priority - b.priority)
              .map((issue, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive" className="text-xs">
                      P{issue.priority}
                    </Badge>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{issue.issue}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Impact:</span> {issue.impact}
                      </p>
                      <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                        <span className="font-medium">Resolution:</span> {issue.resolution}
                      </p>
                    </div>
                  </div>
                  {index < criticalIssues.length - 1 && <Separator />}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Missing Documentation */}
      {missingDocumentation.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-700">
              <FileText className="h-5 w-5" />
              Missing Documentation ({missingDocumentation.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {missingDocumentation.map((doc, index) => (
              <div key={index} className="p-3 bg-yellow-50 rounded-lg space-y-1">
                <p className="font-medium text-sm">{doc.document_type}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Why needed:</span> {doc.why_needed}
                </p>
                <p className="text-xs text-yellow-700">
                  <span className="font-medium">Without it:</span> {doc.impact_without}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Recommendations ({recommendations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{rec.category}</Badge>
                  <Badge className={effortColors[rec.effort]}>
                    {rec.effort} effort
                  </Badge>
                </div>
                <p className="text-sm">{rec.recommendation}</p>
                <p className="text-xs text-green-700">
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  {rec.expected_impact}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Appeal Strategy (if applicable) */}
      {appealStrategy && (
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-blue-700">
              <Clock className="h-5 w-5" />
              Appeal Strategy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Should Appeal?</p>
                <Badge variant={appealStrategy.should_appeal ? "default" : "secondary"}>
                  {appealStrategy.should_appeal ? "Yes - Recommended" : "Not Recommended"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Likelihood</p>
                <p className="font-medium">{appealStrategy.success_likelihood}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Appeal Type</p>
                <p className="font-medium">{appealStrategy.appeal_type}</p>
              </div>
            </div>

            {appealStrategy.key_arguments.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Key Arguments:</p>
                <ul className="space-y-1">
                  {appealStrategy.key_arguments.map((arg, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <ArrowRight className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      {arg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {appealStrategy.required_documents.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Required Documents:</p>
                <ul className="space-y-1">
                  {appealStrategy.required_documents.map((doc, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
