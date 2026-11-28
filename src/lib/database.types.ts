// Archivo generado por `npm run db:types` desde la base local. No lo edites a mano.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_items: {
        Row: {
          counts_for_free_shipping: boolean;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["item_kind"];
          status: Database["public"]["Enums"]["publish_status"];
          tax_rate_bp: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          counts_for_free_shipping?: boolean;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["item_kind"];
          status?: Database["public"]["Enums"]["publish_status"];
          tax_rate_bp?: number;
          updated_at?: string;
        };
        Update: {
          counts_for_free_shipping?: boolean;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["item_kind"];
          status?: Database["public"]["Enums"]["publish_status"];
          tax_rate_bp?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      faq_translations: {
        Row: {
          answer: string;
          created_at: string;
          faq_id: string;
          locale: string;
          question: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          answer: string;
          created_at?: string;
          faq_id: string;
          locale: string;
          question: string;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          created_at?: string;
          faq_id?: string;
          locale?: string;
          question?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "faq_translations_faq_id_fkey";
            columns: ["faq_id"];
            isOneToOne: false;
            referencedRelation: "faqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "faq_translations_locale_fkey";
            columns: ["locale"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      faqs: {
        Row: {
          created_at: string;
          id: string;
          sort_order: number;
          status: Database["public"]["Enums"]["publish_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["publish_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["publish_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      form_rejections: {
        Row: {
          count: number;
          day: string;
          form: string;
          reason: string;
        };
        ComputedFields: never;
        Insert: {
          count: number;
          day: string;
          form: string;
          reason: string;
        };
        Update: {
          count?: number;
          day?: string;
          form?: string;
          reason?: string;
        };
        Relationships: [];
      };
      languages: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          is_default: boolean;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          is_default?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      markets: {
        Row: {
          country_code: string;
          created_at: string;
          currency: string;
          default_locale: string;
          id: string;
          is_active: boolean;
          payment_methods: string[];
          ships_physical: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          country_code: string;
          created_at?: string;
          currency: string;
          default_locale: string;
          id?: string;
          is_active?: boolean;
          payment_methods?: string[];
          ships_physical?: boolean;
          updated_at?: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          currency?: string;
          default_locale?: string;
          id?: string;
          is_active?: boolean;
          payment_methods?: string[];
          ships_physical?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "markets_default_locale_fkey";
            columns: ["default_locale"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      messages: {
        Row: {
          answered_at: string | null;
          answered_by: string | null;
          body: string;
          country_code: string | null;
          created_at: string;
          email: string;
          id: string;
          locale: string;
          name: string;
          payload: NonNullable<Json>;
          privacy_version: string;
          reason: string;
          status: Database["public"]["Enums"]["message_status"];
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          answered_at?: string | null;
          answered_by?: string | null;
          body: string;
          country_code?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          locale: string;
          name: string;
          payload?: NonNullable<Json>;
          privacy_version: string;
          reason: string;
          status?: Database["public"]["Enums"]["message_status"];
          whatsapp?: string | null;
        };
        Update: {
          answered_at?: string | null;
          answered_by?: string | null;
          body?: string;
          country_code?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          locale?: string;
          name?: string;
          payload?: NonNullable<Json>;
          privacy_version?: string;
          reason?: string;
          status?: Database["public"]["Enums"]["message_status"];
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_answered_by_fkey";
            columns: ["answered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_locale_fkey";
            columns: ["locale"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      prices: {
        Row: {
          amount: number;
          catalog_item_id: string;
          created_at: string;
          currency: string;
          market_id: string;
          mode: Database["public"]["Enums"]["price_mode"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          catalog_item_id: string;
          created_at?: string;
          currency: string;
          market_id: string;
          mode?: Database["public"]["Enums"]["price_mode"];
          updated_at?: string;
        };
        Update: {
          amount?: number;
          catalog_item_id?: string;
          created_at?: string;
          currency?: string;
          market_id?: string;
          mode?: Database["public"]["Enums"]["price_mode"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prices_catalog_item_id_fkey";
            columns: ["catalog_item_id"];
            isOneToOne: false;
            referencedRelation: "catalog_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prices_market_currency_fkey";
            columns: ["market_id", "currency"];
            isOneToOne: false;
            referencedRelation: "markets";
            referencedColumns: ["id", "currency"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          locale: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          locale?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          locale?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          count: number;
          expires_at: string;
          key: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count: number;
          expires_at: string;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          expires_at?: string;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          created_at: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      site_texts: {
        Row: {
          created_at: string;
          key: string;
          locale: string;
          updated_at: string;
          value: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          key: string;
          locale: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          created_at?: string;
          key?: string;
          locale?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "site_texts_locale_fkey";
            columns: ["locale"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
      tip_translations: {
        Row: {
          achievement: string | null;
          common_error: string | null;
          created_at: string;
          keys: string[];
          locale: string;
          practice: string | null;
          tip_id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          achievement?: string | null;
          common_error?: string | null;
          created_at?: string;
          keys?: string[];
          locale: string;
          practice?: string | null;
          tip_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          achievement?: string | null;
          common_error?: string | null;
          created_at?: string;
          keys?: string[];
          locale?: string;
          practice?: string | null;
          tip_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tip_translations_locale_fkey";
            columns: ["locale"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "tip_translations_tip_id_fkey";
            columns: ["tip_id"];
            isOneToOne: false;
            referencedRelation: "public_tips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tip_translations_tip_id_fkey";
            columns: ["tip_id"];
            isOneToOne: false;
            referencedRelation: "tips";
            referencedColumns: ["id"];
          },
        ];
      };
      tips: {
        Row: {
          bunny_video_id: string | null;
          created_at: string;
          duration_seconds: number | null;
          fundamental: Database["public"]["Enums"]["tip_fundamental"] | null;
          id: string;
          is_featured: boolean;
          level: Database["public"]["Enums"]["tip_level"] | null;
          orientation: Database["public"]["Enums"]["tip_orientation"] | null;
          promo: Json | null;
          published_at: string | null;
          slug: string;
          status: Database["public"]["Enums"]["publish_status"];
          thumbnail_url: string | null;
          tiktok_url: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bunny_video_id?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          fundamental?: Database["public"]["Enums"]["tip_fundamental"] | null;
          id?: string;
          is_featured?: boolean;
          level?: Database["public"]["Enums"]["tip_level"] | null;
          orientation?: Database["public"]["Enums"]["tip_orientation"] | null;
          promo?: Json | null;
          published_at?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["publish_status"];
          thumbnail_url?: string | null;
          tiktok_url?: string | null;
          updated_at?: string;
        };
        Update: {
          bunny_video_id?: string | null;
          created_at?: string;
          duration_seconds?: number | null;
          fundamental?: Database["public"]["Enums"]["tip_fundamental"] | null;
          id?: string;
          is_featured?: boolean;
          level?: Database["public"]["Enums"]["tip_level"] | null;
          orientation?: Database["public"]["Enums"]["tip_orientation"] | null;
          promo?: Json | null;
          published_at?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["publish_status"];
          thumbnail_url?: string | null;
          tiktok_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      waitlists: {
        Row: {
          city: string | null;
          country_code: string | null;
          created_at: string;
          email: string;
          id: string;
          kind: string;
          locale: string;
          notified_at: string | null;
          privacy_version: string;
        };
        ComputedFields: never;
        Insert: {
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          kind: string;
          locale: string;
          notified_at?: string | null;
          privacy_version: string;
        };
        Update: {
          city?: string | null;
          country_code?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          kind?: string;
          locale?: string;
          notified_at?: string | null;
          privacy_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlists_locale_fkey";
            columns: ["locale"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
        ];
      };
    };
    Views: {
      public_tips: {
        Row: {
          bunny_video_id: string | null;
          duration_seconds: number | null;
          fundamental: Database["public"]["Enums"]["tip_fundamental"] | null;
          id: string;
          is_featured: boolean;
          level: Database["public"]["Enums"]["tip_level"] | null;
          orientation: Database["public"]["Enums"]["tip_orientation"] | null;
          promo: Json | null;
          published_at: string | null;
          slug: string;
          thumbnail_url: string | null;
          tiktok_url: string | null;
          translations: Json | null;
        };
        ComputedFields: never;
        Insert: {
          bunny_video_id?: string | null;
          duration_seconds?: number | null;
          fundamental?: Database["public"]["Enums"]["tip_fundamental"] | null;
          id?: string | null;
          is_featured?: boolean | null;
          level?: Database["public"]["Enums"]["tip_level"] | null;
          orientation?: Database["public"]["Enums"]["tip_orientation"] | null;
          promo?: Json | null;
          published_at?: string | null;
          slug?: string | null;
          thumbnail_url?: string | null;
          tiktok_url?: string | null;
          translations?: never;
        };
        Update: {
          bunny_video_id?: string | null;
          duration_seconds?: number | null;
          fundamental?: Database["public"]["Enums"]["tip_fundamental"] | null;
          id?: string | null;
          is_featured?: boolean | null;
          level?: Database["public"]["Enums"]["tip_level"] | null;
          orientation?: Database["public"]["Enums"]["tip_orientation"] | null;
          promo?: Json | null;
          published_at?: string | null;
          slug?: string | null;
          thumbnail_url?: string | null;
          tiktok_url?: string | null;
          translations?: never;
        };
        Relationships: [];
      };
    };
    Functions: {
      assert_faq_editor: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      audit_log_actions: {
        Args: Record<PropertyKey, never>;
        Returns: string[];
      };
      audit_log_actors: {
        Args: Record<PropertyKey, never>;
        Returns: {
          email: string;
          full_name: string;
          id: string;
        }[];
      };
      check_rate_limit: {
        Args: {
          p_key: string;
          p_max_attempts: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      create_faq: { Args: { p_translations: Json }; Returns: Json };
      enroll_waitlist: {
        Args: {
          p_city?: string;
          p_country_code?: string;
          p_email: string;
          p_kind: string;
          p_locale: string;
          p_privacy_version: string;
        };
        Returns: undefined;
      };
      faq_has_default_text: { Args: { p_faq_id: string }; Returns: boolean };
      faq_translations_snapshot: { Args: { p_faq_id: string }; Returns: Json };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      move_faq: {
        Args: { p_direction: string; p_faq_id: string };
        Returns: Json;
      };
      purge_expired_rate_limits: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      record_form_rejection: {
        Args: { p_form: string; p_reason: string };
        Returns: undefined;
      };
      save_faq: {
        Args: {
          p_expected: Json;
          p_faq_id: string;
          p_removed_locales: string[];
          p_translations: Json;
        };
        Returns: Json;
      };
      save_message: {
        Args: {
          p_body: string;
          p_country_code?: string;
          p_email: string;
          p_locale: string;
          p_name: string;
          p_payload?: Json;
          p_privacy_version: string;
          p_reason: string;
          p_whatsapp?: string;
        };
        Returns: undefined;
      };
      search_public_tips: {
        Args: {
          p_fundamental?: Database["public"]["Enums"]["tip_fundamental"];
          p_level?: Database["public"]["Enums"]["tip_level"];
          p_locale: string;
          p_query?: string;
        };
        Returns: {
          bunny_video_id: string | null;
          duration_seconds: number | null;
          fundamental: Database["public"]["Enums"]["tip_fundamental"] | null;
          id: string;
          is_featured: boolean;
          level: Database["public"]["Enums"]["tip_level"] | null;
          orientation: Database["public"]["Enums"]["tip_orientation"] | null;
          promo: Json | null;
          published_at: string | null;
          slug: string;
          thumbnail_url: string | null;
          tiktok_url: string | null;
          translations: Json | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "public_tips";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_faq_status: {
        Args: {
          p_faq_id: string;
          p_status: Database["public"]["Enums"]["publish_status"];
        };
        Returns: Database["public"]["Enums"]["publish_status"];
      };
      write_faq_translations: {
        Args: { p_faq_id: string; p_translations: Json };
        Returns: undefined;
      };
    };
    Enums: {
      item_kind: "physical" | "digital" | "event_plan" | "bundle";
      message_status: "new" | "answered" | "archived";
      price_mode: "manual";
      publish_status: "draft" | "published" | "retired";
      tip_fundamental:
        "serve" | "reception" | "setting" | "attack" | "block" | "defense";
      tip_level: "basic" | "intermediate" | "advanced";
      tip_orientation: "vertical" | "horizontal";
      user_role: "admin" | "staff" | "buyer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      item_kind: ["physical", "digital", "event_plan", "bundle"],
      message_status: ["new", "answered", "archived"],
      price_mode: ["manual"],
      publish_status: ["draft", "published", "retired"],
      tip_fundamental: [
        "serve",
        "reception",
        "setting",
        "attack",
        "block",
        "defense",
      ],
      tip_level: ["basic", "intermediate", "advanced"],
      tip_orientation: ["vertical", "horizontal"],
      user_role: ["admin", "staff", "buyer"],
    },
  },
} as const;
