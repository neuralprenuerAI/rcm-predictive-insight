import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";
import { toast } from "sonner";
import { 
  Plus, Plug, Trash2, Key, RefreshCw, ChevronDown, CheckCircle,
  Users, FlaskConical, Calendar, Receipt, Shield, Activity, Scan, Syringe, Save, Loader2, UserCog 
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ECWTokenDisplay from "./ECWTokenDisplay";
import { KeyPairGenerator } from "./KeyPairGenerator";

// ECW Sandbox defaults
const ECW_SANDBOX_DEFAULTS = {
  client_id: "2NsNtk5kW9GOcS3XY8dUr_nW6Nm-m2y9Yyha_FllZjs",
  issuer_url: "https://staging-fhir.ecwcloud.com/fhir/r4/FFBJCD",
  kid: "neuralprenuer-key-1",
};

// ECW Scope options with icons and descriptions
const ECW_SCOPE_OPTIONS = [
  { 
    id: 'patient', 
    label: 'Patients', 
    scope: 'system/Patient.read',
    icon: Users,
    description: 'Patient demographics, contact info, insurance'
  },
  { 
    id: 'serviceRequest', 
    label: 'Service Requests', 
    scope: 'system/ServiceRequest.read',
    icon: FlaskConical,
    description: 'Lab orders, imaging orders, procedure orders'
  },
  { 
    id: 'procedure', 
    label: 'Procedures', 
    scope: 'system/Procedure.read',
    icon: Syringe,
    description: 'Completed procedures'
  },
  { 
    id: 'encounter', 
    label: 'Encounters', 
    scope: 'system/Encounter.read',
    icon: Calendar,
    description: 'Patient visits and appointments'
  },
  { 
    id: 'claim', 
    label: 'Claims', 
    scope: 'system/Claim.read',
    icon: Receipt,
    description: 'Billing and claims data'
  },
  { 
    id: 'coverage', 
    label: 'Coverage', 
    scope: 'system/Coverage.read',
    icon: Shield,
    description: 'Insurance coverage information'
  },
  { 
    id: 'observation', 
    label: 'Observations', 
    scope: 'system/Observation.read',
    icon: Activity,
    description: 'Lab results, vitals, measurements'
  },
  { 
    id: 'patientUpdate', 
    label: 'Patient Update', 
    scope: 'system/Patient.update',
    icon: UserCog,
    description: 'Update patient demographics in eClinicalWorks'
  },
  { 
    id: 'patientCreate', 
    label: 'Patient Create', 
    scope: 'system/Patient.create',
    icon: UserCog,
    description: 'Create new patients in eClinicalWorks'
  },
];

export default function ConnectionsManager() {
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [payerDialogOpen, setPayerDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [tokenData, setTokenData] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("all");
  const [pendingSyncParams, setPendingSyncParams] = useState<{
    connectionId: string;
    resource: string;
    category?: string | null;
    fetchAll?: boolean;
  } | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['patient']);
  const [isChunkedSyncing, setIsChunkedSyncing] = useState(false);
  const [chunkProgress, setChunkProgress] = useState<{
    current: number;
    total: number;
    ordersFound: number;
  } | null>(null);
  const [apiFormData, setApiFormData] = useState({
    connection_name: "",
    connection_type: "ehr",
    api_url: "",
    api_key: "",
    client_id: "",
    private_key: "",
    issuer_url: "",
    kid: "",
  });
  const [payerFormData, setPayerFormData] = useState({
    payer_name: "",
    portal_url: "",
    username: "",
    password: ""
  });
  const queryClient = useQueryClient();

  // Generate scope string from selected scopes
  const getScopeString = () => {
    return selectedScopes
      .map(id => ECW_SCOPE_OPTIONS.find(opt => opt.id === id)?.scope)
      .filter(Boolean)
      .join(' ');
  };

  // Toggle scope selection
  const toggleScope = (scopeId: string) => {
    setSelectedScopes(prev => 
      prev.includes(scopeId) 
        ? prev.filter(id => id !== scopeId)
        : [...prev, scopeId]
    );
  };

  // Pre-fill ECW sandbox values when connection type changes to ecw
  useEffect(() => {
    if (apiFormData.connection_type === "ecw") {
      setApiFormData(prev => ({
        ...prev,
        client_id: prev.client_id || ECW_SANDBOX_DEFAULTS.client_id,
        issuer_url: prev.issuer_url || ECW_SANDBOX_DEFAULTS.issuer_url,
        kid: prev.kid || ECW_SANDBOX_DEFAULTS.kid,
      }));
    }
  }, [apiFormData.connection_type]);

  const { data: apiConnections = [] } = useQuery({
    queryKey: ['api-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_connections')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: payerConnections = [] } = useQuery({
    queryKey: ['payer-connections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payer_connections')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createAPIConnection = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // For ECW connections, store credentials in JSONB field
      const credentials = apiFormData.connection_type === "ecw" 
        ? {
            client_id: apiFormData.client_id,
            private_key: apiFormData.private_key,
            issuer_url: apiFormData.issuer_url,
            kid: apiFormData.kid || ECW_SANDBOX_DEFAULTS.kid,
            scope: getScopeString(),
            selected_scopes: selectedScopes,
          }
        : null;

      await awsCrud.insert('api_connections', {
        user_id: user.id,
        name: apiFormData.connection_name,
        connection_name: apiFormData.connection_name,
        connection_type: apiFormData.connection_type,
        api_url: apiFormData.api_url || apiFormData.issuer_url,
        api_key_encrypted: apiFormData.api_key || null,
        credentials: credentials,
        is_active: true
      }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      toast.success("API connection created");
      setApiDialogOpen(false);
      setApiFormData({ 
        connection_name: "", 
        connection_type: "ehr", 
        api_url: "", 
        api_key: "",
        client_id: "",
        private_key: "",
        issuer_url: "",
        kid: "",
      });
      setSelectedScopes(['patient']);
    },
    onError: (error: any) => toast.error(error?.message || "Failed to create connection")
  });

  const createPayerConnection = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await awsCrud.insert('payer_connections', {
        user_id: user.id,
        payer_name: payerFormData.payer_name,
        portal_url: payerFormData.portal_url,
        credentials_encrypted: JSON.stringify({
          username: payerFormData.username,
          password: payerFormData.password
        }),
        is_active: true
      }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-connections'] });
      toast.success("Payer connection created");
      setPayerDialogOpen(false);
      setPayerFormData({ payer_name: "", portal_url: "", username: "", password: "" });
    },
    onError: () => toast.error("Failed to create connection")
  });

  const toggleAPIConnection = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.update('api_connections', { is_active: isActive }, { id }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      toast.success("Connection updated");
    }
  });

  const togglePayerConnection = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.update('payer_connections', { is_active: isActive }, { id }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-connections'] });
      toast.success("Connection updated");
    }
  });

  const deleteAPIConnection = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.delete('api_connections', { id }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      toast.success("Connection deleted");
    }
  });

  // Handler to save connection name inline
  const handleSaveName = async (connectionId: string) => {
    if (editNameValue.trim()) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await awsCrud.update("api_connections", { name: editNameValue.trim() }, { id: connectionId }, user.id);
      }
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
    }
    setEditingNameId(null);
  };

  const testECWToken = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await awsApi.invoke('ecw-get-token', {
        body: { connectionId, environment }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setTokenData(data);
      setTokenDialogOpen(true);
      toast.success("Connection successful!", {
        description: `Access token obtained. Expires in ${data.expires_in}s`,
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Unknown error';
      
      let description = '';
      if (errorMessage.includes('invalid_client')) {
        description = 'Client ID or credentials are incorrect. Please verify your Client ID and Private Key.';
      } else if (errorMessage.includes('invalid_grant')) {
        description = 'JWT signature verification failed. Check that your Private Key matches the Public Key registered with ECW.';
      } else if (errorMessage.includes('unauthorized')) {
        description = 'Authorization failed. Ensure your credentials are registered with ECW.';
      } else {
        description = errorMessage;
      }

      toast.error("Connection test failed", { description });
      console.error("Token error:", error);
    }
  });

  const syncECWData = useMutation({
    mutationFn: async ({ connectionId, resource, category, fetchAll, dateRange }: { 
      connectionId: string; 
      resource: string;
      category?: string | null;
      fetchAll?: boolean;
      dateRange?: string | null;
    }) => {
      const { data, error } = await awsApi.invoke('ecw-sync-data', {
        body: { connectionId, resource, category, fetchAll, dateRange }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Add connectionId to result for saving
      return { ...data, connectionId };
    },
    onSuccess: (data) => {
      setSyncResult(data);
      setSyncDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
    },
    onError: (error: Error) => {
      toast.error("Sync Failed", {
        description: error.message,
      });
    },
  });

  // Chunked ServiceRequest sync with auto-resume
  const syncServiceRequestsChunked = async (
    connectionId: string, 
    category?: string | null, 
    dateRange?: string | null
  ) => {
    setIsChunkedSyncing(true);
    setChunkProgress(null);
    
    let startIndex = 0;
    const allResults: any[] = [];
    let hasMore = true;
    let totalPatients = 0;
    let retryCount = 0;
    const maxRetries = 3;
    
    toast.info("Starting ServiceRequest Sync", {
      description: "This may take a few minutes for large patient lists...",
    });
    
    while (hasMore) {
      try {
        const { data, error } = await awsApi.invoke('ecw-sync-data', {
          body: { 
            connectionId, 
            resource: 'ServiceRequest', 
            fetchAll: true,
            category,
            dateRange,
            searchParams: { startIndex: startIndex.toString() }
          }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        // Collect results
        if (data.data?.entry) {
          allResults.push(...data.data.entry);
        }
        
        // Update progress
        const { pagination } = data;
        totalPatients = pagination.totalPatients;
        
        setChunkProgress({
          current: pagination.endIndex,
          total: pagination.totalPatients,
          ordersFound: allResults.length
        });
        
        // Check if more to process
        hasMore = pagination.hasMore;
        startIndex = pagination.nextStartIndex || 0;
        retryCount = 0; // Reset retry count on success
        
        // Small delay before next chunk
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error: any) {
        console.error("Chunk sync error:", error);
        retryCount++;
        
        const isNetworkError = error?.message?.includes('Network') || 
                               error?.message?.includes('fetch') ||
                               error?.message?.includes('timeout') ||
                               error?.name === 'TypeError';
        
        if (retryCount >= maxRetries) {
          toast.error("Sync Failed", {
            description: isNetworkError 
              ? `Network error at patient ${startIndex}. Please try again.`
              : `Error at patient ${startIndex}. Max retries reached.`,
          });
          setIsChunkedSyncing(false);
          setChunkProgress(null);
          return;
        }
        
        toast.warning(isNetworkError ? "Network issue, retrying..." : "Retrying...", {
          description: `Continuing from patient ${startIndex}. Attempt ${retryCount}/${maxRetries}`,
        });
        
        // Longer wait for network errors
        await new Promise(resolve => setTimeout(resolve, isNetworkError ? 5000 : 3000));
      }
    }
    
    setIsChunkedSyncing(false);
    
    toast.success("Sync Complete!", {
      description: `Found ${allResults.length} ServiceRequests across ${totalPatients} patients.`,
    });
    
    // Set final result for display
    setSyncResult({
      success: true,
      resource: "ServiceRequest",
      category,
      total: allResults.length,
      connectionId,
      pagination: {
        totalPatients,
        processedInThisChunk: totalPatients,
      },
      data: {
        resourceType: "Bundle",
        type: "searchset",
        total: allResults.length,
        entry: allResults,
      },
    });
    setSyncDialogOpen(true);
    queryClient.invalidateQueries({ queryKey: ['api-connections'] });
  };

  // Chunked Procedure sync with auto-resume
  const syncProceduresChunked = async (
    connectionId: string, 
    dateRange?: string | null
  ) => {
    setIsChunkedSyncing(true);
    setChunkProgress(null);
    
    let startIndex = 0;
    const allResults: any[] = [];
    let hasMore = true;
    let totalPatients = 0;
    let retryCount = 0;
    const maxRetries = 3;
    
    toast.info("Starting Procedure Sync", {
      description: "This may take a few minutes for large patient lists...",
    });
    
    while (hasMore) {
      try {
        const { data, error } = await awsApi.invoke('ecw-sync-data', {
          body: { 
            connectionId, 
            resource: 'Procedure', 
            fetchAll: true,
            dateRange,
            searchParams: { startIndex: startIndex.toString() }
          }
        });
        
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        
        // Collect results
        if (data.data?.entry) {
          allResults.push(...data.data.entry);
        }
        
        // Update progress
        const { pagination } = data;
        totalPatients = pagination.totalPatients;
        
        setChunkProgress({
          current: pagination.endIndex,
          total: pagination.totalPatients,
          ordersFound: allResults.length
        });
        
        // Check if more to process
        hasMore = pagination.hasMore;
        startIndex = pagination.nextStartIndex || 0;
        retryCount = 0; // Reset retry count on success
        
        // Small delay before next chunk
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error: any) {
        console.error("Chunk sync error:", error);
        retryCount++;
        
        const isNetworkError = error?.message?.includes('Network') || 
                               error?.message?.includes('fetch') ||
                               error?.message?.includes('timeout') ||
                               error?.name === 'TypeError';
        
        if (retryCount >= maxRetries) {
          toast.error("Sync Failed", {
            description: isNetworkError 
              ? `Network error at patient ${startIndex}. Please try again.`
              : `Error at patient ${startIndex}. Max retries reached.`,
          });
          setIsChunkedSyncing(false);
          setChunkProgress(null);
          return;
        }
        
        toast.warning(isNetworkError ? "Network issue, retrying..." : "Retrying...", {
          description: `Continuing from patient ${startIndex}. Attempt ${retryCount}/${maxRetries}`,
        });
        
        // Longer wait for network errors
        await new Promise(resolve => setTimeout(resolve, isNetworkError ? 5000 : 3000));
      }
    }
    
    setIsChunkedSyncing(false);
    
    toast.success("Sync Complete!", {
      description: `Found ${allResults.length} Procedures across ${totalPatients} patients.`,
    });
    
    // Set final result for display
    setSyncResult({
      success: true,
      resource: "Procedure",
      total: allResults.length,
      connectionId,
      pagination: {
        totalPatients,
        processedInThisChunk: totalPatients,
      },
      data: {
        resourceType: "Bundle",
        type: "searchset",
        total: allResults.length,
        entry: allResults,
      },
    });
    setSyncDialogOpen(true);
    queryClient.invalidateQueries({ queryKey: ['api-connections'] });
  };

  // Save synced patients to database
  const savePatientsMutation = useMutation({
    mutationFn: async ({ entries, connectionId }: { entries: any[]; connectionId: string }) => {
      if (!entries || entries.length === 0) return 0;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      // Transform ECW FHIR patients to our schema
      const patientsToUpsert = entries.map((entry: any) => {
        const p = entry.resource;
        const name = p.name?.[0];
        const phone = p.telecom?.find((t: any) => t.system === 'phone')?.value;
        const email = p.telecom?.find((t: any) => t.system === 'email')?.value;
        const addr = p.address?.[0];
        
        return {
          external_id: p.id,
          source: 'ecw',
          source_connection_id: connectionId,
          first_name: name?.given?.join(' ') || '',
          last_name: name?.family || '',
          date_of_birth: p.birthDate || null,
          gender: p.gender || null,
          phone: phone || null,
          email: email || null,
          address_line1: addr?.line?.[0] || null,
          address_line2: addr?.line?.[1] || null,
          city: addr?.city || null,
          state: addr?.state || null,
          postal_code: addr?.postalCode || null,
          user_id: user.id,
          last_synced_at: new Date().toISOString(),
          raw_fhir_data: p,
        };
      });
      
      // Upsert patients via AWS RDS (maintains write-path consistency)
      await awsCrud.bulkUpsert('patients', patientsToUpsert, user.id, 'external_id,source,user_id');
      
      return patientsToUpsert.length;
    },
    onSuccess: (count) => {
      toast.success(`Saved ${count} patients to database`);
      setSyncDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
    onError: (error: Error) => {
      toast.error("Save Failed", {
        description: error.message,
      });
    },
  });

  // Save synced service requests to database
  const saveServiceRequestsMutation = useMutation({
    mutationFn: async ({ entries, connectionId, category }: { entries: any[]; connectionId: string; category: string }) => {
      if (!entries || entries.length === 0) return 0;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const serviceRequestsToUpsert = entries.map((entry: any) => {
        const sr = entry.resource;
        const patientRef = sr.subject?.reference || '';
        const patientExternalId = sr._patientExternalId || patientRef.replace('Patient/', '');
        
        return {
          external_id: sr.id,
          source: 'ecw',
          source_connection_id: connectionId,
          patient_external_id: patientExternalId,
          category: category,
          code: sr.code?.coding?.[0]?.code || null,
          code_display: sr.code?.text || sr.code?.coding?.[0]?.display || null,
          status: sr.status || null,
          priority: sr.priority || null,
          authored_on: sr.authoredOn || null,
          user_id: user.id,
          last_synced_at: new Date().toISOString(),
          raw_fhir_data: sr,
        };
      });
      
      await awsCrud.bulkUpsert('service_requests', serviceRequestsToUpsert, user.id, 'external_id,source');
      
      // Link to patients
      await supabase.rpc('link_service_requests_to_patients');
      
      return serviceRequestsToUpsert.length;
    },
    onSuccess: (count) => {
      toast.success(`Saved ${count} service requests to database`);
      setSyncDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['service-requests'] });
      queryClient.invalidateQueries({ queryKey: ['patients-with-orders'] });
    },
    onError: (error: Error) => {
      toast.error("Save Failed", {
        description: error.message,
      });
    },
  });

  // Save synced procedures to database
  const saveProceduresMutation = useMutation({
    mutationFn: async ({ entries, connectionId }: { entries: any[]; connectionId: string }) => {
      if (!entries || entries.length === 0) return 0;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const proceduresToUpsert = entries.map((entry: any) => {
        const proc = entry.resource;
        const patientRef = proc.subject?.reference || '';
        const patientExternalId = proc._patientExternalId || patientRef.replace('Patient/', '');
        
        // Extract performed date - can be performedDateTime or performedPeriod.start
        let performedDate = null;
        if (proc.performedDateTime) {
          performedDate = proc.performedDateTime;
        } else if (proc.performedPeriod?.start) {
          performedDate = proc.performedPeriod.start;
        }
        
        return {
          external_id: proc.id,
          source: 'ecw',
          source_connection_id: connectionId,
          patient_external_id: patientExternalId,
          code: proc.code?.coding?.[0]?.code || null,
          code_display: proc.code?.text || proc.code?.coding?.[0]?.display || null,
          status: proc.status || null,
          performed_date: performedDate,
          outcome: proc.outcome?.text || proc.outcome?.coding?.[0]?.display || null,
          user_id: user.id,
          last_synced_at: new Date().toISOString(),
          raw_fhir_data: proc,
        };
      });
      
      await awsCrud.bulkUpsert('procedures', proceduresToUpsert, user.id, 'external_id,source');
      
      // Link to patients
      await supabase.rpc('link_procedures_to_patients');
      
      return proceduresToUpsert.length;
    },
    onSuccess: (count) => {
      toast.success(`Saved ${count} procedures to database`);
      setSyncDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['procedures'] });
      queryClient.invalidateQueries({ queryKey: ['patients-with-procedures'] });
    },
    onError: (error: Error) => {
      toast.error("Save Failed", {
        description: error.message,
      });
    },
  });

  const deletePayerConnection = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.delete('payer_connections', { id }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-connections'] });
      toast.success("Connection deleted");
    }
  });

  // Get credentials from connection with proper typing
  const getConnectionCredentials = (conn: any) => {
    return conn.credentials as { selected_scopes?: string[] } | null;
  };

  return (
    <div className="space-y-6">
      <KeyPairGenerator />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Integrations & Connections
          </CardTitle>
          <CardDescription>Manage API and payer portal connections</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="api">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="api">API Connections</TabsTrigger>
              <TabsTrigger value="payer">Payer Portals</TabsTrigger>
            </TabsList>

          <TabsContent value="api" className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Environment:</Label>
                <Select value={environment} onValueChange={(v: 'sandbox' | 'production') => setEnvironment(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add API Connection
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>New API Connection</DialogTitle>
                    <DialogDescription>Connect to EHR or other healthcare systems</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Connection Name *</Label>
                      <Input
                        value={apiFormData.connection_name}
                        onChange={(e) => setApiFormData({ ...apiFormData, connection_name: e.target.value })}
                        placeholder="e.g., ECW Patients, ECW Procedures"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">A friendly name to identify this connection</p>
                    </div>
                    <div>
                      <Label>Connection Type</Label>
                      <Select
                        value={apiFormData.connection_type}
                        onValueChange={(v) => setApiFormData({ ...apiFormData, connection_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ehr">EHR System (Generic)</SelectItem>
                          <SelectItem value="ecw">eClinicalWorks FHIR</SelectItem>
                          <SelectItem value="payer">Payer API</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {apiFormData.connection_type === "ecw" ? (
                      <>
                        <div className="p-3 bg-muted rounded-md text-sm">
                          <p className="font-semibold mb-1">eClinicalWorks Backend Authentication</p>
                          <p className="text-muted-foreground">
                            OAuth 2.0 client credentials with JWT assertion (RS384). Sandbox values pre-filled.
                          </p>
                        </div>
                        <div>
                          <Label>Client ID</Label>
                          <Input
                            value={apiFormData.client_id}
                            onChange={(e) => setApiFormData({ ...apiFormData, client_id: e.target.value })}
                            placeholder="Your app's client ID"
                          />
                        </div>
                        <div>
                          <Label>FHIR Base URL (Issuer)</Label>
                          <Input
                            value={apiFormData.issuer_url}
                            onChange={(e) => setApiFormData({ ...apiFormData, issuer_url: e.target.value })}
                            placeholder="https://fhir.eclinicalworks.com/..."
                          />
                        </div>
                        <div>
                          <Label>Key ID (kid)</Label>
                          <Input
                            value={apiFormData.kid}
                            onChange={(e) => setApiFormData({ ...apiFormData, kid: e.target.value })}
                            placeholder="neuralprenuer-key-1"
                          />
                        </div>
                        
                        {/* Scope Selection Checkboxes */}
                        <div className="space-y-3">
                          <Label>Data Types to Sync</Label>
                          <p className="text-sm text-muted-foreground">
                            Select data types approved in your ECW Developer Portal
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ECW_SCOPE_OPTIONS.map((option) => {
                              const IconComponent = option.icon;
                              const isSelected = selectedScopes.includes(option.id);
                              
                              return (
                                <div
                                  key={option.id}
                                  onClick={() => toggleScope(option.id)}
                                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                      : 'bg-card hover:bg-accent border-border'
                                  }`}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleScope(option.id)}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <IconComponent className="h-4 w-4 shrink-0" />
                                      <span className="font-medium text-sm">{option.label}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {option.description}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded break-all">
                            {getScopeString() || 'No scopes selected'}
                          </p>
                        </div>
                        
                        <div>
                          <Label>Private Key (PEM format)</Label>
                          <textarea
                            className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md bg-background"
                            value={apiFormData.private_key}
                            onChange={(e) => setApiFormData({ ...apiFormData, private_key: e.target.value })}
                            placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Your RS384 private key for signing JWT assertions
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <Label>API URL</Label>
                          <Input
                            value={apiFormData.api_url}
                            onChange={(e) => setApiFormData({ ...apiFormData, api_url: e.target.value })}
                            placeholder="https://api.example.com"
                          />
                        </div>
                        <div>
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            value={apiFormData.api_key}
                            onChange={(e) => setApiFormData({ ...apiFormData, api_key: e.target.value })}
                            placeholder="Your API key"
                          />
                        </div>
                      </>
                    )}
                    
                    <Button onClick={() => createAPIConnection.mutate()} className="w-full">
                      Create Connection
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {apiConnections.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No API connections configured</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiConnections.map((conn) => {
                    const credentials = getConnectionCredentials(conn);
                    const selectedScopesForConn = credentials?.selected_scopes || [];
                    
                    return (
                      <TableRow key={conn.id}>
                        <TableCell className="font-medium">
                          {editingNameId === conn.id ? (
                            <Input
                              autoFocus
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onBlur={() => handleSaveName(conn.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveName(conn.id);
                                if (e.key === "Escape") setEditingNameId(null);
                              }}
                              className="h-8 w-48"
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:text-primary"
                              onClick={() => {
                                setEditingNameId(conn.id);
                                setEditNameValue((conn as any).name || conn.connection_name || "");
                              }}
                            >
                              {(conn as any).name || conn.connection_name || <span className="text-muted-foreground italic">Click to name</span>}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{conn.connection_type}</TableCell>
                        <TableCell className="max-w-xs truncate">{conn.api_url}</TableCell>
                        <TableCell>
                          {conn.last_sync ? new Date(conn.last_sync).toLocaleString() : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={conn.is_active}
                            onCheckedChange={(checked) => toggleAPIConnection.mutate({ id: conn.id, isActive: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {conn.connection_type === 'ecw' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => testECWToken.mutate(conn.id)}
                                  disabled={testECWToken.isPending}
                                >
                                  <Key className="h-4 w-4 mr-1" />
                                  {testECWToken.isPending ? 'Testing...' : 'Test'}
                                </Button>
                                
                                {/* Sync Data Dropdown */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="default" 
                                      size="sm" 
                                      disabled={syncECWData.isPending || isChunkedSyncing || !conn.is_active}
                                    >
                                      <RefreshCw className={`h-4 w-4 mr-1 ${(syncECWData.isPending || isChunkedSyncing) ? 'animate-spin' : ''}`} />
                                      {isChunkedSyncing && chunkProgress 
                                        ? `Syncing... ${chunkProgress.current}/${chunkProgress.total}` 
                                        : syncECWData.isPending 
                                          ? 'Syncing...' 
                                          : 'Sync Data'}
                                      <ChevronDown className="h-4 w-4 ml-1" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Select Data Type</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    
                                    {selectedScopesForConn.includes('patient') && (
                                      <DropdownMenuItem 
                                        onClick={() => syncECWData.mutate({ connectionId: conn.id, resource: 'Patient', fetchAll: true })}
                                      >
                                        <Users className="h-4 w-4 mr-2" />
                                        All Patients
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {selectedScopesForConn.includes('serviceRequest') && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                          Service Requests
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            setPendingSyncParams({ 
                                              connectionId: conn.id, 
                                              resource: 'ServiceRequest', 
                                              category: 'labs',
                                              fetchAll: true 
                                            });
                                            setDateRangeDialogOpen(true);
                                          }}
                                        >
                                          <FlaskConical className="h-4 w-4 mr-2" />
                                          All Lab Orders
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            setPendingSyncParams({ 
                                              connectionId: conn.id, 
                                              resource: 'ServiceRequest', 
                                              category: 'imaging',
                                              fetchAll: true 
                                            });
                                            setDateRangeDialogOpen(true);
                                          }}
                                        >
                                          <Scan className="h-4 w-4 mr-2" />
                                          All Imaging Orders
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            setPendingSyncParams({ 
                                              connectionId: conn.id, 
                                              resource: 'ServiceRequest', 
                                              category: 'procedures',
                                              fetchAll: true 
                                            });
                                            setDateRangeDialogOpen(true);
                                          }}
                                        >
                                          <Syringe className="h-4 w-4 mr-2" />
                                          All Procedure Orders
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    
                                    {selectedScopesForConn.includes('procedure') && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-xs text-muted-foreground">
                                          Procedures
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            setPendingSyncParams({ 
                                              connectionId: conn.id, 
                                              resource: 'Procedure', 
                                              category: null,
                                              fetchAll: true 
                                            });
                                            setDateRangeDialogOpen(true);
                                          }}
                                        >
                                          <Syringe className="h-4 w-4 mr-2" />
                                          All Completed Procedures
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                    
                                    {selectedScopesForConn.includes('encounter') && (
                                      <DropdownMenuItem 
                                        onClick={() => syncECWData.mutate({ connectionId: conn.id, resource: 'Encounter' })}
                                      >
                                        <Calendar className="h-4 w-4 mr-2" />
                                        Encounters
                                      </DropdownMenuItem>
                                    )}

                                    {selectedScopesForConn.includes('claim') && (
                                      <DropdownMenuItem 
                                        onClick={() => syncECWData.mutate({ connectionId: conn.id, resource: 'Claim' })}
                                      >
                                        <Receipt className="h-4 w-4 mr-2" />
                                        Claims
                                      </DropdownMenuItem>
                                    )}

                                    {selectedScopesForConn.includes('coverage') && (
                                      <DropdownMenuItem 
                                        onClick={() => syncECWData.mutate({ connectionId: conn.id, resource: 'Coverage' })}
                                      >
                                        <Shield className="h-4 w-4 mr-2" />
                                        Coverage
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {selectedScopesForConn.includes('observation') && (
                                      <DropdownMenuItem 
                                        onClick={() => syncECWData.mutate({ connectionId: conn.id, resource: 'Observation' })}
                                      >
                                        <Activity className="h-4 w-4 mr-2" />
                                        Observations
                                      </DropdownMenuItem>
                                    )}
                                    
                                    {selectedScopesForConn.length === 0 && (
                                      <DropdownMenuItem disabled className="text-muted-foreground">
                                        No data types configured
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteAPIConnection.mutate(conn.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="payer" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={payerDialogOpen} onOpenChange={setPayerDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payer Portal
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Payer Portal Connection</DialogTitle>
                    <DialogDescription>Connect to insurance payer portals</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Payer Name</Label>
                      <Input
                        value={payerFormData.payer_name}
                        onChange={(e) => setPayerFormData({ ...payerFormData, payer_name: e.target.value })}
                        placeholder="Blue Cross Blue Shield"
                      />
                    </div>
                    <div>
                      <Label>Portal URL</Label>
                      <Input
                        value={payerFormData.portal_url}
                        onChange={(e) => setPayerFormData({ ...payerFormData, portal_url: e.target.value })}
                        placeholder="https://portal.payer.com"
                      />
                    </div>
                    <div>
                      <Label>Username</Label>
                      <Input
                        value={payerFormData.username}
                        onChange={(e) => setPayerFormData({ ...payerFormData, username: e.target.value })}
                        placeholder="Your username"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={payerFormData.password}
                        onChange={(e) => setPayerFormData({ ...payerFormData, password: e.target.value })}
                        placeholder="Your password"
                      />
                    </div>
                    <Button onClick={() => createPayerConnection.mutate()} className="w-full">
                      Create Connection
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {payerConnections.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No payer connections configured</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payer</TableHead>
                    <TableHead>Portal URL</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payerConnections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">{conn.payer_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{conn.portal_url}</TableCell>
                      <TableCell>
                        <Switch
                          checked={conn.is_active}
                          onCheckedChange={(checked) => togglePayerConnection.mutate({ id: conn.id, isActive: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePayerConnection.mutate(conn.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <ECWTokenDisplay 
        open={tokenDialogOpen} 
        onOpenChange={setTokenDialogOpen} 
        tokenData={tokenData} 
      />

      {/* Sync Results Dialog */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Sync Complete
            </DialogTitle>
            <DialogDescription>
              Retrieved {syncResult?.total || 0} {syncResult?.resource} records
              {syncResult?.category && ` (${syncResult.category})`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto border rounded-lg">
            {/* Patient Results Table */}
            {syncResult?.resource === 'Patient' && syncResult?.data?.entry && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>DOB</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.data.entry.slice(0, 100).map((entry: any, idx: number) => {
                    const p = entry.resource;
                    const name = p.name?.[0];
                    const fullName = name 
                      ? `${name.prefix?.join(' ') || ''} ${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
                      : 'Unknown';
                    const phone = p.telecom?.find((t: any) => t.system === 'phone')?.value || '-';
                    const addr = p.address?.[0];
                    const address = addr ? `${addr.city || ''}, ${addr.state || ''}`.trim() : '-';
                    
                    return (
                      <TableRow key={p.id || idx}>
                        <TableCell className="font-medium">{fullName}</TableCell>
                        <TableCell>{p.birthDate || '-'}</TableCell>
                        <TableCell className="capitalize">{p.gender || '-'}</TableCell>
                        <TableCell>{phone}</TableCell>
                        <TableCell>{address}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            
            {/* ServiceRequest Results Table */}
            {syncResult?.resource === 'ServiceRequest' && syncResult?.data?.entry && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order/Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Ordered Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.data.entry.slice(0, 100).map((entry: any, idx: number) => {
                    const sr = entry.resource;
                    const code = sr.code?.text || sr.code?.coding?.[0]?.display || sr.code?.coding?.[0]?.code || '-';
                    const category = sr.category?.[0]?.text || sr.category?.[0]?.coding?.[0]?.display || '-';
                    
                    return (
                      <TableRow key={sr.id || idx}>
                        <TableCell className="font-medium">{code}</TableCell>
                        <TableCell>{category}</TableCell>
                        <TableCell className="capitalize">{sr.priority || 'routine'}</TableCell>
                        <TableCell>{sr.authoredOn?.split('T')[0] || '-'}</TableCell>
                        <TableCell className="capitalize">{sr.status || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Encounter Results Table */}
            {syncResult?.resource === 'Encounter' && syncResult?.data?.entry && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.data.entry.slice(0, 100).map((entry: any, idx: number) => {
                    const enc = entry.resource;
                    const encClass = enc.class?.display || enc.class?.code || '-';
                    const encType = enc.type?.[0]?.text || enc.type?.[0]?.coding?.[0]?.display || '-';
                    const period = enc.period?.start?.split('T')[0] || '-';
                    
                    return (
                      <TableRow key={enc.id || idx}>
                        <TableCell className="font-medium font-mono text-xs">{enc.id || '-'}</TableCell>
                        <TableCell className="capitalize">{encClass}</TableCell>
                        <TableCell>{encType}</TableCell>
                        <TableCell>{period}</TableCell>
                        <TableCell className="capitalize">{enc.status || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Procedure Results Table */}
            {syncResult?.resource === 'Procedure' && syncResult?.data?.entry && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Performed Date</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.data.entry.slice(0, 100).map((entry: any, idx: number) => {
                    const proc = entry.resource;
                    const code = proc.code?.text || proc.code?.coding?.[0]?.display || proc.code?.coding?.[0]?.code || '-';
                    const performedDate = proc.performedDateTime?.split('T')[0] || proc.performedPeriod?.start?.split('T')[0] || '-';
                    const outcome = proc.outcome?.text || proc.outcome?.coding?.[0]?.display || '-';
                    
                    return (
                      <TableRow key={proc.id || idx}>
                        <TableCell className="font-medium">{code}</TableCell>
                        <TableCell className="capitalize">{proc.status || '-'}</TableCell>
                        <TableCell>{performedDate}</TableCell>
                        <TableCell>{outcome}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Generic Results for other resource types */}
            {syncResult?.data?.entry && 
             !['Patient', 'ServiceRequest', 'Encounter', 'Procedure'].includes(syncResult?.resource) && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Resource Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncResult.data.entry.slice(0, 100).map((entry: any, idx: number) => {
                    const res = entry.resource;
                    return (
                      <TableRow key={res.id || idx}>
                        <TableCell className="font-medium font-mono text-xs">{res.id || '-'}</TableCell>
                        <TableCell>{res.resourceType || '-'}</TableCell>
                        <TableCell className="capitalize">{res.status || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            
            {/* No data message */}
            {(!syncResult?.data?.entry || syncResult.data.entry.length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                No records found
              </div>
            )}
          </div>
          
          {syncResult?.total > 100 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              Showing first 100 of {syncResult.total} records
            </p>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
              Close Without Saving
            </Button>
            {syncResult?.resource === 'Patient' && syncResult?.data?.entry?.length > 0 && (
              <Button 
                onClick={() => {
                  savePatientsMutation.mutate({
                    entries: syncResult.data.entry,
                    connectionId: syncResult.connectionId,
                  });
                }}
                disabled={savePatientsMutation.isPending}
              >
                {savePatientsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save {syncResult?.total || 0} Patients
              </Button>
            )}
            {syncResult?.resource === 'ServiceRequest' && syncResult?.data?.entry?.length > 0 && (
              <Button 
                onClick={() => {
                  saveServiceRequestsMutation.mutate({
                    entries: syncResult.data.entry,
                    connectionId: syncResult.connectionId,
                    category: syncResult.category || 'unknown',
                  });
                }}
                disabled={saveServiceRequestsMutation.isPending}
              >
                {saveServiceRequestsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save {syncResult?.total || 0} Orders
              </Button>
            )}
            {syncResult?.resource === 'Procedure' && syncResult?.data?.entry?.length > 0 && (
              <Button 
                onClick={() => {
                  saveProceduresMutation.mutate({
                    entries: syncResult.data.entry,
                    connectionId: syncResult.connectionId,
                  });
                }}
                disabled={saveProceduresMutation.isPending}
              >
                {saveProceduresMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save {syncResult?.total || 0} Procedures
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Date Range Selection Dialog for ServiceRequest/Procedure */}
      <Dialog open={dateRangeDialogOpen} onOpenChange={setDateRangeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Date Range</DialogTitle>
            <DialogDescription>
              Choose how far back to fetch {pendingSyncParams?.resource === 'Procedure' ? 'procedures' : 'service requests'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2">
            <Label>Date Range</Label>
            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="last90days">Last 90 Days</SelectItem>
                <SelectItem value="lastyear">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDateRangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (pendingSyncParams) {
                  if (pendingSyncParams.resource === 'Procedure') {
                    // Use chunked sync for Procedures
                    syncProceduresChunked(
                      pendingSyncParams.connectionId, 
                      selectedDateRange
                    );
                  } else {
                    // Use chunked sync for ServiceRequests
                    syncServiceRequestsChunked(
                      pendingSyncParams.connectionId, 
                      pendingSyncParams.category,
                      selectedDateRange
                    );
                  }
                }
                setDateRangeDialogOpen(false);
              }}
              disabled={isChunkedSyncing}
            >
              {isChunkedSyncing ? 'Syncing...' : 'Start Sync'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
