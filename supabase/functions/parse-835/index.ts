import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// X12 835 SEGMENT PARSERS
// ============================================

interface Segment {
  id: string;
  elements: string[];
  raw: string;
}

interface ParsedISA {
  senderQualifier: string;
  senderId: string;
  receiverQualifier: string;
  receiverId: string;
  date: string;
  time: string;
  controlNumber: string;
}

interface ParsedGS {
  functionalCode: string;
  senderCode: string;
  receiverCode: string;
  date: string;
  time: string;
  controlNumber: string;
}

interface ParsedBPR {
  transactionHandlingCode: string;
  paymentAmount: number;
  creditDebitFlag: string;
  paymentMethod: string;
  paymentFormat: string;
  senderDFI: string;
  senderAccountQualifier: string;
  senderAccountNumber: string;
  originatingCompanyId: string;
  receiverDFI: string;
  receiverAccountQualifier: string;
  receiverAccountNumber: string;
  checkDate: string;
}

interface ParsedTRN {
  traceType: string;
  traceNumber: string;
  originatingCompanyId: string;
}

interface ParsedN1 {
  entityCode: string;
  name: string;
  idQualifier: string;
  id: string;
}

interface ParsedN3 {
  addressLine1: string;
  addressLine2: string;
}

interface ParsedN4 {
  city: string;
  state: string;
  zip: string;
}

interface ParsedREF {
  qualifier: string;
  value: string;
}

interface ParsedCLP {
  claimSubmitterId: string;
  statusCode: string;
  totalCharge: number;
  totalPaid: number;
  patientResponsibility: number;
  claimFilingIndicator: string;
  payerClaimControlNumber: string;
  facilityTypeCode: string;
  claimFrequencyCode: string;
}

interface ParsedCAS {
  groupCode: string;
  adjustments: Array<{
    reasonCode: string;
    amount: number;
    quantity: number;
  }>;
}

interface ParsedSVC {
  procedureQualifier: string;
  procedureCode: string;
  modifiers: string[];
  chargeAmount: number;
  paidAmount: number;
  revenueCode: string;
  unitsBilled: number;
  unitsPaid: number;
  originalProcedureCode: string;
}

interface ParsedDTM {
  qualifier: string;
  date: string;
}

interface ServiceLine {
  svc: ParsedSVC;
  dates: ParsedDTM[];
  adjustments: ParsedCAS[];
  references: ParsedREF[];
  lineItemControlNumber: string;
  renderingProviderId: string;
  remarkCodes: string[];
}

interface Claim {
  clp: ParsedCLP;
  patient: { name: string; id: string; idQualifier: string };
  subscriber: { name: string; id: string };
  renderingProvider: { name: string; npi: string };
  dates: ParsedDTM[];
  adjustments: ParsedCAS[];
  serviceLines: ServiceLine[];
  amounts: Record<string, number>;
}

interface Payer {
  name: string;
  id: string;
  idQualifier: string;
  address: { line1: string; line2: string; city: string; state: string; zip: string };
  contactName: string;
  contactPhone: string;
}

interface Payee {
  name: string;
  npi: string;
  taxId: string;
  idQualifier: string;
  address: { line1: string; line2: string; city: string; state: string; zip: string };
}

interface Parsed835 {
  isa: ParsedISA;
  gs: ParsedGS;
  bpr: ParsedBPR;
  trn: ParsedTRN;
  payer: Payer;
  payee: Payee;
  claims: Claim[];
  checkNumber: string;
  checkDate: string;
  totalPaid: number;
}

// Parse raw EDI content into segments
function parseSegments(content: string): Segment[] {
  // Detect delimiters from ISA segment
  // ISA is always 106 characters, element separator is at position 3, segment terminator is at 105
  const elementSeparator = content.charAt(3);
  
  // Find segment terminator - it's after ISA16 (1 char) at position 105
  let segmentTerminator = content.charAt(105);
  
  // Handle different terminator scenarios (could be ~, \n, or ~\n)
  if (segmentTerminator === '\r' || segmentTerminator === '\n') {
    segmentTerminator = '\n';
  }
  
  // Also check for ~ as common terminator
  if (content.includes('~')) {
    segmentTerminator = '~';
  }
  
  console.log(`Delimiters - Element: '${elementSeparator}', Segment: '${segmentTerminator === '\n' ? '\\n' : segmentTerminator}'`);
  
  // Split into segments
  const rawSegments = content
    .split(new RegExp(`${segmentTerminator === '~' ? '~' : segmentTerminator}+`))
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  // Parse each segment
  return rawSegments.map(raw => {
    const elements = raw.split(elementSeparator);
    return {
      id: elements[0],
      elements: elements.slice(1),
      raw,
    };
  });
}

