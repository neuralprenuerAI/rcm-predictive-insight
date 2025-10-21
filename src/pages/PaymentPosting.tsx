import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, DollarSign } from "lucide-react";

interface Payment {
  id: string;
  claim_id: string;
  payer: string;
  amount: number;
  payment_date: string;
  method: string | null;
  reference: string | null;
}

export default function PaymentPosting() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    claim_id: "",
    payer: "",
    amount: "",
    payment_date: new Date().toISOString().split('T')[0],
    method: "check",
    reference: ""
  });
  const queryClient = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data as Payment[];
    }
  });

  const { data: claims = [] } = useQuery({
    queryKey: ['claims-for-payment'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claims')
        .select('id, claim_id, patient_name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const postPayment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from('payments').insert({
        user_id: user.id,
        claim_id: formData.claim_id,
        payer: formData.payer,
        amount: parseFloat(formData.amount),
        payment_date: formData.payment_date,
        method: formData.method,
        reference: formData.reference
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success("Payment posted successfully");
      setDialogOpen(false);
      setFormData({ 
        claim_id: "", 
        payer: "", 
        amount: "", 
        payment_date: new Date().toISOString().split('T')[0],
        method: "check",
        reference: ""
      });
    },
    onError: () => toast.error("Failed to post payment")
  });

  const totalPayments = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Payment Posting</h1>
          <p className="text-muted-foreground">Record and track claim payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Post Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Post New Payment</DialogTitle>
              <DialogDescription>Record a payment received for a claim</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Claim</Label>
                <Select value={formData.claim_id} onValueChange={(v) => setFormData({ ...formData, claim_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select claim" />
                  </SelectTrigger>
                  <SelectContent>
                    {claims.map((claim) => (
                      <SelectItem key={claim.id} value={claim.id}>
                        {claim.claim_id} - {claim.patient_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payer</Label>
                <Input
                  value={formData.payer}
                  onChange={(e) => setFormData({ ...formData, payer: e.target.value })}
                  placeholder="Insurance Company"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Method</Label>
                <Select value={formData.method} onValueChange={(v) => setFormData({ ...formData, method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="eft">EFT</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference Number</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>
              <Button onClick={() => postPayment.mutate()} className="w-full">
                Post Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalPayments.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payments Posted</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payments.length}</div>
            <p className="text-xs text-muted-foreground">Total transactions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${payments.length > 0 ? (totalPayments / payments.length).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>Recent payments received</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payments posted yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{payment.claim_id}</TableCell>
                    <TableCell>{payment.payer}</TableCell>
                    <TableCell className="capitalize">{payment.method || '-'}</TableCell>
                    <TableCell>{payment.reference || '-'}</TableCell>
                    <TableCell className="text-right font-medium">${Number(payment.amount).toFixed(2)}</TableCell>
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
