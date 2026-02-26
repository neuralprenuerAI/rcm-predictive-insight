import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";
import { toast } from "sonner";
import { Plus, CheckCircle, XCircle, Clock, Wand2, RefreshCw } from "lucide-react";

interface Authorization {
  id: string;
  patient_name: string;
  payer: string;
  service: string;
  request_date: string;
  status: string;
  auth_number: string | null;
  decision_date: string | null;
}

export default function Authorizations() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    patient_name: "",
    payer: "",
    service: "",
    cpt_codes: "",
    diagnosis_codes: ""
  });
  const queryClient = useQueryClient();

  const { data: authorizations = [] } = useQuery({
    queryKey: ['authorizations'],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");
      const data = await awsCrud.select('authorizations', user.id);
      return (data || []) as Authorization[];
    }
  });

  const { data: apiConnections = [] } = useQuery({
    queryKey: ['api-connections'],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const data = await awsCrud.select('api_connections', user?.id);
      return (data || []).filter((c: any) => c.connection_type === 'ehr' && c.is_active);
    }
  });

  const createAuth = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await awsCrud.insert('authorizations', {
        user_id: user.id,
        patient_name: formData.patient_name,
        payer: formData.payer,
        service: formData.service,
        cpt_codes: formData.cpt_codes.split(',').map(s => s.trim()),
        diagnosis_codes: formData.diagnosis_codes.split(',').map(s => s.trim()),
        request_date: new Date().toISOString().split('T')[0],
        status: 'pending'
      }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authorizations'] });
      toast.success("Authorization request created");
      setDialogOpen(false);
      setFormData({ patient_name: "", payer: "", service: "", cpt_codes: "", diagnosis_codes: "" });
    },
    onError: () => toast.error("Failed to create authorization")
  });

  const syncEHRVisits = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await awsApi.invoke('sync-ehr-visits', {
        body: { connectionId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['authorizations'] });
      const authsCreated = data.visits.filter((v: any) => v.requires_prior_auth).length;
      toast.success(`Synced ${data.visits.length} visits, ${authsCreated} require prior authorization`);
    },
    onError: () => toast.error("Failed to sync EHR visits")
  });

  const generatePriorAuthLetter = useMutation({
    mutationFn: async (authorizationId: string) => {
      const { data, error } = await awsApi.invoke('generate-prior-auth-letter', {
        body: { authorizationId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Prior authorization letter generated");
      const letterWindow = window.open('', '_blank');
      if (letterWindow) {
        letterWindow.document.write(`
          <html>
            <head><title>Prior Authorization Letter</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 800px; margin: auto;">
              <pre style="white-space: pre-wrap;">${data.letter.content}</pre>
            </body>
          </html>
        `);
      }
    },
    onError: () => toast.error("Failed to generate letter")
  });

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'denied': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved': return 'default';
      case 'denied': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Prior Authorizations</h1>
          <p className="text-muted-foreground">Request and track prior authorizations</p>
        </div>
        <div className="flex gap-2">
          {apiConnections.length > 0 && (
            <Button
              variant="outline"
              onClick={() => syncEHRVisits.mutate(apiConnections[0].id)}
              disabled={syncEHRVisits.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {syncEHRVisits.isPending ? "Syncing..." : "Sync EHR"}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Request
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Authorization Request</DialogTitle>
              <DialogDescription>Submit a new prior authorization request</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Patient Name</Label>
                  <Input
                    value={formData.patient_name}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label>Payer</Label>
                  <Input
                    value={formData.payer}
                    onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                    placeholder="Insurance Company"
                  />
                </div>
              </div>
              <div>
                <Label>Service/Procedure</Label>
                <Input
                  value={formData.service}
                  onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                  placeholder="MRI Scan"
                />
              </div>
              <div>
                <Label>CPT Codes (comma-separated)</Label>
                <Input
                  value={formData.cpt_codes}
                  onChange={(e) => setFormData({ ...formData, cpt_codes: e.target.value })}
                  placeholder="70553, 72148"
                />
              </div>
              <div>
                <Label>Diagnosis Codes (comma-separated)</Label>
                <Input
                  value={formData.diagnosis_codes}
                  onChange={(e) => setFormData({ ...formData, diagnosis_codes: e.target.value })}
                  placeholder="M54.5, G89.29"
                />
              </div>
              <Button onClick={() => createAuth.mutate()} className="w-full">
                Submit Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authorization Requests</CardTitle>
          <CardDescription>Track the status of your authorization requests</CardDescription>
        </CardHeader>
        <CardContent>
          {authorizations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No authorization requests yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Request Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auth #</TableHead>
                  <TableHead>Decision Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authorizations.map((auth) => (
                  <TableRow key={auth.id}>
                    <TableCell className="font-medium">{auth.patient_name}</TableCell>
                    <TableCell>{auth.payer}</TableCell>
                    <TableCell>{auth.service}</TableCell>
                    <TableCell>{new Date(auth.request_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(auth.status)}
                        <Badge variant={getStatusVariant(auth.status)}>
                          {auth.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>{auth.auth_number || '-'}</TableCell>
                    <TableCell>
                      {auth.decision_date ? new Date(auth.decision_date).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generatePriorAuthLetter.mutate(auth.id)}
                        disabled={generatePriorAuthLetter.isPending}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate Letter
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
