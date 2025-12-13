import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Healthcare field mappings - maps common column names to standardized fields
const FIELD_MAPPINGS: Record<string, string[]> = {
  // Patient fields
  patient_name: ['patient_name', 'patient', 'patientname', 'patient name', 'pt name', 'pt_name', 'name', 'member_name', 'member name', 'subscriber_name'],
  patient_first_name: ['patient_first_name', 'first_name', 'firstname', 'first name', 'pt_first', 'patient_first', 'member_first'],
  patient_last_name: ['patient_last_name', 'last_name', 'lastname', 'last name', 'pt_last', 'patient_last', 'member_last'],
  patient_dob: ['patient_dob', 'dob', 'date_of_birth', 'dateofbirth', 'birth_date', 'birthdate', 'pt_dob', 'member_dob'],
  patient_id: ['patient_id', 'patientid', 'patient_number', 'pt_id', 'member_id', 'memberid', 'subscriber_id'],
  patient_account: ['patient_account', 'account_number', 'account', 'acct', 'account_no', 'acct_no'],
  
  // Claim fields
  claim_id: ['claim_id', 'claimid', 'claim_number', 'claim_no', 'claim #', 'icn', 'dcn', 'claim_reference'],
  claim_status: ['claim_status', 'status', 'claimstatus', 'claim_state'],
  
  // Service fields
  date_of_service: ['date_of_service', 'dos', 'service_date', 'servicedate', 'from_date', 'service_from', 'svc_date'],
  date_of_service_to: ['date_of_service_to', 'dos_to', 'to_date', 'service_to', 'thru_date', 'through_date'],
  place_of_service: ['place_of_service', 'pos', 'placeofservice', 'place_service'],
  
  // Coding fields
  procedure_code: ['procedure_code', 'cpt', 'cpt_code', 'cptcode', 'proc_code', 'proccode', 'hcpcs', 'hcpcs_code', 'service_code'],
  procedure_modifier: ['procedure_modifier', 'modifier', 'mod', 'modifier_1', 'mod1', 'cpt_modifier'],
  diagnosis_code: ['diagnosis_code', 'dx', 'dx_code', 'dxcode', 'icd', 'icd_code', 'icd10', 'diag_code', 'principal_dx'],
  diagnosis_codes: ['diagnosis_codes', 'dx_codes', 'all_dx', 'icd_codes'],
  revenue_code: ['revenue_code', 'rev_code', 'revcode', 'revenue'],
  
  // Financial fields
  billed_amount: ['billed_amount', 'billed', 'charge', 'charge_amount', 'charges', 'total_charge', 'amount_billed', 'gross_charge'],
  allowed_amount: ['allowed_amount', 'allowed', 'allowable', 'approved_amount', 'approved', 'contracted_amount'],
  paid_amount: ['paid_amount', 'paid', 'payment', 'payment_amount', 'amount_paid', 'reimbursement', 'check_amount'],
  adjusted_amount: ['adjusted_amount', 'adjustment', 'adj_amount', 'adjustments', 'write_off', 'writeoff'],
  patient_responsibility: ['patient_responsibility', 'patient_resp', 'pt_resp', 'patient_balance', 'pt_balance', 'copay', 'coinsurance', 'deductible'],
  balance: ['balance', 'balance_due', 'amount_due', 'outstanding'],
  
  // Units
  units: ['units', 'qty', 'quantity', 'unit_count', 'service_units', 'billed_units'],
  
  // Provider fields
  provider_name: ['provider_name', 'provider', 'rendering_provider', 'servicing_provider', 'physician', 'doctor'],
  provider_npi: ['provider_npi', 'npi', 'rendering_npi', 'servicing_npi', 'physician_npi'],
  provider_tax_id: ['provider_tax_id', 'tax_id', 'tin', 'federal_tax_id', 'ein'],
  referring_provider: ['referring_provider', 'referring_physician', 'ref_provider', 'referral'],
  referring_npi: ['referring_npi', 'ref_npi'],
  billing_provider: ['billing_provider', 'billing_name', 'bill_provider'],
  billing_npi: ['billing_npi', 'bill_npi'],
  
  // Payer fields
  payer_name: ['payer_name', 'payer', 'insurance', 'insurance_name', 'carrier', 'plan_name', 'health_plan'],
  payer_id: ['payer_id', 'payerid', 'insurance_id', 'carrier_id', 'plan_id'],
  
  // Payment fields
  check_number: ['check_number', 'check_no', 'check#', 'eft_number', 'trace_number', 'payment_reference'],
  check_date: ['check_date', 'payment_date', 'paid_date', 'remit_date', 'eft_date'],
  
  // Denial fields
  denial_code: ['denial_code', 'reason_code', 'carc', 'adjustment_reason', 'denial_reason_code', 'remark_code'],
  denial_reason: ['denial_reason', 'reason', 'denial_description', 'adjustment_reason_description'],
  
  // Authorization
  auth_number: ['auth_number', 'authorization', 'prior_auth', 'auth_no', 'pa_number', 'pre_cert', 'precert_number'],
  
  // Reference numbers
  reference_number: ['reference_number', 'ref_no', 'reference', 'control_number', 'tcn'],
};

