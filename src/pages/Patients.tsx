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
import { Users, Search, ChevronRight, FlaskConical, Scan, Stethoscope, Activity, Eye, X, Copy, Check, ChevronDown, ChevronUp, Calendar, Hash, FileCode } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  external_id: string | null;
  code: string | null;
  code_display: string | null;
  status: string | null;
  performed_date: string | null;
  outcome: string | null;
  raw_fhir_data: Record<string, unknown> | null;
  last_synced_at: string | null;
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
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [rawDataExpanded, setRawDataExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch patients with proper counts from both tables
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients-with-orders'],
    queryFn: async () => {
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .order('last_name', { ascending: true });
      
      if (patientsError) throw patientsError;
      
      const { data: serviceRequests, error: srError } = await supabase
        .from('service_requests')
        .select('patient_id, category');
      
      if (srError) throw srError;
      
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

  // Fetch procedures for selected patient (with raw_fhir_data)
  const { data: patientProcedures } = useQuery({
    queryKey: ['patient-procedures', selectedPatient?.id],
    queryFn: async () => {
      if (!selectedPatient?.id) return [];
      const { data, error } = await supabase
        .from('procedures')
        .select('id, external_id, code, code_display, status, performed_date, outcome, raw_fhir_data, last_synced_at')
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
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchLower) ||
      patient.phone?.includes(searchTerm) ||
      patient.email?.toLowerCase().includes(searchLower) ||
      patient.external_id?.includes(searchTerm);
    
    if (!matchesSearch) return false;
    
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

  // Helper functions for extracting FHIR data
  const extractFhirCode = (raw: Record<string, unknown> | null): { code: string; system: string; display: string } | null => {
    if (!raw?.code) return null;
    const code = raw.code as { coding?: Array<{ code?: string; system?: string; display?: string }> };
    const coding = code?.coding?.[0];
    return coding ? {
      code: coding.code || '',
      system: coding.system || '',
      display: coding.display || ''
    } : null;
  };

  const extractFhirReference = (raw: Record<string, unknown> | null, field: string): string | null => {
    if (!raw?.[field]) return null;
    const ref = raw[field] as { reference?: string; display?: string };
    return ref?.display || ref?.reference?.split('/').pop() || null;
  };

  const extractMeta = (raw: Record<string, unknown> | null): { lastUpdated: string | null; versionId: string | null } => {
    if (!raw?.meta) return { lastUpdated: null, versionId: null };
    const meta = raw.meta as { lastUpdated?: string; versionId?: string };
    return {
      lastUpdated: meta.lastUpdated || null,
      versionId: meta.versionId || null
    };
  };

  const copyJsonToClipboard = async () => {
    if (!selectedProcedure?.raw_fhir_data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selectedProcedure.raw_fhir_data, null, 2));
      setCopied(true);
      toast.success("JSON copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy JSON");
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Count badges component
  const CountBadge = ({ count }: { count: number }) => {
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

  // Procedure detail content
  const ProcedureDetailContent = ({ procedure }: { procedure: Procedure }) => {
    const fhirCode = extractFhirCode(procedure.raw_fhir_data);
    const meta = extractMeta(procedure.raw_fhir_data);
    const practitioner = extractFhirReference(procedure.raw_fhir_data, 'asserter') || 
                         extractFhirReference(procedure.raw_fhir_data, 'performer');
    const encounter = extractFhirReference(procedure.raw_fhir_data, 'encounter');
    const location = extractFhirReference(procedure.raw_fhir_data, 'location');

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">
            {procedure.code_display || fhirCode?.display || procedure.code || 'Unknown Procedure'}
          </h3>
          <Badge variant={procedure.status === 'completed' ? 'default' : 'secondary'} className="text-sm">
            {procedure.status || 'Unknown Status'}
          </Badge>
        </div>

        <Separator />

        {/* Procedure Details */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Procedure Details</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Hash className="h-4 w-4" />
                CPT/Procedure Code
              </div>
              <p className="font-mono text-sm font-medium">
                {fhirCode?.code || procedure.code || '-'}
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileCode className="h-4 w-4" />
                Code System
              </div>
              <p className="text-sm font-medium">
                {fhirCode?.system?.split('/').pop() || 'Unknown'}
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Date Performed
              </div>
              <p className="text-sm font-medium">
                {formatDate(procedure.performed_date)}
              </p>
            </div>
            
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Outcome</div>
              <p className="text-sm font-medium">
                {procedure.outcome || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Provider Section */}
        {(practitioner || encounter || location) && (
          <>
            <Separator />
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Provider Information</h4>
              
              <div className="grid grid-cols-2 gap-4">
                {practitioner && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Practitioner</div>
                    <p className="text-sm font-medium">{practitioner}</p>
                  </div>
                )}
                {encounter && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Encounter</div>
                    <p className="text-sm font-medium font-mono">{encounter}</p>
                  </div>
                )}
                {location && (
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Location</div>
                    <p className="text-sm font-medium">{location}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Metadata */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Metadata</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Record ID</div>
              <p className="text-sm font-medium font-mono">{procedure.external_id || procedure.id}</p>
            </div>
            
            {meta.lastUpdated && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Last Updated</div>
                <p className="text-sm font-medium">{formatDate(meta.lastUpdated)}</p>
              </div>
            )}
            
            {procedure.last_synced_at && (
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Last Synced</div>
                <p className="text-sm font-medium">{formatDate(procedure.last_synced_at)}</p>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Raw FHIR Data */}
        <Collapsible open={rawDataExpanded} onOpenChange={setRawDataExpanded}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 p-0 h-auto">
                {rawDataExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Raw FHIR Data
                </span>
              </Button>
            </CollapsibleTrigger>
            
            <Button variant="outline" size="sm" onClick={copyJsonToClipboard} className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy JSON'}
            </Button>
          </div>
          
          <CollapsibleContent className="mt-3">
            <div className="bg-muted rounded-lg p-4 overflow-auto max-h-80">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(procedure.raw_fhir_data, null, 2)}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, email, or ECW ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
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
                        <CountBadge count={patient.lab_count} />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountBadge count={patient.imaging_count} />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountBadge count={patient.procedure_count} />
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
                          <TableHead className="w-[60px]">Actions</TableHead>
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
                              {formatShortDate(proc.performed_date)}
                            </TableCell>
                            <TableCell>{proc.outcome || '-'}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedProcedure(proc);
                                  setRawDataExpanded(false);
                                }}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
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
                                {formatShortDate(order.authored_on)}
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
                                {formatShortDate(order.authored_on)}
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

      {/* Procedure Detail Sheet */}
      <Sheet open={!!selectedProcedure} onOpenChange={() => setSelectedProcedure(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Procedure Details
            </SheetTitle>
            <SheetDescription>
              Full clinical data from FHIR record
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
            {selectedProcedure && <ProcedureDetailContent procedure={selectedProcedure} />}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
