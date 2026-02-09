import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { awsCrud } from '@/lib/awsCrud';
import { CheckCircle, XCircle, AlertCircle, Clock, DollarSign } from 'lucide-react';

interface DenialOutcomeTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  scrubResult?: {
    id: string;
    patient_name: string;
    payer: string;
    procedure_codes: string[];
    icd_codes: string[];
    risk_score: number;
    risk_level: string;
    issues_count: number;
    claim_id?: string;
  };
  onSaved?: () => void;
}

const denialCategories = [
  { value: 'medical_necessity', label: 'Medical Necessity' },
  { value: 'coding_error', label: 'Coding Error' },
  { value: 'authorization', label: 'Prior Authorization Required' },
  { value: 'timely_filing', label: 'Timely Filing' },
  { value: 'duplicate', label: 'Duplicate Claim' },
  { value: 'coverage', label: 'Not Covered' },
  { value: 'eligibility', label: 'Patient Eligibility' },
  { value: 'bundling', label: 'Bundling/NCCI Edit' },
  { value: 'modifier', label: 'Modifier Issue' },
  { value: 'other', label: 'Other' }
];

const commonDenialCodes = [
  { code: 'CO-4', description: 'Procedure code inconsistent with modifier' },
  { code: 'CO-11', description: 'Diagnosis inconsistent with procedure' },
  { code: 'CO-16', description: 'Claim lacks information needed for adjudication' },
  { code: 'CO-18', description: 'Duplicate claim/service' },
  { code: 'CO-22', description: 'Care may be covered by another payer' },
  { code: 'CO-29', description: 'Time limit for filing has expired' },
  { code: 'CO-50', description: 'Non-covered service' },
  { code: 'CO-96', description: 'Non-covered charge(s)' },
  { code: 'CO-97', description: 'Benefit for this service included in another service' },
  { code: 'CO-167', description: 'Diagnosis not covered' },
  { code: 'CO-197', description: 'Precertification/authorization absent' },
  { code: 'PR-1', description: 'Deductible amount' },
  { code: 'PR-2', description: 'Coinsurance amount' },
  { code: 'PR-3', description: 'Co-payment amount' }
];

