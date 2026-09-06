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
      addresses: {
        Row: {
          county: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          notes: string | null
          phone: string
          recipient_name: string
          street: string | null
          town: string | null
          user_id: string
        }
        Insert: {
          county?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          notes?: string | null
          phone: string
          recipient_name: string
          street?: string | null
          town?: string | null
          user_id: string
        }
        Update: {
          county?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          notes?: string | null
          phone?: string
          recipient_name?: string
          street?: string | null
          town?: string | null
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          name: string
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          name: string
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          gold_threshold: number
          id: number
          kes_per_point: number
          max_redeem_percent: number
          point_value_kes: number
          silver_threshold: number
          updated_at: string
        }
        Insert: {
          gold_threshold?: number
          id?: number
          kes_per_point?: number
          max_redeem_percent?: number
          point_value_kes?: number
          silver_threshold?: number
          updated_at?: string
        }
        Update: {
          gold_threshold?: number
          id?: number
          kes_per_point?: number
          max_redeem_percent?: number
          point_value_kes?: number
          silver_threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          points: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total_kes: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_kes: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_kes: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price_kes: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total_kes?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price_kes?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          delivery_address: Json | null
          delivery_fee_kes: number
          delivery_option: string | null
          discount_kes: number
          fulfilment_note: string | null
          id: string
          merchant_reference: string
          points_awarded: boolean
          points_redeemed: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_kes: number
          total_kes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          delivery_address?: Json | null
          delivery_fee_kes?: number
          delivery_option?: string | null
          discount_kes?: number
          fulfilment_note?: string | null
          id?: string
          merchant_reference: string
          points_awarded?: boolean
          points_redeemed?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes?: number
          total_kes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          delivery_address?: Json | null
          delivery_fee_kes?: number
          delivery_option?: string | null
          discount_kes?: number
          fulfilment_note?: string | null
          id?: string
          merchant_reference?: string
          points_awarded?: boolean
          points_redeemed?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_kes?: number
          total_kes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kes: number
          callback_at: string | null
          confirmation_code: string | null
          created_at: string
          currency: string
          id: string
          internal_status: Database["public"]["Enums"]["order_status"]
          ipn_at: string | null
          masked_account: string | null
          merchant_reference: string
          order_id: string
          order_tracking_id: string | null
          payment_method: string | null
          provider_response: Json | null
          provider_status: string | null
          refund_reference: string | null
          refund_status: string | null
          updated_at: string
        }
        Insert: {
          amount_kes: number
          callback_at?: string | null
          confirmation_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          internal_status?: Database["public"]["Enums"]["order_status"]
          ipn_at?: string | null
          masked_account?: string | null
          merchant_reference: string
          order_id: string
          order_tracking_id?: string | null
          payment_method?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          refund_reference?: string | null
          refund_status?: string | null
          updated_at?: string
        }
        Update: {
          amount_kes?: number
          callback_at?: string | null
          confirmation_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          internal_status?: Database["public"]["Enums"]["order_status"]
          ipn_at?: string | null
          masked_account?: string | null
          merchant_reference?: string
          order_id?: string
          order_tracking_id?: string | null
          payment_method?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          refund_reference?: string | null
          refund_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author: string | null
          body: string | null
          category: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[]
          title: string
        }
        Insert: {
          author?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[]
          title: string
        }
        Update: {
          author?: string | null
          body?: string | null
          category?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[]
          title?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price_kes: number
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          specifications: Json
          stock: number
          unit: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price_kes?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          specifications?: Json
          stock?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price_kes?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          specifications?: Json
          stock?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          loyalty_points: number
          phone: string | null
          tier: Database["public"]["Enums"]["loyalty_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          loyalty_points?: number
          phone?: string | null
          tier?: Database["public"]["Enums"]["loyalty_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          loyalty_points?: number
          phone?: string | null
          tier?: Database["public"]["Enums"]["loyalty_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client: string | null
          completed_on: string | null
          created_at: string
          description: string | null
          gallery: Json
          id: string
          image_url: string | null
          is_featured: boolean
          is_published: boolean
          location: string | null
          sector: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          summary: string | null
          title: string
        }
        Insert: {
          client?: string | null
          completed_on?: string | null
          created_at?: string
          description?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          sector?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          summary?: string | null
          title: string
        }
        Update: {
          client?: string | null
          completed_on?: string | null
          created_at?: string
          description?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          sector?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_published: boolean
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          summary: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
        }
        Relationships: []
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
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role:
        | "super_admin"
        | "content_manager"
        | "ecommerce_manager"
        | "rewards_manager"
        | "viewer"
      loyalty_tier: "bronze" | "silver" | "gold"
      order_status:
        | "PENDING_PAYMENT"
        | "PAYMENT_PROCESSING"
        | "PAID"
        | "PAYMENT_FAILED"
        | "PAYMENT_REVERSED"
        | "CANCELLED"
        | "FULFILLED"
        | "SHIPPED"
        | "DELIVERED"
        | "REFUND_REQUESTED"
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
      app_role: [
        "super_admin",
        "content_manager",
        "ecommerce_manager",
        "rewards_manager",
        "viewer",
      ],
      loyalty_tier: ["bronze", "silver", "gold"],
      order_status: [
        "PENDING_PAYMENT",
        "PAYMENT_PROCESSING",
        "PAID",
        "PAYMENT_FAILED",
        "PAYMENT_REVERSED",
        "CANCELLED",
        "FULFILLED",
        "SHIPPED",
        "DELIVERED",
        "REFUND_REQUESTED",
      ],
    },
  },
} as const
