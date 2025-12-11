import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Plug, Trash2, Key, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ECWTokenDisplay from "./ECWTokenDisplay";
import { KeyPairGenerator } from "./KeyPairGenerator";

// ECW Sandbox defaults
const ECW_SANDBOX_DEFAULTS = {
  client_id: "2NsNtk5kW9GOcS3XY8dUr_nW6Nm-m2y9Yyha_FIIZjs",
  issuer_url: "https://fhir.eclinicalworks.com/ecwopendev/",
  kid: "neuralprenuer-key-1",
  scope: "system/Patient.read system/Encounter.read system/Coverage.read system/Observation.read system/Claim.read system/Procedure.read",
};

export default function ConnectionsManager() {
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [payerDialogOpen, setPayerDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [apiFormData, setApiFormData] = useState({
    connection_name: "",
    connection_type: "ehr",
    api_url: "",
    api_key: "",
    client_id: "",
    private_key: "",
    issuer_url: "",
    kid: "",
    scope: "",
  });
  const [payerFormData, setPayerFormData] = useState({
    payer_name: "",
    portal_url: "",
    username: "",
    password: ""
  });
  const queryClient = useQueryClient();

  // Pre-fill ECW sandbox values when connection type changes to ecw
  useEffect(() => {
    if (apiFormData.connection_type === "ecw") {
      setApiFormData(prev => ({
        ...prev,
        client_id: prev.client_id || ECW_SANDBOX_DEFAULTS.client_id,
        issuer_url: prev.issuer_url || ECW_SANDBOX_DEFAULTS.issuer_url,
        kid: prev.kid || ECW_SANDBOX_DEFAULTS.kid,
        scope: prev.scope || ECW_SANDBOX_DEFAULTS.scope,
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
            scope: apiFormData.scope || ECW_SANDBOX_DEFAULTS.scope,
          }
        : null;

      const { error } = await supabase.from('api_connections').insert({
        user_id: user.id,
        connection_name: apiFormData.connection_name,
        connection_type: apiFormData.connection_type,
        api_url: apiFormData.api_url || apiFormData.issuer_url,
        api_key_encrypted: apiFormData.api_key || null,
        credentials: credentials,
        is_active: true
      });
      if (error) throw error;
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
        scope: "",
      });
    },
    onError: (error: any) => toast.error(error?.message || "Failed to create connection")
  });

  const createPayerConnection = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('payer_connections').insert({
        user_id: user.id,
        payer_name: payerFormData.payer_name,
        portal_url: payerFormData.portal_url,
        credentials_encrypted: JSON.stringify({
          username: payerFormData.username,
          password: payerFormData.password
        }),
        is_active: true
      });
      if (error) throw error;
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
      const { error } = await supabase
        .from('api_connections')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      toast.success("Connection updated");
    }
  });

  const togglePayerConnection = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('payer_connections')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-connections'] });
      toast.success("Connection updated");
    }
  });

  const deleteAPIConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('api_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      toast.success("Connection deleted");
    }
  });

  const testECWToken = useMutation({
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke('ecw-get-token', {
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
    mutationFn: async (connectionId: string) => {
      const { data, error } = await supabase.functions.invoke('ecw-sync-data', {
        body: { connectionId, environment }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['claims'] });
      queryClient.invalidateQueries({ queryKey: ['recent-claims'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      
      const errorCount = data.errors?.length || 0;
      toast.success("ECW Sync Complete", {
        description: `Synced ${data.claims || 0} claims, ${data.patients || 0} patients, ${data.encounters || 0} encounters${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
      });
    },
    onError: (error: any) => {
      toast.error("Sync failed", { description: error.message });
      console.error("Sync error:", error);
    }
  });

  const deletePayerConnection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payer_connections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payer-connections'] });
      toast.success("Connection deleted");
    }
  });

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
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>New API Connection</DialogTitle>
                    <DialogDescription>Connect to EHR or other healthcare systems</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    <div>
                      <Label>Connection Name</Label>
                      <Input
                        value={apiFormData.connection_name}
                        onChange={(e) => setApiFormData({ ...apiFormData, connection_name: e.target.value })}
                        placeholder="ECW Sandbox"
                      />
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
                        <div>
                          <Label>Scopes</Label>
                          <Input
                            value={apiFormData.scope}
                            onChange={(e) => setApiFormData({ ...apiFormData, scope: e.target.value })}
                            placeholder="system/Patient.read system/Claim.read ..."
                          />
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
                  {apiConnections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">{conn.connection_name}</TableCell>
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
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => syncECWData.mutate(conn.id)}
                                disabled={syncECWData.isPending || !conn.is_active}
                              >
                                <RefreshCw className={`h-4 w-4 mr-1 ${syncECWData.isPending ? 'animate-spin' : ''}`} />
                                {syncECWData.isPending ? 'Syncing...' : 'Sync Data'}
                              </Button>
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
                  ))}
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
    </div>
  );
}
