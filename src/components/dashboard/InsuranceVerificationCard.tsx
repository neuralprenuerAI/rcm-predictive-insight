import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";
import { awsApi } from "@/integrations/aws/awsApi";
import { supabase } from "@/integrations/supabase/client";

interface EligibilityPatient {
  id: string;
  firstName: string;
  lastName: string;
  reason: string;
}

interface EligibilitySummary {
  verified: number;
  needsVerification: number;
  notEligible: number;
  noInsurance: number;
  needsAttention: number;
}

interface EligibilityData {
  summary: EligibilitySummary;
  verified: EligibilityPatient[];
  notEligible: EligibilityPatient[];
  needsVerification: EligibilityPatient[];
  noInsurance: EligibilityPatient[];
}

export function InsuranceVerificationCard() {
  const navigate = useNavigate();

  const { data: eligibilityData, isLoading } = useQuery<EligibilityData>({
    queryKey: ["dashboard-eligibility"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const result = await awsApi.invoke<EligibilityData>("rcm-dashboard-eligibility", {
        body: { user_id: user.id },
      });
      if (result.error) throw result.error;
      return result.data!;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5" />
            Insurance Verification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center space-y-2">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-4 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = eligibilityData?.summary || {
    verified: 0,
    needsVerification: 0,
    notEligible: 0,
    noInsurance: 0,
    needsAttention: 0,
  };

  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5" />
          Insurance Verification
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.verified}</div>
            <div className="text-sm text-muted-foreground">Verified</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summary.needsVerification}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summary.notEligible}</div>
            <div className="text-sm text-muted-foreground">Not Eligible</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{summary.noInsurance}</div>
            <div className="text-sm text-muted-foreground">No Insurance</div>
          </div>
        </div>

        {/* Needs Attention List */}
        {((eligibilityData?.needsVerification?.length ?? 0) > 0 ||
          (eligibilityData?.notEligible?.length ?? 0) > 0) && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-yellow-700 mb-2">
              ⚠️ Needs Attention ({summary.needsAttention})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {eligibilityData?.needsVerification?.map((patient) => (
                <div
                  key={patient.id}
                  className="flex justify-between items-center p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded"
                >
                  <div>
                    <span className="font-medium">
                      {patient.firstName} {patient.lastName}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      - {patient.reason}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/patient-intake?patientId=${patient.id}&tab=insurance`)
                    }
                  >
                    Verify →
                  </Button>
                </div>
              ))}
              {eligibilityData?.notEligible?.map((patient) => (
                <div
                  key={patient.id}
                  className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-950/20 rounded"
                >
                  <div>
                    <span className="font-medium">
                      {patient.firstName} {patient.lastName}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      - {patient.reason}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      navigate(`/patient-intake?patientId=${patient.id}&tab=insurance`)
                    }
                  >
                    Review →
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Good Message */}
        {summary.needsAttention === 0 && (
          <div className="text-center text-green-600 py-4">
            ✅ All patients with insurance are verified!
          </div>
        )}
      </CardContent>
    </Card>
  );
}
