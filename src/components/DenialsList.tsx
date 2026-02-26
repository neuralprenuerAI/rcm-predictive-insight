import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsCrud } from "@/lib/awsCrud";
import { Skeleton } from "@/components/ui/skeleton";

export default function DenialsList() {
  const { data: denials = [], isLoading } = useQuery({
    queryKey: ['recent-denials'],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      const data = await awsCrud.select('denial_queue', user.id);
      return ((data || []).sort((a: any, b: any) =>
        new Date(b.denial_date).getTime() - new Date(a.denial_date).getTime()
      ).slice(0, 5));
    }
  });

  const getStatusBadge = (status: string | null) => {
    const variants: Record<string, "destructive" | "default" | "outline" | "secondary"> = {
      "pending": "destructive",
      "in_review": "default",
      "appealed": "outline",
      "resolved": "secondary"
    };
    return variants[status || 'pending'] || "default";
  };

  const getDaysPending = (denialDate: string) => {
    const denial = new Date(denialDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - denial.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
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
                <TableHead>Payer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Days Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {denials.map((denial) => {
                const daysPending = getDaysPending(denial.denial_date);
                return (
                  <TableRow key={denial.id}>
                    <TableCell className="font-medium">{denial.claim_id || '-'}</TableCell>
                    <TableCell>{denial.payer}</TableCell>
                    <TableCell className="font-medium">${Number(denial.denied_amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">{denial.denial_code}</Badge>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{denial.denial_reason}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className={daysPending > 7 ? "text-destructive font-medium" : "text-muted-foreground"}>
                          {daysPending}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadge(denial.appeal_status)}>
                        {denial.appeal_status || 'pending'}
                      </Badge>
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
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
