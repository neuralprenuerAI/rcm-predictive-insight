// Safe logger that sanitizes sensitive data for HIPAA compliance
// This prevents PHI/PII from being logged to console

const SENSITIVE_KEYS = [
  'password', 'token', 'access_token', 'refresh_token', 'jwt',
  'private_key', 'privateKey', 'secret', 'api_key', 'apiKey',
  'authorization', 'auth', 'credential', 'ssn', 'social_security',
  'date_of_birth', 'dob', 'birthDate', 'birthdate', 'phone', 'email',
  'address', 'first_name', 'last_name', 'firstName', 'lastName',
  'patient', 'diagnosis', 'medical', 'insurance_id', 'member_id',
  'patient_name', 'patientName', 'subscriber', 'client_id', 'clientId',
  'homePhone', 'workPhone', 'mobilePhone', 'home_phone', 'work_phone',
  'mobile_phone', 'addressLine', 'address_line', 'emergencyContact',
  'emergency_contact', 'accountNumber', 'account_number', 'postalCode',
  'postal_code', 'city', 'state', 'country', 'zip', 'given', 'family',
  'name', 'telecom', 'identifier', 'icd', 'cpt', 'procedure', 'claim',
  'kid', 'iss', 'sub', 'aud', 'jti'
];

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()));
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    // Redact long strings that look like tokens/keys
    if (value.length > 50 && !value.includes(' ')) {
      return '[REDACTED_TOKEN]';
    }
    // Redact PEM keys
    if (value.includes('-----BEGIN') || value.includes('-----END')) {
      return '[REDACTED_PRIVATE_KEY]';
    }
    // Redact JWT tokens
    if (value.match(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/)) {
      return '[REDACTED_JWT]';
    }
  }
  return value;
}

export function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return sanitizeValue(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeData(value);
    } else {
      result[key] = sanitizeValue(value);
    }
  }
  
  return result;
}

/**
 * Safe logging function that redacts sensitive data
 * Use this instead of console.log for any data that may contain PHI/PII
 */
export function safeLog(message: string, data?: unknown): void {
  if (data === undefined) {
    console.log(message);
    return;
  }
  
  const sanitized = sanitizeData(data);
  console.log(message, typeof sanitized === 'object' ? JSON.stringify(sanitized) : sanitized);
}

/**
 * Safe error logging that doesn't expose stack traces or sensitive details
 */
export function logError(message: string, error: unknown): void {
  const errorInfo = {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    // Do NOT log stack traces in production as they may contain sensitive data paths
  };
  console.error(message, JSON.stringify(errorInfo));
}

/**
 * Log only the type and count of items, not the actual data
 * Useful for logging arrays of sensitive data
 */
export function logCount(message: string, items: unknown[] | undefined): void {
  console.log(message, `[${items?.length || 0} items]`);
}

/**
 * Log only metadata about an operation, not the actual values
 */
export function logOperation(operation: string, metadata: { 
  userId?: string; 
  resourceType?: string; 
  resourceId?: string;
  status?: string;
  count?: number;
}): void {
  console.log(`[${operation}]`, JSON.stringify({
    ...metadata,
    timestamp: new Date().toISOString()
  }));
}
