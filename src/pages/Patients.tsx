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
import { Users, Search, ChevronRight, FlaskConical, Scan, Stethoscope, Activity } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type FilterType = 'all' | 'procedures' | 'labs' | 'imaging' | 'any';

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

interface Procedure {
  id: string;
  code: string | null;
  code_display: string | null;
  status: string | null;
  performed_date: string | null;
  outcome: string | null;
}

interface ServiceRequest {
  id: string;
  code: string | null;
  code_display: string | null;
  category: string | null;
  status: string | null;
  priority: string | null;
  authored_on: string | null;
}

export default function Patients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientWithOrders | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Fetch patients with proper counts from both tables
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients-with-orders'],
    queryFn: async () => {
      // Get all patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .order('last_name', { ascending: true });
      
      if (patientsError) throw patientsError;
      
      // Get service requests for labs and imaging counts
      const { data: serviceRequests, error: srError } = await supabase
        .from('service_requests')
        .select('patient_id, category');
      
      if (srError) throw srError;
      
      // Get procedures for procedure counts
      const { data: procedures, error: procError } = await supabase
        .from('procedures')
        .select('patient_id');
      
      if (procError) throw procError;
      
      return patientsData?.map(patient => ({
        ...patient,
        lab_count: serviceRequests?.filter(o => o.patient_id === patient.id && o.category === 'labs').length || 0,
        imaging_count: serviceRequests?.filter(o => o.patient_id === patient.id && o.category === 'imaging').length || 0,
        procedure_count: procedures?.filter(p => p.patient_id === patient.id).length || 0,
      })) as PatientWithOrders[];
    }
  });

  // Fetch procedures for selected patient
  const { data: patientProcedures } = useQuery({
    queryKey: ['patient-procedures', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('procedures')
        .select('id, code, code_display, status, performed_date, outcome')
        .eq('patient_id', selectedPatient.id)
        .order('performed_date', { ascending: false });
      if (error) throw error;
      return data as Procedure[];
    },
    enabled: !!selectedPatient?.id,
  });

  // Fetch service requests for selected patient
  const { data: patientOrders } = useQuery({
    queryKey: ['patient-orders', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('id, code, code_display, category, status, priority, authored_on')
        .eq('patient_id', selectedPatient.id)
        .order('authored_on', { ascending: false });
      if (error) throw error;
      return data as ServiceRequest[];
    },
    enabled: !!selectedPatient?.id,
  });

  // Apply search and filter
  const filteredPatients = patients?.filter(patient => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchLower) ||
      patient.phone?.includes(searchTerm) ||
      patient.email?.toLowerCase().includes(searchLower) ||
      patient.external_id?.includes(searchTerm);
    
    if (!matchesSearch) return false;
    
    // Category filter
    switch (activeFilter) {
      case 'procedures':
        return patient.procedure_count > 0;
      case 'labs':
        return patient.lab_count > 0;
      case 'imaging':
        return patient.imaging_count > 0;
      case 'any':
        return patient.procedure_count > 0 || patient.lab_count > 0 || patient.imaging_count > 0;
      default:
        return true;
    }
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

  // Count badges component
  const CountBadge = ({ count, variant }: { count: number; variant: 'labs' | 'imaging' | 'procedures' }) => {
    const hasData = count > 0;
    return (
      <Badge 
        variant={hasData ? "default" : "outline"}
        className={cn(
          "min-w-[2rem] justify-center",
          hasData ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}
      >
        {count}
      </Badge>
    );
  };

  // Filter stats
  const stats = {
    total: patients?.length || 0,
    withProcedures: patients?.filter(p => p.procedure_count > 0).length || 0,
    withLabs: patients?.filter(p => p.lab_count > 0).length || 0,
    withImaging: patients?.filter(p => p.imaging_count > 0).length || 0,
    withAny: patients?.filter(p => p.procedure_count > 0 || p.lab_count > 0 || p.imaging_count > 0).length || 0,
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

      {/* Search and Filters */}
      <Card className="border-border">
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, or ECW ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('all')}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              All Patients
              <Badge variant="secondary" className="ml-1">{stats.total}</Badge>
            </Button>
            
            <Button
              variant={activeFilter === 'procedures' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('procedures')}
              className="gap-2"
            >
              <Stethoscope className="h-4 w-4" />
              With Procedures
              <Badge variant="secondary" className="ml-1">{stats.withProcedures}</Badge>
            </Button>
            
            <Button
              variant={activeFilter === 'labs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('labs')}
              className="gap-2"
            >
              <FlaskConical className="h-4 w-4" />
              With Labs
              <Badge variant="secondary" className="ml-1">{stats.withLabs}</Badge>
            </Button>
            
            <Button
              variant={activeFilter === 'imaging' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('imaging')}
              className="gap-2"
            >
              <Scan className="h-4 w-4" />
              With Imaging
              <Badge variant="secondary" className="ml-1">{stats.withImaging}</Badge>
            </Button>
            
            <Button
              variant={activeFilter === 'any' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveFilter('any')}
              className="gap-2"
            >
              <Activity className="h-4 w-4" />
              With Any Data
              <Badge variant="secondary" className="ml-1">{stats.withAny}</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Patient Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle>
            {activeFilter === 'all' ? 'All Patients' : 
             activeFilter === 'procedures' ? 'Patients with Procedures' :
             activeFilter === 'labs' ? 'Patients with Labs' :
             activeFilter === 'imaging' ? 'Patients with Imaging' :
             'Patients with Clinical Data'}
          </CardTitle>
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
              {searchTerm || activeFilter !== 'all' 
                ? 'No patients match your filters' 
                : 'No patients found. Sync with ECW to import patients.'}
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
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FlaskConical className="h-3.5 w-3.5" />
                        Labs
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Scan className="h-3.5 w-3.5" />
                        Imaging
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        Procedures
                      </div>
                    </TableHead>
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
                      <TableCell className="text-center">
                        <CountBadge count={patient.lab_count} variant="labs" />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountBadge count={patient.imaging_count} variant="imaging" />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountBadge count={patient.procedure_count} variant="procedures" />
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
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedPatient?.first_name} {selectedPatient?.last_name}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap gap-4">
              <span>DOB: {selectedPatient?.date_of_birth || '-'}</span>
              <span>Gender: {selectedPatient?.gender || '-'}</span>
              <span>Phone: {selectedPatient?.phone || '-'}</span>
              {selectedPatient?.email && <span>Email: {selectedPatient.email}</span>}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="procedures" className="h-full flex flex-col">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="procedures" className="gap-2">
                  <Stethoscope className="h-4 w-4" />
                  Procedures ({patientProcedures?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="labs" className="gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Labs ({patientOrders?.filter(o => o.category === 'labs').length || 0})
                </TabsTrigger>
                <TabsTrigger value="imaging" className="gap-2">
                  <Scan className="h-4 w-4" />
                  Imaging ({patientOrders?.filter(o => o.category === 'imaging').length || 0})
                </TabsTrigger>
              </TabsList>
              
              {/* Procedures Tab */}
              <TabsContent value="procedures" className="flex-1 overflow-auto mt-4">
                {!patientProcedures || patientProcedures.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No procedures found for this patient
                  </p>
                ) : (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Procedure</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Outcome</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {patientProcedures.map((proc) => (
                          <TableRow key={proc.id}>
                            <TableCell className="font-medium">
                              {proc.code_display || proc.code || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={proc.status === 'completed' ? 'default' : 'secondary'}>
                                {proc.status || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {proc.performed_date 
                                ? new Date(proc.performed_date).toLocaleDateString() 
                                : '-'}
                            </TableCell>
                            <TableCell>{proc.outcome || '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
              
              {/* Labs Tab */}
              <TabsContent value="labs" className="flex-1 overflow-auto mt-4">
                {(() => {
                  const labs = patientOrders?.filter(o => o.category === 'labs') || [];
                  return labs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No lab orders found for this patient
                    </p>
                  ) : (
                    <div className="rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {labs.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">
                                {order.code_display || order.code || '-'}
                              </TableCell>
                              <TableCell className="capitalize">{order.status || '-'}</TableCell>
                              <TableCell className="capitalize">{order.priority || '-'}</TableCell>
                              <TableCell>
                                {order.authored_on 
                                  ? new Date(order.authored_on).toLocaleDateString() 
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </TabsContent>
              
              {/* Imaging Tab */}
              <TabsContent value="imaging" className="flex-1 overflow-auto mt-4">
                {(() => {
                  const imaging = patientOrders?.filter(o => o.category === 'imaging') || [];
                  return imaging.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No imaging orders found for this patient
                    </p>
                  ) : (
                    <div className="rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Order</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {imaging.map((order) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">
                                {order.code_display || order.code || '-'}
                              </TableCell>
                              <TableCell className="capitalize">{order.status || '-'}</TableCell>
                              <TableCell className="capitalize">{order.priority || '-'}</TableCell>
                              <TableCell>
                                {order.authored_on 
                                  ? new Date(order.authored_on).toLocaleDateString() 
                                  : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
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
