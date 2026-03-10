export interface ColombiaPatient {

  dgh_patient_id: string;

  nombres: string;

  apellidos: string;

  tipo_doc: "CC" | "TI" | "RC" | "PA" | "CE" | "PE";

  cedula: string;

  telefono?: string;

  email?: string;

  direccion?: string;

  fecha_nacimiento?: string;

  sexo?: "M" | "F";

  ciudad?: string;

}

export interface EpsEligibility {

  cedula: string;

  tipo_doc: string;

  nombre_completo?: string;

  eps_nombre?: string;

  regimen?: "CONTRIBUTIVO" | "SUBSIDIADO" | "ESPECIAL";

  estado?: "ACTIVO" | "INACTIVO" | "SUSPENDIDO" | "NO_ENCONTRADO";

  tipo_afiliado?: "COTIZANTE" | "BENEFICIARIO";

  fecha_afiliacion?: string;

  fecha_nacimiento?: string;

  municipio?: string;

  departamento?: string;

  is_eligible: boolean;

  mock?: boolean;

}

export interface PatientSearchResult {

  success: boolean;

  patient: ColombiaPatient | null;

  eligibility: EpsEligibility | null;

  appointments: ColombiaAppointment[];

  can_schedule: boolean;

  alert: string | null;

}

export interface ColombiaAppointment {

  dgh_appointment_id: string;

  scheduled_at: string;

  especialidad: string;

  medico_nombre: string;

  status: "DISPONIBLE" | "CONFIRMADA" | "COMPLETADA" | "CANCELADA" | "NO_SHOW";

  consultorio?: string;

  sede?: string;

  motivo_consulta?: string;

}

export interface ColombiaEncounter {

  dgh_encounter_id: string;

  fecha_atencion: string;

  dgh_patient_id: string;

  especialidad: string;

  medico_nombre: string;

  medico_registro?: string;

  diagnostico_principal?: string;

  sede?: string;

  total_billed?: number;

  billing_status?: "PENDIENTE" | "RADICADO" | "ACEPTADO" | "DEVUELTO" | "GLOSA";

  procedures?: EncounterProcedure[];

}

export interface EncounterProcedure {

  cups_code: string;

  descripcion: string;

  cantidad: number;

  valor_unitario: number;

  valor_total: number;

}

export interface ColombiaRadicacion {

  id: string;

  ips_id: string;

  dgh_encounter_id?: string;

  rips_json?: Record<string, unknown>;

  factramed_lote_id?: string;

  radicacion_number?: string;

  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "DEVUELTA" | "GLOSA";

  error_codes?: Record<string, unknown>;

  certificate_pdf_s3?: string;

  auto_fix_attempts: number;

  submitted_at?: string;

  accepted_at?: string;

  total_billed?: number;

  created_at: string;

}

export interface ColombiaGlosa {

  id: string;

  ips_id: string;

  radicacion_id?: string;

  factramed_glosa_id?: string;

  glosa_code?: string;

  glosa_description?: string;

  amount_glosed?: number;

  win_probability?: number;

  ai_classification?: GlosaClassification;

  status: "PENDING" | "CLASSIFIED" | "RESPONDING" | "SUBMITTED" | "WON" | "LOST" | "WRITTEN_OFF";

  response_letter_s3?: string;

  excel_response_s3?: string;

  deadline_at?: string;

  created_at: string;

}

export interface GlosaClassification {

  tipo: string;

  causa_raiz: string;

  win_probability: number;

  documentos_requeridos: string[];

  estrategia_respuesta: string;

  recomendacion: "RESPONDER" | "CASTIGO_CONTABLE";

}

export interface IpsConfig {

  id: string;

  nombre: string;

  nit: string;

  dgh_type: "mock" | "sqlserver" | "api";

  factramed_configured: boolean;

  twilio_configured: boolean;

  is_active: boolean;

}

export interface ColombiaKPIs {

  encounters_pending_billing: number;

  radicaciones_submitted: number;

  radicaciones_accepted: number;

  radicaciones_devueltas: number;

  glosas_active: number;

  glosas_deadline_soon: number;

  total_billed_month: number;

  total_paid_month: number;

  collection_rate: number;

}
