import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('last_name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    }
  });

  const filteredPatients = patients?.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      patient.phone?.includes(searchTerm) ||
      patient.email?.toLowerCase().includes(searchLower) ||
      patient.external_id?.includes(searchTerm)
    );
  });

  const formatAddress = (patient: any) => {
    const parts = [
      patient.address_line1,
      patient.city,
      patient.state,
      patient.postal_code
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2 text-foreground">
            <Users className="h-8 w-8" />
            Patients
          </h1>
          <p className="text-muted-foreground">
            {patients?.length || 0} patients synced from ECW
          </p>
        </div>
      </div>

      <Card className="border-border">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, or ECW ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle>All Patients</CardTitle>
          <CardDescription>
            Showing {filteredPatients?.length || 0} of {patients?.length || 0} patients
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading patients...
            </div>
          ) : filteredPatients?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No patients match your search' : 'No patients found. Sync with ECW to import patients.'}
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients?.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </TableCell>
                      <TableCell>{patient.date_of_birth || '-'}</TableCell>
                      <TableCell className="capitalize">{patient.gender || '-'}</TableCell>
                      <TableCell>{patient.phone || '-'}</TableCell>
                      <TableCell>{patient.email || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {formatAddress(patient)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={patient.source === 'ecw' ? 'default' : 'secondary'}>
                          {patient.source || 'manual'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
