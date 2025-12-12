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
      claims: {
        Row: {
          ai_analysis: Json | null
          billed_amount: number | null
          claim_file_url: string | null
          claim_id: string
          created_at: string | null
          date_of_service: string
          deniability_probability: number | null
          diagnosis_code: string | null
          fhir_id: string | null
          id: string
          notes_file_url: string | null
          patient_name: string
          payer: string | null
          procedure_code: string | null
          provider: string
          risk_category: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          billed_amount?: number | null
          claim_file_url?: string | null
          claim_id: string
          created_at?: string | null
          date_of_service: string
          deniability_probability?: number | null
          diagnosis_code?: string | null
          fhir_id?: string | null
          id?: string
          notes_file_url?: string | null
          patient_name: string
          payer?: string | null
          procedure_code?: string | null
          provider: string
          risk_category?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          billed_amount?: number | null
          claim_file_url?: string | null
          claim_id?: string
          created_at?: string | null
          date_of_service?: string
          deniability_probability?: number | null
          diagnosis_code?: string | null
          fhir_id?: string | null
          id?: string
          notes_file_url?: string | null
          patient_name?: string
          payer?: string | null
          procedure_code?: string | null
          provider?: string
          risk_category?: string | null
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