// Parse ISA segment (Interchange Control Header)
function parseISA(segment: Segment): ParsedISA {
  return {
    senderQualifier: segment.elements[4]?.trim() || '',
    senderId: segment.elements[5]?.trim() || '',
    receiverQualifier: segment.elements[6]?.trim() || '',
    receiverId: segment.elements[7]?.trim() || '',
    date: segment.elements[8]?.trim() || '',
    time: segment.elements[9]?.trim() || '',
    controlNumber: segment.elements[12]?.trim() || '',
  };
}

// Parse GS segment (Functional Group Header)
function parseGS(segment: Segment): ParsedGS {
  return {
    functionalCode: segment.elements[0] || '',
    senderCode: segment.elements[1] || '',
    receiverCode: segment.elements[2] || '',
    date: segment.elements[3] || '',
    time: segment.elements[4] || '',
    controlNumber: segment.elements[5] || '',
  };
}

// Parse BPR segment (Financial Information)
function parseBPR(segment: Segment): ParsedBPR {
  return {
    transactionHandlingCode: segment.elements[0] || '',
    paymentAmount: parseFloat(segment.elements[1]) || 0,
    creditDebitFlag: segment.elements[2] || '',
    paymentMethod: segment.elements[3] || '',
    paymentFormat: segment.elements[4] || '',
    senderDFI: segment.elements[5] || '',
    senderAccountQualifier: segment.elements[6] || '',
    senderAccountNumber: segment.elements[7] || '',
    originatingCompanyId: segment.elements[8] || '',
    receiverDFI: segment.elements[11] || '',
    receiverAccountQualifier: segment.elements[12] || '',
    receiverAccountNumber: segment.elements[13] || '',
    checkDate: segment.elements[15] || '',
  };
}

// Parse TRN segment (Trace Number)
function parseTRN(segment: Segment): ParsedTRN {
  return {
    traceType: segment.elements[0] || '',
    traceNumber: segment.elements[1] || '',
    originatingCompanyId: segment.elements[2] || '',
  };
}

// Parse N1 segment (Name)
function parseN1(segment: Segment): ParsedN1 {
  return {
    entityCode: segment.elements[0] || '',
    name: segment.elements[1] || '',
    idQualifier: segment.elements[2] || '',
    id: segment.elements[3] || '',
  };
}

// Parse N3 segment (Address)
function parseN3(segment: Segment): ParsedN3 {
  return {
    addressLine1: segment.elements[0] || '',
    addressLine2: segment.elements[1] || '',
  };
}

// Parse N4 segment (City/State/Zip)
function parseN4(segment: Segment): ParsedN4 {
  return {
    city: segment.elements[0] || '',
    state: segment.elements[1] || '',
    zip: segment.elements[2] || '',
  };
}

// Parse REF segment (Reference)
function parseREF(segment: Segment): ParsedREF {
  return {
    qualifier: segment.elements[0] || '',
    value: segment.elements[1] || '',
  };
}

// Parse CLP segment (Claim Payment Information)
function parseCLP(segment: Segment): ParsedCLP {
  return {
    claimSubmitterId: segment.elements[0] || '',
    statusCode: segment.elements[1] || '',
    totalCharge: parseFloat(segment.elements[2]) || 0,
    totalPaid: parseFloat(segment.elements[3]) || 0,
    patientResponsibility: parseFloat(segment.elements[4]) || 0,
    claimFilingIndicator: segment.elements[5] || '',
    payerClaimControlNumber: segment.elements[6] || '',
    facilityTypeCode: segment.elements[7] || '',
    claimFrequencyCode: segment.elements[8] || '',
  };
}

