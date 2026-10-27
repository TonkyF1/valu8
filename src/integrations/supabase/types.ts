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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      advert_checks: {
        Row: {
          asking_price: number
          confidence: string | null
          created_at: string
          engine_version: string | null
          estimate_dealer_high: number | null
          estimate_dealer_low: number | null
          estimate_dealer_mid: number | null
          estimate_private: number | null
          followup_answered_at: string | null
          followup_next_at: string | null
          followup_sent_at: string | null
          followup_snoozes: number
          guest_token_hash: string | null
          id: string
          last_rechecked_at: string | null
          last_seen_price: number | null
          link_domain: string | null
          link_fetchable: boolean
          link_url: string | null
          listing_status: string
          make: string
          mileage: number
          model: string
          pricing_source: string | null
          recheck_count: number
          seller_type: string
          user_id: string | null
          variant: string | null
          verdict: string | null
          year: number
        }
        Insert: {
          asking_price: number
          confidence?: string | null
          created_at?: string
          engine_version?: string | null
          estimate_dealer_high?: number | null
          estimate_dealer_low?: number | null
          estimate_dealer_mid?: number | null
          estimate_private?: number | null
          followup_answered_at?: string | null
          followup_next_at?: string | null
          followup_sent_at?: string | null
          followup_snoozes?: number
          guest_token_hash?: string | null
          id?: string
          last_rechecked_at?: string | null
          last_seen_price?: number | null
          link_domain?: string | null
          link_fetchable?: boolean
          link_url?: string | null
          listing_status?: string
          make: string
          mileage: number
          model: string
          pricing_source?: string | null
          recheck_count?: number
          seller_type?: string
          user_id?: string | null
          variant?: string | null
          verdict?: string | null
          year: number
        }
        Update: {
          asking_price?: number
          confidence?: string | null
          created_at?: string
          engine_version?: string | null
          estimate_dealer_high?: number | null
          estimate_dealer_low?: number | null
          estimate_dealer_mid?: number | null
          estimate_private?: number | null
          followup_answered_at?: string | null
          followup_next_at?: string | null
          followup_sent_at?: string | null
          followup_snoozes?: number
          guest_token_hash?: string | null
          id?: string
          last_rechecked_at?: string | null
          last_seen_price?: number | null
          link_domain?: string | null
          link_fetchable?: boolean
          link_url?: string | null
          listing_status?: string
          make?: string
          mileage?: number
          model?: string
          pricing_source?: string | null
          recheck_count?: number
          seller_type?: string
          user_id?: string | null
          variant?: string | null
          verdict?: string | null
          year?: number
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          current_period_end: string | null
          price_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          price_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          price_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      check_outcomes: {
        Row: {
          id: string
          item_id: string
          kind: string
          outcome_date: string | null
          outcome_price: number | null
          outcome_type: string
          recorded_at: string
          seller_type: string | null
          source: string
        }
        Insert: {
          id?: string
          item_id: string
          kind: string
          outcome_date?: string | null
          outcome_price?: number | null
          outcome_type: string
          recorded_at?: string
          seller_type?: string | null
          source: string
        }
        Update: {
          id?: string
          item_id?: string
          kind?: string
          outcome_date?: string | null
          outcome_price?: number | null
          outcome_type?: string
          recorded_at?: string
          seller_type?: string | null
          source?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          created_at: string
          flags: Json
          fuel: string | null
          gearbox: string | null
          id: string
          last_seen: string
          listed_on: string
          location: string | null
          make: string
          mileage: number
          model: string
          price: number
          seller: string | null
          source: string
          source_url: string | null
          variant: string | null
          year: number
        }
        Insert: {
          created_at?: string
          flags?: Json
          fuel?: string | null
          gearbox?: string | null
          id: string
          last_seen?: string
          listed_on?: string
          location?: string | null
          make: string
          mileage: number
          model: string
          price: number
          seller?: string | null
          source: string
          source_url?: string | null
          variant?: string | null
          year: number
        }
        Update: {
          created_at?: string
          flags?: Json
          fuel?: string | null
          gearbox?: string | null
          id?: string
          last_seen?: string
          listed_on?: string
          location?: string | null
          make?: string
          mileage?: number
          model?: string
          price?: number
          seller?: string | null
          source?: string
          source_url?: string | null
          variant?: string | null
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_premium: boolean
          plan: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_premium?: boolean
          plan?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_premium?: boolean
          plan?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      sale_feedback: {
        Row: {
          estimate_at_time: number | null
          make: string
          mileage: number
          model: string
          recorded_at: string
          sale_price: number
          sold_on: string | null
          sold_to: string | null
          valuation_id: string
          variant: string | null
          year: number
        }
        Insert: {
          estimate_at_time?: number | null
          make: string
          mileage: number
          model: string
          recorded_at?: string
          sale_price: number
          sold_on?: string | null
          sold_to?: string | null
          valuation_id: string
          variant?: string | null
          year: number
        }
        Update: {
          estimate_at_time?: number | null
          make?: string
          mileage?: number
          model?: string
          recorded_at?: string
          sale_price?: number
          sold_on?: string | null
          sold_to?: string | null
          valuation_id?: string
          variant?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_feedback_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: true
            referencedRelation: "valuations"
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
      valuation_pool: {
        Row: {
          condition_score: number | null
          created_at: string
          declared_status: string | null
          engine_version: string | null
          fuel: string | null
          gearbox: string | null
          make: string
          mileage: number
          model: string
          own_comps: Json | null
          photo_count: number
          price_private: number | null
          price_source: string | null
          spec: Json
          valuation_id: string
          variant: string | null
          year: number
        }
        Insert: {
          condition_score?: number | null
          created_at?: string
          declared_status?: string | null
          engine_version?: string | null
          fuel?: string | null
          gearbox?: string | null
          make: string
          mileage: number
          model: string
          own_comps?: Json | null
          photo_count?: number
          price_private?: number | null
          price_source?: string | null
          spec?: Json
          valuation_id: string
          variant?: string | null
          year: number
        }
        Update: {
          condition_score?: number | null
          created_at?: string
          declared_status?: string | null
          engine_version?: string | null
          fuel?: string | null
          gearbox?: string | null
          make?: string
          mileage?: number
          model?: string
          own_comps?: Json | null
          photo_count?: number
          price_private?: number | null
          price_source?: string | null
          spec?: Json
          valuation_id?: string
          variant?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "valuation_pool_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: true
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          condition_score: number | null
          created_at: string
          guest_token_hash: string | null
          id: string
          make: string
          mileage: number
          model: string
          mot_expiry: string | null
          photo_urls: Json
          private_value: number | null
          registration: string | null
          report: Json
          service_notes: string | null
          user_id: string | null
          year: number
        }
        Insert: {
          condition_score?: number | null
          created_at?: string
          guest_token_hash?: string | null
          id?: string
          make: string
          mileage: number
          model: string
          mot_expiry?: string | null
          photo_urls?: Json
          private_value?: number | null
          registration?: string | null
          report?: Json
          service_notes?: string | null
          user_id?: string | null
          year: number
        }
        Update: {
          condition_score?: number | null
          created_at?: string
          guest_token_hash?: string | null
          id?: string
          make?: string
          mileage?: number
          model?: string
          mot_expiry?: string | null
          photo_urls?: Json
          private_value?: number | null
          registration?: string | null
          report?: Json
          service_notes?: string | null
          user_id?: string | null
          year?: number
        }
        Relationships: []
      }
      vehicle_history_flags: {
        Row: {
          created_at: string
          mot_flags: Json
          source: string
          stolen: boolean | null
          valuation_id: string
          write_off_category: string | null
        }
        Insert: {
          created_at?: string
          mot_flags?: Json
          source?: string
          stolen?: boolean | null
          valuation_id: string
          write_off_category?: string | null
        }
        Update: {
          created_at?: string
          mot_flags?: Json
          source?: string
          stolen?: boolean | null
          valuation_id?: string
          write_off_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_history_flags_valuation_id_fkey"
            columns: ["valuation_id"]
            isOneToOne: true
            referencedRelation: "valuations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      readiness_outcomes: {
        Row: {
          confidence: string | null
          engine_version: string | null
          estimate: number | null
          estimated_at: string | null
          item_id: string | null
          make: string | null
          mileage: number | null
          model: string | null
          outcome_at: string | null
          outcome_price: number | null
          pricing_source: string | null
          sale_type: string | null
          side: string | null
          year: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_stats: { Args: never; Returns: Json }
      beta_signup_count: { Args: never; Returns: number }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      has_beta_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      public_accuracy_stats: {
        Args: never
        Returns: {
          count: number
          mean_signed_pct: number
          median_abs_pct: number
          within_10_pct: number
        }[]
      }
      readiness_stats: { Args: { p_engine?: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
