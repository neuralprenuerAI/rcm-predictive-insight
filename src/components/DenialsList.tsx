import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Denial {
  id: string;
  claim_id: string;
  patient_name: string;
  payer: string;
  amount: number;
  denial_date: string;
  carc_code: string;
  carc_description: string;
  status: string;
  days_pending: number;
}

export default function DenialsList() {
  const { data: denials = [], isLoading } = useQuery({
    queryKey: ['recent-denials'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('denials')
        .select('*')
        .order('denial_date', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return (data || []) as Denial[];
    }
  });
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      "New": "destructive",
      "In Review": "default",
      "Appealed": "outline",
      "Resolved": "secondary"
    };
    return variants[status] || "default";
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Recent Denials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Recent Denials
        </CardTitle>
        <CardDescription>Requires immediate attention</CardDescription>
      </CardHeader>
      <CardContent>
        {denials.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No denials found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>CARC</TableHead>
                <TableHead>Days Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {denials.map((denial) => (
                <TableRow key={denial.id}>
                  <TableCell className="font-medium">{denial.claim_id}</TableCell>
                  <TableCell>{denial.patient_name}</TableCell>
                  <TableCell>{denial.payer}</TableCell>
                  <TableCell className="font-medium">${denial.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">{denial.carc_code}</Badge>
                      <p className="text-xs text-muted-foreground">{denial.carc_description}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className={denial.days_pending > 7 ? "text-destructive font-medium" : "text-muted-foreground"}>
                        {denial.days_pending}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadge(denial.status)}>{denial.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toast.success("Opening appeal wizard...")}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Appeal
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
