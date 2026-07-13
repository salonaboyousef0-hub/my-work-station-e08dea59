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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string
          title: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string
          title?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          check_in: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_source: string | null
          check_out: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_source: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          qr_token_id: string | null
          work_date: string
        }
        Insert: {
          check_in?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_source?: string | null
          check_out?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_source?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          qr_token_id?: string | null
          work_date?: string
        }
        Update: {
          check_in?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_source?: string | null
          check_out?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_source?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          qr_token_id?: string | null
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_qr_token_id_fkey"
            columns: ["qr_token_id"]
            isOneToOne: false
            referencedRelation: "attendance_qr_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_qr_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          employee_id: string
          ends_at: string | null
          external_booking_id: string | null
          id: string
          notes: string | null
          price: number | null
          service_id: string | null
          service_name: string | null
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          employee_id: string
          ends_at?: string | null
          external_booking_id?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          service_id?: string | null
          service_name?: string | null
          source?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          employee_id?: string
          ends_at?: string | null
          external_booking_id?: string | null
          id?: string
          notes?: string | null
          price?: number | null
          service_id?: string | null
          service_name?: string | null
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_assets: {
        Row: {
          asset_name: string
          condition: string
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          received_date: string
          returned_date: string | null
          serial_number: string | null
        }
        Insert: {
          asset_name: string
          condition?: string
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          received_date?: string
          returned_date?: string | null
          serial_number?: string | null
        }
        Update: {
          asset_name?: string
          condition?: string
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          received_date?: string
          returned_date?: string | null
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_assets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          cashier_employee_id: string | null
          cashier_name: string | null
          created_at: string
          employee_code: string
          full_name: string
          hire_date: string | null
          id: string
          is_active: boolean
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          cashier_employee_id?: string | null
          cashier_name?: string | null
          created_at?: string
          employee_code?: string
          full_name?: string
          hire_date?: string | null
          id: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          cashier_employee_id?: string | null
          cashier_name?: string | null
          created_at?: string
          employee_code?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      employee_requests: {
        Row: {
          admin_notes: string | null
          amount: number | null
          created_at: string
          description: string | null
          employee_id: string
          id: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          type: Database["public"]["Enums"]["request_type"]
        }
        Insert: {
          admin_notes?: string | null
          amount?: number | null
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          type: Database["public"]["Enums"]["request_type"]
        }
        Update: {
          admin_notes?: string | null
          amount?: number | null
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          type?: Database["public"]["Enums"]["request_type"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_services: {
        Row: {
          admin_notes: string | null
          client_count: number
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          reviewed_at: string | null
          service_date: string
          service_name: string
          service_value: number
          status: Database["public"]["Enums"]["request_status"]
          submitted_by_employee: boolean
        }
        Insert: {
          admin_notes?: string | null
          client_count?: number
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          service_date?: string
          service_name: string
          service_value?: number
          status?: Database["public"]["Enums"]["request_status"]
          submitted_by_employee?: boolean
        }
        Update: {
          admin_notes?: string | null
          client_count?: number
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          service_date?: string
          service_name?: string
          service_value?: number
          status?: Database["public"]["Enums"]["request_status"]
          submitted_by_employee?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_services_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_transactions: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "employee_transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          attitude: number
          commitment: number
          created_at: string
          customer_satisfaction: number
          employee_id: string
          evaluator_id: string | null
          hygiene: number
          id: string
          notes: string | null
          period_month: string
          quality: number
        }
        Insert: {
          attitude: number
          commitment: number
          created_at?: string
          customer_satisfaction: number
          employee_id: string
          evaluator_id?: string | null
          hygiene: number
          id?: string
          notes?: string | null
          period_month: string
          quality: number
        }
        Update: {
          attitude?: number
          commitment?: number
          created_at?: string
          customer_satisfaction?: number
          employee_id?: string
          evaluator_id?: string | null
          hygiene?: number
          id?: string
          notes?: string | null
          period_month?: string
          quality?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      general_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          employee_id: string
          id: string
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          title: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          employee_id: string
          id?: string
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          employee_id?: string
          id?: string
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "general_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          bonus_amount: number
          created_at: string
          description: string | null
          employee_id: string
          id: string
          period_month: string
          target_services: number
          target_value: number
        }
        Insert: {
          bonus_amount?: number
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          period_month: string
          target_services?: number
          target_value?: number
        }
        Update: {
          bonus_amount?: number
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          period_month?: string
          target_services?: number
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          cashier_publishable_key: string | null
          cashier_url: string | null
          created_at: string
          enabled: boolean
          id: string
          stats_function_path: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cashier_publishable_key?: string | null
          cashier_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          stats_function_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cashier_publishable_key?: string | null
          cashier_url?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          stats_function_path?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          employee_id: string
          id: string
          is_read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          employee_id: string
          id?: string
          is_read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          is_read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string | null
          id: string
          is_day_off: boolean
          notes: string | null
          shift_date: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          notes?: string | null
          shift_date: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          notes?: string | null
          shift_date?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_materials: {
        Row: {
          content: string | null
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          media_type: string
          media_url: string | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          media_type?: string
          media_url?: string | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          media_type?: string
          media_url?: string | null
          title?: string
        }
        Relationships: []
      }
      training_progress: {
        Row: {
          completed_at: string
          employee_id: string
          id: string
          material_id: string
        }
        Insert: {
          completed_at?: string
          employee_id: string
          id?: string
          material_id: string
        }
        Update: {
          completed_at?: string
          employee_id?: string
          id?: string
          material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employee_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "training_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      recalculate_employee_balance: {
        Args: { p_employee_id: string }
        Returns: undefined
      }
      validate_qr_token: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      leave_type: "vacation" | "sick" | "personal" | "other"
      notification_type: "request" | "transaction" | "announcement" | "system"
      request_status: "pending" | "approved" | "rejected"
      request_type: "advance" | "leave" | "other"
      transaction_type: "earning" | "advance" | "deduction" | "payment"
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
      app_role: ["admin", "manager", "employee"],
      leave_type: ["vacation", "sick", "personal", "other"],
      notification_type: ["request", "transaction", "announcement", "system"],
      request_status: ["pending", "approved", "rejected"],
      request_type: ["advance", "leave", "other"],
      transaction_type: ["earning", "advance", "deduction", "payment"],
    },
  },
} as const
