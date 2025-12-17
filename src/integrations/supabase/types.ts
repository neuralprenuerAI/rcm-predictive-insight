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
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      appeals: {
        Row: {
          claim_id: string | null
          content: string | null
          created_at: string
          denial_id: string | null
          id: string
          notes: string | null
          outcome: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_id?: string | null
          content?: string | null
          created_at?: string
          denial_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_id?: string | null
          content?: string | null
          created_at?: string
          denial_id?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "appeals_denial_id_fkey"
            columns: ["denial_id"]
            isOneToOne: false
            referencedRelation: "denials"
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
          phone: string | null
          postal_code: string | null
          raw_fhir_data: Json | null
          source: string
          source_connection_id: string | null
          state: string | null
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
          phone?: string | null
          postal_code?: string | null
          raw_fhir_data?: Json | null
          source?: string
          source_connection_id?: string | null
          state?: string | null
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
          phone?: string | null
          postal_code?: string | null
          raw_fhir_data?: Json | null
          source?: string
          source_connection_id?: string | null
          state?: string | null
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
      [_ in never]: never
    }
    Functions: {
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
