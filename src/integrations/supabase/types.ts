export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      actual_charges: {
        Row: {
          audit_id: string
          charge_amount: number | null
          cpt_code: string
          cpt_description: string | null
          created_at: string | null
          external_charge_id: string | null
          icd_codes: string[] | null
          id: string
          matched_predicted_id: string | null
          modifiers: string[] | null
          source: string | null
          units: number | null
        }
        Insert: {
          audit_id: string
          charge_amount?: number | null
          cpt_code: string
          cpt_description?: string | null
          created_at?: string | null
          external_charge_id?: string | null
          icd_codes?: string[] | null
          id?: string
          matched_predicted_id?: string | null
          modifiers?: string[] | null
          source?: string | null
          units?: number | null
        }
        Update: {
          audit_id?: string
          charge_amount?: number | null
          cpt_code?: string
          cpt_description?: string | null
          created_at?: string | null
          external_charge_id?: string | null
          icd_codes?: string[] | null
          id?: string
          matched_predicted_id?: string | null
          modifiers?: string[] | null
          source?: string | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actual_charges_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "charge_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      adjustment_reason_codes: {
        Row: {
          category: string | null
          code: string
          code_type: string | null
          description: string
          effective_date: string | null
          full_description: string | null
          notes: string | null
          termination_date: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          code: string
          code_type?: string | null
          description: string
          effective_date?: string | null
          full_description?: string | null
          notes?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          code_type?: string | null
          description?: string
          effective_date?: string | null
          full_description?: string | null
          notes?: string | null
          termination_date?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      api_connections: {
        Row: {
          api_key_encrypted: string | null
          api_url: string
          configuration: Json | null
          connection_name: string
          connection_type: string
          created_at: string
          credentials: Json | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url: string
          configuration?: Json | null
          connection_name: string
          connection_type: string
          created_at?: string
          credentials?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string
          configuration?: Json | null
          connection_name?: string
          connection_type?: string
          created_at?: string
          credentials?: Json | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appeal_templates: {
        Row: {
          active: boolean | null
          body_template: string
          created_at: string | null
          denial_category: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          optional_attachments: string[] | null
          payer_specific: string | null
          reason_codes: string[] | null
          required_attachments: string[] | null
          subject_template: string | null
          success_rate: number | null
          times_used: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          body_template: string
          created_at?: string | null
          denial_category: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          optional_attachments?: string[] | null
          payer_specific?: string | null
          reason_codes?: string[] | null
          required_attachments?: string[] | null
          subject_template?: string | null
          success_rate?: number | null
          times_used?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          body_template?: string
          created_at?: string | null
          denial_category?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          optional_attachments?: string[] | null
          payer_specific?: string | null
          reason_codes?: string[] | null
          required_attachments?: string[] | null
          subject_template?: string | null
          success_rate?: number | null
          times_used?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      appeals: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean | null
          appeal_date: string | null
          appeal_number: string | null
          appeal_type: string | null
          attachments: Json | null
          claim_id: string | null
          clinical_justification: string | null
          confirmation_number: string | null
          created_at: string | null
          denial_queue_id: string | null
          disputed_amount: number | null
          id: string
          letter_body: string | null
          outcome_amount: number | null
          patient_id: string | null
          payer_address: string | null
          payer_email: string | null
          payer_fax: string | null
          payer_name: string | null
          requested_amount: number | null
          response_date: string | null
          response_deadline: string | null
          response_notes: string | null
          status: string | null
          subject_line: string | null
          submission_method: string | null
          submitted_at: string | null
          submitted_by: string | null
          supporting_documents: string[] | null
          template_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          appeal_date?: string | null
          appeal_number?: string | null
          appeal_type?: string | null
          attachments?: Json | null
          claim_id?: string | null
          clinical_justification?: string | null
          confirmation_number?: string | null
          created_at?: string | null
          denial_queue_id?: string | null
          disputed_amount?: number | null
          id?: string
          letter_body?: string | null
          outcome_amount?: number | null
          patient_id?: string | null
          payer_address?: string | null
          payer_email?: string | null
          payer_fax?: string | null
          payer_name?: string | null
          requested_amount?: number | null
          response_date?: string | null
          response_deadline?: string | null
          response_notes?: string | null
          status?: string | null
          subject_line?: string | null
          submission_method?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          supporting_documents?: string[] | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean | null
          appeal_date?: string | null
          appeal_number?: string | null
          appeal_type?: string | null
          attachments?: Json | null
          claim_id?: string | null
          clinical_justification?: string | null
          confirmation_number?: string | null
          created_at?: string | null
          denial_queue_id?: string | null
          disputed_amount?: number | null
          id?: string
          letter_body?: string | null
          outcome_amount?: number | null
          patient_id?: string | null
          payer_address?: string | null
          payer_email?: string | null
          payer_fax?: string | null
          payer_name?: string | null
          requested_amount?: number | null
          response_date?: string | null
          response_deadline?: string | null
          response_notes?: string | null
          status?: string | null
          subject_line?: string | null
          submission_method?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          supporting_documents?: string[] | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appeals_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_denial_queue_id_fkey"
            columns: ["denial_queue_id"]
            isOneToOne: false
            referencedRelation: "denial_queue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "appeal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_discrepancies: {
        Row: {
          actual_charge_id: string | null
          actual_cpt: string | null
          actual_modifiers: string[] | null
          actual_units: number | null
          ai_explanation: string | null
          audit_id: string
          created_at: string | null
          description: string | null
          discrepancy_type: string
          id: string
          predicted_charge_id: string | null
          predicted_cpt: string | null
          predicted_modifiers: string[] | null
          predicted_units: number | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          revenue_impact: number | null
          severity: string | null
          status: string | null
          supporting_text: string | null
        }
        Insert: {
          actual_charge_id?: string | null
          actual_cpt?: string | null
          actual_modifiers?: string[] | null
          actual_units?: number | null
          ai_explanation?: string | null
          audit_id: string
          created_at?: string | null
          description?: string | null
          discrepancy_type: string
          id?: string
          predicted_charge_id?: string | null
          predicted_cpt?: string | null
          predicted_modifiers?: string[] | null
          predicted_units?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          revenue_impact?: number | null
          severity?: string | null
          status?: string | null
          supporting_text?: string | null
        }
        Update: {
          actual_charge_id?: string | null
          actual_cpt?: string | null
          actual_modifiers?: string[] | null
          actual_units?: number | null
          ai_explanation?: string | null
          audit_id?: string
          created_at?: string | null
          description?: string | null
          discrepancy_type?: string
          id?: string
          predicted_charge_id?: string | null
          predicted_cpt?: string | null
          predicted_modifiers?: string[] | null
          predicted_units?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          revenue_impact?: number | null
          severity?: string | null
          status?: string | null
          supporting_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_discrepancies_actual_charge_id_fkey"
            columns: ["actual_charge_id"]
            isOneToOne: false
            referencedRelation: "actual_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_discrepancies_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "charge_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_discrepancies_predicted_charge_id_fkey"
            columns: ["predicted_charge_id"]
            isOneToOne: false
            referencedRelation: "predicted_charges"
            referencedColumns: ["id"]
          },
        ]
      }
      authorizations: {
        Row: {
          auth_number: string | null
          cpt_codes: string[] | null
          created_at: string
          decision_date: string | null
          denial_reason: string | null
          diagnosis_codes: string[] | null
          id: string
          notes: string | null
          patient_name: string
          payer: string
          request_date: string
          service: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_number?: string | null
          cpt_codes?: string[] | null
          created_at?: string
          decision_date?: string | null
          denial_reason?: string | null
          diagnosis_codes?: string[] | null
          id?: string
          notes?: string | null
          patient_name: string
          payer: string
          request_date: string
          service?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_number?: string | null
          cpt_codes?: string[] | null
          created_at?: string
          decision_date?: string | null
          denial_reason?: string | null
          diagnosis_codes?: string[] | null
          id?: string
          notes?: string | null
          patient_name?: string
          payer?: string
          request_date?: string
          service?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      charge_audits: {
        Row: {
          actual_count: number | null
          audit_date: string | null
          clinical_note_id: string | null
          confirmed_revenue: number | null
          created_at: string | null
          id: string
          matched_count: number | null
          missing_count: number | null
          overall_confidence: number | null
          overcoded_count: number | null
          potential_revenue: number | null
          predicted_count: number | null
          processing_time_ms: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string | null
          undercoded_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_count?: number | null
          audit_date?: string | null
          clinical_note_id?: string | null
          confirmed_revenue?: number | null
          created_at?: string | null
          id?: string
          matched_count?: number | null
          missing_count?: number | null
          overall_confidence?: number | null
          overcoded_count?: number | null
          potential_revenue?: number | null
          predicted_count?: number | null
          processing_time_ms?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          undercoded_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_count?: number | null
          audit_date?: string | null
          clinical_note_id?: string | null
          confirmed_revenue?: number | null
          created_at?: string | null
          id?: string
          matched_count?: number | null
          missing_count?: number | null
          overall_confidence?: number | null
          overcoded_count?: number | null
          potential_revenue?: number | null
          predicted_count?: number | null
          processing_time_ms?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string | null
          undercoded_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_audits_clinical_note_id_fkey"
            columns: ["clinical_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_adjustments: {
        Row: {
          adjustment_group_code: string
          adjustment_group_description: string | null
          amount_1: number | null
          amount_2: number | null
          amount_3: number | null
          amount_4: number | null
          amount_5: number | null
          amount_6: number | null
          created_at: string | null
          id: string
          quantity_1: number | null
          quantity_2: number | null
          quantity_3: number | null
          quantity_4: number | null
          quantity_5: number | null
          quantity_6: number | null
          reason_code_1: string | null
          reason_code_2: string | null
          reason_code_3: string | null
          reason_code_4: string | null
          reason_code_5: string | null
          reason_code_6: string | null
          remittance_claim_id: string | null
          service_line_id: string | null
        }
        Insert: {
          adjustment_group_code: string
          adjustment_group_description?: string | null
          amount_1?: number | null
          amount_2?: number | null
          amount_3?: number | null
          amount_4?: number | null
          amount_5?: number | null
          amount_6?: number | null
          created_at?: string | null
          id?: string
          quantity_1?: number | null
          quantity_2?: number | null
          quantity_3?: number | null
          quantity_4?: number | null
          quantity_5?: number | null
          quantity_6?: number | null
          reason_code_1?: string | null
          reason_code_2?: string | null
          reason_code_3?: string | null
          reason_code_4?: string | null
          reason_code_5?: string | null
          reason_code_6?: string | null
          remittance_claim_id?: string | null
          service_line_id?: string | null
        }
        Update: {
          adjustment_group_code?: string
          adjustment_group_description?: string | null
          amount_1?: number | null
          amount_2?: number | null
          amount_3?: number | null
          amount_4?: number | null
          amount_5?: number | null
          amount_6?: number | null
          created_at?: string | null
          id?: string
          quantity_1?: number | null
          quantity_2?: number | null
          quantity_3?: number | null
          quantity_4?: number | null
          quantity_5?: number | null
          quantity_6?: number | null
          reason_code_1?: string | null
          reason_code_2?: string | null
          reason_code_3?: string | null
          reason_code_4?: string | null
          reason_code_5?: string | null
          reason_code_6?: string | null
          remittance_claim_id?: string | null
          service_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_adjustments_remittance_claim_id_fkey"
            columns: ["remittance_claim_id"]
            isOneToOne: false
            referencedRelation: "remittance_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_adjustments_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "remittance_service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_documents: {
        Row: {
          claim_id: string
          created_at: string | null
          document_id: string
          document_role: string
          id: string
          is_primary: boolean | null
          notes: string | null
          user_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          document_id: string
          document_role?: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          user_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          document_id?: string
          document_role?: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_scrub_results: {
        Row: {
          all_issues: Json | null
          claim_id: string | null
          claim_info: Json | null
          corrections: Json | null
          created_at: string | null
          critical_count: number | null
          denial_risk_score: number | null
          documentation_issues: Json | null
          high_count: number | null
          id: string
          low_count: number | null
          medium_count: number | null
          modifier_issues: Json | null
          mue_issues: Json | null
          ncci_issues: Json | null
          necessity_issues: Json | null
          payer_issues: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          status: string | null
          total_issues: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          all_issues?: Json | null
          claim_id?: string | null
          claim_info?: Json | null
          corrections?: Json | null
          created_at?: string | null
          critical_count?: number | null
          denial_risk_score?: number | null
          documentation_issues?: Json | null
          high_count?: number | null
          id?: string
          low_count?: number | null
          medium_count?: number | null
          modifier_issues?: Json | null
          mue_issues?: Json | null
          ncci_issues?: Json | null
          necessity_issues?: Json | null
          payer_issues?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          status?: string | null
          total_issues?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          all_issues?: Json | null
          claim_id?: string | null
          claim_info?: Json | null
          corrections?: Json | null
          created_at?: string | null
          critical_count?: number | null
          denial_risk_score?: number | null
          documentation_issues?: Json | null
          high_count?: number | null
          id?: string
          low_count?: number | null
          medium_count?: number | null
          modifier_issues?: Json | null
          mue_issues?: Json | null
          ncci_issues?: Json | null
          necessity_issues?: Json | null
          payer_issues?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          status?: string | null
          total_issues?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_scrub_results_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          ai_analysis: Json | null
          ai_recommendations: string[] | null
          ai_reviewed_at: string | null
          approval_probability: number | null
          billed_amount: number | null
          claim_file_url: string | null
          claim_filename: string | null
          claim_id: string
          clinical_findings: Json | null
          created_at: string | null
          date_of_service: string
          deniability_probability: number | null
          diagnosis_code: string | null
          diagnosis_codes: string[] | null
          documentation_score: number | null
          executive_summary: string | null
          extracted_claim_data: Json | null
          fhir_id: string | null
          id: string
          next_steps: string[] | null
          notes_file_url: string | null
          notes_filename: string | null
          patient_address: string | null
          patient_dob: string | null
          patient_name: string
          patient_phone: string | null
          payer: string | null
          payer_id: string | null
          payer_type: string | null
          procedure_code: string | null
          procedure_codes: string[] | null
          provider: string
          provider_name: string | null
          provider_npi: string | null
          risk_category: string | null
          risk_level: string | null
          service_facility_name: string | null
          service_facility_npi: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_recommendations?: string[] | null
          ai_reviewed_at?: string | null
          approval_probability?: number | null
          billed_amount?: number | null
          claim_file_url?: string | null
          claim_filename?: string | null
          claim_id: string
          clinical_findings?: Json | null
          created_at?: string | null
          date_of_service: string
          deniability_probability?: number | null
          diagnosis_code?: string | null
          diagnosis_codes?: string[] | null
          documentation_score?: number | null
          executive_summary?: string | null
          extracted_claim_data?: Json | null
          fhir_id?: string | null
          id?: string
          next_steps?: string[] | null
          notes_file_url?: string | null
          notes_filename?: string | null
          patient_address?: string | null
          patient_dob?: string | null
          patient_name: string
          patient_phone?: string | null
          payer?: string | null
          payer_id?: string | null
          payer_type?: string | null
          procedure_code?: string | null
          procedure_codes?: string[] | null
          provider: string
          provider_name?: string | null
          provider_npi?: string | null
          risk_category?: string | null
          risk_level?: string | null
          service_facility_name?: string | null
          service_facility_npi?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_recommendations?: string[] | null
          ai_reviewed_at?: string | null
          approval_probability?: number | null
          billed_amount?: number | null
          claim_file_url?: string | null
          claim_filename?: string | null
          claim_id?: string
          clinical_findings?: Json | null
          created_at?: string | null
          date_of_service?: string
          deniability_probability?: number | null
          diagnosis_code?: string | null
          diagnosis_codes?: string[] | null
          documentation_score?: number | null
          executive_summary?: string | null
          extracted_claim_data?: Json | null
          fhir_id?: string | null
          id?: string
          next_steps?: string[] | null
          notes_file_url?: string | null
          notes_filename?: string | null
          patient_address?: string | null
          patient_dob?: string | null
          patient_name?: string
          patient_phone?: string | null
          payer?: string | null
          payer_id?: string | null
          payer_type?: string | null
          procedure_code?: string | null
          procedure_codes?: string[] | null
          provider?: string
          provider_name?: string | null
          provider_npi?: string | null
          risk_category?: string | null
          risk_level?: string | null
          service_facility_name?: string | null
          service_facility_npi?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clinical_notes: {
        Row: {
          created_at: string | null
          encounter_date: string | null
          encounter_id: string | null
          error_message: string | null
          facility_name: string | null
          id: string
          note_type: string | null
          parsed_content: Json | null
          patient_id: string | null
          patient_name: string | null
          processed_at: string | null
          provider_name: string | null
          provider_npi: string | null
          raw_content: string | null
          source: string | null
          source_document_id: string | null
          specialty: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encounter_date?: string | null
          encounter_id?: string | null
          error_message?: string | null
          facility_name?: string | null
          id?: string
          note_type?: string | null
          parsed_content?: Json | null
          patient_id?: string | null
          patient_name?: string | null
          processed_at?: string | null
          provider_name?: string | null
          provider_npi?: string | null
          raw_content?: string | null
          source?: string | null
          source_document_id?: string | null
          specialty?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encounter_date?: string | null
          encounter_id?: string | null
          error_message?: string | null
          facility_name?: string | null
          id?: string
          note_type?: string | null
          parsed_content?: Json | null
          patient_id?: string | null
          patient_name?: string | null
          processed_at?: string | null
          provider_name?: string | null
          provider_npi?: string | null
          raw_content?: string | null
          source?: string | null
          source_document_id?: string | null
          specialty?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      cpt_documentation_rules: {
        Row: {
          active: boolean | null
          commercial_rate: number | null
          common_modifiers: string[] | null
          cpt_category: string | null
          cpt_code: string
          cpt_description: string | null
          created_at: string | null
          em_level: number | null
          exclusion_keywords: string[] | null
          id: string
          mdm_level: string | null
          medicare_rate: number | null
          modifier_triggers: Json | null
          required_elements: Json | null
          required_keywords: string[] | null
          source: string | null
          specialty: string | null
          supporting_keywords: string[] | null
          time_threshold_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          commercial_rate?: number | null
          common_modifiers?: string[] | null
          cpt_category?: string | null
          cpt_code: string
          cpt_description?: string | null
          created_at?: string | null
          em_level?: number | null
          exclusion_keywords?: string[] | null
          id?: string
          mdm_level?: string | null
          medicare_rate?: number | null
          modifier_triggers?: Json | null
          required_elements?: Json | null
          required_keywords?: string[] | null
          source?: string | null
          specialty?: string | null
          supporting_keywords?: string[] | null
          time_threshold_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          commercial_rate?: number | null
          common_modifiers?: string[] | null
          cpt_category?: string | null
          cpt_code?: string
          cpt_description?: string | null
          created_at?: string | null
          em_level?: number | null
          exclusion_keywords?: string[] | null
          id?: string
          mdm_level?: string | null
          medicare_rate?: number | null
          modifier_triggers?: Json | null
          required_elements?: Json | null
          required_keywords?: string[] | null
          source?: string | null
          specialty?: string | null
          supporting_keywords?: string[] | null
          time_threshold_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cpt_requirements: {
        Row: {
          cms_requirements: string | null
          cpt_code: string
          id: string
          payer_specific: Json | null
          requires_prior_auth: boolean | null
          updated_at: string
        }
        Insert: {
          cms_requirements?: string | null
          cpt_code: string
          id?: string
          payer_specific?: Json | null
          requires_prior_auth?: boolean | null
          updated_at?: string
        }
        Update: {
          cms_requirements?: string | null
          cpt_code?: string
          id?: string
          payer_specific?: Json | null
          requires_prior_auth?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      denial_actions: {
        Row: {
          action_description: string | null
          action_type: string
          appeal_id: string | null
          created_at: string | null
          denial_queue_id: string | null
          id: string
          new_value: string | null
          performed_at: string | null
          performed_by: string | null
          previous_value: string | null
          user_id: string | null
        }
        Insert: {
          action_description?: string | null
          action_type: string
          appeal_id?: string | null
          created_at?: string | null
          denial_queue_id?: string | null
          id?: string
          new_value?: string | null
          performed_at?: string | null
          performed_by?: string | null
          previous_value?: string | null
          user_id?: string | null
        }
        Update: {
          action_description?: string | null
          action_type?: string
          appeal_id?: string | null
          created_at?: string | null
          denial_queue_id?: string | null
          id?: string
          new_value?: string | null
          performed_at?: string | null
          performed_by?: string | null
          previous_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denial_actions_appeal_id_fkey"
            columns: ["appeal_id"]
            isOneToOne: false
            referencedRelation: "appeals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denial_actions_denial_queue_id_fkey"
            columns: ["denial_queue_id"]
            isOneToOne: false
            referencedRelation: "denial_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      denial_classifications: {
        Row: {
          active: boolean | null
          appeal_success_rate: number | null
          appealable: boolean | null
          category: string
          common_causes: string[] | null
          created_at: string | null
          id: string
          reason_code: string
          reason_description: string | null
          recommended_action: string | null
          required_documentation: string[] | null
          subcategory: string | null
          typical_appeal_deadline_days: number | null
          typical_resolution: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          appeal_success_rate?: number | null
          appealable?: boolean | null
          category: string
          common_causes?: string[] | null
          created_at?: string | null
          id?: string
          reason_code: string
          reason_description?: string | null
          recommended_action?: string | null
          required_documentation?: string[] | null
          subcategory?: string | null
          typical_appeal_deadline_days?: number | null
          typical_resolution?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          appeal_success_rate?: number | null
          appealable?: boolean | null
          category?: string
          common_causes?: string[] | null
          created_at?: string | null
          id?: string
          reason_code?: string
          reason_description?: string | null
          recommended_action?: string | null
          required_documentation?: string[] | null
          subcategory?: string | null
          typical_appeal_deadline_days?: number | null
          typical_resolution?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      denial_history: {
        Row: {
          appeal_date: string | null
          appeal_outcome: string | null
          billed_amount: number | null
          claim_id: string | null
          cpt_codes: string[] | null
          created_at: string | null
          denial_category: string | null
          denial_date: string | null
          denial_reason_code: string | null
          denial_reason_description: string | null
          final_paid_amount: number | null
          icd_codes: string[] | null
          id: string
          modifiers: string[] | null
          payer: string | null
          predicted_risk_score: number | null
          remark_codes: string[] | null
          scrub_result_id: string | null
          user_id: string | null
          was_appealed: boolean | null
        }
        Insert: {
          appeal_date?: string | null
          appeal_outcome?: string | null
          billed_amount?: number | null
          claim_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string | null
          denial_category?: string | null
          denial_date?: string | null
          denial_reason_code?: string | null
          denial_reason_description?: string | null
          final_paid_amount?: number | null
          icd_codes?: string[] | null
          id?: string
          modifiers?: string[] | null
          payer?: string | null
          predicted_risk_score?: number | null
          remark_codes?: string[] | null
          scrub_result_id?: string | null
          user_id?: string | null
          was_appealed?: boolean | null
        }
        Update: {
          appeal_date?: string | null
          appeal_outcome?: string | null
          billed_amount?: number | null
          claim_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string | null
          denial_category?: string | null
          denial_date?: string | null
          denial_reason_code?: string | null
          denial_reason_description?: string | null
          final_paid_amount?: number | null
          icd_codes?: string[] | null
          id?: string
          modifiers?: string[] | null
          payer?: string | null
          predicted_risk_score?: number | null
          remark_codes?: string[] | null
          scrub_result_id?: string | null
          user_id?: string | null
          was_appealed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "denial_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denial_history_scrub_result_id_fkey"
            columns: ["scrub_result_id"]
            isOneToOne: false
            referencedRelation: "claim_scrub_results"
            referencedColumns: ["id"]
          },
        ]
      }
      denial_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          denial_queue_id: string | null
          id: string
          note_text: string
          note_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          denial_queue_id?: string | null
          id?: string
          note_text: string
          note_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          denial_queue_id?: string | null
          id?: string
          note_text?: string
          note_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denial_notes_denial_queue_id_fkey"
            columns: ["denial_queue_id"]
            isOneToOne: false
            referencedRelation: "denial_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      denial_outcomes: {
        Row: {
          billed_amount: number | null
          claim_id: string | null
          created_at: string | null
          date_adjudicated: string | null
          date_of_service: string | null
          date_submitted: string | null
          denial_category: string | null
          denial_reason_code: string | null
          denial_reason_description: string | null
          denied_amount: number | null
          icd_codes: string[] | null
          id: string
          issues_flagged: number | null
          notes: string | null
          outcome: string
          paid_amount: number | null
          patient_name: string | null
          payer: string | null
          predicted_risk_level: string | null
          predicted_risk_score: number | null
          procedure_codes: string[] | null
          scrub_result_id: string | null
          updated_at: string | null
          user_id: string
          was_prediction_correct: boolean | null
        }
        Insert: {
          billed_amount?: number | null
          claim_id?: string | null
          created_at?: string | null
          date_adjudicated?: string | null
          date_of_service?: string | null
          date_submitted?: string | null
          denial_category?: string | null
          denial_reason_code?: string | null
          denial_reason_description?: string | null
          denied_amount?: number | null
          icd_codes?: string[] | null
          id?: string
          issues_flagged?: number | null
          notes?: string | null
          outcome: string
          paid_amount?: number | null
          patient_name?: string | null
          payer?: string | null
          predicted_risk_level?: string | null
          predicted_risk_score?: number | null
          procedure_codes?: string[] | null
          scrub_result_id?: string | null
          updated_at?: string | null
          user_id: string
          was_prediction_correct?: boolean | null
        }
        Update: {
          billed_amount?: number | null
          claim_id?: string | null
          created_at?: string | null
          date_adjudicated?: string | null
          date_of_service?: string | null
          date_submitted?: string | null
          denial_category?: string | null
          denial_reason_code?: string | null
          denial_reason_description?: string | null
          denied_amount?: number | null
          icd_codes?: string[] | null
          id?: string
          issues_flagged?: number | null
          notes?: string | null
          outcome?: string
          paid_amount?: number | null
          patient_name?: string | null
          payer?: string | null
          predicted_risk_level?: string | null
          predicted_risk_score?: number | null
          procedure_codes?: string[] | null
          scrub_result_id?: string | null
          updated_at?: string | null
          user_id?: string
          was_prediction_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "denial_outcomes_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denial_outcomes_scrub_result_id_fkey"
            columns: ["scrub_result_id"]
            isOneToOne: false
            referencedRelation: "claim_scrub_results"
            referencedColumns: ["id"]
          },
        ]
      }
      denial_queue: {
        Row: {
          adjustment_reason_code: string | null
          ai_confidence: number | null
          allowed_amount: number | null
          appeal_deadline: string | null
          assigned_at: string | null
          assigned_to: string | null
          billed_amount: number | null
          claim_id: string | null
          classification_id: string | null
          classified_category: string | null
          cpt_code: string | null
          cpt_description: string | null
          created_at: string | null
          days_until_deadline: number | null
          denial_date: string
          denied_amount: number | null
          icd_codes: string[] | null
          id: string
          modifiers: string[] | null
          patient_id: string | null
          payer_id: string | null
          payer_name: string | null
          priority: string | null
          reason_code: string | null
          reason_description: string | null
          remark_codes: string[] | null
          remittance_id: string | null
          resolution_amount: number | null
          resolution_date: string | null
          resolution_notes: string | null
          resolution_type: string | null
          root_cause: string | null
          service_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          adjustment_reason_code?: string | null
          ai_confidence?: number | null
          allowed_amount?: number | null
          appeal_deadline?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          billed_amount?: number | null
          claim_id?: string | null
          classification_id?: string | null
          classified_category?: string | null
          cpt_code?: string | null
          cpt_description?: string | null
          created_at?: string | null
          days_until_deadline?: number | null
          denial_date: string
          denied_amount?: number | null
          icd_codes?: string[] | null
          id?: string
          modifiers?: string[] | null
          patient_id?: string | null
          payer_id?: string | null
          payer_name?: string | null
          priority?: string | null
          reason_code?: string | null
          reason_description?: string | null
          remark_codes?: string[] | null
          remittance_id?: string | null
          resolution_amount?: number | null
          resolution_date?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          root_cause?: string | null
          service_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          adjustment_reason_code?: string | null
          ai_confidence?: number | null
          allowed_amount?: number | null
          appeal_deadline?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          billed_amount?: number | null
          claim_id?: string | null
          classification_id?: string | null
          classified_category?: string | null
          cpt_code?: string | null
          cpt_description?: string | null
          created_at?: string | null
          days_until_deadline?: number | null
          denial_date?: string
          denied_amount?: number | null
          icd_codes?: string[] | null
          id?: string
          modifiers?: string[] | null
          patient_id?: string | null
          payer_id?: string | null
          payer_name?: string | null
          priority?: string | null
          reason_code?: string | null
          reason_description?: string | null
          remark_codes?: string[] | null
          remittance_id?: string | null
          resolution_amount?: number | null
          resolution_date?: string | null
          resolution_notes?: string | null
          resolution_type?: string | null
          root_cause?: string | null
          service_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denial_queue_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denial_queue_classification_id_fkey"
            columns: ["classification_id"]
            isOneToOne: false
            referencedRelation: "denial_classifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denial_queue_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      denials: {
        Row: {
          appeal_status: string | null
          claim_id: string | null
          created_at: string | null
          denial_code: string
          denial_date: string
          denial_reason: string
          denied_amount: number | null
          id: string
          payer: string
          user_id: string
        }
        Insert: {
          appeal_status?: string | null
          claim_id?: string | null
          created_at?: string | null
          denial_code: string
          denial_date: string
          denial_reason: string
          denied_amount?: number | null
          id?: string
          payer: string
          user_id: string
        }
        Update: {
          appeal_status?: string | null
          claim_id?: string | null
          created_at?: string | null
          denial_code?: string
          denial_date?: string
          denial_reason?: string
          denied_amount?: number | null
          id?: string
          payer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "denials_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          classification_confidence: string | null
          classification_indicators: string[] | null
          created_at: string | null
          document_type: string | null
          error_code: string | null
          error_message: string | null
          extracted_data: Json | null
          extracted_text: string | null
          file_size: number | null
          file_type: string
          file_url: string
          filename: string
          id: string
          mime_type: string | null
          notes: string | null
          ocr_confidence: number | null
          ocr_provider: string | null
          ocr_required: boolean | null
          original_filename: string | null
          processed_at: string | null
          processing_duration_ms: number | null
          processing_started_at: string | null
          retry_count: number | null
          source: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          classification_confidence?: string | null
          classification_indicators?: string[] | null
          created_at?: string | null
          document_type?: string | null
          error_code?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          extracted_text?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          filename: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_provider?: string | null
          ocr_required?: boolean | null
          original_filename?: string | null
          processed_at?: string | null
          processing_duration_ms?: number | null
          processing_started_at?: string | null
          retry_count?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          classification_confidence?: string | null
          classification_indicators?: string[] | null
          created_at?: string | null
          document_type?: string | null
          error_code?: string | null
          error_message?: string | null
          extracted_data?: Json | null
          extracted_text?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          filename?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          ocr_confidence?: number | null
          ocr_provider?: string | null
          ocr_required?: boolean | null
          original_filename?: string | null
          processed_at?: string | null
          processing_duration_ms?: number | null
          processing_started_at?: string | null
          retry_count?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      edi_claims: {
        Row: {
          accident_date: string | null
          accident_state: string | null
          accident_type: string | null
          admission_date: string | null
          benefits_assignment: string | null
          billing_provider_address_line1: string | null
          billing_provider_address_line2: string | null
          billing_provider_city: string | null
          billing_provider_name: string | null
          billing_provider_npi: string | null
          billing_provider_state: string | null
          billing_provider_tax_id: string | null
          billing_provider_taxonomy: string | null
          billing_provider_zip: string | null
          claim_frequency_code: string | null
          claim_submitter_id: string | null
          created_at: string | null
          diagnosis_code_qualifier: string | null
          diagnosis_codes: string[] | null
          discharge_date: string | null
          edi_file_id: string | null
          id: string
          internal_claim_id: string | null
          patient_address_line1: string | null
          patient_city: string | null
          patient_dob: string | null
          patient_gender: string | null
          patient_name_first: string | null
          patient_name_last: string | null
          patient_name_middle: string | null
          patient_relationship: string | null
          patient_signature_source: string | null
          patient_state: string | null
          patient_zip: string | null
          pay_to_provider_address_line1: string | null
          pay_to_provider_city: string | null
          pay_to_provider_name: string | null
          pay_to_provider_npi: string | null
          pay_to_provider_state: string | null
          pay_to_provider_zip: string | null
          payer_address_line1: string | null
          payer_city: string | null
          payer_id: string | null
          payer_name: string | null
          payer_state: string | null
          payer_zip: string | null
          place_of_service: string | null
          principal_diagnosis: string | null
          prior_auth_number: string | null
          provider_accept_assignment: string | null
          provider_signature: boolean | null
          referring_provider_name: string | null
          referring_provider_npi: string | null
          release_of_info: string | null
          rendering_provider_name: string | null
          rendering_provider_npi: string | null
          service_date_end: string | null
          service_date_start: string | null
          service_facility_address: string | null
          service_facility_name: string | null
          service_facility_npi: string | null
          service_lines: Json | null
          subscriber_address_line1: string | null
          subscriber_city: string | null
          subscriber_dob: string | null
          subscriber_gender: string | null
          subscriber_id: string | null
          subscriber_name_first: string | null
          subscriber_name_last: string | null
          subscriber_name_middle: string | null
          subscriber_state: string | null
          subscriber_zip: string | null
          total_charge: number | null
          user_id: string
        }
        Insert: {
          accident_date?: string | null
          accident_state?: string | null
          accident_type?: string | null
          admission_date?: string | null
          benefits_assignment?: string | null
          billing_provider_address_line1?: string | null
          billing_provider_address_line2?: string | null
          billing_provider_city?: string | null
          billing_provider_name?: string | null
          billing_provider_npi?: string | null
          billing_provider_state?: string | null
          billing_provider_tax_id?: string | null
          billing_provider_taxonomy?: string | null
          billing_provider_zip?: string | null
          claim_frequency_code?: string | null
          claim_submitter_id?: string | null
          created_at?: string | null
          diagnosis_code_qualifier?: string | null
          diagnosis_codes?: string[] | null
          discharge_date?: string | null
          edi_file_id?: string | null
          id?: string
          internal_claim_id?: string | null
          patient_address_line1?: string | null
          patient_city?: string | null
          patient_dob?: string | null
          patient_gender?: string | null
          patient_name_first?: string | null
          patient_name_last?: string | null
          patient_name_middle?: string | null
          patient_relationship?: string | null
          patient_signature_source?: string | null
          patient_state?: string | null
          patient_zip?: string | null
          pay_to_provider_address_line1?: string | null
          pay_to_provider_city?: string | null
          pay_to_provider_name?: string | null
          pay_to_provider_npi?: string | null
          pay_to_provider_state?: string | null
          pay_to_provider_zip?: string | null
          payer_address_line1?: string | null
          payer_city?: string | null
          payer_id?: string | null
          payer_name?: string | null
          payer_state?: string | null
          payer_zip?: string | null
          place_of_service?: string | null
          principal_diagnosis?: string | null
          prior_auth_number?: string | null
          provider_accept_assignment?: string | null
          provider_signature?: boolean | null
          referring_provider_name?: string | null
          referring_provider_npi?: string | null
          release_of_info?: string | null
          rendering_provider_name?: string | null
          rendering_provider_npi?: string | null
          service_date_end?: string | null
          service_date_start?: string | null
          service_facility_address?: string | null
          service_facility_name?: string | null
          service_facility_npi?: string | null
          service_lines?: Json | null
          subscriber_address_line1?: string | null
          subscriber_city?: string | null
          subscriber_dob?: string | null
          subscriber_gender?: string | null
          subscriber_id?: string | null
          subscriber_name_first?: string | null
          subscriber_name_last?: string | null
          subscriber_name_middle?: string | null
          subscriber_state?: string | null
          subscriber_zip?: string | null
          total_charge?: number | null
          user_id: string
        }
        Update: {
          accident_date?: string | null
          accident_state?: string | null
          accident_type?: string | null
          admission_date?: string | null
          benefits_assignment?: string | null
          billing_provider_address_line1?: string | null
          billing_provider_address_line2?: string | null
          billing_provider_city?: string | null
          billing_provider_name?: string | null
          billing_provider_npi?: string | null
          billing_provider_state?: string | null
          billing_provider_tax_id?: string | null
          billing_provider_taxonomy?: string | null
          billing_provider_zip?: string | null
          claim_frequency_code?: string | null
          claim_submitter_id?: string | null
          created_at?: string | null
          diagnosis_code_qualifier?: string | null
          diagnosis_codes?: string[] | null
          discharge_date?: string | null
          edi_file_id?: string | null
          id?: string
          internal_claim_id?: string | null
          patient_address_line1?: string | null
          patient_city?: string | null
          patient_dob?: string | null
          patient_gender?: string | null
          patient_name_first?: string | null
          patient_name_last?: string | null
          patient_name_middle?: string | null
          patient_relationship?: string | null
          patient_signature_source?: string | null
          patient_state?: string | null
          patient_zip?: string | null
          pay_to_provider_address_line1?: string | null
          pay_to_provider_city?: string | null
          pay_to_provider_name?: string | null
          pay_to_provider_npi?: string | null
          pay_to_provider_state?: string | null
          pay_to_provider_zip?: string | null
          payer_address_line1?: string | null
          payer_city?: string | null
          payer_id?: string | null
          payer_name?: string | null
          payer_state?: string | null
          payer_zip?: string | null
          place_of_service?: string | null
          principal_diagnosis?: string | null
          prior_auth_number?: string | null
          provider_accept_assignment?: string | null
          provider_signature?: boolean | null
          referring_provider_name?: string | null
          referring_provider_npi?: string | null
          release_of_info?: string | null
          rendering_provider_name?: string | null
          rendering_provider_npi?: string | null
          service_date_end?: string | null
          service_date_start?: string | null
          service_facility_address?: string | null
          service_facility_name?: string | null
          service_facility_npi?: string | null
          service_lines?: Json | null
          subscriber_address_line1?: string | null
          subscriber_city?: string | null
          subscriber_dob?: string | null
          subscriber_gender?: string | null
          subscriber_id?: string | null
          subscriber_name_first?: string | null
          subscriber_name_last?: string | null
          subscriber_name_middle?: string | null
          subscriber_state?: string | null
          subscriber_zip?: string | null
          total_charge?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edi_claims_edi_file_id_fkey"
            columns: ["edi_file_id"]
            isOneToOne: false
            referencedRelation: "edi_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edi_claims_internal_claim_id_fkey"
            columns: ["internal_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      edi_files: {
        Row: {
          application_receiver_code: string | null
          application_sender_code: string | null
          created_at: string | null
          document_id: string | null
          error_message: string | null
          file_type: string
          functional_group_control_number: string | null
          id: string
          implementation_reference: string | null
          interchange_control_number: string | null
          interchange_date: string | null
          interchange_time: string | null
          parsed_data: Json | null
          processed_at: string | null
          raw_content: string | null
          receiver_id: string | null
          receiver_qualifier: string | null
          sender_id: string | null
          sender_qualifier: string | null
          status: string | null
          transaction_count: number | null
          transaction_set_control_number: string | null
          user_id: string
          validation_errors: Json | null
          version_code: string | null
        }
        Insert: {
          application_receiver_code?: string | null
          application_sender_code?: string | null
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_type: string
          functional_group_control_number?: string | null
          id?: string
          implementation_reference?: string | null
          interchange_control_number?: string | null
          interchange_date?: string | null
          interchange_time?: string | null
          parsed_data?: Json | null
          processed_at?: string | null
          raw_content?: string | null
          receiver_id?: string | null
          receiver_qualifier?: string | null
          sender_id?: string | null
          sender_qualifier?: string | null
          status?: string | null
          transaction_count?: number | null
          transaction_set_control_number?: string | null
          user_id: string
          validation_errors?: Json | null
          version_code?: string | null
        }
        Update: {
          application_receiver_code?: string | null
          application_sender_code?: string | null
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          file_type?: string
          functional_group_control_number?: string | null
          id?: string
          implementation_reference?: string | null
          interchange_control_number?: string | null
          interchange_date?: string | null
          interchange_time?: string | null
          parsed_data?: Json | null
          processed_at?: string | null
          raw_content?: string | null
          receiver_id?: string | null
          receiver_qualifier?: string | null
          sender_id?: string | null
          sender_qualifier?: string | null
          status?: string | null
          transaction_count?: number | null
          transaction_set_control_number?: string | null
          user_id?: string
          validation_errors?: Json | null
          version_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "edi_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          action: string | null
          component: string | null
          created_at: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          request_data: Json | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          response_data: Json | null
          severity: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          component?: string | null
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          request_data?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_data?: Json | null
          severity?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          component?: string | null
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          request_data?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_data?: Json | null
          severity?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      frequency_limits: {
        Row: {
          cpt_code: string
          created_at: string | null
          description: string | null
          exception_diagnoses: string[] | null
          exception_modifiers: string[] | null
          exception_note: string | null
          id: string
          max_per_day: number | null
          max_per_month: number | null
          max_per_week: number | null
          max_per_year: number | null
          payer: string | null
          requires_interval_days: number | null
          reset_on_diagnosis_change: boolean | null
        }
        Insert: {
          cpt_code: string
          created_at?: string | null
          description?: string | null
          exception_diagnoses?: string[] | null
          exception_modifiers?: string[] | null
          exception_note?: string | null
          id?: string
          max_per_day?: number | null
          max_per_month?: number | null
          max_per_week?: number | null
          max_per_year?: number | null
          payer?: string | null
          requires_interval_days?: number | null
          reset_on_diagnosis_change?: boolean | null
        }
        Update: {
          cpt_code?: string
          created_at?: string | null
          description?: string | null
          exception_diagnoses?: string[] | null
          exception_modifiers?: string[] | null
          exception_note?: string | null
          id?: string
          max_per_day?: number | null
          max_per_month?: number | null
          max_per_week?: number | null
          max_per_year?: number | null
          payer?: string | null
          requires_interval_days?: number | null
          reset_on_diagnosis_change?: boolean | null
        }
        Relationships: []
      }
      generated_letters: {
        Row: {
          content: string
          generated_at: string
          id: string
          letter_type: string
          metadata: Json | null
          related_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          letter_type: string
          metadata?: Json | null
          related_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          letter_type?: string
          metadata?: Json | null
          related_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medical_necessity_matrix: {
        Row: {
          cpt_code: string
          created_at: string | null
          icd_code: string
          id: string
          necessity_score: number | null
          notes: string | null
          payer_type: string | null
          source: string | null
        }
        Insert: {
          cpt_code: string
          created_at?: string | null
          icd_code: string
          id?: string
          necessity_score?: number | null
          notes?: string | null
          payer_type?: string | null
          source?: string | null
        }
        Update: {
          cpt_code?: string
          created_at?: string | null
          icd_code?: string
          id?: string
          necessity_score?: number | null
          notes?: string | null
          payer_type?: string | null
          source?: string | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          created_at: string | null
          id: string
          metric_type: string
          period_end: string
          period_start: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_type: string
          period_end: string
          period_start: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_type?: string
          period_end?: string
          period_start?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      modifier_rules: {
        Row: {
          created_at: string | null
          documentation_requirements: string | null
          global_rule: boolean | null
          id: string
          modifier: string
          modifier_description: string | null
          prohibited_with_modifiers: string[] | null
          required_conditions: string[] | null
          required_with_cpt_categories: string[] | null
          requires_documentation: boolean | null
        }
        Insert: {
          created_at?: string | null
          documentation_requirements?: string | null
          global_rule?: boolean | null
          id?: string
          modifier: string
          modifier_description?: string | null
          prohibited_with_modifiers?: string[] | null
          required_conditions?: string[] | null
          required_with_cpt_categories?: string[] | null
          requires_documentation?: boolean | null
        }
        Update: {
          created_at?: string | null
          documentation_requirements?: string | null
          global_rule?: boolean | null
          id?: string
          modifier?: string
          modifier_description?: string | null
          prohibited_with_modifiers?: string[] | null
          required_conditions?: string[] | null
          required_with_cpt_categories?: string[] | null
          requires_documentation?: boolean | null
        }
        Relationships: []
      }
      mue_edits: {
        Row: {
          cpt_code: string
          created_at: string | null
          effective_date: string | null
          end_date: string | null
          facility_limit: number | null
          id: string
          practitioner_limit: number | null
          rationale: string | null
          updated_at: string | null
        }
        Insert: {
          cpt_code: string
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          facility_limit?: number | null
          id?: string
          practitioner_limit?: number | null
          rationale?: string | null
          updated_at?: string | null
        }
        Update: {
          cpt_code?: string
          created_at?: string | null
          effective_date?: string | null
          end_date?: string | null
          facility_limit?: number | null
          id?: string
          practitioner_limit?: number | null
          rationale?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ncci_ptp_edits: {
        Row: {
          column_1_cpt: string
          column_2_cpt: string
          created_at: string | null
          deletion_date: string | null
          effective_date: string | null
          id: string
          modifier_indicator: string | null
          ptp_edit_rationale: number | null
        }
        Insert: {
          column_1_cpt: string
          column_2_cpt: string
          created_at?: string | null
          deletion_date?: string | null
          effective_date?: string | null
          id?: string
          modifier_indicator?: string | null
          ptp_edit_rationale?: number | null
        }
        Update: {
          column_1_cpt?: string
          column_2_cpt?: string
          created_at?: string | null
          deletion_date?: string | null
          effective_date?: string | null
          id?: string
          modifier_indicator?: string | null
          ptp_edit_rationale?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          claim_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          scrub_result_id: string | null
          severity: string
          title: string
          user_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          claim_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message: string
          notification_type: string
          read_at?: string | null
          scrub_result_id?: string | null
          severity: string
          title: string
          user_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          claim_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          scrub_result_id?: string | null
          severity?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_scrub_result_id_fkey"
            columns: ["scrub_result_id"]
            isOneToOne: false
            referencedRelation: "claim_scrub_results"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          changes: Json | null
          created_at: string | null
          error_message: string | null
          id: string
          patient_external_id: string | null
          patient_id: string | null
          source: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          changes?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          patient_external_id?: string | null
          patient_id?: string | null
          source?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          changes?: Json | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          patient_external_id?: string | null
          patient_id?: string | null
          source?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_audit_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          external_id: string | null
          first_name: string | null
          gender: string | null
          id: string
          insurance_info: Json | null
          last_name: string | null
          last_synced_at: string | null
          middle_name: string | null
          phone: string | null
          postal_code: string | null
          prefix: string | null
          raw_fhir_data: Json | null
          source: string
          source_connection_id: string | null
          state: string | null
          suffix: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          insurance_info?: Json | null
          last_name?: string | null
          last_synced_at?: string | null
          middle_name?: string | null
          phone?: string | null
          postal_code?: string | null
          prefix?: string | null
          raw_fhir_data?: Json | null
          source?: string
          source_connection_id?: string | null
          state?: string | null
          suffix?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          insurance_info?: Json | null
          last_name?: string | null
          last_synced_at?: string | null
          middle_name?: string | null
          phone?: string | null
          postal_code?: string | null
          prefix?: string | null
          raw_fhir_data?: Json | null
          source?: string
          source_connection_id?: string | null
          state?: string | null
          suffix?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_source_connection_id_fkey"
            columns: ["source_connection_id"]
            isOneToOne: false
            referencedRelation: "api_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_connections: {
        Row: {
          configuration: Json | null
          created_at: string
          credentials_encrypted: string | null
          id: string
          is_active: boolean | null
          payer_name: string
          portal_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean | null
          payer_name: string
          portal_url: string
          updated_at?: string
          user_id: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          credentials_encrypted?: string | null
          id?: string
          is_active?: boolean | null
          payer_name?: string
          portal_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payer_rules: {
        Row: {
          action_required: string | null
          active: boolean | null
          coverage_type: string | null
          covered_diagnoses: string[] | null
          cpt_codes: string[] | null
          created_at: string | null
          denial_reason_codes: string[] | null
          documentation_required: string | null
          frequency_limit: string | null
          icd_codes: string[] | null
          id: string
          mac_contractor: string | null
          payer_id: string | null
          payer_name: string
          rule_description: string
          rule_type: string
          severity: string | null
          updated_at: string | null
        }
        Insert: {
          action_required?: string | null
          active?: boolean | null
          coverage_type?: string | null
          covered_diagnoses?: string[] | null
          cpt_codes?: string[] | null
          created_at?: string | null
          denial_reason_codes?: string[] | null
          documentation_required?: string | null
          frequency_limit?: string | null
          icd_codes?: string[] | null
          id?: string
          mac_contractor?: string | null
          payer_id?: string | null
          payer_name: string
          rule_description: string
          rule_type: string
          severity?: string | null
          updated_at?: string | null
        }
        Update: {
          action_required?: string | null
          active?: boolean | null
          coverage_type?: string | null
          covered_diagnoses?: string[] | null
          cpt_codes?: string[] | null
          created_at?: string | null
          denial_reason_codes?: string[] | null
          documentation_required?: string | null
          frequency_limit?: string | null
          icd_codes?: string[] | null
          id?: string
          mac_contractor?: string | null
          payer_id?: string | null
          payer_name?: string
          rule_description?: string
          rule_type?: string
          severity?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          adjustments: Json | null
          amount: number
          claim_id: string | null
          created_at: string
          id: string
          method: string | null
          payer: string
          payment_date: string
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustments?: Json | null
          amount: number
          claim_id?: string | null
          created_at?: string
          id?: string
          method?: string | null
          payer: string
          payment_date: string
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustments?: Json | null
          amount?: number
          claim_id?: string | null
          created_at?: string
          id?: string
          method?: string | null
          payer?: string
          payment_date?: string
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invites: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invite_token: string | null
          invited_by: string
          invited_by_email: string | null
          role: string
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_token?: string | null
          invited_by: string
          invited_by_email?: string | null
          role?: string
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_token?: string | null
          invited_by?: string
          invited_by_email?: string | null
          role?: string
          status?: string | null
        }
        Relationships: []
      }
      predicted_charges: {
        Row: {
          audit_id: string
          confidence_level: string | null
          confidence_score: number | null
          cpt_code: string
          cpt_description: string | null
          created_at: string | null
          documentation_elements: Json | null
          estimated_value: number | null
          icd_codes: string[] | null
          id: string
          match_status: string | null
          matched_actual_id: string | null
          modifiers: string[] | null
          reasoning: string | null
          supporting_text: string | null
          units: number | null
        }
        Insert: {
          audit_id: string
          confidence_level?: string | null
          confidence_score?: number | null
          cpt_code: string
          cpt_description?: string | null
          created_at?: string | null
          documentation_elements?: Json | null
          estimated_value?: number | null
          icd_codes?: string[] | null
          id?: string
          match_status?: string | null
          matched_actual_id?: string | null
          modifiers?: string[] | null
          reasoning?: string | null
          supporting_text?: string | null
          units?: number | null
        }
        Update: {
          audit_id?: string
          confidence_level?: string | null
          confidence_score?: number | null
          cpt_code?: string
          cpt_description?: string | null
          created_at?: string | null
          documentation_elements?: Json | null
          estimated_value?: number | null
          icd_codes?: string[] | null
          id?: string
          match_status?: string | null
          matched_actual_id?: string | null
          modifiers?: string[] | null
          reasoning?: string | null
          supporting_text?: string | null
          units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "predicted_charges_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "charge_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          code: string | null
          code_display: string | null
          created_at: string | null
          external_id: string
          id: string
          last_synced_at: string | null
          outcome: string | null
          patient_external_id: string | null
          patient_id: string | null
          performed_date: string | null
          raw_fhir_data: Json | null
          source: string | null
          source_connection_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          code?: string | null
          code_display?: string | null
          created_at?: string | null
          external_id: string
          id?: string
          last_synced_at?: string | null
          outcome?: string | null
          patient_external_id?: string | null
          patient_id?: string | null
          performed_date?: string | null
          raw_fhir_data?: Json | null
          source?: string | null
          source_connection_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          code?: string | null
          code_display?: string | null
          created_at?: string | null
          external_id?: string
          id?: string
          last_synced_at?: string | null
          outcome?: string | null
          patient_external_id?: string | null
          patient_id?: string | null
          performed_date?: string | null
          raw_fhir_data?: Json | null
          source?: string | null
          source_connection_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_source_connection_id_fkey"
            columns: ["source_connection_id"]
            isOneToOne: false
            referencedRelation: "api_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      remittance_claims: {
        Row: {
          claim_filing_indicator: string | null
          claim_frequency_code: string | null
          claim_status_code: string | null
          claim_status_description: string | null
          claim_submitter_id: string
          coverage_amount: number | null
          coverage_expiration_date: string | null
          created_at: string | null
          discount_amount: number | null
          facility_type_code: string | null
          id: string
          interest_amount: number | null
          internal_claim_id: string | null
          patient_id: string | null
          patient_id_qualifier: string | null
          patient_name_first: string | null
          patient_name_last: string | null
          patient_name_middle: string | null
          patient_responsibility: number | null
          payer_claim_control_number: string | null
          received_date: string | null
          remittance_id: string
          rendering_provider_name: string | null
          rendering_provider_npi: string | null
          service_date_end: string | null
          service_date_start: string | null
          subscriber_id: string | null
          subscriber_name_first: string | null
          subscriber_name_last: string | null
          total_charge: number | null
          total_paid: number | null
          user_id: string
        }
        Insert: {
          claim_filing_indicator?: string | null
          claim_frequency_code?: string | null
          claim_status_code?: string | null
          claim_status_description?: string | null
          claim_submitter_id: string
          coverage_amount?: number | null
          coverage_expiration_date?: string | null
          created_at?: string | null
          discount_amount?: number | null
          facility_type_code?: string | null
          id?: string
          interest_amount?: number | null
          internal_claim_id?: string | null
          patient_id?: string | null
          patient_id_qualifier?: string | null
          patient_name_first?: string | null
          patient_name_last?: string | null
          patient_name_middle?: string | null
          patient_responsibility?: number | null
          payer_claim_control_number?: string | null
          received_date?: string | null
          remittance_id: string
          rendering_provider_name?: string | null
          rendering_provider_npi?: string | null
          service_date_end?: string | null
          service_date_start?: string | null
          subscriber_id?: string | null
          subscriber_name_first?: string | null
          subscriber_name_last?: string | null
          total_charge?: number | null
          total_paid?: number | null
          user_id: string
        }
        Update: {
          claim_filing_indicator?: string | null
          claim_frequency_code?: string | null
          claim_status_code?: string | null
          claim_status_description?: string | null
          claim_submitter_id?: string
          coverage_amount?: number | null
          coverage_expiration_date?: string | null
          created_at?: string | null
          discount_amount?: number | null
          facility_type_code?: string | null
          id?: string
          interest_amount?: number | null
          internal_claim_id?: string | null
          patient_id?: string | null
          patient_id_qualifier?: string | null
          patient_name_first?: string | null
          patient_name_last?: string | null
          patient_name_middle?: string | null
          patient_responsibility?: number | null
          payer_claim_control_number?: string | null
          received_date?: string | null
          remittance_id?: string
          rendering_provider_name?: string | null
          rendering_provider_npi?: string | null
          service_date_end?: string | null
          service_date_start?: string | null
          subscriber_id?: string | null
          subscriber_name_first?: string | null
          subscriber_name_last?: string | null
          total_charge?: number | null
          total_paid?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittance_claims_internal_claim_id_fkey"
            columns: ["internal_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_claims_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "remittances"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_service_lines: {
        Row: {
          charge_amount: number | null
          created_at: string | null
          healthcare_policy_id: string | null
          id: string
          line_item_control_number: string | null
          line_number: number | null
          original_procedure_code: string | null
          paid_amount: number | null
          procedure_code: string | null
          procedure_code_qualifier: string | null
          procedure_modifiers: string[] | null
          remark_codes: string[] | null
          remittance_claim_id: string
          rendering_provider_id: string | null
          revenue_code: string | null
          service_date_end: string | null
          service_date_start: string | null
          units_billed: number | null
          units_paid: number | null
        }
        Insert: {
          charge_amount?: number | null
          created_at?: string | null
          healthcare_policy_id?: string | null
          id?: string
          line_item_control_number?: string | null
          line_number?: number | null
          original_procedure_code?: string | null
          paid_amount?: number | null
          procedure_code?: string | null
          procedure_code_qualifier?: string | null
          procedure_modifiers?: string[] | null
          remark_codes?: string[] | null
          remittance_claim_id: string
          rendering_provider_id?: string | null
          revenue_code?: string | null
          service_date_end?: string | null
          service_date_start?: string | null
          units_billed?: number | null
          units_paid?: number | null
        }
        Update: {
          charge_amount?: number | null
          created_at?: string | null
          healthcare_policy_id?: string | null
          id?: string
          line_item_control_number?: string | null
          line_number?: number | null
          original_procedure_code?: string | null
          paid_amount?: number | null
          procedure_code?: string | null
          procedure_code_qualifier?: string | null
          procedure_modifiers?: string[] | null
          remark_codes?: string[] | null
          remittance_claim_id?: string
          rendering_provider_id?: string | null
          revenue_code?: string | null
          service_date_end?: string | null
          service_date_start?: string | null
          units_billed?: number | null
          units_paid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "remittance_service_lines_remittance_claim_id_fkey"
            columns: ["remittance_claim_id"]
            isOneToOne: false
            referencedRelation: "remittance_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      remittances: {
        Row: {
          check_date: string | null
          check_number: string | null
          created_at: string | null
          credit_debit_flag: string | null
          edi_file_id: string | null
          eft_trace_number: string | null
          id: string
          originating_company_id: string | null
          payee_address_line1: string | null
          payee_address_line2: string | null
          payee_city: string | null
          payee_id_qualifier: string | null
          payee_name: string | null
          payee_npi: string | null
          payee_state: string | null
          payee_tax_id: string | null
          payee_zip: string | null
          payer_address_line1: string | null
          payer_address_line2: string | null
          payer_city: string | null
          payer_contact_name: string | null
          payer_contact_phone: string | null
          payer_id: string | null
          payer_id_qualifier: string | null
          payer_name: string | null
          payer_state: string | null
          payer_zip: string | null
          payment_amount: number | null
          payment_format: string | null
          payment_method: string | null
          receiver_account_number: string | null
          receiver_dfi_number: string | null
          sender_account_number: string | null
          sender_dfi_number: string | null
          total_adjustments: number | null
          total_charged: number | null
          total_claims: number | null
          total_paid: number | null
          total_patient_responsibility: number | null
          trace_number: string | null
          trace_type: string | null
          transaction_handling_code: string | null
          user_id: string
        }
        Insert: {
          check_date?: string | null
          check_number?: string | null
          created_at?: string | null
          credit_debit_flag?: string | null
          edi_file_id?: string | null
          eft_trace_number?: string | null
          id?: string
          originating_company_id?: string | null
          payee_address_line1?: string | null
          payee_address_line2?: string | null
          payee_city?: string | null
          payee_id_qualifier?: string | null
          payee_name?: string | null
          payee_npi?: string | null
          payee_state?: string | null
          payee_tax_id?: string | null
          payee_zip?: string | null
          payer_address_line1?: string | null
          payer_address_line2?: string | null
          payer_city?: string | null
          payer_contact_name?: string | null
          payer_contact_phone?: string | null
          payer_id?: string | null
          payer_id_qualifier?: string | null
          payer_name?: string | null
          payer_state?: string | null
          payer_zip?: string | null
          payment_amount?: number | null
          payment_format?: string | null
          payment_method?: string | null
          receiver_account_number?: string | null
          receiver_dfi_number?: string | null
          sender_account_number?: string | null
          sender_dfi_number?: string | null
          total_adjustments?: number | null
          total_charged?: number | null
          total_claims?: number | null
          total_paid?: number | null
          total_patient_responsibility?: number | null
          trace_number?: string | null
          trace_type?: string | null
          transaction_handling_code?: string | null
          user_id: string
        }
        Update: {
          check_date?: string | null
          check_number?: string | null
          created_at?: string | null
          credit_debit_flag?: string | null
          edi_file_id?: string | null
          eft_trace_number?: string | null
          id?: string
          originating_company_id?: string | null
          payee_address_line1?: string | null
          payee_address_line2?: string | null
          payee_city?: string | null
          payee_id_qualifier?: string | null
          payee_name?: string | null
          payee_npi?: string | null
          payee_state?: string | null
          payee_tax_id?: string | null
          payee_zip?: string | null
          payer_address_line1?: string | null
          payer_address_line2?: string | null
          payer_city?: string | null
          payer_contact_name?: string | null
          payer_contact_phone?: string | null
          payer_id?: string | null
          payer_id_qualifier?: string | null
          payer_name?: string | null
          payer_state?: string | null
          payer_zip?: string | null
          payment_amount?: number | null
          payment_format?: string | null
          payment_method?: string | null
          receiver_account_number?: string | null
          receiver_dfi_number?: string | null
          sender_account_number?: string | null
          sender_dfi_number?: string | null
          total_adjustments?: number | null
          total_charged?: number | null
          total_claims?: number | null
          total_paid?: number | null
          total_patient_responsibility?: number | null
          trace_number?: string | null
          trace_type?: string | null
          transaction_handling_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittances_edi_file_id_fkey"
            columns: ["edi_file_id"]
            isOneToOne: false
            referencedRelation: "edi_files"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_action_logs: {
        Row: {
          action_params: Json | null
          action_result: string | null
          action_type: string
          created_at: string | null
          execution_id: string
          id: string
          message: string | null
          result_data: Json | null
        }
        Insert: {
          action_params?: Json | null
          action_result?: string | null
          action_type: string
          created_at?: string | null
          execution_id: string
          id?: string
          message?: string | null
          result_data?: Json | null
        }
        Update: {
          action_params?: Json | null
          action_result?: string | null
          action_type?: string
          created_at?: string | null
          execution_id?: string
          id?: string
          message?: string | null
          result_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rule_action_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "rule_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_executions: {
        Row: {
          actions_executed: Json | null
          batch_id: string | null
          conditions_evaluated: Json | null
          error_message: string | null
          error_stack: string | null
          executed_at: string | null
          execution_duration_ms: number | null
          execution_result: string | null
          id: string
          input_data: Json | null
          result_message: string | null
          rule_id: string
          target_id: string | null
          target_type: string
          trigger_event: string | null
          user_id: string
        }
        Insert: {
          actions_executed?: Json | null
          batch_id?: string | null
          conditions_evaluated?: Json | null
          error_message?: string | null
          error_stack?: string | null
          executed_at?: string | null
          execution_duration_ms?: number | null
          execution_result?: string | null
          id?: string
          input_data?: Json | null
          result_message?: string | null
          rule_id: string
          target_id?: string | null
          target_type: string
          trigger_event?: string | null
          user_id: string
        }
        Update: {
          actions_executed?: Json | null
          batch_id?: string | null
          conditions_evaluated?: Json | null
          error_message?: string | null
          error_stack?: string | null
          executed_at?: string | null
          execution_duration_ms?: number | null
          execution_result?: string | null
          id?: string
          input_data?: Json | null
          result_message?: string | null
          rule_id?: string
          target_id?: string | null
          target_type?: string
          trigger_event?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
        ]
      }
      rules: {
        Row: {
          actions: Json
          applies_to: string[] | null
          category: string | null
          conditions: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          last_modified_by: string | null
          payer_ids: string[] | null
          place_of_service: string[] | null
          priority: number | null
          provider_npis: string[] | null
          rule_code: string | null
          rule_name: string
          rule_type: string
          stop_on_match: boolean | null
          tags: string[] | null
          trigger_event: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          actions?: Json
          applies_to?: string[] | null
          category?: string | null
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          last_modified_by?: string | null
          payer_ids?: string[] | null
          place_of_service?: string[] | null
          priority?: number | null
          provider_npis?: string[] | null
          rule_code?: string | null
          rule_name: string
          rule_type: string
          stop_on_match?: boolean | null
          tags?: string[] | null
          trigger_event?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          actions?: Json
          applies_to?: string[] | null
          category?: string | null
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          last_modified_by?: string | null
          payer_ids?: string[] | null
          place_of_service?: string[] | null
          priority?: number | null
          provider_npis?: string[] | null
          rule_code?: string | null
          rule_name?: string
          rule_type?: string
          stop_on_match?: boolean | null
          tags?: string[] | null
          trigger_event?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          authored_on: string | null
          category: string | null
          code: string | null
          code_display: string | null
          created_at: string | null
          external_id: string
          id: string
          last_synced_at: string | null
          patient_external_id: string | null
          patient_id: string | null
          priority: string | null
          raw_fhir_data: Json | null
          source: string | null
          source_connection_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          authored_on?: string | null
          category?: string | null
          code?: string | null
          code_display?: string | null
          created_at?: string | null
          external_id: string
          id?: string
          last_synced_at?: string | null
          patient_external_id?: string | null
          patient_id?: string | null
          priority?: string | null
          raw_fhir_data?: Json | null
          source?: string | null
          source_connection_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          authored_on?: string | null
          category?: string | null
          code?: string | null
          code_display?: string | null
          created_at?: string | null
          external_id?: string
          id?: string
          last_synced_at?: string | null
          patient_external_id?: string | null
          patient_id?: string | null
          priority?: string | null
          raw_fhir_data?: Json | null
          source?: string | null
          source_connection_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_source_connection_id_fkey"
            columns: ["source_connection_id"]
            isOneToOne: false
            referencedRelation: "api_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_date_range: string
          id: string
          notify_email: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_date_range?: string
          id?: string
          notify_email?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_date_range?: string
          id?: string
          notify_email?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cpt_denial_patterns: {
        Row: {
          cpt_code: string | null
          denial_rate: number | null
          denied_count: number | null
          highest_denial_payer: string | null
          most_common_denial_reason: string | null
          total_claims: number | null
        }
        Relationships: []
      }
      payer_denial_patterns: {
        Row: {
          avg_predicted_risk: number | null
          denial_rate: number | null
          denied_count: number | null
          most_common_denial_reason: string | null
          paid_count: number | null
          partial_count: number | null
          payer: string | null
          prediction_accuracy: number | null
          total_claims: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_invite_role: { Args: { check_email: string }; Returns: string }
      get_user_role: { Args: never; Returns: string }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_email_invited: { Args: { check_email: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      link_procedures_to_patients: { Args: never; Returns: undefined }
      link_service_requests_to_patients: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
