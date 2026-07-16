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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string
          batch_id: string
          created_at: string
          device_id: string | null
          id: string
          marked_at: string
          marked_by: string | null
          method: string
          notes: string | null
          status: string
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance_date?: string
          batch_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          marked_at?: string
          marked_by?: string | null
          method?: string
          notes?: string | null
          status?: string
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance_date?: string
          batch_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          marked_at?: string
          marked_by?: string | null
          method?: string
          notes?: string | null
          status?: string
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          custom_fields: Json
          description: string | null
          fee: number
          id: string
          name: string
          public_token: string
          required_fields: string[]
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json
          description?: string | null
          fee?: number
          id?: string
          name: string
          public_token?: string
          required_fields?: string[]
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json
          description?: string | null
          fee?: number
          id?: string
          name?: string
          public_token?: string
          required_fields?: string[]
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      biometric_devices: {
        Row: {
          api_key: string | null
          auto_sync: boolean
          auto_sync_interval_minutes: number
          connection_type: string
          created_at: string
          device_identifier: string | null
          device_name: string
          id: string
          ip_address: string | null
          is_active: boolean
          last_connected_at: string | null
          last_status: string
          last_status_message: string | null
          last_synced_at: string | null
          password: string | null
          port: number | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          api_key?: string | null
          auto_sync?: boolean
          auto_sync_interval_minutes?: number
          connection_type?: string
          created_at?: string
          device_identifier?: string | null
          device_name: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_connected_at?: string | null
          last_status?: string
          last_status_message?: string | null
          last_synced_at?: string | null
          password?: string | null
          port?: number | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          api_key?: string | null
          auto_sync?: boolean
          auto_sync_interval_minutes?: number
          connection_type?: string
          created_at?: string
          device_identifier?: string | null
          device_name?: string
          id?: string
          ip_address?: string | null
          is_active?: boolean
          last_connected_at?: string | null
          last_status?: string
          last_status_message?: string | null
          last_synced_at?: string | null
          password?: string | null
          port?: number | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      chatbot_chat_history: {
        Row: {
          answer: string
          created_at: string
          id: string
          matched_kb_id: string | null
          owner_id: string
          phone: string | null
          question: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          matched_kb_id?: string | null
          owner_id: string
          phone?: string | null
          question: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          matched_kb_id?: string | null
          owner_id?: string
          phone?: string | null
          question?: string
        }
        Relationships: []
      }
      chatbot_knowledge: {
        Row: {
          alternate_questions: string[]
          answer: string
          category: string | null
          created_at: string
          id: string
          keywords: string[]
          owner_id: string
          question: string
          status: string
          updated_at: string
        }
        Insert: {
          alternate_questions?: string[]
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          owner_id: string
          question: string
          status?: string
          updated_at?: string
        }
        Update: {
          alternate_questions?: string[]
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          keywords?: string[]
          owner_id?: string
          question?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chatbot_pending_questions: {
        Row: {
          created_at: string
          id: string
          knowledge_id: string | null
          owner_id: string
          phone: string | null
          question: string
          resolved: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          knowledge_id?: string | null
          owner_id: string
          phone?: string | null
          question: string
          resolved?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          knowledge_id?: string | null
          owner_id?: string
          phone?: string | null
          question?: string
          resolved?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_pending_questions_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "chatbot_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          location_id: string | null
          receipt_url: string | null
          tax_deductible: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          location_id?: string | null
          receipt_url?: string | null
          tax_deductible?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          location_id?: string | null
          receipt_url?: string | null
          tax_deductible?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          expiry_action: string
          id: string
          is_public: boolean
          media_type: string
          storage_path: string
          thumbnail_path: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          expiry_action?: string
          id?: string
          is_public?: boolean
          media_type: string
          storage_path: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          expiry_action?: string
          id?: string
          is_public?: boolean
          media_type?: string
          storage_path?: string
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instructors: {
        Row: {
          compensation_type: string
          compensation_value: number
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          compensation_type?: string
          compensation_value?: number
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          compensation_type?: string
          compensation_value?: number
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_classes: {
        Row: {
          auto_convert_to_recording: boolean
          converted_at: string | null
          converted_recording_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_public: boolean
          meeting_url: string
          platform: string | null
          recording_hide_after_days: number | null
          recording_publish_delay_minutes: number | null
          recording_visibility: string
          scheduled_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_convert_to_recording?: boolean
          converted_at?: string | null
          converted_recording_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_public?: boolean
          meeting_url: string
          platform?: string | null
          recording_hide_after_days?: number | null
          recording_publish_delay_minutes?: number | null
          recording_visibility?: string
          scheduled_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_convert_to_recording?: boolean
          converted_at?: string | null
          converted_recording_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_public?: boolean
          meeting_url?: string
          platform?: string | null
          recording_hide_after_days?: number | null
          recording_publish_delay_minutes?: number | null
          recording_visibility?: string
          scheduled_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          device: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          owner_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          device?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          device?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          owner_id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recordings: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          expires_at: string | null
          external_url: string | null
          id: string
          is_public: boolean
          public_slug: string | null
          publish_at: string | null
          recorded_on: string | null
          source_live_class_id: string | null
          storage_path: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          external_url?: string | null
          id?: string
          is_public?: boolean
          public_slug?: string | null
          publish_at?: string | null
          recorded_on?: string | null
          source_live_class_id?: string | null
          storage_path?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          expires_at?: string | null
          external_url?: string | null
          id?: string
          is_public?: boolean
          public_slug?: string | null
          publish_at?: string | null
          recorded_on?: string | null
          source_live_class_id?: string | null
          storage_path?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordings_source_live_class_id_fkey"
            columns: ["source_live_class_id"]
            isOneToOne: false
            referencedRelation: "live_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          email: string | null
          id: string
          studio_name: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          email?: string | null
          id: string
          studio_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          studio_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      staff_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          owner_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          owner_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      staff_permissions: {
        Row: {
          can_classes: boolean
          can_customers: boolean
          can_gallery: boolean
          can_payments: boolean
          can_renewals: boolean
          created_at: string
          is_active: boolean
          owner_id: string
          staff_user_id: string
          updated_at: string
        }
        Insert: {
          can_classes?: boolean
          can_customers?: boolean
          can_gallery?: boolean
          can_payments?: boolean
          can_renewals?: boolean
          created_at?: string
          is_active?: boolean
          owner_id: string
          staff_user_id: string
          updated_at?: string
        }
        Update: {
          can_classes?: boolean
          can_customers?: boolean
          can_gallery?: boolean
          can_payments?: boolean
          can_renewals?: boolean
          created_at?: string
          is_active?: boolean
          owner_id?: string
          staff_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_payments: {
        Row: {
          amount: number
          created_at: string
          duration_months: number | null
          duration_unit: string | null
          duration_value: number | null
          id: string
          method: string
          notes: string | null
          paid_on: string
          plan: string | null
          reminder_sent_at: string | null
          student_id: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          duration_months?: number | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          method?: string
          notes?: string | null
          paid_on?: string
          plan?: string | null
          reminder_sent_at?: string | null
          student_id: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          duration_months?: number | null
          duration_unit?: string | null
          duration_value?: number | null
          id?: string
          method?: string
          notes?: string | null
          paid_on?: string
          plan?: string | null
          reminder_sent_at?: string | null
          student_id?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          batch_id: string | null
          created_at: string
          custom_data: Json
          email: string | null
          height_cm: number | null
          id: string
          membership_status: string | null
          membership_type: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          address?: string | null
          batch_id?: string | null
          created_at?: string
          custom_data?: Json
          email?: string | null
          height_cm?: number | null
          id?: string
          membership_status?: string | null
          membership_type?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          address?: string | null
          batch_id?: string | null
          created_at?: string
          custom_data?: Json
          email?: string | null
          height_cm?: number | null
          id?: string
          membership_status?: string | null
          membership_type?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "students_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_security: {
        Row: {
          app_lock_pin_hash: string | null
          created_at: string
          owner_id: string
          payments_pin_hash: string | null
          updated_at: string
          webauthn_credential_id: string | null
          webauthn_enabled: boolean
        }
        Insert: {
          app_lock_pin_hash?: string | null
          created_at?: string
          owner_id: string
          payments_pin_hash?: string | null
          updated_at?: string
          webauthn_credential_id?: string | null
          webauthn_enabled?: boolean
        }
        Update: {
          app_lock_pin_hash?: string | null
          created_at?: string
          owner_id?: string
          payments_pin_hash?: string | null
          updated_at?: string
          webauthn_credential_id?: string | null
          webauthn_enabled?: boolean
        }
        Relationships: []
      }
      studio_settings: {
        Row: {
          background_url: string | null
          logo_url: string | null
          owner_id: string
          studio_name: string
          updated_at: string
        }
        Insert: {
          background_url?: string | null
          logo_url?: string | null
          owner_id: string
          studio_name?: string
          updated_at?: string
        }
        Update: {
          background_url?: string | null
          logo_url?: string | null
          owner_id?: string
          studio_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_gallery: {
        Args: { _owner: string }
        Returns: {
          deleted_paths: string[]
        }[]
      }
      get_batch_by_token: {
        Args: { _token: string }
        Returns: {
          custom_fields: Json
          description: string
          fee: number
          id: string
          name: string
          required_fields: string[]
          start_date: string
        }[]
      }
      get_email_by_phone: { Args: { _phone: string }; Returns: string }
      get_owner_id: { Args: { _user_id: string }; Returns: string }
      get_public_gallery: {
        Args: { _owner: string }
        Returns: {
          created_at: string
          description: string
          id: string
          media_type: string
          storage_path: string
          thumbnail_path: string
          title: string
        }[]
      }
      get_public_live_classes: {
        Args: { _owner: string }
        Returns: {
          description: string
          duration_minutes: number
          id: string
          meeting_url: string
          platform: string
          scheduled_at: string
          title: string
        }[]
      }
      get_public_recordings: {
        Args: { _owner: string }
        Returns: {
          created_at: string
          description: string
          duration_minutes: number
          external_url: string
          id: string
          public_slug: string
          recorded_on: string
          storage_path: string
          title: string
        }[]
      }
      get_recording_by_slug: {
        Args: { _slug: string }
        Returns: {
          created_at: string
          description: string
          duration_minutes: number
          external_url: string
          id: string
          recorded_on: string
          storage_path: string
          title: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_live_class_lifecycle: {
        Args: never
        Returns: {
          archived: number
          converted: number
        }[]
      }
      register_student_via_token:
        | {
            Args: {
              _address: string
              _email: string
              _name: string
              _notes: string
              _phone: string
              _token: string
            }
            Returns: string
          }
        | {
            Args: {
              _address: string
              _email: string
              _height_cm?: number
              _name: string
              _notes: string
              _phone: string
              _token: string
              _weight_kg?: number
            }
            Returns: string
          }
        | {
            Args: {
              _address: string
              _custom_data?: Json
              _email: string
              _height_cm?: number
              _name: string
              _notes: string
              _phone: string
              _token: string
              _weight_kg?: number
            }
            Returns: string
          }
      staff_has_permission: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "staff"
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
    Enums: {
      app_role: ["owner", "staff"],
    },
  },
} as const
