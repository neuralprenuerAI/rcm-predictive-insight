import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface Denial {
  id: string;
  claimId: string;
  patient: string;
  payer: string;
  amount: number;
  denialDate: string;
  carc: string;
  carcDesc: string;
  status: "New" | "In Review" | "Appealed" | "Resolved";
  daysPending: number;
}

const mockDenials: Denial[] = [
  {
    id: "D001",
    claimId: "CLM2025-1234",
    patient: "Sarah Johnson",
    payer: "Aetna",
    amount: 450.00,
    denialDate: "2025-01-10",
    carc: "CO-16",
    carcDesc: "Claim lacks information",
    status: "New",
    daysPending: 5
  },
  {
    id: "D002",
    claimId: "CLM2025-1567",
    patient: "Michael Chen",
    payer: "UnitedHealthcare",
    amount: 825.50,
    denialDate: "2025-01-08",
    carc: "CO-50",
    carcDesc: "Non-covered services",
    status: "In Review",
    daysPending: 7
  },
  {
    id: "D003",
    claimId: "CLM2025-1890",
    patient: "Emily Rodriguez",
    payer: "Blue Cross Blue Shield",
    amount: 1250.00,
    denialDate: "2025-01-05",
    carc: "CO-97",
    carcDesc: "Benefit maximum reached",
    status: "Appealed",
    daysPending: 10
  }
];

export default function DenialsList() {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      "New": "destructive",
      "In Review": "default",
      "Appealed": "outline",
      "Resolved": "secondary"
    };
    return variants[status] || "default";
  };

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
            {mockDenials.map((denial) => (
              <TableRow key={denial.id}>
                <TableCell className="font-medium">{denial.claimId}</TableCell>
                <TableCell>{denial.patient}</TableCell>
                <TableCell>{denial.payer}</TableCell>
                <TableCell className="font-medium">${denial.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-xs">{denial.carc}</Badge>
                    <p className="text-xs text-muted-foreground">{denial.carcDesc}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className={denial.daysPending > 7 ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {denial.daysPending}
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
      </CardContent>
    </Card>
  );
}