// Normalize column name for matching
function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Find the standardized field name for a column
function mapColumnToField(columnName: string): string | null {
  const normalized = normalizeColumnName(columnName);
  
  for (const [standardField, aliases] of Object.entries(FIELD_MAPPINGS)) {
    for (const alias of aliases) {
      if (normalizeColumnName(alias) === normalized) {
        return standardField;
      }
    }
  }
  
  return null;
}

// Parse CSV content
function parseCSV(content: string, delimiter: string = ','): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }
  
  // Handle quoted fields properly
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  };
  
  const headers = parseRow(lines[0]);
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Skip empty rows
    if (Object.values(row).some(v => v.trim())) {
      rows.push(row);
    }
  }
  
  return { headers, rows };
}

// Detect delimiter (comma, tab, pipe, semicolon)
function detectDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/)[0] || '';
  const delimiters = [',', '\t', '|', ';'];
  
  let maxCount = 0;
  let bestDelimiter = ',';
  
  for (const delimiter of delimiters) {
    const count = (firstLine.match(new RegExp(delimiter === '|' ? '\\|' : delimiter, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delimiter;
    }
  }
  
  return bestDelimiter;
}

// Parse date string to ISO format
function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null;
  
  const cleaned = value.trim();
  
  // Try various date formats
  const patterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
    // MM/DD/YY or MM-DD-YY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,
    // MMDDYYYY
    /^(\d{2})(\d{2})(\d{4})$/,
    // YYYYMMDD
    /^(\d{4})(\d{2})(\d{2})$/,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let year: number, month: number, day: number;
      
      if (pattern === patterns[0]) {
        // MM/DD/YYYY
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else if (pattern === patterns[1]) {
        // YYYY-MM-DD
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      } else if (pattern === patterns[2]) {
        // MM/DD/YY
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
        year = year < 50 ? 2000 + year : 1900 + year;
      } else if (pattern === patterns[3]) {
        // MMDDYYYY
        month = parseInt(match[1], 10);
        day = parseInt(match[2], 10);
        year = parseInt(match[3], 10);
      } else {
        // YYYYMMDD
        year = parseInt(match[1], 10);
        month = parseInt(match[2], 10);
        day = parseInt(match[3], 10);
      }
      
      // Validate
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }
  
  return null;
}

// Parse amount string to number
function parseAmount(value: string): number | null {
  if (!value || !value.trim()) return null;
  
  // Remove currency symbols, commas, spaces
  const cleaned = value.trim().replace(/[$,\s]/g, '');
  
  // Handle parentheses for negative numbers
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  const numStr = isNegative ? cleaned.slice(1, -1) : cleaned;
  
  const num = parseFloat(numStr);
  
  if (isNaN(num)) return null;
  
  return isNegative ? -num : num;
}

