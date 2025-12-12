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
import { Users, Search, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PatientWithOrders {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  source: string;
  external_id: string | null;
  lab_count: number;
  imaging_count: number;
  procedure_count: number;
}

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientWithOrders | null>(null);

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients-with-orders'],
    queryFn: async () => {
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .order('last_name', { ascending: true });
      
      if (patientsError) throw patientsError;
      
      const { data: orders, error: ordersError } = await supabase
        .from('service_requests')
        .select('patient_id, category');
      
      if (ordersError) throw ordersError;
      
      return patientsData?.map(patient => ({
        ...patient,
        lab_count: orders?.filter(o => o.patient_id === patient.id && o.category === 'labs').length || 0,
        imaging_count: orders?.filter(o => o.patient_id === patient.id && o.category === 'imaging').length || 0,
        procedure_count: orders?.filter(o => o.patient_id === patient.id && o.category === 'procedures').length || 0,
      })) as PatientWithOrders[];
    }
  });

  const { data: patientOrders } = useQuery({
    queryKey: ['patient-orders', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('authored_on', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedPatient?.id,
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

  const formatAddress = (patient: PatientWithOrders) => {
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
                    <TableHead>Labs</TableHead>
                    <TableHead>Imaging</TableHead>
                    <TableHead>Procedures</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients?.map((patient) => (
                    <TableRow 
                      key={patient.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <TableCell className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </TableCell>
                      <TableCell>{patient.date_of_birth || '-'}</TableCell>
                      <TableCell className="capitalize">{patient.gender || '-'}</TableCell>
                      <TableCell>{patient.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{patient.lab_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{patient.imaging_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{patient.procedure_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patient Detail Dialog */}
      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedPatient?.first_name} {selectedPatient?.last_name}
            </DialogTitle>
            <DialogDescription>
              DOB: {selectedPatient?.date_of_birth || '-'} | 
              Gender: {selectedPatient?.gender || '-'} | 
              Phone: {selectedPatient?.phone || '-'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <h3 className="font-semibold mb-2">Service Requests ({patientOrders?.length || 0})</h3>
            
            {patientOrders?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No service requests found for this patient
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientOrders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.code_display || order.code || '-'}</TableCell>
                        <TableCell className="capitalize">{order.category || '-'}</TableCell>
                        <TableCell className="capitalize">{order.status || '-'}</TableCell>
                        <TableCell className="capitalize">{order.priority || '-'}</TableCell>
                        <TableCell>
                          {order.authored_on ? new Date(order.authored_on).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPatient(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}