// Parse CAS segment (Claim Adjustment)
function parseCAS(segment: Segment): ParsedCAS {
  const adjustments: Array<{ reasonCode: string; amount: number; quantity: number }> = [];
  
  // CAS can have up to 6 adjustment groups (reason, amount, quantity triplets)
  for (let i = 1; i < segment.elements.length; i += 3) {
    if (segment.elements[i]) {
      adjustments.push({
        reasonCode: segment.elements[i] || '',
        amount: parseFloat(segment.elements[i + 1]) || 0,
        quantity: parseFloat(segment.elements[i + 2]) || 0,
      });
    }
  }
  
  return {
    groupCode: segment.elements[0] || '',
    adjustments,
  };
}

// Parse SVC segment (Service Payment Information)
function parseSVC(segment: Segment): ParsedSVC {
  // SVC01 is composite: qualifier:code:modifier:modifier...
  const procedureComposite = (segment.elements[0] || '').split(':');
  
  return {
    procedureQualifier: procedureComposite[0] || '',
    procedureCode: procedureComposite[1] || '',
    modifiers: procedureComposite.slice(2).filter(m => m),
    chargeAmount: parseFloat(segment.elements[1]) || 0,
    paidAmount: parseFloat(segment.elements[2]) || 0,
    revenueCode: segment.elements[3] || '',
    unitsBilled: parseFloat(segment.elements[4]) || 0,
    unitsPaid: parseFloat(segment.elements[6]) || 0,
    originalProcedureCode: (segment.elements[5] || '').split(':')[1] || '',
  };
}

// Parse DTM segment (Date/Time)
function parseDTM(segment: Segment): ParsedDTM {
  return {
    qualifier: segment.elements[0] || '',
    date: segment.elements[1] || '',
  };
}

// Parse NM1 segment (Individual or Organizational Name)
function parseNM1(segment: Segment): { entityCode: string; lastName: string; firstName: string; middleName: string; idQualifier: string; id: string } {
  return {
    entityCode: segment.elements[0] || '',
    lastName: segment.elements[2] || '',
    firstName: segment.elements[3] || '',
    middleName: segment.elements[4] || '',
    idQualifier: segment.elements[7] || '',
    id: segment.elements[8] || '',
  };
}

// Get claim status description
function getClaimStatusDescription(code: string): string {
  const statuses: Record<string, string> = {
    '1': 'Processed as Primary',
    '2': 'Processed as Secondary',
    '3': 'Processed as Tertiary',
    '4': 'Denied',
    '19': 'Processed as Primary, Forwarded to Additional Payer(s)',
    '20': 'Processed as Secondary, Forwarded to Additional Payer(s)',
    '21': 'Processed as Tertiary, Forwarded to Additional Payer(s)',
    '22': 'Reversal of Previous Payment',
    '23': 'Not Our Claim, Forwarded to Additional Payer(s)',
    '25': 'Predetermination Pricing Only - No Payment',
  };
  return statuses[code] || `Unknown (${code})`;
}

// Format date from YYYYMMDD or YYMMDD to YYYY-MM-DD
function formatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  let year: string, month: string, day: string;
  
  if (dateStr.length === 8) {
    year = dateStr.substring(0, 4);
    month = dateStr.substring(4, 6);
    day = dateStr.substring(6, 8);
  } else if (dateStr.length === 6) {
    const yy = parseInt(dateStr.substring(0, 2));
    year = (yy > 50 ? '19' : '20') + dateStr.substring(0, 2);
    month = dateStr.substring(2, 4);
    day = dateStr.substring(4, 6);
  } else {
    return null;
  }
  
  return `${year}-${month}-${day}`;
}