export function DenialOutcomeTracker({ isOpen, onClose, scrubResult, onSaved }: DenialOutcomeTrackerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [outcome, setOutcome] = useState('');
  const [denialReasonCode, setDenialReasonCode] = useState('');
  const [denialReasonDescription, setDenialReasonDescription] = useState('');
  const [denialCategory, setDenialCategory] = useState('');
  const [billedAmount, setBilledAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [dateOfService, setDateOfService] = useState('');
  const [dateAdjudicated, setDateAdjudicated] = useState('');
  const [notes, setNotes] = useState('');

  const handleDenialCodeSelect = (code: string) => {
    setDenialReasonCode(code);
    const found = commonDenialCodes.find(c => c.code === code);
    if (found) {
      setDenialReasonDescription(found.description);
    }
  };

  const handleSave = async () => {
    if (!outcome) {
      toast({ title: 'Please select an outcome', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate if prediction was correct
      let wasPredictionCorrect: boolean | null = null;
      if (scrubResult) {
        const predictedDenial = scrubResult.risk_score >= 50;
        const actualDenial = outcome === 'denied';
        wasPredictionCorrect = predictedDenial === actualDenial;
      }

      const deniedAmount = outcome === 'denied' 
        ? parseFloat(billedAmount) || 0 
        : outcome === 'partial' 
          ? (parseFloat(billedAmount) || 0) - (parseFloat(paidAmount) || 0)
          : 0;

      await awsCrud.insert('denial_outcomes', {
        user_id: user.id,
        scrub_result_id: scrubResult?.id,
        claim_id: scrubResult?.claim_id,
        patient_name: scrubResult?.patient_name,
        payer: scrubResult?.payer,
        procedure_codes: scrubResult?.procedure_codes,
        icd_codes: scrubResult?.icd_codes,
        predicted_risk_score: scrubResult?.risk_score,
        predicted_risk_level: scrubResult?.risk_level,
        issues_flagged: scrubResult?.issues_count || 0,
        outcome,
        denial_reason_code: denialReasonCode || null,
        denial_reason_description: denialReasonDescription || null,
        denial_category: denialCategory || null,
        billed_amount: parseFloat(billedAmount) || null,
        paid_amount: parseFloat(paidAmount) || null,
        denied_amount: deniedAmount || null,
        date_of_service: dateOfService || null,
        date_adjudicated: dateAdjudicated || null,
        was_prediction_correct: wasPredictionCorrect,
        notes: notes || null
      }, user.id);

      toast({ 
        title: 'Outcome recorded!',
        description: wasPredictionCorrect 
          ? '✅ Our prediction was correct!' 
          : '📊 Thanks for the feedback - this helps improve predictions.'
      });
      
      onSaved?.();
      onClose();
      
      // Reset form
      setOutcome('');
      setDenialReasonCode('');
      setDenialReasonDescription('');
      setDenialCategory('');
      setBilledAmount('');
      setPaidAmount('');
      setDateOfService('');
      setDateAdjudicated('');
      setNotes('');
      
    } catch (error) {
      console.error('Error saving outcome:', error);
      toast({ title: 'Error saving outcome', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Record Claim Outcome
          </DialogTitle>
        </DialogHeader>

        {scrubResult && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <p className="font-medium text-foreground">{scrubResult.patient_name}</p>
            <p className="text-muted-foreground">{scrubResult.payer}</p>
            <p className="text-xs text-muted-foreground">
              CPT: {scrubResult.procedure_codes?.join(', ')}
            </p>
            <p className="text-xs">
              Predicted Risk:
              <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                scrubResult.risk_score >= 70 ? 'bg-red-100 text-red-700' :
                scrubResult.risk_score >= 50 ? 'bg-orange-100 text-orange-700' :
                scrubResult.risk_score >= 25 ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {scrubResult.risk_score}%
              </span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Outcome Selection */}
          <div>
            <Label className="mb-2 block">What happened to this claim? *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={outcome === 'paid' ? 'default' : 'outline'}
                className={`flex items-center gap-2 ${outcome === 'paid' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                onClick={() => setOutcome('paid')}
              >
                <CheckCircle className="h-4 w-4" />
                Paid
              </Button>
              <Button
                type="button"
                variant={outcome === 'denied' ? 'default' : 'outline'}
                className={`flex items-center gap-2 ${outcome === 'denied' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                onClick={() => setOutcome('denied')}
              >
                <XCircle className="h-4 w-4" />
                Denied
              </Button>
              <Button
                type="button"
                variant={outcome === 'partial' ? 'default' : 'outline'}
                className={`flex items-center gap-2 ${outcome === 'partial' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                onClick={() => setOutcome('partial')}
              >
                <AlertCircle className="h-4 w-4" />
                Partial Pay
              </Button>
              <Button
                type="button"
                variant={outcome === 'pending' ? 'default' : 'outline'}
                className={`flex items-center gap-2 ${outcome === 'pending' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                onClick={() => setOutcome('pending')}
              >
                <Clock className="h-4 w-4" />
                Pending
              </Button>
            </div>
          </div>

          {/* Denial Details - Only show if denied or partial */}
          {(outcome === 'denied' || outcome === 'partial') && (
            <>
              <div>
                <Label>Denial Reason Code</Label>
                <Select value={denialReasonCode} onValueChange={handleDenialCodeSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select denial code" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonDenialCodes.map(code => (
                      <SelectItem key={code.code} value={code.code}>
                        {code.code} - {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Denial Category</Label>
                <Select value={denialCategory} onValueChange={setDenialCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {denialCategories.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Denial Reason Description</Label>
                <Textarea
                  value={denialReasonDescription}
                  onChange={(e) => setDenialReasonDescription(e.target.value)}
                  placeholder="Enter denial reason from EOB"
                  rows={2}
                />
              </div>
            </>
          )}

          {/* Financial Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Billed Amount ($)</Label>
              <Input
                type="number"
                value={billedAmount}
                onChange={(e) => setBilledAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Paid Amount ($)</Label>
              <Input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date of Service</Label>
              <Input
                type="date"
                value={dateOfService}
                onChange={(e) => setDateOfService(e.target.value)}
              />
            </div>
            <div>
              <Label>Date Adjudicated</Label>
              <Input
                type="date"
                value={dateAdjudicated}
                onChange={(e) => setDateAdjudicated(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this claim"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !outcome}>
            {loading ? 'Saving...' : 'Save Outcome'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DenialOutcomeTracker;