// Detect the type of data in the spreadsheet
function detectDataType(mappedFields: string[], sampleRows: Record<string, any>[]): string {
  const fieldSet = new Set(mappedFields);
  
  // Check for remittance/payment data (835-like)
  if (fieldSet.has('check_number') || fieldSet.has('paid_amount')) {
    if (fieldSet.has('procedure_code') || fieldSet.has('claim_id')) {
      return 'remittance_detail';
    }
    return 'payment_summary';
  }
  
  // Check for claims data
  if (fieldSet.has('procedure_code') && fieldSet.has('diagnosis_code')) {
    if (fieldSet.has('billed_amount')) {
      return 'claims';
    }
    return 'charge_detail';
  }
  
  // Check for patient data
  if (fieldSet.has('patient_name') || (fieldSet.has('patient_first_name') && fieldSet.has('patient_last_name'))) {
    if (fieldSet.has('patient_dob') || fieldSet.has('patient_id')) {
      return 'patient_roster';
    }
  }
  
  // Check for denial data
  if (fieldSet.has('denial_code') || fieldSet.has('denial_reason')) {
    return 'denials';
  }
  
  // Check for authorization data
  if (fieldSet.has('auth_number')) {
    return 'authorizations';
  }
  
  // Check for aging/AR data
  if (fieldSet.has('balance') && (fieldSet.has('patient_name') || fieldSet.has('claim_id'))) {
    return 'aging_report';
  }
  
  return 'unknown';
}

// Transform raw rows using field mappings
function transformRows(
  rows: Record<string, string>[],
  headers: string[]
): { mappedRows: Record<string, any>[]; mappings: Record<string, string>; unmappedColumns: string[] } {
  const mappings: Record<string, string> = {};
  const unmappedColumns: string[] = [];
  
  // Create column mappings
  for (const header of headers) {
    const standardField = mapColumnToField(header);
    if (standardField) {
      mappings[header] = standardField;
    } else {
      unmappedColumns.push(header);
    }
  }
  
  // Transform rows
  const mappedRows = rows.map(row => {
    const mappedRow: Record<string, any> = {
      _original: row, // Keep original data
    };
    
    for (const [originalColumn, standardField] of Object.entries(mappings)) {
      const value = row[originalColumn];
      
      // Parse based on field type
      if (standardField.includes('date') || standardField.includes('dob')) {
        mappedRow[standardField] = parseDate(value);
      } else if (
        standardField.includes('amount') ||
        standardField.includes('charge') ||
        standardField.includes('paid') ||
        standardField.includes('balance') ||
        standardField === 'units'
      ) {
        mappedRow[standardField] = parseAmount(value);
      } else {
        mappedRow[standardField] = value?.trim() || null;
      }
    }
    
    // Keep unmapped columns with original names
    for (const col of unmappedColumns) {
      mappedRow[`_unmapped_${normalizeColumnName(col)}`] = row[col]?.trim() || null;
    }
    
    return mappedRow;
  });
  
  return { mappedRows, mappings, unmappedColumns };
}

