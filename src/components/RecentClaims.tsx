import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Claim {
  id: string;
  claim_id: string;
  patient_name: string;
  billed_amount: number | null;
  status: string;
  payer: string;
}

export default function RecentClaims() {
  const { data: claims = [], isLoading } = useQuery({
    queryKey: ['recent-claims'],
    queryFn: async () => {
      const { data, error} = await (supabase as any)
        .from('claims')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return (data || []) as Claim[];
    }
  });

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid': return 'default';
      case 'denied': return 'destructive';
      case 'pending': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle>Recent Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border shadow-[var(--shadow-card)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Claims</CardTitle>
        <Button variant="secondary" size="sm">View All</Button>
      </CardHeader>
      <CardContent>
        {claims.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No claims found</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium">{claim.claim_id}</TableCell>
                  <TableCell>{claim.patient_name}</TableCell>
                  <TableCell>${claim.billed_amount?.toFixed(2) || '0.00'}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(claim.status)}>
                      {claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{claim.payer}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline">View</Button>
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
