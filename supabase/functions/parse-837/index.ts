import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// X12 837 TYPES AND INTERFACES
// ============================================

interface Segment {
  id: string;
  elements: string[];
  raw: string;
}

interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

interface Provider {
  name: string;
  npi: string;
  taxId: string;
  taxonomy: string;
  address: Address;
}

interface Subscriber {
  id: string;
  lastName: string;
  firstName: string;
  middleName: string;
  dob: string;
  gender: string;
  address: Address;
  payerId: string;
  payerName: string;
  groupNumber: string;
}

interface Patient {
  lastName: string;
  firstName: string;
  middleName: string;
  dob: string;
  gender: string;
  relationship: string;
  address: Address;
}

interface DiagnosisCode {
  qualifier: string;
  code: string;
  isPrincipal: boolean;
}

interface ServiceLine {
  lineNumber: number;
  procedureCode: string;
  procedureQualifier: string;
  modifiers: string[];
  description: string;
  chargeAmount: number;
  units: number;
  unitType: string;
  placeOfService: string;
  serviceDateStart: string;
  serviceDateEnd: string;
  diagnosisPointers: string[];
  revenueCode: string;
  renderingProviderNpi: string;
  priorAuthNumber: string;
  lineControlNumber: string;
}

interface Claim {
  claimId: string;
  totalCharge: number;
  placeOfService: string;
  frequencyCode: string;
  signatureOnFile: boolean;
  assignmentOfBenefits: string;
  releaseOfInfo: string;
  patientSignatureSource: string;
  
  // Providers
  billingProvider: Provider;
  renderingProvider: Provider | null;
  referringProvider: { name: string; npi: string } | null;
  serviceFacility: { name: string; npi: string; address: Address } | null;
  
  // Patient/Subscriber
  subscriber: Subscriber;
  patient: Patient | null;
  isSubscriberPatient: boolean;
  
  // Clinical
  diagnosisCodes: DiagnosisCode[];
  principalDiagnosis: string;
  admissionDate: string | null;
  dischargeDate: string | null;
  
  // Service Lines
  serviceLines: ServiceLine[];
  
  // Other
  priorAuthNumber: string;
  claimNote: string;
  accidentDate: string | null;
  accidentState: string | null;
  accidentType: string | null;
}

