import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Search,
  Filter,
  ArrowLeft,
  Eye,
  Loader2,
  Calendar,
  FileText,
  Stethoscope,
  TrendingDown,
  Download,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { DenialOutcomeTracker } from "@/components/DenialOutcomeTracker";

interface ClaimInfo {
  patient_name?: string;
  payer?: string;
  procedures?: { cpt_code: string; units: number }[];
  icd_codes?: string[];
  billed_amount?: number;
}

interface ScrubResult {
  id: string;
  denial_risk_score: number;
  risk_level: string;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  all_issues: any[];
  corrections: any[];
  claim_info: ClaimInfo | null;
  created_at: string;
  status: string;
}

export default function ScrubHistory() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [selectedScrub, setSelectedScrub] = useState<ScrubResult | null>(null);
  const [outcomeModalOpen, setOutcomeModalOpen] = useState(false);
  const [selectedForOutcome, setSelectedForOutcome] = useState<any>(null);

  const handleRecordOutcome = (result: ScrubResult) => {
    setSelectedForOutcome({
      id: result.id,
      patient_name: result.claim_info?.patient_name || 'Unknown',
      payer: result.claim_info?.payer || 'Unknown',
      procedure_codes: result.claim_info?.procedures?.map((p) => p.cpt_code) || [],
      icd_codes: result.claim_info?.icd_codes || [],
      risk_score: result.denial_risk_score,
      risk_level: result.risk_level,
      issues_count: (result.critical_count || 0) + (result.high_count || 0) + 
                    (result.medium_count || 0) + (result.low_count || 0),
      claim_id: undefined
    });
    setOutcomeModalOpen(true);
  };

  const { data: scrubs, isLoading, refetch } = useQuery({
    queryKey: ['scrub-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('claim_scrub_results')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Scrub history fetch error:', error);
        return [];
      }
      return (data || []).map(item => ({
        ...item,
        claim_info: item.claim_info as ClaimInfo | null,
        all_issues: (item.all_issues || []) as any[],
        corrections: (item.corrections || []) as any[],
      })) as ScrubResult[];
    },
  });

  // Filter scrubs based on search and risk level
  const filteredScrubs = scrubs?.filter(scrub => {
    const matchesSearch = searchTerm === "" || 
      scrub.claim_info?.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scrub.claim_info?.payer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scrub.claim_info?.procedures?.some(p => p.cpt_code.includes(searchTerm));
    
    const matchesRisk = riskFilter === "all" || scrub.risk_level === riskFilter;
    
    return matchesSearch && matchesRisk;
  }) || [];

  // Stats
  const stats = {
    total: scrubs?.length || 0,
    critical: scrubs?.filter(s => s.risk_level === 'critical').length || 0,
    high: scrubs?.filter(s => s.risk_level === 'high').length || 0,
    medium: scrubs?.filter(s => s.risk_level === 'medium').length || 0,
    low: scrubs?.filter(s => s.risk_level === 'low').length || 0,
    avgRisk: scrubs?.length 
      ? Math.round(scrubs.reduce((sum, s) => sum + (s.denial_risk_score || 0), 0) / scrubs.length)
      : 0,
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'high': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default: return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
  };

  const getRiskBadge = (score: number, level: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return (
      <Badge variant="outline" className={colors[level] || colors.low}>
        {score}%
      </Badge>
    );
  };

  const exportToCSV = () => {
    if (!scrubs || scrubs.length === 0) return;

    const headers = ['Date', 'Patient', 'Payer', 'CPT Codes', 'ICD Codes', 'Risk Score', 'Risk Level', 'Issues'];
    const rows = scrubs.map(s => [
      format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
      s.claim_info?.patient_name || 'N/A',
      s.claim_info?.payer || 'N/A',
      s.claim_info?.procedures?.map(p => p.cpt_code).join('; ') || 'N/A',
      s.claim_info?.icd_codes?.join('; ') || 'N/A',
      s.denial_risk_score,
      s.risk_level,
      s.total_issues,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrub_history_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Scrub History</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              View all past claim scrub results
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => navigate('/scrubber')}>
            <Shield className="h-4 w-4 mr-2" />
            New Scrub
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Scrubs</p>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
            <p className="text-xs text-red-600/80">Critical</p>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
            <p className="text-xs text-orange-600/80">High Risk</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
            <p className="text-xs text-yellow-600/80">Medium</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.low}</p>
            <p className="text-xs text-green-600/80">Low Risk</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${
              stats.avgRisk >= 50 ? 'text-red-600' : 
              stats.avgRisk >= 25 ? 'text-yellow-600' : 'text-green-600'
            }`}>{stats.avgRisk}%</p>
            <p className="text-xs text-muted-foreground">Avg Risk</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by patient, payer, or CPT code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Scrub Results ({filteredScrubs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredScrubs.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Risk</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>CPT Codes</TableHead>
                    <TableHead className="w-[80px]">Score</TableHead>
                    <TableHead className="w-[80px]">Issues</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScrubs.map((scrub) => (
                    <TableRow 
                      key={scrub.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedScrub(scrub)}
                    >
                      <TableCell>{getRiskIcon(scrub.risk_level)}</TableCell>
                      <TableCell className="font-medium">
                        {scrub.claim_info?.patient_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {scrub.claim_info?.payer || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {scrub.claim_info?.procedures?.slice(0, 2).map(p => p.cpt_code).join(', ')}
                        {(scrub.claim_info?.procedures?.length || 0) > 2 && 
                          ` +${scrub.claim_info!.procedures!.length - 2}`}
                      </TableCell>
                      <TableCell>
                        {getRiskBadge(scrub.denial_risk_score, scrub.risk_level)}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${scrub.total_issues > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {scrub.total_issues}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(scrub.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScrub(scrub);
                            }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecordOutcome(scrub);
                            }}
                            title="Record Outcome"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-foreground">No scrubs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm || riskFilter !== "all" 
                  ? "Try adjusting your filters"
                  : "Start scrubbing claims to see results here"}
              </p>
              <Button className="mt-4" onClick={() => navigate('/scrubber')}>
                <Shield className="h-4 w-4 mr-2" />
                Scrub First Claim
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedScrub} onOpenChange={() => setSelectedScrub(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedScrub && getRiskIcon(selectedScrub.risk_level)}
              Scrub Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedScrub && (
            <div className="space-y-6">
              {/* Risk Score Header */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Denial Risk Score</p>
                  <p className={`text-4xl font-bold ${
                    selectedScrub.denial_risk_score >= 70 ? 'text-red-600' :
                    selectedScrub.denial_risk_score >= 50 ? 'text-orange-500' :
                    selectedScrub.denial_risk_score >= 25 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {selectedScrub.denial_risk_score}%
                  </p>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  {selectedScrub.risk_level.toUpperCase()} RISK
                </Badge>
              </div>

              {/* Claim Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Stethoscope className="h-3 w-3" /> Patient
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedScrub.claim_info?.patient_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Payer
                  </p>
                  <p className="font-medium text-foreground">
                    {selectedScrub.claim_info?.payer || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPT Codes</p>
                  <p className="text-sm text-foreground">
                    {selectedScrub.claim_info?.procedures?.map(p => p.cpt_code).join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ICD Codes</p>
                  <p className="text-sm text-foreground">
                    {selectedScrub.claim_info?.icd_codes?.join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Scrubbed
                  </p>
                  <p className="text-sm text-foreground">
                    {format(new Date(selectedScrub.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {/* Issue Counts */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-xl font-bold text-red-600">{selectedScrub.critical_count}</p>
                  <p className="text-xs text-red-600/80">Critical</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-xl font-bold text-orange-600">{selectedScrub.high_count}</p>
                  <p className="text-xs text-orange-600/80">High</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xl font-bold text-yellow-600">{selectedScrub.medium_count}</p>
                  <p className="text-xs text-yellow-600/80">Medium</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xl font-bold text-green-600">{selectedScrub.low_count}</p>
                  <p className="text-xs text-green-600/80">Low</p>
                </div>
              </div>

              {/* Issues List */}
              {selectedScrub.all_issues && selectedScrub.all_issues.length > 0 ? (
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Issues Found</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedScrub.all_issues.map((issue, idx) => (
                      <div 
                        key={idx}
                        className="p-3 bg-muted/30 rounded-lg border"
                      >
                        <div className="flex items-start gap-2">
                          {issue.severity === 'critical' ? <XCircle className="h-4 w-4 text-red-600 mt-0.5" /> :
                           issue.severity === 'high' ? <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5" /> :
                           issue.severity === 'medium' ? <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" /> :
                           <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {issue.code || issue.code_pair?.join(' + ') || issue.type}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {issue.message}
                            </p>
                            {issue.correction && (
                              <p className="text-xs text-primary mt-1">
                                💡 {issue.correction}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-green-50 rounded-lg">
                  <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium text-green-800">All Checks Passed!</p>
                  <p className="text-sm text-green-600">Claim was ready to submit</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/scrubber')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  New Scrub
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setSelectedScrub(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Denial Outcome Tracker Modal */}
      <DenialOutcomeTracker
        isOpen={outcomeModalOpen}
        onClose={() => setOutcomeModalOpen(false)}
        scrubResult={selectedForOutcome}
        onSaved={() => refetch()}
      />
    </div>
  );
}
