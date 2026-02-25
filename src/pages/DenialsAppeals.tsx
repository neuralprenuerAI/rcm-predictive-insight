import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { awsApi } from "@/integrations/aws/awsApi";
import { awsCrud } from "@/lib/awsCrud";
import { toast } from "sonner";
import { FileText, AlertCircle, Clock, Wand2 } from "lucide-react";

interface Denial {
  id: string;
  claim_id: string;
  denial_code: string;
  denial_reason: string;
  denial_date: string;
  denied_amount: number | null;
  payer: string;
  appeal_status: string;
}

interface Appeal {
  id: string;
  denial_queue_id: string | null;
  claim_id: string | null;
  status: string | null;
  submitted_at: string | null;
  appeal_date: string | null;
  outcome_amount: number | null;
}

// This page uses the old denials table. The new system uses denial_queue + appeals tables.

export default function DenialsAppeals() {
  const [appealDialog, setAppealDialog] = useState(false);
  const [selectedDenial, setSelectedDenial] = useState<Denial | null>(null);
  const [appealContent, setAppealContent] = useState("");
  const queryClient = useQueryClient();

  const { data: denials = [] } = useQuery({
    queryKey: ['denials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('denials')
        .select('*')
        .order('denial_date', { ascending: false });
      if (error) throw error;
      return data as Denial[];
    }
  });

  const { data: appeals = [] } = useQuery({
    queryKey: ['appeals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appeals')
        .select('id, denial_queue_id, claim_id, status, submitted_at, appeal_date, outcome_amount')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Appeal[];
    }
  });

  const createAppeal = useMutation({
    mutationFn: async (denialId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await awsCrud.insert('appeals', {
        user_id: user.id,
        denial_id: denialId,
        claim_id: selectedDenial?.claim_id,
        content: appealContent,
        status: 'draft'
      }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
      toast.success("Appeal created successfully");
      setAppealDialog(false);
      setAppealContent("");
    },
    onError: () => toast.error("Failed to create appeal")
  });

  const submitAppeal = useMutation({
    mutationFn: async (appealId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await awsCrud.update('appeals', { status: 'submitted', submitted_at: new Date().toISOString() }, { id: appealId }, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appeals'] });
      toast.success("Appeal submitted");
    }
  });

  const generateAppealLetter = useMutation({
    mutationFn: async (denialId: string) => {
      const { data, error } = await awsApi.invoke('generate-appeal', {
        body: { denialId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Appeal letter generated successfully");
      // Open letter in new window for review/printing
      const letterWindow = window.open('', '_blank');
      if (letterWindow) {
        letterWindow.document.write(`
          <html>
            <head><title>Appeal Letter</title></head>
            <body style="font-family: Arial; padding: 40px; max-width: 800px; margin: auto;">
              <pre style="white-space: pre-wrap;">${data.letter.content}</pre>
            </body>
          </html>
        `);
      }
    },
    onError: () => toast.error("Failed to generate appeal letter")
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Denials & Appeals</h1>
        <p className="text-muted-foreground">Manage claim denials and appeal submissions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Recent Denials
          </CardTitle>
          <CardDescription>Review and appeal denied claims</CardDescription>
        </CardHeader>
        <CardContent>
          {denials.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No denials found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {denials.map((denial) => (
                  <TableRow key={denial.id}>
                    <TableCell className="font-medium">{denial.claim_id}</TableCell>
                    <TableCell>{denial.payer}</TableCell>
                    <TableCell>${Number(denial.denied_amount ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{denial.denial_code}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{denial.denial_reason}</TableCell>
                    <TableCell>{new Date(denial.denial_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={denial.appeal_status === 'pending' ? 'secondary' : 'default'}>
                        {denial.appeal_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog open={appealDialog} onOpenChange={setAppealDialog}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedDenial(denial)}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Appeal
                            </Button>
                          </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create Appeal</DialogTitle>
                            <DialogDescription>
                              Submit an appeal for denied claim {selectedDenial?.claim_id}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Appeal Content</Label>
                              <Textarea
                                value={appealContent}
                                onChange={(e) => setAppealContent(e.target.value)}
                                placeholder="Explain why this claim should be reconsidered..."
                                rows={6}
                              />
                            </div>
                            <Button 
                              onClick={() => selectedDenial && createAppeal.mutate(selectedDenial.id)}
                              disabled={!appealContent.trim()}
                            >
                              Create Appeal
                            </Button>
                          </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          onClick={() => generateAppealLetter.mutate(denial.id)}
                          disabled={generateAppealLetter.isPending}
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          {generateAppealLetter.isPending ? "Generating..." : "Generate Letter"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appeals Tracker</CardTitle>
          <CardDescription>Monitor your submitted appeals</CardDescription>
        </CardHeader>
        <CardContent>
          {appeals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No appeals yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appeals.map((appeal) => (
                  <TableRow key={appeal.id}>
                    <TableCell>{appeal.claim_id}</TableCell>
                    <TableCell>
                      <Badge variant={appeal.status === 'draft' ? 'outline' : 'default'}>
                        {appeal.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {appeal.submitted_at ? new Date(appeal.submitted_at).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell>{appeal.outcome_amount ? `$${appeal.outcome_amount}` : '-'}</TableCell>
                    <TableCell>
                      {appeal.status === 'draft' && (
                        <Button 
                          size="sm" 
                          onClick={() => submitAppeal.mutate(appeal.id)}
                        >
                          Submit
                        </Button>
                      )}
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