interface Parsed837 {
  fileType: '837P' | '837I';
  isa: {
    controlNumber: string;
    senderId: string;
    senderQualifier: string;
    receiverId: string;
    receiverQualifier: string;
    date: string;
    time: string;
  };
  gs: {
    functionalCode: string;
    senderCode: string;
    receiverCode: string;
    date: string;
    controlNumber: string;
  };
  submitter: {
    name: string;
    id: string;
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  receiver: {
    name: string;
    id: string;
  };
  claims: Claim[];
}

// ============================================
// PARSING UTILITIES
// ============================================

function parseSegments(content: string): Segment[] {
  const elementSeparator = content.charAt(3);
  let segmentTerminator = '~';
  
  if (!content.includes('~')) {
    segmentTerminator = content.charAt(105);
    if (segmentTerminator === '\r' || segmentTerminator === '\n') {
      segmentTerminator = '\n';
    }
  }
  
  const rawSegments = content
    .split(new RegExp(`${segmentTerminator === '~' ? '~' : segmentTerminator}+`))
    .map(s => s.trim().replace(/[\r\n]/g, ''))
    .filter(s => s.length > 0);
  
  return rawSegments.map(raw => {
    const elements = raw.split(elementSeparator);
    return {
      id: elements[0],
      elements: elements.slice(1),
      raw,
    };
  });
}

function formatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  if (dateStr.length === 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  return null;
}

function parseComposite(value: string): string[] {
  return (value || '').split(':').filter(v => v);
}

// ============================================
// SEGMENT PARSERS
// ============================================

function parseNM1(segment: Segment): {
  entityCode: string;
  entityType: string;
  lastName: string;
  firstName: string;
  middleName: string;
  suffix: string;
  idQualifier: string;
  id: string;
} {
  return {
    entityCode: segment.elements[0] || '',
    entityType: segment.elements[1] || '',
    lastName: segment.elements[2] || '',
    firstName: segment.elements[3] || '',
    middleName: segment.elements[4] || '',
    suffix: segment.elements[5] || '',
    idQualifier: segment.elements[7] || '',
    id: segment.elements[8] || '',
  };
}

function parseN3(segment: Segment): { line1: string; line2: string } {
  return {
    line1: segment.elements[0] || '',
    line2: segment.elements[1] || '',
  };
}

function parseN4(segment: Segment): { city: string; state: string; zip: string } {
  return {
    city: segment.elements[0] || '',
    state: segment.elements[1] || '',
    zip: segment.elements[2] || '',
  };
}

function parseDMG(segment: Segment): { dob: string; gender: string } {
  return {
    dob: formatDate(segment.elements[1] || '') || '',
    gender: segment.elements[2] || '',
  };
}

function parseSBR(segment: Segment): {
  payerResponsibility: string;
  relationship: string;
  groupNumber: string;
  claimFilingIndicator: string;
} {
  return {
    payerResponsibility: segment.elements[0] || '',
    relationship: segment.elements[1] || '',
    groupNumber: segment.elements[2] || '',
    claimFilingIndicator: segment.elements[8] || '',
  };
}

function parseCLM(segment: Segment): {
  claimId: string;
  totalCharge: number;
  placeOfService: string;
  frequencyCode: string;
  signatureOnFile: boolean;
  assignmentOfBenefits: string;
  releaseOfInfo: string;
  patientSignatureSource: string;
} {
  const facilityComposite = parseComposite(segment.elements[4] || '');
  
  return {
    claimId: segment.elements[0] || '',
    totalCharge: parseFloat(segment.elements[1]) || 0,
    placeOfService: facilityComposite[0] || '',
    frequencyCode: facilityComposite[1] || '',
    signatureOnFile: segment.elements[5] === 'Y',
    assignmentOfBenefits: segment.elements[6] || '',
    releaseOfInfo: segment.elements[7] || '',
    patientSignatureSource: segment.elements[8] || '',
  };
}

function parseHI(segment: Segment): DiagnosisCode[] {
  const codes: DiagnosisCode[] = [];
  
  for (let i = 0; i < segment.elements.length; i++) {
    const composite = parseComposite(segment.elements[i]);
    if (composite.length >= 2) {
      codes.push({
        qualifier: composite[0],
        code: composite[1],
        isPrincipal: i === 0,
      });
    }
  }
  
  return codes;
}

function parseSV1(segment: Segment): Partial<ServiceLine> {
  const procedureComposite = parseComposite(segment.elements[0] || '');
  const diagPointers = (segment.elements[6] || '').split(':').filter(p => p);
  
  return {
    procedureQualifier: procedureComposite[0] || '',
    procedureCode: procedureComposite[1] || '',
    modifiers: procedureComposite.slice(2, 6).filter(m => m),
    description: procedureComposite[6] || '',
    chargeAmount: parseFloat(segment.elements[1]) || 0,
    unitType: segment.elements[2] || '',
    units: parseFloat(segment.elements[3]) || 1,
    placeOfService: segment.elements[4] || '',
    diagnosisPointers: diagPointers,
  };
}

function parseSV2(segment: Segment): Partial<ServiceLine> {
  const procedureComposite = parseComposite(segment.elements[1] || '');
  
  return {
    revenueCode: segment.elements[0] || '',
    procedureQualifier: procedureComposite[0] || '',
    procedureCode: procedureComposite[1] || '',
    modifiers: procedureComposite.slice(2).filter(m => m),
    chargeAmount: parseFloat(segment.elements[2]) || 0,
    unitType: segment.elements[3] || '',
    units: parseFloat(segment.elements[4]) || 1,
  };
}

function parseDTP(segment: Segment): { qualifier: string; format: string; date: string } {
  return {
    qualifier: segment.elements[0] || '',
    format: segment.elements[1] || '',
    date: segment.elements[2] || '',
  };
}

function parseREF(segment: Segment): { qualifier: string; value: string } {
  return {
    qualifier: segment.elements[0] || '',
    value: segment.elements[1] || '',
  };
}

function parsePRV(segment: Segment): { providerCode: string; qualifierCode: string; taxonomyCode: string } {
  return {
    providerCode: segment.elements[0] || '',
    qualifierCode: segment.elements[1] || '',
    taxonomyCode: segment.elements[2] || '',
  };
}

// ============================================
// MAIN 837 PARSER
// ============================================

function createEmptyClaim(): Claim {
  return {
    claimId: '',
    totalCharge: 0,
    placeOfService: '',
    frequencyCode: '',
    signatureOnFile: false,
    assignmentOfBenefits: '',
    releaseOfInfo: '',
    patientSignatureSource: '',
    billingProvider: { name: '', npi: '', taxId: '', taxonomy: '', address: { line1: '', line2: '', city: '', state: '', zip: '' } },
    renderingProvider: null,
    referringProvider: null,
    serviceFacility: null,
    subscriber: { id: '', lastName: '', firstName: '', middleName: '', dob: '', gender: '', address: { line1: '', line2: '', city: '', state: '', zip: '' }, payerId: '', payerName: '', groupNumber: '' },
    patient: null,
    isSubscriberPatient: true,
    diagnosisCodes: [],
    principalDiagnosis: '',
    admissionDate: null,
    dischargeDate: null,
    serviceLines: [],
    priorAuthNumber: '',
    claimNote: '',
    accidentDate: null,
    accidentState: null,
    accidentType: null,
  };
}

function createEmptyPatient(): Patient {
  return {
    lastName: '',
    firstName: '',
    middleName: '',
    dob: '',
    gender: '',
    relationship: '',
    address: { line1: '', line2: '', city: '', state: '', zip: '' },
  };
}

function createEmptyServiceLine(lineNum: number): ServiceLine {
  return {
    lineNumber: lineNum,
    procedureCode: '',
    procedureQualifier: '',
    modifiers: [],
    description: '',
    chargeAmount: 0,
    units: 1,
    unitType: '',
    placeOfService: '',
    serviceDateStart: '',
    serviceDateEnd: '',
    diagnosisPointers: [],
    revenueCode: '',
    renderingProviderNpi: '',
    priorAuthNumber: '',
    lineControlNumber: '',
  };
}

function parse837(content: string): Parsed837 {
  const segments = parseSegments(content);
  
  // Determine if 837P or 837I based on GS01
  let fileType: '837P' | '837I' = '837P';
  
  const result: Parsed837 = {
    fileType,
    isa: {
      controlNumber: '',
      senderId: '',
      senderQualifier: '',
      receiverId: '',
      receiverQualifier: '',
      date: '',
      time: '',
    },
    gs: {
      functionalCode: '',
      senderCode: '',
      receiverCode: '',
      date: '',
      controlNumber: '',
    },
    submitter: {
      name: '',
      id: '',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    },
    receiver: {
      name: '',
      id: '',
    },
    claims: [],
  };

  // State tracking
  let currentClaim: Claim | null = null;
  let currentServiceLine: ServiceLine | null = null;
  let currentLoop = '';
  let currentEntityCode = '';
  let lineNumber = 0;
  
  // Temporary storage
  let tempAddress: Address = { line1: '', line2: '', city: '', state: '', zip: '' };
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    switch (segment.id) {
      case 'ISA':
        result.isa = {
          senderQualifier: segment.elements[4]?.trim() || '',
          senderId: segment.elements[5]?.trim() || '',
          receiverQualifier: segment.elements[6]?.trim() || '',
          receiverId: segment.elements[7]?.trim() || '',
          date: segment.elements[8]?.trim() || '',
          time: segment.elements[9]?.trim() || '',
          controlNumber: segment.elements[12]?.trim() || '',
        };
        break;
        
      case 'GS':
        result.gs = {
          functionalCode: segment.elements[0] || '',
          senderCode: segment.elements[1] || '',
          receiverCode: segment.elements[2] || '',
          date: segment.elements[3] || '',
          controlNumber: segment.elements[5] || '',
        };
        break;
        
      case 'ST':
        // ST*837 indicates claim type
        if (segment.elements[0] === '837') {
          // Implementation reference might indicate P or I
          const implRef = segment.elements[2] || '';
          if (implRef.includes('005010X223')) {
            fileType = '837I';
            result.fileType = '837I';
          }
        }
        break;
        
      case 'HL':
        const hlCode = segment.elements[2] || '';
        if (hlCode === '20') {
          currentLoop = 'BILLING_PROVIDER';
        } else if (hlCode === '22') {
          currentLoop = 'SUBSCRIBER';
          // Save previous claim if exists
          if (currentClaim) {
            if (currentServiceLine) {
              currentClaim.serviceLines.push(currentServiceLine);
            }
            result.claims.push(currentClaim);
          }
          // Initialize new claim
          currentClaim = createEmptyClaim();
          currentServiceLine = null;
          lineNumber = 0;
        } else if (hlCode === '23') {
          currentLoop = 'PATIENT';
        }
        break;
        
      case 'PRV':
        const prv = parsePRV(segment);
        if (currentLoop === 'BILLING_PROVIDER' && currentClaim) {
          currentClaim.billingProvider.taxonomy = prv.taxonomyCode;
        }
        break;
        
      case 'NM1':
        const nm1 = parseNM1(segment);
        currentEntityCode = nm1.entityCode;
        
        if (nm1.entityCode === '41') {
          // Submitter
          result.submitter.name = nm1.entityType === '2' ? nm1.lastName : `${nm1.firstName} ${nm1.lastName}`.trim();
          result.submitter.id = nm1.id;
        } else if (nm1.entityCode === '40') {
          // Receiver
          result.receiver.name = nm1.lastName;
          result.receiver.id = nm1.id;
        } else if (nm1.entityCode === '85' && currentClaim) {
          // Billing Provider
          currentClaim.billingProvider.name = nm1.lastName;
          currentClaim.billingProvider.npi = nm1.idQualifier === 'XX' ? nm1.id : '';
        } else if (nm1.entityCode === 'IL' && currentClaim) {
          // Subscriber
          currentClaim.subscriber.lastName = nm1.lastName;
          currentClaim.subscriber.firstName = nm1.firstName;
          currentClaim.subscriber.middleName = nm1.middleName;
          currentClaim.subscriber.id = nm1.id;
        } else if (nm1.entityCode === 'PR' && currentClaim) {
          // Payer
          currentClaim.subscriber.payerName = nm1.lastName;
          currentClaim.subscriber.payerId = nm1.id;
        } else if (nm1.entityCode === 'QC' && currentClaim) {
          // Patient (if different from subscriber)
          if (!currentClaim.patient) {
            currentClaim.patient = createEmptyPatient();
          }
          currentClaim.patient.lastName = nm1.lastName;
          currentClaim.patient.firstName = nm1.firstName;
          currentClaim.patient.middleName = nm1.middleName;
          currentClaim.isSubscriberPatient = false;
        } else if (nm1.entityCode === '82' && currentClaim) {
          // Rendering Provider
          currentClaim.renderingProvider = {
            name: nm1.lastName,
            npi: nm1.idQualifier === 'XX' ? nm1.id : '',
            taxId: '',
            taxonomy: '',
            address: { line1: '', line2: '', city: '', state: '', zip: '' },
          };
        } else if (nm1.entityCode === 'DN' && currentClaim) {
          // Referring Provider
          currentClaim.referringProvider = {
            name: `${nm1.firstName} ${nm1.lastName}`.trim(),
            npi: nm1.idQualifier === 'XX' ? nm1.id : '',
          };
        } else if (nm1.entityCode === '77' && currentClaim) {
          // Service Facility
          currentClaim.serviceFacility = {
            name: nm1.lastName,
            npi: nm1.idQualifier === 'XX' ? nm1.id : '',
            address: { line1: '', line2: '', city: '', state: '', zip: '' },
          };
        }
        break;
        
      case 'N3':
        const n3 = parseN3(segment);
        tempAddress.line1 = n3.line1;
        tempAddress.line2 = n3.line2;
        break;
        
      case 'N4':
        const n4 = parseN4(segment);
        tempAddress.city = n4.city;
        tempAddress.state = n4.state;
        tempAddress.zip = n4.zip;
        
        // Apply address to appropriate entity
        if (currentClaim) {
          if (currentEntityCode === '85') {
            currentClaim.billingProvider.address = { ...tempAddress };
          } else if (currentEntityCode === 'IL') {
            currentClaim.subscriber.address = { ...tempAddress };
          } else if (currentEntityCode === 'QC' && currentClaim.patient) {
            currentClaim.patient.address = { ...tempAddress };
          } else if (currentEntityCode === '77' && currentClaim.serviceFacility) {
            currentClaim.serviceFacility.address = { ...tempAddress };
          }
        }
        tempAddress = { line1: '', line2: '', city: '', state: '', zip: '' };
        break;
        
      case 'PER':
        if (segment.elements[0] === 'IC') {
          result.submitter.contactName = segment.elements[1] || '';
          // Parse contact methods (TE=phone, EM=email)
          for (let j = 2; j < segment.elements.length; j += 2) {
            const contactType = segment.elements[j];
            const contactValue = segment.elements[j + 1] || '';
            if (contactType === 'TE') {
              result.submitter.contactPhone = contactValue;
            } else if (contactType === 'EM') {
              result.submitter.contactEmail = contactValue;
            }
          }
        }
        break;
        
      case 'SBR':
        if (currentClaim) {
          const sbr = parseSBR(segment);
          currentClaim.subscriber.groupNumber = sbr.groupNumber;
        }
        break;
        
      case 'DMG':
        const dmg = parseDMG(segment);
        if (currentClaim) {
          if (currentLoop === 'PATIENT' && currentClaim.patient) {
            currentClaim.patient.dob = dmg.dob;
            currentClaim.patient.gender = dmg.gender;
          } else {
            currentClaim.subscriber.dob = dmg.dob;
            currentClaim.subscriber.gender = dmg.gender;
          }
        }
        break;
        
      case 'PAT':
        if (currentClaim) {
          currentClaim.isSubscriberPatient = false;
          const relationship = segment.elements[0] || '';
          if (currentClaim.patient) {
            currentClaim.patient.relationship = relationship;
          }
        }
        break;
        
      case 'CLM':
        if (currentClaim) {
          const clm = parseCLM(segment);
          currentClaim.claimId = clm.claimId;
          currentClaim.totalCharge = clm.totalCharge;
          currentClaim.placeOfService = clm.placeOfService;
          currentClaim.frequencyCode = clm.frequencyCode;
          currentClaim.signatureOnFile = clm.signatureOnFile;
          currentClaim.assignmentOfBenefits = clm.assignmentOfBenefits;
          currentClaim.releaseOfInfo = clm.releaseOfInfo;
          currentClaim.patientSignatureSource = clm.patientSignatureSource;
        }
        break;
        
      case 'REF':
        const ref = parseREF(segment);
        if (currentClaim) {
          if (ref.qualifier === 'G1') {
            currentClaim.priorAuthNumber = ref.value;
          } else if (ref.qualifier === 'EI' && currentEntityCode === '85') {
            currentClaim.billingProvider.taxId = ref.value;
          }
        }
        if (currentServiceLine && ref.qualifier === '6R') {
          currentServiceLine.lineControlNumber = ref.value;
        }
        break;
        
      case 'HI':
        if (currentClaim) {
          const diagCodes = parseHI(segment);
          currentClaim.diagnosisCodes.push(...diagCodes);
          const principal = diagCodes.find(d => d.isPrincipal);
          if (principal) {
            currentClaim.principalDiagnosis = principal.code;
          }
        }
        break;
        
      case 'DTP':
        const dtp = parseDTP(segment);
        if (currentClaim) {
          if (dtp.qualifier === '431') {
            // Admission date
            currentClaim.admissionDate = formatDate(dtp.date);
          } else if (dtp.qualifier === '096') {
            // Discharge date
            currentClaim.dischargeDate = formatDate(dtp.date);
          } else if (dtp.qualifier === '439') {
            // Accident date
            currentClaim.accidentDate = formatDate(dtp.date);
          }
          
          // Service line dates
          if (currentServiceLine) {
            if (dtp.qualifier === '472') {
              // Service date
              if (dtp.format === 'D8') {
                currentServiceLine.serviceDateStart = formatDate(dtp.date) || '';
                currentServiceLine.serviceDateEnd = formatDate(dtp.date) || '';
              } else if (dtp.format === 'RD8' && dtp.date.includes('-')) {
                const [start, end] = dtp.date.split('-');
                currentServiceLine.serviceDateStart = formatDate(start) || '';
                currentServiceLine.serviceDateEnd = formatDate(end) || '';
              }
            }
          }
        }
        break;
        
      case 'LX':
        // Start of new service line
        if (currentServiceLine && currentClaim) {
          currentClaim.serviceLines.push(currentServiceLine);
        }
        lineNumber++;
        currentServiceLine = createEmptyServiceLine(lineNumber);
        break;
        
      case 'SV1':
        // Professional service line
        if (currentServiceLine) {
          const sv1 = parseSV1(segment);
          Object.assign(currentServiceLine, sv1);
        }
        result.fileType = '837P';
        break;
        
      case 'SV2':
        // Institutional service line
        if (currentServiceLine) {
          const sv2 = parseSV2(segment);
          Object.assign(currentServiceLine, sv2);
        }
        result.fileType = '837I';
        break;
        
      case 'NTE':
        if (currentClaim && segment.elements[0] === 'ADD') {
          currentClaim.claimNote = segment.elements[1] || '';
        }
        break;
        
      case 'SE':
      case 'GE':
      case 'IEA':
        // End - save final claim
        if (currentServiceLine && currentClaim) {
          currentClaim.serviceLines.push(currentServiceLine);
        }
        if (currentClaim) {
          result.claims.push(currentClaim);
          currentClaim = null;
        }
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
      content,
      documentId,
      saveToDatabase = true,
    } = await req.json();

    if (!content) {
      throw new Error("Missing required field: content");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    console.log("Parsing 837 EDI content...");
    const startTime = Date.now();
    
    const parsed = parse837(content);
    
    const processingTime = Date.now() - startTime;
    console.log(`Parsed ${parsed.fileType}: ${parsed.claims.length} claims, $${parsed.claims.reduce((s, c) => s + c.totalCharge, 0)} total, ${processingTime}ms`);

    let ediFileId: string | null = null;

    if (saveToDatabase) {
      // 1. Create EDI file record
      const { data: ediFile, error: ediError } = await supabaseClient
        .from('edi_files')
        .insert({
          user_id: user.id,
          document_id: documentId || null,
          file_type: parsed.fileType,
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

      // 2. Create edi_claims records
      for (const claim of parsed.claims) {
        const patient = claim.patient || {
          lastName: claim.subscriber.lastName,
          firstName: claim.subscriber.firstName,
          middleName: claim.subscriber.middleName,
          dob: claim.subscriber.dob,
          gender: claim.subscriber.gender,
          address: claim.subscriber.address,
          relationship: '18', // Self
        };

        const { error: claimError } = await supabaseClient
          .from('edi_claims')
          .insert({
            user_id: user.id,
            edi_file_id: ediFileId,
            claim_submitter_id: claim.claimId,
            total_charge: claim.totalCharge,
            place_of_service: claim.placeOfService,
            claim_frequency_code: claim.frequencyCode,
            provider_signature: claim.signatureOnFile,
            provider_accept_assignment: claim.assignmentOfBenefits,
            benefits_assignment: claim.assignmentOfBenefits,
            release_of_info: claim.releaseOfInfo,
            patient_signature_source: claim.patientSignatureSource,
            billing_provider_npi: claim.billingProvider.npi,
            billing_provider_name: claim.billingProvider.name,
            billing_provider_tax_id: claim.billingProvider.taxId,
            billing_provider_taxonomy: claim.billingProvider.taxonomy,
            billing_provider_address_line1: claim.billingProvider.address.line1,
            billing_provider_city: claim.billingProvider.address.city,
            billing_provider_state: claim.billingProvider.address.state,
            billing_provider_zip: claim.billingProvider.address.zip,
            subscriber_id: claim.subscriber.id,
            subscriber_name_last: claim.subscriber.lastName,
            subscriber_name_first: claim.subscriber.firstName,
            subscriber_dob: claim.subscriber.dob || null,
            subscriber_gender: claim.subscriber.gender,
            subscriber_address_line1: claim.subscriber.address.line1,
            subscriber_city: claim.subscriber.address.city,
            subscriber_state: claim.subscriber.address.state,
            subscriber_zip: claim.subscriber.address.zip,
            patient_name_last: patient.lastName,
            patient_name_first: patient.firstName,
            patient_dob: patient.dob || null,
            patient_gender: patient.gender,
            patient_relationship: patient.relationship,
            patient_address_line1: patient.address.line1,
            patient_city: patient.address.city,
            patient_state: patient.address.state,
            patient_zip: patient.address.zip,
            payer_name: claim.subscriber.payerName,
            payer_id: claim.subscriber.payerId,
            referring_provider_npi: claim.referringProvider?.npi || null,
            referring_provider_name: claim.referringProvider?.name || null,
            rendering_provider_npi: claim.renderingProvider?.npi || null,
            rendering_provider_name: claim.renderingProvider?.name || null,
            service_facility_name: claim.serviceFacility?.name || null,
            service_facility_npi: claim.serviceFacility?.npi || null,
            diagnosis_code_qualifier: claim.diagnosisCodes[0]?.qualifier || 'ABK',
            principal_diagnosis: claim.principalDiagnosis,
            diagnosis_codes: claim.diagnosisCodes.map(d => d.code),
            admission_date: claim.admissionDate,
            discharge_date: claim.dischargeDate,
            service_date_start: claim.serviceLines[0]?.serviceDateStart || null,
            service_date_end: claim.serviceLines[claim.serviceLines.length - 1]?.serviceDateEnd || null,
            service_lines: claim.serviceLines,
            prior_auth_number: claim.priorAuthNumber || null,
            accident_date: claim.accidentDate,
            accident_state: claim.accidentState,
            accident_type: claim.accidentType,
          });

        if (claimError) {
          console.error('Error creating claim record:', claimError);
        }
      }

      console.log(`Saved to database: EDI file ${ediFileId}`);
    }

    // Prepare response
    const result = {
      success: true,
      fileType: parsed.fileType,
      parsing: {
        processingTimeMs: processingTime,
        claimCount: parsed.claims.length,
        serviceLineCount: parsed.claims.reduce((sum, c) => sum + c.serviceLines.length, 0),
      },
      summary: {
        totalCharge: parsed.claims.reduce((sum, c) => sum + c.totalCharge, 0),
        submitter: parsed.submitter.name,
        receiver: parsed.receiver.name,
        uniquePayers: [...new Set(parsed.claims.map(c => c.subscriber.payerName))],
        uniqueProviders: [...new Set(parsed.claims.map(c => c.billingProvider.name))],
      },
      database: saveToDatabase ? {
        ediFileId,
        saved: true,
      } : { saved: false },
      data: parsed,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in parse-837:", error);
    
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