// Main 835 parser
function parse835(content: string): Parsed835 {
  const segments = parseSegments(content);
  
  // Initialize result structure
  const result: Parsed835 = {
    isa: {} as ParsedISA,
    gs: {} as ParsedGS,
    bpr: {} as ParsedBPR,
    trn: {} as ParsedTRN,
    payer: {
      name: '', id: '', idQualifier: '',
      address: { line1: '', line2: '', city: '', state: '', zip: '' },
      contactName: '', contactPhone: '',
    },
    payee: {
      name: '', npi: '', taxId: '', idQualifier: '',
      address: { line1: '', line2: '', city: '', state: '', zip: '' },
    },
    claims: [],
    checkNumber: '',
    checkDate: '',
    totalPaid: 0,
  };
  
  let currentN1Entity = '';
  let currentClaim: Claim | null = null;
  let currentServiceLine: ServiceLine | null = null;
  let inClaimLoop = false;
  let inServiceLoop = false;
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    switch (segment.id) {
      case 'ISA':
        result.isa = parseISA(segment);
        break;
        
      case 'GS':
        result.gs = parseGS(segment);
        break;
        
      case 'BPR':
        result.bpr = parseBPR(segment);
        result.totalPaid = result.bpr.paymentAmount;
        result.checkDate = formatDate(result.bpr.checkDate) || '';
        break;
        
      case 'TRN':
        result.trn = parseTRN(segment);
        result.checkNumber = result.trn.traceNumber;
        break;
        
      case 'N1':
        const n1 = parseN1(segment);
        currentN1Entity = n1.entityCode;
        
        if (n1.entityCode === 'PR') {
          // Payer
          result.payer.name = n1.name;
          result.payer.id = n1.id;
          result.payer.idQualifier = n1.idQualifier;
        } else if (n1.entityCode === 'PE') {
          // Payee
          result.payee.name = n1.name;
          result.payee.npi = n1.idQualifier === 'XX' ? n1.id : '';
          result.payee.taxId = n1.idQualifier === 'FI' ? n1.id : '';
          result.payee.idQualifier = n1.idQualifier;
        }
        break;
        
      case 'N3':
        const n3 = parseN3(segment);
        if (currentN1Entity === 'PR') {
          result.payer.address.line1 = n3.addressLine1;
          result.payer.address.line2 = n3.addressLine2;
        } else if (currentN1Entity === 'PE') {
          result.payee.address.line1 = n3.addressLine1;
          result.payee.address.line2 = n3.addressLine2;
        }
        break;
        
      case 'N4':
        const n4 = parseN4(segment);
        if (currentN1Entity === 'PR') {
          result.payer.address.city = n4.city;
          result.payer.address.state = n4.state;
          result.payer.address.zip = n4.zip;
        } else if (currentN1Entity === 'PE') {
          result.payee.address.city = n4.city;
          result.payee.address.state = n4.state;
          result.payee.address.zip = n4.zip;
        }
        break;
        
      case 'PER':
        if (currentN1Entity === 'PR') {
          result.payer.contactName = segment.elements[1] || '';
          result.payer.contactPhone = segment.elements[3] || '';
        }
        break;
        
      case 'REF':
        const ref = parseREF(segment);
        if (currentN1Entity === 'PE') {
          if (ref.qualifier === 'TJ') {
            result.payee.taxId = ref.value;
          }
        }
        if (currentServiceLine && inServiceLoop) {
          currentServiceLine.references.push(ref);
          if (ref.qualifier === '6R') {
            currentServiceLine.lineItemControlNumber = ref.value;
          }
        } else if (currentClaim && inClaimLoop) {
          // Claim-level reference
        }
        break;
        
      case 'CLP':
        // Save previous claim if exists
        if (currentClaim) {
          if (currentServiceLine) {
            currentClaim.serviceLines.push(currentServiceLine);
          }
          result.claims.push(currentClaim);
        }
        
        const clp = parseCLP(segment);
        currentClaim = {
          clp,
          patient: { name: '', id: '', idQualifier: '' },
          subscriber: { name: '', id: '' },
          renderingProvider: { name: '', npi: '' },
          dates: [],
          adjustments: [],
          serviceLines: [],
          amounts: {},
        };
        currentServiceLine = null;
        inClaimLoop = true;
        inServiceLoop = false;
        break;
        
      case 'CAS':
        const cas = parseCAS(segment);
        if (currentServiceLine && inServiceLoop) {
          currentServiceLine.adjustments.push(cas);
        } else if (currentClaim) {
          currentClaim.adjustments.push(cas);
        }
        break;
        
      case 'NM1':
        const nm1 = parseNM1(segment);
        if (currentClaim) {
          if (nm1.entityCode === 'QC') {
            // Patient
            currentClaim.patient = {
              name: `${nm1.lastName}, ${nm1.firstName} ${nm1.middleName}`.trim(),
              id: nm1.id,
              idQualifier: nm1.idQualifier,
            };
          } else if (nm1.entityCode === 'IL') {
            // Subscriber
            currentClaim.subscriber = {
              name: `${nm1.lastName}, ${nm1.firstName}`.trim(),
              id: nm1.id,
            };
          } else if (nm1.entityCode === '82') {
            // Rendering Provider
            currentClaim.renderingProvider = {
              name: nm1.lastName,
              npi: nm1.idQualifier === 'XX' ? nm1.id : '',
            };
          }
        }
        break;
        
      case 'SVC':
        // Save previous service line if exists
        if (currentServiceLine && currentClaim) {
          currentClaim.serviceLines.push(currentServiceLine);
        }
        
        const svc = parseSVC(segment);
        currentServiceLine = {
          svc,
          dates: [],
          adjustments: [],
          references: [],
          lineItemControlNumber: '',
          renderingProviderId: '',
          remarkCodes: [],
        };
        inServiceLoop = true;
        break;
        
      case 'DTM':
        const dtm = parseDTM(segment);
        if (currentServiceLine && inServiceLoop) {
          currentServiceLine.dates.push(dtm);
        } else if (currentClaim) {
          currentClaim.dates.push(dtm);
        }
        break;
        
      case 'AMT':
        if (currentClaim) {
          const amtQualifier = segment.elements[0] || '';
          const amtValue = parseFloat(segment.elements[1]) || 0;
          currentClaim.amounts[amtQualifier] = amtValue;
        }
        break;
        
      case 'LQ':
        // Remark codes
        if (currentServiceLine && segment.elements[0] === 'HE') {
          currentServiceLine.remarkCodes.push(segment.elements[1] || '');
        }
        break;
        
      case 'SE':
      case 'GE':
      case 'IEA':
        // End of transaction - save final claim
        if (currentServiceLine && currentClaim) {
          currentClaim.serviceLines.push(currentServiceLine);
        }
        if (currentClaim) {
          result.claims.push(currentClaim);
          currentClaim = null;
        }
        inClaimLoop = false;
        inServiceLoop = false;
        break;
    }
  }
  
  return result;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      content,        // Raw 835 EDI content
      documentId,     // Optional: link to documents table
      saveToDatabase = true,  // Whether to save parsed data to database
    } = await req.json();

    if (!content) {
      throw new Error("Missing required field: content");
    }

    // Get auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get user
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    console.log("Parsing 835 EDI content...");
    const startTime = Date.now();
    
    // Parse the 835
    const parsed = parse835(content);
    
    const processingTime = Date.now() - startTime;
    console.log(`Parsed 835: ${parsed.claims.length} claims, $${parsed.totalPaid} total, ${processingTime}ms`);

    // Save to database if requested
    let ediFileId: string | null = null;
    let remittanceId: string | null = null;

    if (saveToDatabase) {
      // 1. Create EDI file record
      const { data: ediFile, error: ediError } = await supabaseClient
        .from('edi_files')
        .insert({
          user_id: user.id,
          document_id: documentId || null,
          file_type: '835',
          interchange_control_number: parsed.isa.controlNumber,
          interchange_date: formatDate(parsed.isa.date),
          sender_id: parsed.isa.senderId,
          sender_qualifier: parsed.isa.senderQualifier,
          receiver_id: parsed.isa.receiverId,
          receiver_qualifier: parsed.isa.receiverQualifier,
          functional_group_control_number: parsed.gs.controlNumber,
          application_sender_code: parsed.gs.senderCode,
          application_receiver_code: parsed.gs.receiverCode,
          transaction_count: parsed.claims.length,
          status: 'parsed',
          parsed_data: parsed,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (ediError) {
        console.error('Error creating EDI file record:', ediError);
      } else {
        ediFileId = ediFile.id;
      }

      // 2. Create remittance record
      const { data: remittance, error: remittanceError } = await supabaseClient
        .from('remittances')
        .insert({
          user_id: user.id,
          edi_file_id: ediFileId,
          transaction_handling_code: parsed.bpr.transactionHandlingCode,
          payment_amount: parsed.bpr.paymentAmount,
          credit_debit_flag: parsed.bpr.creditDebitFlag,
          payment_method: parsed.bpr.paymentMethod,
          payment_format: parsed.bpr.paymentFormat,
          check_number: parsed.checkNumber,
          check_date: parsed.checkDate || null,
          sender_dfi_number: parsed.bpr.senderDFI,
          sender_account_number: parsed.bpr.senderAccountNumber,
          receiver_dfi_number: parsed.bpr.receiverDFI,
          receiver_account_number: parsed.bpr.receiverAccountNumber,
          trace_type: parsed.trn.traceType,
          trace_number: parsed.trn.traceNumber,
          originating_company_id: parsed.trn.originatingCompanyId,
          payer_name: parsed.payer.name,
          payer_id: parsed.payer.id,
          payer_id_qualifier: parsed.payer.idQualifier,
          payer_address_line1: parsed.payer.address.line1,
          payer_address_line2: parsed.payer.address.line2,
          payer_city: parsed.payer.address.city,
          payer_state: parsed.payer.address.state,
          payer_zip: parsed.payer.address.zip,
          payer_contact_name: parsed.payer.contactName,
          payer_contact_phone: parsed.payer.contactPhone,
          payee_name: parsed.payee.name,
          payee_npi: parsed.payee.npi,
          payee_tax_id: parsed.payee.taxId,
          payee_id_qualifier: parsed.payee.idQualifier,
          payee_address_line1: parsed.payee.address.line1,
          payee_address_line2: parsed.payee.address.line2,
          payee_city: parsed.payee.address.city,
          payee_state: parsed.payee.address.state,
          payee_zip: parsed.payee.address.zip,
          total_claims: parsed.claims.length,
          total_paid: parsed.totalPaid,
          total_charged: parsed.claims.reduce((sum, c) => sum + c.clp.totalCharge, 0),
        })
        .select('id')
        .single();

      if (remittanceError) {
        console.error('Error creating remittance record:', remittanceError);
      } else {
        remittanceId = remittance.id;
      }

      // 3. Create remittance claim records
      if (remittanceId) {
        for (const claim of parsed.claims) {
          // Find service date from DTM segments
          const serviceDateStart = claim.dates.find(d => d.qualifier === '232' || d.qualifier === '472')?.date;
          const serviceDateEnd = claim.dates.find(d => d.qualifier === '233')?.date;

          const { data: remittanceClaim, error: claimError } = await supabaseClient
            .from('remittance_claims')
            .insert({
              remittance_id: remittanceId,
              user_id: user.id,
              claim_submitter_id: claim.clp.claimSubmitterId,
              claim_status_code: claim.clp.statusCode,
              claim_status_description: getClaimStatusDescription(claim.clp.statusCode),
              total_charge: claim.clp.totalCharge,
              total_paid: claim.clp.totalPaid,
              patient_responsibility: claim.clp.patientResponsibility,
              claim_filing_indicator: claim.clp.claimFilingIndicator,
              payer_claim_control_number: claim.clp.payerClaimControlNumber,
              facility_type_code: claim.clp.facilityTypeCode,
              claim_frequency_code: claim.clp.claimFrequencyCode,
              patient_name_last: claim.patient.name.split(',')[0]?.trim() || '',
              patient_name_first: claim.patient.name.split(',')[1]?.trim().split(' ')[0] || '',
              patient_id: claim.patient.id,
              patient_id_qualifier: claim.patient.idQualifier,
              subscriber_name_last: claim.subscriber.name.split(',')[0]?.trim() || '',
              subscriber_name_first: claim.subscriber.name.split(',')[1]?.trim() || '',
              subscriber_id: claim.subscriber.id,
              rendering_provider_name: claim.renderingProvider.name,
              rendering_provider_npi: claim.renderingProvider.npi,
              service_date_start: formatDate(serviceDateStart || '') || null,
              service_date_end: formatDate(serviceDateEnd || '') || null,
              coverage_amount: claim.amounts['AU'] || null,
              discount_amount: claim.amounts['D8'] || null,
            })
            .select('id')
            .single();

          if (claimError) {
            console.error('Error creating remittance claim:', claimError);
            continue;
          }

          // 4. Create service line records
          for (let lineNum = 0; lineNum < claim.serviceLines.length; lineNum++) {
            const line = claim.serviceLines[lineNum];
            const lineDateStart = line.dates.find(d => d.qualifier === '472')?.date;
            const lineDateEnd = line.dates.find(d => d.qualifier === '473')?.date;

            const { data: serviceLine, error: lineError } = await supabaseClient
              .from('remittance_service_lines')
              .insert({
                remittance_claim_id: remittanceClaim.id,
                line_number: lineNum + 1,
                procedure_code_qualifier: line.svc.procedureQualifier,
                procedure_code: line.svc.procedureCode,
                procedure_modifiers: line.svc.modifiers,
                original_procedure_code: line.svc.originalProcedureCode || null,
                revenue_code: line.svc.revenueCode || null,
                charge_amount: line.svc.chargeAmount,
                paid_amount: line.svc.paidAmount,
                units_billed: line.svc.unitsBilled || null,
                units_paid: line.svc.unitsPaid || null,
                service_date_start: formatDate(lineDateStart || '') || null,
                service_date_end: formatDate(lineDateEnd || '') || null,
                line_item_control_number: line.lineItemControlNumber || null,
                rendering_provider_id: line.renderingProviderId || null,
                remark_codes: line.remarkCodes.length > 0 ? line.remarkCodes : null,
              })
              .select('id')
              .single();

            if (lineError) {
              console.error('Error creating service line:', lineError);
              continue;
            }

            // 5. Create adjustment records for service line
            for (const adj of line.adjustments) {
              await supabaseClient
                .from('claim_adjustments')
                .insert({
                  service_line_id: serviceLine.id,
                  adjustment_group_code: adj.groupCode,
                  reason_code_1: adj.adjustments[0]?.reasonCode || null,
                  amount_1: adj.adjustments[0]?.amount || null,
                  quantity_1: adj.adjustments[0]?.quantity || null,
                  reason_code_2: adj.adjustments[1]?.reasonCode || null,
                  amount_2: adj.adjustments[1]?.amount || null,
                  quantity_2: adj.adjustments[1]?.quantity || null,
                  reason_code_3: adj.adjustments[2]?.reasonCode || null,
                  amount_3: adj.adjustments[2]?.amount || null,
                  quantity_3: adj.adjustments[2]?.quantity || null,
                });
            }
          }

          // 6. Create adjustment records for claim level
          for (const adj of claim.adjustments) {
            await supabaseClient
              .from('claim_adjustments')
              .insert({
                remittance_claim_id: remittanceClaim.id,
                adjustment_group_code: adj.groupCode,
                reason_code_1: adj.adjustments[0]?.reasonCode || null,
                amount_1: adj.adjustments[0]?.amount || null,
                quantity_1: adj.adjustments[0]?.quantity || null,
                reason_code_2: adj.adjustments[1]?.reasonCode || null,
                amount_2: adj.adjustments[1]?.amount || null,
                quantity_2: adj.adjustments[1]?.quantity || null,
                reason_code_3: adj.adjustments[2]?.reasonCode || null,
                amount_3: adj.adjustments[2]?.amount || null,
                quantity_3: adj.adjustments[2]?.quantity || null,
              });
          }
        }
      }

      console.log(`Saved to database: EDI file ${ediFileId}, Remittance ${remittanceId}`);
    }

    // Prepare response
    const result = {
      success: true,
      parsing: {
        processingTimeMs: processingTime,
        claimCount: parsed.claims.length,
        serviceLineCount: parsed.claims.reduce((sum, c) => sum + c.serviceLines.length, 0),
      },
      summary: {
        checkNumber: parsed.checkNumber,
        checkDate: parsed.checkDate,
        totalPaid: parsed.totalPaid,
        totalCharged: parsed.claims.reduce((sum, c) => sum + c.clp.totalCharge, 0),
        totalAdjusted: parsed.claims.reduce((sum, c) => sum + (c.clp.totalCharge - c.clp.totalPaid), 0),
        payer: parsed.payer.name,
        payee: parsed.payee.name,
      },
      database: saveToDatabase ? {
        ediFileId,
        remittanceId,
        saved: true,
      } : { saved: false },
      data: parsed,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-835:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
