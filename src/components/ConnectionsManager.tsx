import { useState } from "react";
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
import { Plus, Plug, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function ConnectionsManager() {
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [payerDialogOpen, setPayerDialogOpen] = useState(false);
  const [apiFormData, setApiFormData] = useState({
    connection_name: "",
    connection_type: "ehr",
    api_url: "",
    api_key: ""
  });
  const [payerFormData, setPayerFormData] = useState({
    payer_name: "",
    portal_url: "",
    username: "",
    password: ""
  });
  const queryClient = useQueryClient();

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

      const { error } = await supabase.from('api_connections').insert({
        user_id: user.id,
        connection_name: apiFormData.connection_name,
        connection_type: apiFormData.connection_type,
        api_url: apiFormData.api_url,
        api_key_encrypted: apiFormData.api_key, // In production, encrypt this
        is_active: true
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-connections'] });
      toast.success("API connection created");
      setApiDialogOpen(false);
      setApiFormData({ connection_name: "", connection_type: "ehr", api_url: "", api_key: "" });
    },
    onError: () => toast.error("Failed to create connection")
  });

  const createPayerConnection = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('payer_connections').insert({
        user_id: user.id,
        payer_name: payerFormData.payer_name,
        portal_url: payerFormData.portal_url,
        credentials_encrypted: JSON.stringify({ // In production, encrypt this
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
            <div className="flex justify-end">
              <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add API Connection
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New API Connection</DialogTitle>
                    <DialogDescription>Connect to EHR or other healthcare systems</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Connection Name</Label>
                      <Input
                        value={apiFormData.connection_name}
                        onChange={(e) => setApiFormData({ ...apiFormData, connection_name: e.target.value })}
                        placeholder="My EHR System"
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
                          <SelectItem value="ehr">EHR System</SelectItem>
                          <SelectItem value="payer">Payer API</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteAPIConnection.mutate(conn.id)}
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
                        placeholder="Your portal username"
                      />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <Input
                        type="password"
                        value={payerFormData.password}
                        onChange={(e) => setPayerFormData({ ...payerFormData, password: e.target.value })}
                        placeholder="Your portal password"
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
                    <TableHead>Created</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payerConnections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell className="font-medium">{conn.payer_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{conn.portal_url}</TableCell>
                      <TableCell>{new Date(conn.created_at).toLocaleDateString()}</TableCell>
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
  );
}