// Calculate summary statistics
function calculateSummary(rows: Record<string, any>[], dataType: string): Record<string, any> {
  const summary: Record<string, any> = {
    total_rows: rows.length,
    data_type: dataType,
  };
  
  // Financial summaries
  const financialFields = ['billed_amount', 'allowed_amount', 'paid_amount', 'adjusted_amount', 'patient_responsibility', 'balance'];
  
  for (const field of financialFields) {
    const values = rows.map(r => r[field]).filter(v => typeof v === 'number');
    if (values.length > 0) {
      summary[`total_${field}`] = values.reduce((a, b) => a + b, 0);
      summary[`count_${field}`] = values.length;
    }
  }
  
  // Count unique values for key fields
  const countFields = ['patient_id', 'claim_id', 'payer_name', 'provider_npi', 'procedure_code', 'diagnosis_code'];
  
  for (const field of countFields) {
    const uniqueValues = new Set(rows.map(r => r[field]).filter(v => v));
    if (uniqueValues.size > 0) {
      summary[`unique_${field}_count`] = uniqueValues.size;
    }
  }
  
  // Date range
  const dateFields = ['date_of_service', 'check_date', 'patient_dob'];
  for (const field of dateFields) {
    const dates = rows.map(r => r[field]).filter(v => v).sort();
    if (dates.length > 0) {
      summary[`${field}_range`] = {
        earliest: dates[0],
        latest: dates[dates.length - 1],
      };
    }
  }
  
  return summary;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      content,           // Raw file content (string for CSV, base64 for Excel)
      filename,          // Original filename
      documentId,        // Optional: existing document ID to update
      fileType,          // 'csv', 'tsv', 'xlsx', 'xls' - auto-detected if not provided
      delimiter,         // Optional: force specific delimiter
      hasHeaders = true, // Whether first row is headers
      skipRows = 0,      // Number of rows to skip at start
      maxRows,           // Optional: limit rows to parse
      sheetName,         // For Excel: which sheet to parse
      sheetIndex = 0,    // For Excel: sheet index (0-based)
    } = await req.json();

    // Validate required fields
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

    console.log(`Processing spreadsheet: ${filename || 'unknown'}`);

    // Detect file type from filename or content
    let detectedFileType = fileType;
    if (!detectedFileType && filename) {
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === 'csv') detectedFileType = 'csv';
      else if (ext === 'tsv') detectedFileType = 'tsv';
      else if (ext === 'xlsx') detectedFileType = 'xlsx';
      else if (ext === 'xls') detectedFileType = 'xls';
      else if (ext === 'txt') detectedFileType = 'csv'; // Assume CSV for txt
    }

    let parsedData: { headers: string[]; rows: Record<string, string>[] };

    // Parse based on file type
    if (detectedFileType === 'xlsx' || detectedFileType === 'xls') {
      // For Excel files, we need to use a library
      // Since Deno doesn't have native Excel support, we'll return an error
      // suggesting the user convert to CSV, or we can add xlsx library later
      throw new Error(
        "Excel files (.xlsx, .xls) are not yet supported. Please convert to CSV format and try again. " +
        "You can do this in Excel: File → Save As → CSV (Comma delimited)"
      );
    } else {
      // CSV/TSV parsing
      const actualDelimiter = delimiter || (detectedFileType === 'tsv' ? '\t' : detectDelimiter(content));
      
      // Skip rows if needed
      let processContent = content;
      if (skipRows > 0) {
        const lines = content.split(/\r?\n/);
        processContent = lines.slice(skipRows).join('\n');
      }
      
      parsedData = parseCSV(processContent, actualDelimiter);
    }

    // Limit rows if specified
    if (maxRows && parsedData.rows.length > maxRows) {
      parsedData.rows = parsedData.rows.slice(0, maxRows);
    }

    console.log(`Parsed ${parsedData.rows.length} rows with ${parsedData.headers.length} columns`);

    // Transform using field mappings
    const { mappedRows, mappings, unmappedColumns } = transformRows(parsedData.rows, parsedData.headers);
    
    // Detect data type
    const mappedFields = Object.values(mappings);
    const dataType = detectDataType(mappedFields, mappedRows);
    
    // Calculate summary
    const summary = calculateSummary(mappedRows, dataType);

    console.log(`Detected data type: ${dataType}`);
    console.log(`Mapped ${Object.keys(mappings).length} columns, ${unmappedColumns.length} unmapped`);

    // Prepare result
    const result = {
      success: true,
      filename: filename || 'unknown',
      file_type: detectedFileType || 'csv',
      data_type: dataType,
      parsing: {
        total_rows: parsedData.rows.length,
        total_columns: parsedData.headers.length,
        mapped_columns: Object.keys(mappings).length,
        unmapped_columns: unmappedColumns.length,
        headers: parsedData.headers,
        field_mappings: mappings,
        unmapped: unmappedColumns,
      },
      summary,
      data: mappedRows,
    };

    // If documentId provided, update the document record
    if (documentId) {
      const { error: updateError } = await supabaseClient
        .from('documents')
        .update({
          status: 'completed',
          document_type: `spreadsheet_${dataType}`,
          extracted_data: {
            parsing: result.parsing,
            summary: result.summary,
            row_count: result.data.length,
          },
          processed_at: new Date().toISOString(),
        })
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating document:', updateError);
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );

  } catch (error) {
    console.error("Error in parse-spreadsheet:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        } 
      }
    );
  }
});
