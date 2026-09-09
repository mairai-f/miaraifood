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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          access_session_id: string | null
          browser_name: string | null
          country_code: string | null
          created_at: string
          device_type: string
          email: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          occurred_at: string
          os_name: string | null
          owner_user_id: string
          role: string
          source: string
          user_agent: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          access_session_id?: string | null
          browser_name?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string
          email?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          occurred_at?: string
          os_name?: string | null
          owner_user_id: string
          role: string
          source?: string
          user_agent?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          access_session_id?: string | null
          browser_name?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string
          email?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          occurred_at?: string
          os_name?: string | null
          owner_user_id?: string
          role?: string
          source?: string
          user_agent?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_access_session_id_fkey"
            columns: ["access_session_id"]
            isOneToOne: false
            referencedRelation: "access_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      access_sessions: {
        Row: {
          browser_name: string | null
          client_session_id: string
          country_code: string | null
          created_at: string
          device_type: string
          email: string | null
          ended_at: string | null
          id: string
          ip_address: string | null
          last_seen_at: string
          login_at: string
          metadata: Json
          os_name: string | null
          owner_user_id: string
          role: string
          source: string
          updated_at: string
          user_agent: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          browser_name?: string | null
          client_session_id: string
          country_code?: string | null
          created_at?: string
          device_type?: string
          email?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          login_at?: string
          metadata?: Json
          os_name?: string | null
          owner_user_id: string
          role: string
          source?: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          browser_name?: string | null
          client_session_id?: string
          country_code?: string | null
          created_at?: string
          device_type?: string
          email?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          login_at?: string
          metadata?: Json
          os_name?: string | null
          owner_user_id?: string
          role?: string
          source?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_label: string | null
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          owner_user_id: string
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          owner_user_id: string
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          cpf_cnpj: string | null
          created_at: string
          email: string
          id: string
          metadata: Json
          owner_user_id: string
          phone: string | null
          provider: string
          provider_customer_deleted: boolean
          provider_customer_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          id?: string
          metadata?: Json
          owner_user_id: string
          phone?: string | null
          provider?: string
          provider_customer_deleted?: boolean
          provider_customer_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          id?: string
          metadata?: Json
          owner_user_id?: string
          phone?: string | null
          provider?: string
          provider_customer_deleted?: boolean
          provider_customer_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: true
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string
          provider?: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by_name: string | null
          closed_by_user_id: string | null
          closing_balance: number | null
          closing_difference: number | null
          counted_balance: number | null
          created_at: string
          difference_reason: string | null
          expected_balance: number | null
          id: string
          location_id: string | null
          opened_at: string
          opened_by_name: string
          opening_amount: number
          operator_name: string
          operator_user_id: string
          owner_user_id: string
          status: string
          terminal_id: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closing_balance?: number | null
          closing_difference?: number | null
          counted_balance?: number | null
          created_at?: string
          difference_reason?: string | null
          expected_balance?: number | null
          id?: string
          location_id?: string | null
          opened_at?: string
          opened_by_name: string
          opening_amount?: number
          operator_name: string
          operator_user_id: string
          owner_user_id: string
          status?: string
          terminal_id?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closing_balance?: number | null
          closing_difference?: number | null
          counted_balance?: number | null
          created_at?: string
          difference_reason?: string | null
          expected_balance?: number | null
          id?: string
          location_id?: string | null
          opened_at?: string
          opened_by_name?: string
          opening_amount?: number
          operator_name?: string
          operator_user_id?: string
          owner_user_id?: string
          status?: string
          terminal_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          channel_type: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          channel_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          channel_id: string
          created_at: string
          edited_at: string | null
          id: string
          sender_user_id: string | null
        }
        Insert: {
          body: string
          channel_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_user_id?: string | null
        }
        Update: {
          body?: string
          channel_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          credit_limit: number | null
          debt_due_date: string | null
          deleted: boolean
          deleted_at: string | null
          id: string
          name: string
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_limit?: number | null
          debt_due_date?: string | null
          deleted?: boolean
          deleted_at?: string | null
          id?: string
          name: string
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credit_limit?: number | null
          debt_due_date?: string | null
          deleted?: boolean
          deleted_at?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      debt_entries: {
        Row: {
          client_id: string
          created_at: string
          date_added: string
          date_paid: string | null
          deleted: boolean
          deleted_at: string | null
          deleted_by: string | null
          deleted_reason: string | null
          id: string
          location_id: string | null
          manual_deleted: boolean
          packaging_id: string | null
          packaging_name: string | null
          packaging_price: number | null
          packaging_quantity: number | null
          product_code: number | null
          product_id: string
          product_name: string
          quantity: number
          registered_by: string | null
          status: string
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date_added?: string
          date_paid?: string | null
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          location_id?: string | null
          manual_deleted?: boolean
          packaging_id?: string | null
          packaging_name?: string | null
          packaging_price?: number | null
          packaging_quantity?: number | null
          product_code?: number | null
          product_id: string
          product_name: string
          quantity?: number
          registered_by?: string | null
          status?: string
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date_added?: string
          date_paid?: string | null
          deleted?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          deleted_reason?: string | null
          id?: string
          location_id?: string | null
          manual_deleted?: boolean
          packaging_id?: string | null
          packaging_name?: string | null
          packaging_price?: number | null
          packaging_quantity?: number | null
          product_code?: number | null
          product_id?: string
          product_name?: string
          quantity?: number
          registered_by?: string | null
          status?: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "admin_system_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "debt_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_entries_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "product_packagings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string
          delivery_pin_hash: string | null
          driver_id: string | null
          id: string
          order_id: string
          pickup_address: string
          status: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_pin_hash?: string | null
          driver_id?: string | null
          id?: string
          order_id: string
          pickup_address?: string
          status?: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivered_at?: string | null
          delivery_address?: string
          delivery_pin_hash?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string
          pickup_address?: string
          status?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_driver_applications: {
        Row: {
          city: string
          cnh_number: string | null
          cpf: string
          created_at: string
          document_status: string
          email: string
          establishment_id: string | null
          establishment_invite_code: string | null
          full_name: string
          id: string
          phone: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string
          status: string
          terms_version: string
          updated_at: string
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          city: string
          cnh_number?: string | null
          cpf: string
          created_at?: string
          document_status?: string
          email: string
          establishment_id?: string | null
          establishment_invite_code?: string | null
          full_name: string
          id?: string
          phone: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state: string
          status?: string
          terms_version: string
          updated_at?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type: string
        }
        Update: {
          city?: string
          cnh_number?: string | null
          cpf?: string
          created_at?: string
          document_status?: string
          email?: string
          establishment_id?: string | null
          establishment_invite_code?: string | null
          full_name?: string
          id?: string
          phone?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string
          status?: string
          terms_version?: string
          updated_at?: string
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_applications_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_driver_documents: {
        Row: {
          application_id: string
          created_at: string
          document_type: string
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          storage_path: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_type: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_type?: string
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "delivery_driver_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_driver_stores: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string
          exclusive: boolean
          store_account_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id: string
          exclusive?: boolean
          store_account_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string
          exclusive?: boolean
          store_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_stores_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_driver_stores_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          availability: string
          created_at: string
          display_name: string
          id: string
          phone: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          availability?: string
          created_at?: string
          display_name?: string
          id?: string
          phone?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          availability?: string
          created_at?: string
          display_name?: string
          id?: string
          phone?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          delivery_id: string
          details: Json
          event_type: string
          id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          delivery_id: string
          details?: Json
          event_type: string
          id?: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          delivery_id?: string
          details?: Json
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_incidents: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          note: string
          reason: string
          reporter_user_id: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          note?: string
          reason: string
          reporter_user_id: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
          note?: string
          reason?: string
          reporter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_incidents_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          delivery_id: string
          driver_id: string
          id: string
          latitude: number
          longitude: number
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          delivery_id: string
          driver_id: string
          id?: string
          latitude: number
          longitude: number
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          delivery_id?: string
          driver_id?: string
          id?: string
          latitude?: number
          longitude?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_locations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_offers: {
        Row: {
          delivery_id: string
          driver_id: string
          id: string
          offered_at: string
          responded_at: string | null
          status: string
        }
        Insert: {
          delivery_id: string
          driver_id: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          delivery_id?: string
          driver_id?: string
          id?: string
          offered_at?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_offers_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      desktop_license_keys: {
        Row: {
          created_at: string
          id: string
          issued_at: string
          key_hash: string
          key_prefix: string
          key_suffix: string
          owner_user_id: string
          revoked_at: string | null
          status: string
          subscription_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          issued_at?: string
          key_hash: string
          key_prefix?: string
          key_suffix: string
          owner_user_id: string
          revoked_at?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          issued_at?: string
          key_hash?: string
          key_prefix?: string
          key_suffix?: string
          owner_user_id?: string
          revoked_at?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desktop_license_keys_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: true
            referencedRelation: "store_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      desktop_machine_activations: {
        Row: {
          activated_at: string
          app_context: string
          app_version: string | null
          company_name: string | null
          id: string
          installation_id: string
          last_seen_at: string
          legal_acceptance_source: string | null
          lgpd_accepted_at: string | null
          lgpd_version: string | null
          owner_user_id: string
          platform: string | null
          privacy_accepted_at: string | null
          privacy_version: string | null
          store_account_id: string
          terminal_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string
          app_context?: string
          app_version?: string | null
          company_name?: string | null
          id?: string
          installation_id: string
          last_seen_at?: string
          legal_acceptance_source?: string | null
          lgpd_accepted_at?: string | null
          lgpd_version?: string | null
          owner_user_id: string
          platform?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          store_account_id: string
          terminal_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string
          app_context?: string
          app_version?: string | null
          company_name?: string | null
          id?: string
          installation_id?: string
          last_seen_at?: string
          legal_acceptance_source?: string | null
          lgpd_accepted_at?: string | null
          lgpd_version?: string | null
          owner_user_id?: string
          platform?: string | null
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          store_account_id?: string
          terminal_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "desktop_machine_activations_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desktop_machine_activations_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_permission_catalog: {
        Row: {
          created_at: string
          default_hr: boolean
          default_operator: boolean
          default_waiter: boolean
          description: string
          module_key: string
          name: string
          permission_key: string
          runtime_scope: string
        }
        Insert: {
          created_at?: string
          default_hr?: boolean
          default_operator?: boolean
          default_waiter?: boolean
          description?: string
          module_key: string
          name: string
          permission_key: string
          runtime_scope?: string
        }
        Update: {
          created_at?: string
          default_hr?: boolean
          default_operator?: boolean
          default_waiter?: boolean
          description?: string
          module_key?: string
          name?: string
          permission_key?: string
          runtime_scope?: string
        }
        Relationships: []
      }
      erp_permission_group_rules: {
        Row: {
          allowed: boolean
          created_at: string
          group_id: string
          owner_user_id: string
          permission_key: string
          updated_at: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          group_id: string
          owner_user_id: string
          permission_key: string
          updated_at?: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          group_id?: string
          owner_user_id?: string
          permission_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_permission_group_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "erp_permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erp_permission_group_rules_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "erp_permission_catalog"
            referencedColumns: ["permission_key"]
          },
        ]
      }
      erp_permission_groups: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_system: boolean
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_system?: boolean
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      erp_staff_group_memberships: {
        Row: {
          created_at: string
          group_id: string
          owner_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          owner_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          owner_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_staff_group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "erp_permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_staff_permission_overrides: {
        Row: {
          allowed: boolean
          created_at: string
          owner_user_id: string
          permission_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed: boolean
          created_at?: string
          owner_user_id: string
          permission_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          owner_user_id?: string
          permission_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_staff_permission_overrides_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "erp_permission_catalog"
            referencedColumns: ["permission_key"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          attachment_url: string
          cash_session_id: string | null
          category: string
          cost_center: string
          created_at: string
          date: string
          description: string
          id: string
          location_id: string | null
          operator_user_id: string | null
          party_name: string | null
          payment_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attachment_url?: string
          cash_session_id?: string | null
          category?: string
          cost_center?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          location_id?: string | null
          operator_user_id?: string | null
          party_name?: string | null
          payment_method?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string
          cash_session_id?: string | null
          category?: string
          cost_center?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          location_id?: string | null
          operator_user_id?: string | null
          party_name?: string | null
          payment_method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          reporter_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          reporter_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          media_type: string
          media_url: string | null
          owner_user_id: string
          published_at: string
          store_account_id: string
          title: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          owner_user_id: string
          published_at?: string
          store_account_id: string
          title?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          owner_user_id?: string
          published_at?: string
          store_account_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          account_type: string
          amount: number
          attachment_url: string
          canceled_at: string | null
          canceled_reason: string
          cost_center: string
          created_at: string
          description: string
          due_date: string
          id: string
          installment_number: number
          installment_total: number
          location_id: string | null
          notes: string
          owner_user_id: string
          paid_amount: number
          paid_at: string | null
          party_name: string
          payment_history: Json
          payment_method: string
          recurrence_parent_id: string | null
          recurrence_type: string
          reference_id: string | null
          source: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_type: string
          amount?: number
          attachment_url?: string
          canceled_at?: string | null
          canceled_reason?: string
          cost_center?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          installment_number?: number
          installment_total?: number
          location_id?: string | null
          notes?: string
          owner_user_id: string
          paid_amount?: number
          paid_at?: string | null
          party_name?: string
          payment_history?: Json
          payment_method?: string
          recurrence_parent_id?: string | null
          recurrence_type?: string
          reference_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_type?: string
          amount?: number
          attachment_url?: string
          canceled_at?: string | null
          canceled_reason?: string
          cost_center?: string
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          installment_number?: number
          installment_total?: number
          location_id?: string | null
          notes?: string
          owner_user_id?: string
          paid_amount?: number
          paid_at?: string | null
          party_name?: string
          payment_history?: Json
          payment_method?: string
          recurrence_parent_id?: string | null
          recurrence_type?: string
          reference_id?: string | null
          source?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_recurrence_parent_id_fkey"
            columns: ["recurrence_parent_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          access_key: string
          created_at: string
          created_by_user_id: string | null
          document_model: string
          emitted_at: string
          environment: string
          error_message: string | null
          external_id: string | null
          external_status: string | null
          homologation_message: string | null
          id: string
          location_id: string | null
          number: number
          operator_user_id: string | null
          owner_user_id: string
          payload: Json
          protocol: string | null
          provider: string
          sale_id: string
          series: number
          status: string
          updated_at: string
        }
        Insert: {
          access_key: string
          created_at?: string
          created_by_user_id?: string | null
          document_model?: string
          emitted_at?: string
          environment?: string
          error_message?: string | null
          external_id?: string | null
          external_status?: string | null
          homologation_message?: string | null
          id?: string
          location_id?: string | null
          number: number
          operator_user_id?: string | null
          owner_user_id: string
          payload?: Json
          protocol?: string | null
          provider?: string
          sale_id: string
          series: number
          status?: string
          updated_at?: string
        }
        Update: {
          access_key?: string
          created_at?: string
          created_by_user_id?: string | null
          document_model?: string
          emitted_at?: string
          environment?: string
          error_message?: string | null
          external_id?: string | null
          external_status?: string | null
          homologation_message?: string | null
          id?: string
          location_id?: string | null
          number?: number
          operator_user_id?: string | null
          owner_user_id?: string
          payload?: Json
          protocol?: string | null
          provider?: string
          sale_id?: string
          series?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      food_areas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string
          name: string
          owner_user_id: string
          sort_order: number
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id: string
          name: string
          owner_user_id: string
          sort_order?: number
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string
          name?: string
          owner_user_id?: string
          sort_order?: number
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_areas_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_areas_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_customer_feedback: {
        Row: {
          created_at: string
          customer_name: string
          customer_user_id: string
          food_comment: string
          food_rating: number
          id: string
          is_anonymous: boolean
          order_id: string
          updated_at: string
          waiter_comment: string
          waiter_name: string
          waiter_rating: number | null
        }
        Insert: {
          created_at?: string
          customer_name?: string
          customer_user_id: string
          food_comment?: string
          food_rating: number
          id?: string
          is_anonymous?: boolean
          order_id: string
          updated_at?: string
          waiter_comment?: string
          waiter_name?: string
          waiter_rating?: number | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_user_id?: string
          food_comment?: string
          food_rating?: number
          id?: string
          is_anonymous?: boolean
          order_id?: string
          updated_at?: string
          waiter_comment?: string
          waiter_name?: string
          waiter_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "food_customer_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_customer_issues: {
        Row: {
          created_at: string
          customer_user_id: string
          description: string
          id: string
          issue_type: string
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_user_id: string
          description: string
          id?: string
          issue_type: string
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_user_id?: string
          description?: string
          id?: string
          issue_type?: string
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_customer_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_guest_sessions: {
        Row: {
          appetite_level: string | null
          created_at: string
          experience_mode: string | null
          id: string
          last_seen_at: string
          party_size_hint: number | null
          revoked_at: string | null
          table_session_id: string
          token_hash: string
        }
        Insert: {
          appetite_level?: string | null
          created_at?: string
          experience_mode?: string | null
          id?: string
          last_seen_at?: string
          party_size_hint?: number | null
          revoked_at?: string | null
          table_session_id: string
          token_hash: string
        }
        Update: {
          appetite_level?: string | null
          created_at?: string
          experience_mode?: string | null
          id?: string
          last_seen_at?: string
          party_size_hint?: number | null
          revoked_at?: string | null
          table_session_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_guest_sessions_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "food_table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_menu_addon_groups: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_select: number
          menu_product_id: string
          min_select: number
          name: string
          required: boolean
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_select?: number
          menu_product_id: string
          min_select?: number
          name: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_select?: number
          menu_product_id?: string
          min_select?: number
          name?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_menu_addon_groups_menu_product_id_fkey"
            columns: ["menu_product_id"]
            isOneToOne: false
            referencedRelation: "food_menu_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_menu_addon_groups_menu_product_id_fkey"
            columns: ["menu_product_id"]
            isOneToOne: false
            referencedRelation: "miaifood_public_menu"
            referencedColumns: ["menu_id"]
          },
        ]
      }
      food_menu_addon_options: {
        Row: {
          active: boolean
          addon_group_id: string
          created_at: string
          id: string
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          addon_group_id: string
          created_at?: string
          id?: string
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          addon_group_id?: string
          created_at?: string
          id?: string
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_menu_addon_options_addon_group_id_fkey"
            columns: ["addon_group_id"]
            isOneToOne: false
            referencedRelation: "food_menu_addon_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      food_menu_products: {
        Row: {
          active: boolean
          created_at: string
          description: string
          featured: boolean
          id: string
          image_url: string
          owner_user_id: string
          product_id: string
          sort_order: number
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          image_url?: string
          owner_user_id: string
          product_id: string
          sort_order?: number
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          image_url?: string
          owner_user_id?: string
          product_id?: string
          sort_order?: number
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_menu_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_menu_products_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_events: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          created_at: string
          details: Json
          event_type: string
          id: string
          location_id: string
          order_id: string
          owner_user_id: string
          store_account_id: string
        }
        Insert: {
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type: string
          id?: string
          location_id: string
          order_id: string
          owner_user_id: string
          store_account_id: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          event_type?: string
          id?: string
          location_id?: string
          order_id?: string
          owner_user_id?: string
          store_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_order_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_events_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_item_addons: {
        Row: {
          addon_option_id: string | null
          created_at: string
          id: string
          name: string
          order_item_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          addon_option_id?: string | null
          created_at?: string
          id?: string
          name: string
          order_item_id: string
          quantity: number
          total: number
          unit_price?: number
        }
        Update: {
          addon_option_id?: string | null
          created_at?: string
          id?: string
          name?: string
          order_item_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_order_item_addons_addon_option_id_fkey"
            columns: ["addon_option_id"]
            isOneToOne: false
            referencedRelation: "food_menu_addon_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_item_addons_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "food_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      food_order_items: {
        Row: {
          added_by_user_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by_user_id: string | null
          created_at: string
          id: string
          location_id: string
          notes: string
          order_id: string
          owner_user_id: string
          product_id: string | null
          product_name: string
          quantity: number
          status: string
          store_account_id: string
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          added_by_user_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          id?: string
          location_id: string
          notes?: string
          order_id: string
          owner_user_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          status?: string
          store_account_id: string
          total: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          added_by_user_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          id?: string
          location_id?: string
          notes?: string
          order_id?: string
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string
          store_account_id?: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_order_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_order_items_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_orders: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          closed_at: string | null
          closed_sale_id: string | null
          created_at: string
          created_by_user_id: string | null
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          discount: number
          guest_session_id: string | null
          id: string
          location_id: string
          owner_user_id: string
          service_ticket_id: string | null
          source: string
          status: string
          store_account_id: string
          submitted_at: string | null
          subtotal: number
          table_session_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          closed_sale_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          discount?: number
          guest_session_id?: string | null
          id?: string
          location_id: string
          owner_user_id: string
          service_ticket_id?: string | null
          source?: string
          status?: string
          store_account_id: string
          submitted_at?: string | null
          subtotal?: number
          table_session_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          closed_sale_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          discount?: number
          guest_session_id?: string | null
          id?: string
          location_id?: string
          owner_user_id?: string
          service_ticket_id?: string | null
          source?: string
          status?: string
          store_account_id?: string
          submitted_at?: string | null
          subtotal?: number
          table_session_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_orders_closed_sale_id_fkey"
            columns: ["closed_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_orders_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "food_guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_orders_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_orders_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_orders_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "food_table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_public_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          revoked_at: string | null
          table_session_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          table_session_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          table_session_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_public_sessions_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "food_table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_reservations: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string
          customer_user_id: string | null
          id: string
          location_id: string
          notes: string
          party_size: number
          starts_at: string
          status: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string
          customer_user_id?: string | null
          id?: string
          location_id: string
          notes?: string
          party_size: number
          starts_at: string
          status?: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string | null
          id?: string
          location_id?: string
          notes?: string
          party_size?: number
          starts_at?: string
          status?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_reservations_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_table_payment_splits: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          id: string
          location_id: string
          owner_user_id: string
          paid_at: string | null
          payment_method: string | null
          person_number: number
          status: string
          store_account_id: string
          table_session_id: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          id?: string
          location_id: string
          owner_user_id: string
          paid_at?: string | null
          payment_method?: string | null
          person_number: number
          status?: string
          store_account_id: string
          table_session_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          id?: string
          location_id?: string
          owner_user_id?: string
          paid_at?: string | null
          payment_method?: string | null
          person_number?: number
          status?: string
          store_account_id?: string
          table_session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_table_payment_splits_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_table_payment_splits_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_table_payment_splits_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "food_table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      food_table_qr_credentials: {
        Row: {
          created_at: string
          qr_token: string
          rotated_at: string
          table_id: string
        }
        Insert: {
          created_at?: string
          qr_token?: string
          rotated_at?: string
          table_id: string
        }
        Update: {
          created_at?: string
          qr_token?: string
          rotated_at?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_table_qr_credentials_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: true
            referencedRelation: "food_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      food_table_sessions: {
        Row: {
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          guest_count: number | null
          id: string
          location_id: string
          notes: string
          opened_at: string
          opened_by_user_id: string | null
          owner_user_id: string
          service_ticket_id: string | null
          status: string
          store_account_id: string
          table_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          guest_count?: number | null
          id?: string
          location_id: string
          notes?: string
          opened_at?: string
          opened_by_user_id?: string | null
          owner_user_id: string
          service_ticket_id?: string | null
          status?: string
          store_account_id: string
          table_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by_user_id?: string | null
          created_at?: string
          guest_count?: number | null
          id?: string
          location_id?: string
          notes?: string
          opened_at?: string
          opened_by_user_id?: string | null
          owner_user_id?: string
          service_ticket_id?: string | null
          status?: string
          store_account_id?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_table_sessions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_table_sessions_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_table_sessions_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_table_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "food_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      food_tables: {
        Row: {
          active: boolean
          area_id: string | null
          code: string
          created_at: string
          id: string
          location_id: string
          name: string
          owner_user_id: string
          seats: number
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          code: string
          created_at?: string
          id?: string
          location_id: string
          name?: string
          owner_user_id: string
          seats?: number
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_id?: string | null
          code?: string
          created_at?: string
          id?: string
          location_id?: string
          name?: string
          owner_user_id?: string
          seats?: number
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_tables_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "food_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_tables_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_tables_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      food_waiter_calls: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          guest_session_id: string | null
          handled_by_user_id: string | null
          id: string
          kind: string
          resolved_at: string | null
          status: string
          table_session_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          guest_session_id?: string | null
          handled_by_user_id?: string | null
          id?: string
          kind?: string
          resolved_at?: string | null
          status?: string
          table_session_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          guest_session_id?: string | null
          handled_by_user_id?: string | null
          id?: string
          kind?: string
          resolved_at?: string | null
          status?: string
          table_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_waiter_calls_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "food_guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_waiter_calls_table_session_id_fkey"
            columns: ["table_session_id"]
            isOneToOne: false
            referencedRelation: "food_table_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_announcements: {
        Row: {
          active: boolean
          audience: string
          body: string
          created_by: string | null
          expires_at: string | null
          id: string
          owner_user_id: string
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          body?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          owner_user_id: string
          published_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          body?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          owner_user_id?: string
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_audit_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          description: string
          employee_id: string | null
          event_type: string
          id: string
          metadata: Json
          owner_user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          description?: string
          employee_id?: string | null
          event_type: string
          id?: string
          metadata?: Json
          owner_user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          description?: string
          employee_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_audit_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_compliance_rules: {
        Row: {
          active: boolean
          category: string
          code: string
          configuration: Json
          created_at: string
          id: string
          owner_user_id: string | null
          requirement_summary: string
          severity: string
          source_name: string
          source_url: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          configuration?: Json
          created_at?: string
          id?: string
          owner_user_id?: string | null
          requirement_summary?: string
          severity?: string
          source_name?: string
          source_url?: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          configuration?: Json
          created_at?: string
          id?: string
          owner_user_id?: string | null
          requirement_summary?: string
          severity?: string
          source_name?: string
          source_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_employee_compensation: {
        Row: {
          benefits: Json
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          notes: string | null
          owner_user_id: string
          salary_amount: number
          salary_type: string
          updated_at: string
        }
        Insert: {
          benefits?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          owner_user_id: string
          salary_amount?: number
          salary_type?: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          owner_user_id?: string
          salary_amount?: number
          salary_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employee_documents: {
        Row: {
          created_at: string
          created_by: string | null
          document_type: string
          employee_id: string
          expires_at: string | null
          file_url: string | null
          id: string
          owner_user_id: string
          sensitive: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          document_type: string
          employee_id: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          owner_user_id: string
          sensitive?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          document_type?: string
          employee_id?: string
          expires_at?: string | null
          file_url?: string | null
          id?: string
          owner_user_id?: string
          sensitive?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employee_schedule_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          ends_on: string | null
          id: string
          owner_user_id: string
          schedule_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          ends_on?: string | null
          id?: string
          owner_user_id: string
          schedule_id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          ends_on?: string | null
          id?: string
          owner_user_id?: string
          schedule_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employee_schedule_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employee_schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "hr_work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip_code: string | null
          admission_date: string | null
          bank_account: string | null
          bank_agency: string | null
          bank_name: string | null
          contract_type: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string | null
          employment_type: string
          full_name: string
          id: string
          manager_employee_id: string | null
          notes: string | null
          owner_user_id: string
          phone: string | null
          photo_url: string | null
          position: string | null
          preferred_name: string | null
          profile_user_id: string | null
          salary_amount: number | null
          status: string
          termination_date: string | null
          unit_name: string | null
          updated_at: string
          updated_by: string | null
          work_journey: string | null
          work_location_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          admission_date?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          employment_type?: string
          full_name: string
          id?: string
          manager_employee_id?: string | null
          notes?: string | null
          owner_user_id: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          preferred_name?: string | null
          profile_user_id?: string | null
          salary_amount?: number | null
          status?: string
          termination_date?: string | null
          unit_name?: string | null
          updated_at?: string
          updated_by?: string | null
          work_journey?: string | null
          work_location_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          admission_date?: string | null
          bank_account?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string | null
          employment_type?: string
          full_name?: string
          id?: string
          manager_employee_id?: string | null
          notes?: string | null
          owner_user_id?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          preferred_name?: string | null
          profile_user_id?: string | null
          salary_amount?: number | null
          status?: string
          termination_date?: string | null
          unit_name?: string | null
          updated_at?: string
          updated_by?: string | null
          work_journey?: string | null
          work_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_work_location_id_fkey"
            columns: ["work_location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_leave_requests: {
        Row: {
          approved_by: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          owner_user_id: string
          reason: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date: string
          id?: string
          leave_type: string
          owner_user_id: string
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          owner_user_id?: string
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payroll_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          employee_id: string
          event_code: string
          event_type: string
          id: string
          metadata: Json
          owner_user_id: string
          payroll_run_id: string
          quantity: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          employee_id: string
          event_code: string
          event_type: string
          id?: string
          metadata?: Json
          owner_user_id: string
          payroll_run_id: string
          quantity?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          employee_id?: string
          event_code?: string
          event_type?: string
          id?: string
          metadata?: Json
          owner_user_id?: string
          payroll_run_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "hr_payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payroll_runs: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          gross_total: number
          id: string
          metadata: Json
          net_total: number
          owner_user_id: string
          period_end: string
          period_start: string
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          gross_total?: number
          id?: string
          metadata?: Json
          net_total?: number
          owner_user_id: string
          period_end: string
          period_start: string
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          gross_total?: number
          id?: string
          metadata?: Json
          net_total?: number
          owner_user_id?: string
          period_end?: string
          period_start?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_time_clock_entries: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          entry_type: string
          id: string
          notes: string | null
          occurred_at: string
          owner_user_id: string
          schedule_id: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          entry_type: string
          id?: string
          notes?: string | null
          occurred_at?: string
          owner_user_id: string
          schedule_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          entry_type?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          owner_user_id?: string
          schedule_id?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_time_clock_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_time_clock_entries_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "hr_work_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_work_schedules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          owner_user_id: string
          timezone: string
          tolerance_minutes: number
          updated_at: string
          weekly_rules: Json
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          owner_user_id: string
          timezone?: string
          tolerance_minutes?: number
          updated_at?: string
          weekly_rules?: Json
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          owner_user_id?: string
          timezone?: string
          tolerance_minutes?: number
          updated_at?: string
          weekly_rules?: Json
        }
        Relationships: []
      }
      internal_chat_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_audit_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_conversations: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          direct_recipient_user_id: string | null
          id: string
          kind: string
          location_id: string | null
          name: string
          owner_user_id: string
          photo_url: string | null
          store_account_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          direct_recipient_user_id?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          name: string
          owner_user_id: string
          photo_url?: string | null
          store_account_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          direct_recipient_user_id?: string | null
          id?: string
          kind?: string
          location_id?: string | null
          name?: string
          owner_user_id?: string
          photo_url?: string | null
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_conversations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_chat_conversations_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_chat_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          id: string
          sender_user_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_user_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "internal_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_inventory: {
        Row: {
          location_id: string
          max_stock: number | null
          min_stock: number
          owner_user_id: string
          product_id: string
          reserved_stock: number
          stock: number
          updated_at: string
        }
        Insert: {
          location_id: string
          max_stock?: number | null
          min_stock?: number
          owner_user_id: string
          product_id: string
          reserved_stock?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          location_id?: string
          max_stock?: number | null
          min_stock?: number
          owner_user_id?: string
          product_id?: string
          reserved_stock?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_search_signals: {
        Row: {
          created_at: string
          id: string
          region: string | null
          result_count: number
          state: string
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          region?: string | null
          result_count?: number
          state: string
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          region?: string | null
          result_count?: number
          state?: string
          term?: string
        }
        Relationships: []
      }
      measurement_unit_conversions: {
        Row: {
          active: boolean
          created_at: string
          factor: number
          from_unit_id: string
          id: string
          owner_user_id: string
          store_account_id: string
          to_unit_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          factor: number
          from_unit_id: string
          id?: string
          owner_user_id: string
          store_account_id: string
          to_unit_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          factor?: number
          from_unit_id?: string
          id?: string
          owner_user_id?: string
          store_account_id?: string
          to_unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_unit_conversions_from_unit_id_fkey"
            columns: ["from_unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_unit_conversions_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_unit_conversions_to_unit_id_fkey"
            columns: ["to_unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_units: {
        Row: {
          active: boolean
          code: string
          created_at: string
          decimal_places: number
          id: string
          name: string
          owner_user_id: string
          store_account_id: string
          symbol: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          decimal_places?: number
          id?: string
          name: string
          owner_user_id: string
          store_account_id: string
          symbol: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          decimal_places?: number
          id?: string
          name?: string
          owner_user_id?: string
          store_account_id?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_units_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_login_attempts: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          origin: string | null
          status: string
          user_agent: string | null
          username_hash: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          origin?: string | null
          status: string
          user_agent?: string | null
          username_hash?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          origin?: string | null
          status?: string
          user_agent?: string | null
          username_hash?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          date: string
          details: Json
          id: string
          location_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          date?: string
          details?: Json
          id?: string
          location_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          date?: string
          details?: Json
          id?: string
          location_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "admin_system_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_activation_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          establishment_name: string
          expires_at: string
          id: string
          person_email: string
          person_name: string
          sent_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          establishment_name: string
          expires_at?: string
          id?: string
          person_email: string
          person_name: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          establishment_name?: string
          expires_at?: string
          id?: string
          person_email?: string
          person_name?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      platform_admin_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          after_state: Json
          created_at: string
          id: string
          resource_id: string
          resource_type: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_state?: Json
          created_at?: string
          id?: string
          resource_id?: string
          resource_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_state?: Json
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: string
        }
        Relationships: []
      }
      platform_banned_emails: {
        Row: {
          banned_at: string
          banned_by: string | null
          email: string
          reason: string | null
        }
        Insert: {
          banned_at?: string
          banned_by?: string | null
          email: string
          reason?: string | null
        }
        Update: {
          banned_at?: string
          banned_by?: string | null
          email?: string
          reason?: string | null
        }
        Relationships: []
      }
      platform_company_controls: {
        Row: {
          deleted_at: string | null
          deleted_reason: string | null
          is_suspended: boolean
          store_account_id: string
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          deleted_at?: string | null
          deleted_reason?: string | null
          is_suspended?: boolean
          store_account_id: string
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          deleted_at?: string | null
          deleted_reason?: string | null
          is_suspended?: boolean
          store_account_id?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_company_controls_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: true
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_representatives: {
        Row: {
          cities: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          managers: number
          name: string
          revenue: number
        }
        Insert: {
          cities?: string
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          managers?: number
          name: string
          revenue?: number
        }
        Update: {
          cities?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          managers?: number
          name?: string
          revenue?: number
        }
        Relationships: []
      }
      pos_terminals: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          installation_id: string | null
          last_seen_at: string | null
          location_id: string
          name: string
          owner_user_id: string
          store_account_id: string
          terminal_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          installation_id?: string | null
          last_seen_at?: string | null
          location_id: string
          name: string
          owner_user_id: string
          store_account_id: string
          terminal_type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          installation_id?: string | null
          last_seen_at?: string | null
          location_id?: string
          name?: string
          owner_user_id?: string
          store_account_id?: string
          terminal_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_terminals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_terminals_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          alert_days: number
          batch_code: string
          created_at: string
          expiration_date: string
          id: string
          notes: string
          owner_user_id: string
          product_id: string | null
          product_name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          alert_days?: number
          batch_code?: string
          created_at?: string
          expiration_date: string
          id?: string
          notes?: string
          owner_user_id: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          alert_days?: number
          batch_code?: string
          created_at?: string
          expiration_date?: string
          id?: string
          notes?: string
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_brands_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_category_pricing_rules: {
        Row: {
          category: string
          created_at: string
          default_markup_pct: number
          id: string
          minimum_markup_pct: number
          minimum_price: number
          notes: string
          owner_user_id: string
          rounding_rule: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_markup_pct?: number
          id?: string
          minimum_markup_pct?: number
          minimum_price?: number
          notes?: string
          owner_user_id: string
          rounding_rule?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_markup_pct?: number
          id?: string
          minimum_markup_pct?: number
          minimum_price?: number
          notes?: string
          owner_user_id?: string
          rounding_rule?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_departments: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_departments_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packagings: {
        Row: {
          active: boolean
          auto_apply: boolean
          barcode: string
          base_quantity: number
          closed_only: boolean
          created_at: string
          id: string
          name: string
          owner_user_id: string
          product_id: string
          purchase_cost: number
          sale_price: number
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auto_apply?: boolean
          barcode?: string
          base_quantity: number
          closed_only?: boolean
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          product_id: string
          purchase_cost?: number
          sale_price: number
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auto_apply?: boolean
          barcode?: string
          base_quantity?: number
          closed_only?: boolean
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          product_id?: string
          purchase_cost?: number
          sale_price?: number
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packagings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_packagings_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_by_user_id: string | null
          created_at: string
          id: string
          new_cost_price: number
          new_margin_pct: number
          new_markup_pct: number
          new_price: number
          owner_user_id: string
          previous_cost_price: number
          previous_margin_pct: number
          previous_markup_pct: number
          previous_price: number
          product_id: string
          product_name: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_cost_price?: number
          new_margin_pct?: number
          new_markup_pct?: number
          new_price?: number
          owner_user_id: string
          previous_cost_price?: number
          previous_margin_pct?: number
          previous_markup_pct?: number
          previous_price?: number
          product_id: string
          product_name: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          new_cost_price?: number
          new_margin_pct?: number
          new_markup_pct?: number
          new_price?: number
          owner_user_id?: string
          previous_cost_price?: number
          previous_margin_pct?: number
          previous_markup_pct?: number
          previous_price?: number
          product_id?: string
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_table_items: {
        Row: {
          active: boolean
          created_at: string
          id: string
          max_discount_pct: number
          min_quantity: number
          owner_user_id: string
          price: number
          price_table_id: string
          product_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          max_discount_pct?: number
          min_quantity?: number
          owner_user_id: string
          price: number
          price_table_id: string
          product_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          max_discount_pct?: number
          min_quantity?: number
          owner_user_id?: string
          price?: number
          price_table_id?: string
          product_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_table_items_price_table_id_fkey"
            columns: ["price_table_id"]
            isOneToOne: false
            referencedRelation: "product_price_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_table_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_table_items_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tables: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          is_default: boolean
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name: string
          owner_user_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_user_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tables_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_promotions: {
        Row: {
          active: boolean
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          notes: string
          owner_user_id: string
          product_id: string | null
          product_name: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          notes?: string
          owner_user_id: string
          product_id?: string | null
          product_name?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          notes?: string
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subgroups: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          owner_user_id: string
          product_group_id: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          product_group_id: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          product_group_id?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subgroups_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_subgroups_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          average_cost: number
          barcode: string
          block_sale_without_stock: boolean
          brand_id: string | null
          card_fee_cost: number
          category: string
          code: number
          commission_cost: number
          commission_type: string
          commission_value: number
          control_stock: boolean
          cost_price: number
          created_at: string
          custom_costs: Json
          deleted: boolean
          deleted_at: string | null
          department_id: string | null
          expiry_date: string | null
          fiscal_cest: string | null
          fiscal_cfop: string | null
          fiscal_cofins_cst: string | null
          fiscal_csosn: string | null
          fiscal_gtin: string
          fiscal_ncm: string | null
          fiscal_origin: number | null
          fiscal_pis_cst: string | null
          fiscal_unit: string
          freight_cost: number
          id: string
          max_discount_pct: number
          max_stock: number | null
          measurement_unit_id: string | null
          min_stock: number
          minimum_markup_pct: number
          minimum_price: number
          name: string
          operational_cost: number
          other_extra_cost: number
          packaging_cost: number
          price: number
          pricing_notes: string
          primary_transport_company_id: string | null
          product_group_id: string | null
          product_kind: string
          product_subgroup_id: string | null
          purchase_cost: number
          reference: string
          rounding_rule: string
          stock: number
          supplier_id: string | null
          supplier_name: string
          target_markup_pct: number
          tax_cost: number
          updated_at: string
          user_id: string
        }
        Insert: {
          average_cost?: number
          barcode?: string
          block_sale_without_stock?: boolean
          brand_id?: string | null
          card_fee_cost?: number
          category?: string
          code?: number
          commission_cost?: number
          commission_type?: string
          commission_value?: number
          control_stock?: boolean
          cost_price?: number
          created_at?: string
          custom_costs?: Json
          deleted?: boolean
          deleted_at?: string | null
          department_id?: string | null
          expiry_date?: string | null
          fiscal_cest?: string | null
          fiscal_cfop?: string | null
          fiscal_cofins_cst?: string | null
          fiscal_csosn?: string | null
          fiscal_gtin?: string
          fiscal_ncm?: string | null
          fiscal_origin?: number | null
          fiscal_pis_cst?: string | null
          fiscal_unit?: string
          freight_cost?: number
          id?: string
          max_discount_pct?: number
          max_stock?: number | null
          measurement_unit_id?: string | null
          min_stock?: number
          minimum_markup_pct?: number
          minimum_price?: number
          name: string
          operational_cost?: number
          other_extra_cost?: number
          packaging_cost?: number
          price?: number
          pricing_notes?: string
          primary_transport_company_id?: string | null
          product_group_id?: string | null
          product_kind?: string
          product_subgroup_id?: string | null
          purchase_cost?: number
          reference?: string
          rounding_rule?: string
          stock?: number
          supplier_id?: string | null
          supplier_name?: string
          target_markup_pct?: number
          tax_cost?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          average_cost?: number
          barcode?: string
          block_sale_without_stock?: boolean
          brand_id?: string | null
          card_fee_cost?: number
          category?: string
          code?: number
          commission_cost?: number
          commission_type?: string
          commission_value?: number
          control_stock?: boolean
          cost_price?: number
          created_at?: string
          custom_costs?: Json
          deleted?: boolean
          deleted_at?: string | null
          department_id?: string | null
          expiry_date?: string | null
          fiscal_cest?: string | null
          fiscal_cfop?: string | null
          fiscal_cofins_cst?: string | null
          fiscal_csosn?: string | null
          fiscal_gtin?: string
          fiscal_ncm?: string | null
          fiscal_origin?: number | null
          fiscal_pis_cst?: string | null
          fiscal_unit?: string
          freight_cost?: number
          id?: string
          max_discount_pct?: number
          max_stock?: number | null
          measurement_unit_id?: string | null
          min_stock?: number
          minimum_markup_pct?: number
          minimum_price?: number
          name?: string
          operational_cost?: number
          other_extra_cost?: number
          packaging_cost?: number
          price?: number
          pricing_notes?: string
          primary_transport_company_id?: string | null
          product_group_id?: string | null
          product_kind?: string
          product_subgroup_id?: string | null
          purchase_cost?: number
          reference?: string
          rounding_rule?: string
          stock?: number
          supplier_id?: string | null
          supplier_name?: string
          target_markup_pct?: number
          tax_cost?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "product_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_measurement_unit_id_fkey"
            columns: ["measurement_unit_id"]
            isOneToOne: false
            referencedRelation: "measurement_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_primary_transport_company_id_fkey"
            columns: ["primary_transport_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_subgroup_id_fkey"
            columns: ["product_subgroup_id"]
            isOneToOne: false
            referencedRelation: "product_subgroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          commission_enabled: boolean
          commission_rate_pct: number
          created_at: string
          created_by_user_id: string | null
          email: string | null
          id: string
          job_title: string | null
          owner_user_id: string
          role: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          commission_enabled?: boolean
          commission_rate_pct?: number
          created_at?: string
          created_by_user_id?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          owner_user_id: string
          role?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          commission_enabled?: boolean
          commission_rate_pct?: number
          created_at?: string
          created_by_user_id?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          owner_user_id?: string
          role?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          average_cost_after: number | null
          created_at: string
          id: string
          last_divergence_quantity: number
          last_received_quantity: number
          owner_user_id: string
          product_id: string | null
          product_name: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          received_unit_cost: number | null
          total_cost: number
          unit_cost: number
        }
        Insert: {
          average_cost_after?: number | null
          created_at?: string
          id?: string
          last_divergence_quantity?: number
          last_received_quantity?: number
          owner_user_id: string
          product_id?: string | null
          product_name?: string
          purchase_order_id: string
          quantity?: number
          received_quantity?: number
          received_unit_cost?: number | null
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          average_cost_after?: number | null
          created_at?: string
          id?: string
          last_divergence_quantity?: number
          last_received_quantity?: number
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          received_unit_cost?: number | null
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approval_notes: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          divergence_status: string
          due_date: string | null
          freight_amount: number
          id: string
          invoice_number: string
          last_divergence_note: string
          location_id: string | null
          notes: string
          owner_user_id: string
          purchase_date: string
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name: string
          tax_amount: number
          total_amount: number
          transport_company_id: string | null
          updated_at: string
        }
        Insert: {
          approval_notes?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          divergence_status?: string
          due_date?: string | null
          freight_amount?: number
          id?: string
          invoice_number?: string
          last_divergence_note?: string
          location_id?: string | null
          notes?: string
          owner_user_id: string
          purchase_date?: string
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          total_amount?: number
          transport_company_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_notes?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          divergence_status?: string
          due_date?: string | null
          freight_amount?: number
          id?: string
          invoice_number?: string
          last_divergence_note?: string
          location_id?: string | null
          notes?: string
          owner_user_id?: string
          purchase_date?: string
          received_at?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string | null
          supplier_name?: string
          tax_amount?: number
          total_amount?: number
          transport_company_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_transport_company_id_fkey"
            columns: ["transport_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      representative_applications: {
        Row: {
          applicant_type: string
          city: string
          company_cnpj: string | null
          company_name: string | null
          cpf: string
          created_at: string
          email: string
          experience: string | null
          full_name: string
          has_client_portfolio: boolean
          id: string
          phone: string
          prospecting_channels: string[]
          representation_type: string
          represented_company: boolean | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sales_experience: boolean
          segments: string[]
          state: string
          status: string
          terms_version: string
          updated_at: string
        }
        Insert: {
          applicant_type: string
          city: string
          company_cnpj?: string | null
          company_name?: string | null
          cpf: string
          created_at?: string
          email: string
          experience?: string | null
          full_name: string
          has_client_portfolio?: boolean
          id?: string
          phone: string
          prospecting_channels?: string[]
          representation_type?: string
          represented_company?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sales_experience?: boolean
          segments?: string[]
          state: string
          status?: string
          terms_version: string
          updated_at?: string
        }
        Update: {
          applicant_type?: string
          city?: string
          company_cnpj?: string | null
          company_name?: string | null
          cpf?: string
          created_at?: string
          email?: string
          experience?: string | null
          full_name?: string
          has_client_portfolio?: boolean
          id?: string
          phone?: string
          prospecting_channels?: string[]
          representation_type?: string
          represented_company?: boolean | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sales_experience?: boolean
          segments?: string[]
          state?: string
          status?: string
          terms_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          allow_pdv_redemption: boolean
          auto_apply: boolean
          created_at: string
          description: string
          enabled: boolean
          id: string
          minimum_spending: number
          name: string
          notes: string
          points_cost: number
          reward_type: string
          reward_value: number
          updated_at: string
          user_id: string
          validity_days: number
        }
        Insert: {
          allow_pdv_redemption?: boolean
          auto_apply?: boolean
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          minimum_spending?: number
          name: string
          notes?: string
          points_cost?: number
          reward_type?: string
          reward_value?: number
          updated_at?: string
          user_id?: string
          validity_days?: number
        }
        Update: {
          allow_pdv_redemption?: boolean
          auto_apply?: boolean
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          minimum_spending?: number
          name?: string
          notes?: string
          points_cost?: number
          reward_type?: string
          reward_value?: number
          updated_at?: string
          user_id?: string
          validity_days?: number
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          cost_price: number
          created_at: string
          discount_amount: number
          id: string
          margin_pct: number
          markup_pct: number
          net_total: number
          packaging_id: string | null
          packaging_name: string | null
          packaging_price: number | null
          packaging_quantity: number | null
          product_code: number | null
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          total: number
          total_profit: number
          unit_price: number
          unit_profit: number
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          discount_amount?: number
          id?: string
          margin_pct?: number
          markup_pct?: number
          net_total?: number
          packaging_id?: string | null
          packaging_name?: string | null
          packaging_price?: number | null
          packaging_quantity?: number | null
          product_code?: number | null
          product_id?: string | null
          product_name: string
          quantity?: number
          sale_id: string
          total: number
          total_profit?: number
          unit_price: number
          unit_profit?: number
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          discount_amount?: number
          id?: string
          margin_pct?: number
          markup_pct?: number
          net_total?: number
          packaging_id?: string | null
          packaging_name?: string | null
          packaging_price?: number | null
          packaging_quantity?: number | null
          product_code?: number | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          total?: number
          total_profit?: number
          unit_price?: number
          unit_profit?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "product_packagings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cash_received: number
          cash_session_id: string | null
          change_amount: number
          client_id: string | null
          created_at: string
          date: string
          delivery_address: string | null
          delivery_courier_name: string | null
          delivery_fee: number
          discount: number
          fiscal_customer_document: string | null
          fiscal_customer_name: string | null
          id: string
          is_delivery: boolean
          location_id: string | null
          operator_user_id: string | null
          payment_method: string
          seller_name: string | null
          service_ticket_number: number | null
          status: string
          terminal_id: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_received?: number
          cash_session_id?: string | null
          change_amount?: number
          client_id?: string | null
          created_at?: string
          date?: string
          delivery_address?: string | null
          delivery_courier_name?: string | null
          delivery_fee?: number
          discount?: number
          fiscal_customer_document?: string | null
          fiscal_customer_name?: string | null
          id?: string
          is_delivery?: boolean
          location_id?: string | null
          operator_user_id?: string | null
          payment_method?: string
          seller_name?: string | null
          service_ticket_number?: number | null
          status?: string
          terminal_id?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cash_received?: number
          cash_session_id?: string | null
          change_amount?: number
          client_id?: string | null
          created_at?: string
          date?: string
          delivery_address?: string | null
          delivery_courier_name?: string | null
          delivery_fee?: number
          discount?: number
          fiscal_customer_document?: string | null
          fiscal_customer_name?: string | null
          id?: string
          is_delivery?: boolean
          location_id?: string | null
          operator_user_id?: string | null
          payment_method?: string
          seller_name?: string | null
          service_ticket_number?: number | null
          status?: string
          terminal_id?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "admin_system_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_terminal_id_fkey"
            columns: ["terminal_id"]
            isOneToOne: false
            referencedRelation: "pos_terminals"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ticket_items: {
        Row: {
          added_by_name: string | null
          added_by_user_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by_name: string | null
          cancelled_by_user_id: string | null
          created_at: string
          id: string
          notes: string | null
          owner_user_id: string
          product_id: string | null
          product_name: string
          quantity: number
          status: string
          ticket_id: string
          total: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          added_by_name?: string | null
          added_by_user_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_name?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owner_user_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          status?: string
          ticket_id: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          added_by_name?: string | null
          added_by_user_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by_name?: string | null
          cancelled_by_user_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          owner_user_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          status?: string
          ticket_id?: string
          total?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_ticket_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ticket_items_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_tickets: {
        Row: {
          barcode: string
          closed_at: string | null
          closed_by_name: string | null
          closed_by_user_id: string | null
          closed_sale_id: string | null
          created_at: string
          id: string
          label: string | null
          location_id: string | null
          notes: string | null
          number: number
          opened_at: string | null
          opened_by_name: string | null
          opened_by_user_id: string | null
          owner_user_id: string
          status: string
          updated_at: string
        }
        Insert: {
          barcode: string
          closed_at?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closed_sale_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          location_id?: string | null
          notes?: string | null
          number: number
          opened_at?: string | null
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          owner_user_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          barcode?: string
          closed_at?: string | null
          closed_by_name?: string | null
          closed_by_user_id?: string | null
          closed_sale_id?: string | null
          created_at?: string
          id?: string
          label?: string | null
          location_id?: string | null
          notes?: string | null
          number?: number
          opened_at?: string | null
          opened_by_name?: string | null
          opened_by_user_id?: string | null
          owner_user_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_closed_sale_id_fkey"
            columns: ["closed_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pending_registrations: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string
          complemento: string | null
          completed_at: string | null
          cpf_cnpj: string
          created_at: string
          email: string
          endereco: string
          estado: string
          failure_reason: string | null
          id: string
          legal_acceptance_source: string | null
          lgpd_accepted_at: string | null
          lgpd_version: string | null
          nome_cliente: string
          nome_estabelecimento: string
          nome_rua: string
          numero: string | null
          owner_user_id: string
          privacy_accepted_at: string | null
          privacy_version: string | null
          product_context: string
          setup_config: Json
          status: string
          store_account_id: string | null
          telefone: string
          terms_accepted_at: string | null
          terms_version: string | null
          tipo_estabelecimento: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade: string
          complemento?: string | null
          completed_at?: string | null
          cpf_cnpj: string
          created_at?: string
          email: string
          endereco: string
          estado: string
          failure_reason?: string | null
          id?: string
          legal_acceptance_source?: string | null
          lgpd_accepted_at?: string | null
          lgpd_version?: string | null
          nome_cliente: string
          nome_estabelecimento: string
          nome_rua: string
          numero?: string | null
          owner_user_id: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          product_context?: string
          setup_config?: Json
          status?: string
          store_account_id?: string | null
          telefone: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tipo_estabelecimento: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string
          complemento?: string | null
          completed_at?: string | null
          cpf_cnpj?: string
          created_at?: string
          email?: string
          endereco?: string
          estado?: string
          failure_reason?: string | null
          id?: string
          legal_acceptance_source?: string | null
          lgpd_accepted_at?: string | null
          lgpd_version?: string | null
          nome_cliente?: string
          nome_estabelecimento?: string
          nome_rua?: string
          numero?: string | null
          owner_user_id?: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          product_context?: string
          setup_config?: Json
          status?: string
          store_account_id?: string | null
          telefone?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tipo_estabelecimento?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_pending_registrations_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      site_registration_attempts: {
        Row: {
          created_at: string
          email_hash: string | null
          id: string
          ip_hash: string | null
          origin: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email_hash?: string | null
          id?: string
          ip_hash?: string | null
          origin?: string | null
          status: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email_hash?: string | null
          id?: string
          ip_hash?: string | null
          origin?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          actor_label: string | null
          balance_after: number | null
          balance_before: number | null
          created_at: string
          date: string
          id: string
          location_id: string | null
          operator_user_id: string | null
          product_id: string
          quantity: number
          reason: string
          reference_id: string | null
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_label?: string | null
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          operator_user_id?: string | null
          product_id: string
          quantity: number
          reason?: string
          reference_id?: string | null
          source?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_label?: string | null
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          operator_user_id?: string | null
          product_id?: string
          quantity?: number
          reason?: string
          reference_id?: string | null
          source?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_accounts: {
        Row: {
          bairro: string | null
          block_sale_without_stock: boolean
          cep: string
          cidade: string
          cnpj: string | null
          complemento: string | null
          created_at: string
          desktop_license_key: string
          email: string
          endereco: string
          estado: string
          id: string
          legal_acceptance_source: string | null
          lgpd_accepted_at: string | null
          lgpd_version: string | null
          nome_cliente: string
          nome_estabelecimento: string
          nome_rua: string
          numero: string | null
          owner_user_id: string
          privacy_accepted_at: string | null
          privacy_version: string | null
          product_context: string
          setup_config: Json
          telefone: string
          terms_accepted_at: string | null
          terms_version: string | null
          tipo_estabelecimento: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          block_sale_without_stock?: boolean
          cep: string
          cidade: string
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          desktop_license_key?: string
          email: string
          endereco: string
          estado: string
          id?: string
          legal_acceptance_source?: string | null
          lgpd_accepted_at?: string | null
          lgpd_version?: string | null
          nome_cliente: string
          nome_estabelecimento: string
          nome_rua: string
          numero?: string | null
          owner_user_id: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          product_context?: string
          setup_config?: Json
          telefone: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tipo_estabelecimento: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          block_sale_without_stock?: boolean
          cep?: string
          cidade?: string
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          desktop_license_key?: string
          email?: string
          endereco?: string
          estado?: string
          id?: string
          legal_acceptance_source?: string | null
          lgpd_accepted_at?: string | null
          lgpd_version?: string | null
          nome_cliente?: string
          nome_estabelecimento?: string
          nome_rua?: string
          numero?: string | null
          owner_user_id?: string
          privacy_accepted_at?: string | null
          privacy_version?: string | null
          product_context?: string
          setup_config?: Json
          telefone?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tipo_estabelecimento?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_fiscal_settings: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_street: string | null
          address_zip_code: string | null
          consumer_document_prompt_enabled: boolean
          contingency_offline_enabled: boolean
          created_at: string
          csc_id: string | null
          csc_token: string | null
          danfe_auto_print: boolean
          danfe_message: string | null
          danfe_print_width: string
          danfe_store_locally: boolean
          fiscal_mode: string
          fiscal_provider: string
          id: string
          issuer_city_ibge_code: string | null
          issuer_cnpj: string | null
          issuer_legal_name: string | null
          issuer_state: string
          issuer_state_registration: string | null
          issuer_tax_regime: string | null
          issuer_trade_name: string | null
          nfce_enabled: boolean
          nfce_environment: string
          nfce_next_number: number
          nfce_series: number
          nuvem_fiscal_certificate_synced_at: string | null
          nuvem_fiscal_company_synced_at: string | null
          nuvem_fiscal_last_error: string | null
          nuvem_fiscal_nfce_config_synced_at: string | null
          operation_nature: string | null
          owner_user_id: string
          print_customer_copy: boolean
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          consumer_document_prompt_enabled?: boolean
          contingency_offline_enabled?: boolean
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          danfe_auto_print?: boolean
          danfe_message?: string | null
          danfe_print_width?: string
          danfe_store_locally?: boolean
          fiscal_mode?: string
          fiscal_provider?: string
          id?: string
          issuer_city_ibge_code?: string | null
          issuer_cnpj?: string | null
          issuer_legal_name?: string | null
          issuer_state?: string
          issuer_state_registration?: string | null
          issuer_tax_regime?: string | null
          issuer_trade_name?: string | null
          nfce_enabled?: boolean
          nfce_environment?: string
          nfce_next_number?: number
          nfce_series?: number
          nuvem_fiscal_certificate_synced_at?: string | null
          nuvem_fiscal_company_synced_at?: string | null
          nuvem_fiscal_last_error?: string | null
          nuvem_fiscal_nfce_config_synced_at?: string | null
          operation_nature?: string | null
          owner_user_id: string
          print_customer_copy?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip_code?: string | null
          consumer_document_prompt_enabled?: boolean
          contingency_offline_enabled?: boolean
          created_at?: string
          csc_id?: string | null
          csc_token?: string | null
          danfe_auto_print?: boolean
          danfe_message?: string | null
          danfe_print_width?: string
          danfe_store_locally?: boolean
          fiscal_mode?: string
          fiscal_provider?: string
          id?: string
          issuer_city_ibge_code?: string | null
          issuer_cnpj?: string | null
          issuer_legal_name?: string | null
          issuer_state?: string
          issuer_state_registration?: string | null
          issuer_tax_regime?: string | null
          issuer_trade_name?: string | null
          nfce_enabled?: boolean
          nfce_environment?: string
          nfce_next_number?: number
          nfce_series?: number
          nuvem_fiscal_certificate_synced_at?: string | null
          nuvem_fiscal_company_synced_at?: string | null
          nuvem_fiscal_last_error?: string | null
          nuvem_fiscal_nfce_config_synced_at?: string | null
          operation_nature?: string | null
          owner_user_id?: string
          print_customer_copy?: boolean
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: []
      }
      store_locations: {
        Row: {
          active: boolean
          city: string
          code: string
          complement: string
          created_at: string
          district: string
          document: string
          email: string
          id: string
          is_headquarters: boolean
          location_type: string
          name: string
          owner_user_id: string
          phone: string
          postal_code: string
          state: string
          store_account_id: string
          street: string
          street_number: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string
          code: string
          complement?: string
          created_at?: string
          district?: string
          document?: string
          email?: string
          id?: string
          is_headquarters?: boolean
          location_type?: string
          name: string
          owner_user_id: string
          phone?: string
          postal_code?: string
          state?: string
          store_account_id: string
          street?: string
          street_number?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          code?: string
          complement?: string
          created_at?: string
          district?: string
          document?: string
          email?: string
          id?: string
          is_headquarters?: boolean
          location_type?: string
          name?: string
          owner_user_id?: string
          phone?: string
          postal_code?: string
          state?: string
          store_account_id?: string
          street?: string
          street_number?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_locations_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_providers: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string
          enabled: boolean
          environment: string
          id: string
          provider: string
          public_config: Json
          secret_config_encrypted: string | null
          secret_ref: string | null
          store_account_id: string
          updated_at: string
          webhook_secret_encrypted: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          enabled?: boolean
          environment?: string
          id?: string
          provider: string
          public_config?: Json
          secret_config_encrypted?: string | null
          secret_ref?: string | null
          store_account_id: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string
          enabled?: boolean
          environment?: string
          id?: string
          provider?: string
          public_config?: Json
          secret_config_encrypted?: string | null
          secret_ref?: string | null
          store_account_id?: string
          updated_at?: string
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_providers_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: string
          order_id: string | null
          paid_at: string | null
          payment_group_id: string | null
          provider_id: string
          provider_payload: Json
          provider_transaction_id: string | null
          status: string
          store_account_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          order_id?: string | null
          paid_at?: string | null
          payment_group_id?: string | null
          provider_id: string
          provider_payload?: Json
          provider_transaction_id?: string | null
          status?: string
          store_account_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id?: string | null
          paid_at?: string | null
          payment_group_id?: string | null
          provider_id?: string
          provider_payload?: Json
          provider_transaction_id?: string | null
          status?: string
          store_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "food_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payment_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "store_payment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payment_transactions_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "store_payment_providers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payment_transactions_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          billing_type: string
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          external_reference: string | null
          id: string
          metadata: Json
          owner_user_id: string
          plan_id: string
          price: number
          product_context: string
          provider: string
          provider_payment_id: string | null
          provider_subscription_id: string | null
          status: string
          store_account_id: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          billing_type?: string
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json
          owner_user_id: string
          plan_id: string
          price?: number
          product_context?: string
          provider?: string
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          status: string
          store_account_id: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_type?: string
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          current_period_ends_at?: string | null
          current_period_starts_at?: string | null
          external_reference?: string | null
          id?: string
          metadata?: Json
          owner_user_id?: string
          plan_id?: string
          price?: number
          product_context?: string
          provider?: string
          provider_payment_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          store_account_id?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plan_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          plan_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          plan_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          annual_price: number
          billing_cycle: string
          created_at: string
          currency: string
          description: string
          duration_days: number
          id: string
          is_active: boolean
          is_public: boolean
          name: string
          price: number
          sort_order: number
          trial_hours: number
          updated_at: string
        }
        Insert: {
          annual_price?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string
          duration_days?: number
          id: string
          is_active?: boolean
          is_public?: boolean
          name: string
          price?: number
          sort_order?: number
          trial_hours?: number
          updated_at?: string
        }
        Update: {
          annual_price?: number
          billing_cycle?: string
          created_at?: string
          currency?: string
          description?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          is_public?: boolean
          name?: string
          price?: number
          sort_order?: number
          trial_hours?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean
          contact_name: string
          created_at: string
          delivery_lead_days: number
          document: string
          email: string
          id: string
          minimum_order: number
          name: string
          notes: string
          owner_user_id: string
          payment_terms_days: number
          preferred_transport_company_id: string | null
          updated_at: string
          whatsapp: string
        }
        Insert: {
          active?: boolean
          contact_name?: string
          created_at?: string
          delivery_lead_days?: number
          document?: string
          email?: string
          id?: string
          minimum_order?: number
          name: string
          notes?: string
          owner_user_id: string
          payment_terms_days?: number
          preferred_transport_company_id?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          active?: boolean
          contact_name?: string
          created_at?: string
          delivery_lead_days?: number
          document?: string
          email?: string
          id?: string
          minimum_order?: number
          name?: string
          notes?: string
          owner_user_id?: string
          payment_terms_days?: number
          preferred_transport_company_id?: string | null
          updated_at?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_preferred_transport_company_id_fkey"
            columns: ["preferred_transport_company_id"]
            isOneToOne: false
            referencedRelation: "transport_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      system_account_registry: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          is_demo: boolean
          metadata: Json
          owner_email: string
          owner_user_id: string
          product_context: string
          source: string
          store_account_id: string | null
          store_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string
          id?: string
          is_demo?: boolean
          metadata?: Json
          owner_email: string
          owner_user_id: string
          product_context: string
          source?: string
          store_account_id?: string | null
          store_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          is_demo?: boolean
          metadata?: Json
          owner_email?: string
          owner_user_id?: string
          product_context?: string
          source?: string
          store_account_id?: string | null
          store_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_account_registry_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: true
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_companies: {
        Row: {
          active: boolean
          city: string
          code: string
          complement: string
          contact_name: string
          created_at: string
          district: string
          document: string
          email: string
          id: string
          name: string
          notes: string
          owner_user_id: string
          phone: string
          postal_code: string
          state: string
          state_registration: string
          store_account_id: string
          street: string
          street_number: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string
          code: string
          complement?: string
          contact_name?: string
          created_at?: string
          district?: string
          document?: string
          email?: string
          id?: string
          name: string
          notes?: string
          owner_user_id: string
          phone?: string
          postal_code?: string
          state?: string
          state_registration?: string
          store_account_id: string
          street?: string
          street_number?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          code?: string
          complement?: string
          contact_name?: string
          created_at?: string
          district?: string
          document?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          owner_user_id?: string
          phone?: string
          postal_code?: string
          state?: string
          state_registration?: string
          store_account_id?: string
          street?: string
          street_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_companies_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_system_clients: {
        Row: {
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          client_source: string | null
          created_at: string | null
          deleted: boolean | null
          owner_user_id: string | null
          product_context: string | null
          store_account_email: string | null
          store_account_id: string | null
          store_name: string | null
          system_name: string | null
          updated_at: string | null
        }
        Insert: {
          client_email?: never
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_source?: never
          created_at?: string | null
          deleted?: boolean | null
          owner_user_id?: string | null
          product_context?: never
          store_account_email?: never
          store_account_id?: never
          store_name?: never
          system_name?: never
          updated_at?: string | null
        }
        Update: {
          client_email?: never
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          client_source?: never
          created_at?: string | null
          deleted?: boolean | null
          owner_user_id?: string | null
          product_context?: never
          store_account_email?: never
          store_account_id?: never
          store_name?: never
          system_name?: never
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_system_emails: {
        Row: {
          auth_email: string | null
          created_at: string | null
          current_period_ends_at: string | null
          customer_name: string | null
          is_demo: boolean | null
          owner_email: string | null
          owner_user_id: string | null
          plan_id: string | null
          product_context: string | null
          profile_email: string | null
          profile_role: string | null
          store_account_email: string | null
          store_account_id: string | null
          store_name: string | null
          subscription_status: string | null
          system_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_account_registry_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: true
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_demand_trends: {
        Row: {
          count: number | null
          last_seen: string | null
          state: string | null
          term: string | null
        }
        Relationships: []
      }
      miaifood_public_menu: {
        Row: {
          category: string | null
          city: string | null
          description: string | null
          featured: boolean | null
          image_url: string | null
          menu_id: string | null
          name: string | null
          price: number | null
          product_id: string | null
          restaurant_id: string | null
          restaurant_name: string | null
          segment: string | null
          sort_order: number | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_menu_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_menu_products_store_account_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_providers_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          display_name: string | null
          enabled: boolean | null
          environment: string | null
          id: string | null
          provider: string | null
          public_config: Json | null
          secret_ref: string | null
          store_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          enabled?: boolean | null
          environment?: string | null
          id?: string | null
          provider?: string | null
          public_config?: Json | null
          secret_ref?: string | null
          store_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          display_name?: string | null
          enabled?: boolean | null
          environment?: string | null
          id?: string | null
          provider?: string | null
          public_config?: Json | null
          secret_ref?: string | null
          store_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_providers_store_account_id_fkey"
            columns: ["store_account_id"]
            isOneToOne: false
            referencedRelation: "store_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_delivery_offer: {
        Args: { p_offer_id: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string
          delivery_pin_hash: string | null
          driver_id: string | null
          id: string
          order_id: string
          pickup_address: string
          status: string
          store_account_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      advance_delivery_status: {
        Args: { p_delivery_id: string; p_status: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string
          delivery_pin_hash: string | null
          driver_id: string | null
          id: string
          order_id: string
          pickup_address: string
          status: string
          store_account_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_location_stock_delta: {
        Args: {
          p_delta: number
          p_location_id: string
          p_movement_id: string
          p_movement_type: string
          p_product_id: string
          p_reason: string
          p_reference_id?: string
          p_source?: string
        }
        Returns: {
          actor_label: string | null
          balance_after: number | null
          balance_before: number | null
          created_at: string
          date: string
          id: string
          location_id: string | null
          operator_user_id: string | null
          product_id: string
          quantity: number
          reason: string
          reference_id: string | null
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_pricing_rounding: {
        Args: { raw_value: number; rounding_rule: string }
        Returns: number
      }
      apply_stock_delta: {
        Args: {
          p_delta: number
          p_movement_id: string
          p_movement_type: string
          p_product_id: string
          p_reason: string
          p_reference_id?: string
          p_source?: string
        }
        Returns: {
          actor_label: string | null
          balance_after: number | null
          balance_before: number | null
          created_at: string
          date: string
          id: string
          location_id: string | null
          operator_user_id: string | null
          product_id: string
          quantity: number
          reason: string
          reference_id: string | null
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_purchase_order: {
        Args: { p_notes?: string; p_order_id: string }
        Returns: {
          approval_notes: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          divergence_status: string
          due_date: string | null
          freight_amount: number
          id: string
          invoice_number: string
          last_divergence_note: string
          location_id: string | null
          notes: string
          owner_user_id: string
          purchase_date: string
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name: string
          tax_amount: number
          total_amount: number
          transport_company_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_internal_chat_group: {
        Args: { p_archive?: boolean; p_conversation_id: string }
        Returns: undefined
      }
      close_food_table_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      confirm_delivery_pin: {
        Args: { p_delivery_id: string; p_pin: string }
        Returns: {
          accepted_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          delivered_at: string | null
          delivery_address: string
          delivery_pin_hash: string | null
          driver_id: string | null
          id: string
          order_id: string
          pickup_address: string
          status: string
          store_account_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_customer_order_feedback: {
        Args: {
          p_customer_name?: string
          p_food_comment?: string
          p_food_rating: number
          p_is_anonymous?: boolean
          p_order_id: string
          p_waiter_comment?: string
          p_waiter_name?: string
          p_waiter_rating?: number
        }
        Returns: string
      }
      create_customer_order_issue: {
        Args: {
          p_description: string
          p_issue_type: string
          p_order_id: string
        }
        Returns: string
      }
      create_internal_chat_group: {
        Args: { p_member_ids?: string[]; p_name: string }
        Returns: string
      }
      create_split_payment_group: {
        Args: { p_order_id: string; p_parts: Json }
        Returns: string
      }
      create_store_payment_transaction: {
        Args: {
          p_amount: number
          p_method?: string
          p_order_id: string
          p_provider: string
        }
        Returns: string
      }
      current_store_blocks_sale_without_stock: { Args: never; Returns: boolean }
      current_store_has_feature: {
        Args: { target_feature: string }
        Returns: boolean
      }
      current_user_has_erp_permission: {
        Args: { target_permission_key: string }
        Returns: boolean
      }
      current_user_is_admin: { Args: never; Returns: boolean }
      delete_internal_chat_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      delete_internal_chat_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      delete_pos_terminal_operationally: {
        Args: { target_terminal_id: string }
        Returns: Json
      }
      delete_store_location_operationally: {
        Args: { target_location_id: string }
        Returns: Json
      }
      discard_product_batch: {
        Args: { p_adjust_stock?: boolean; p_batch_id: string }
        Returns: Json
      }
      ensure_default_erp_permission_groups: {
        Args: { target_owner_user_id: string }
        Returns: undefined
      }
      ensure_internal_direct_conversation: {
        Args: { p_target_user_id: string }
        Returns: string
      }
      ensure_store_account_headquarters: {
        Args: { p_store_account_id: string }
        Returns: string
      }
      erp_add_debt_entries_atomic: {
        Args: {
          p_adjust_stock?: boolean
          p_entries: Json
          p_location_id?: string
          p_reason?: string
        }
        Returns: Json
      }
      erp_apply_product_stock: {
        Args: {
          target_delta: number
          target_location_id: string
          target_product_id: string
          target_reason: string
          target_reference_id: string
          target_source: string
          target_type: string
        }
        Returns: {
          actor_label: string | null
          balance_after: number | null
          balance_before: number | null
          created_at: string
          date: string
          id: string
          location_id: string | null
          operator_user_id: string | null
          product_id: string
          quantity: number
          reason: string
          reference_id: string | null
          source: string
          type: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "stock_movements"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      erp_cancel_sale_atomic: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: Json
      }
      erp_close_cash_session_atomic: {
        Args: {
          p_counted: number
          p_expected: number
          p_reason?: string
          p_session_id: string
        }
        Returns: {
          closed_at: string | null
          closed_by_name: string | null
          closed_by_user_id: string | null
          closing_balance: number | null
          closing_difference: number | null
          counted_balance: number | null
          created_at: string
          difference_reason: string | null
          expected_balance: number | null
          id: string
          location_id: string | null
          opened_at: string
          opened_by_name: string
          opening_amount: number
          operator_name: string
          operator_user_id: string
          owner_user_id: string
          status: string
          terminal_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      erp_create_sale_atomic: {
        Args: { p_items: Json; p_sale: Json }
        Returns: Json
      }
      erp_operational_location: {
        Args: { target_location_id: string }
        Returns: {
          active: boolean
          city: string
          code: string
          complement: string
          created_at: string
          district: string
          document: string
          email: string
          id: string
          is_headquarters: boolean
          location_type: string
          name: string
          owner_user_id: string
          phone: string
          postal_code: string
          state: string
          store_account_id: string
          street: string
          street_number: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "store_locations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      erp_user_has_permission: {
        Args: { target_permission_key: string; target_user_id: string }
        Returns: boolean
      }
      food_can_operate_orders: { Args: never; Returns: boolean }
      food_can_view: { Args: never; Returns: boolean }
      food_current_scope_matches: {
        Args: { row_account: string; row_owner: string }
        Returns: boolean
      }
      generate_store_desktop_license_key: { Args: never; Returns: string }
      get_current_desktop_operational_scope: {
        Args: { target_installation_id: string }
        Returns: {
          is_headquarters: boolean
          location_code: string
          location_id: string
          location_name: string
          location_type: string
          terminal_code: string
          terminal_id: string
          terminal_name: string
          terminal_type: string
        }[]
      }
      get_current_store_account_id: { Args: never; Returns: string }
      get_current_store_account_id_for_context: {
        Args: { target_product_context: string }
        Returns: string
      }
      get_current_store_owner_id: { Args: never; Returns: string }
      get_current_store_plan_id: { Args: never; Returns: string }
      get_current_store_product_context: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_internal_chat_context: {
        Args: never
        Returns: {
          owner_user_id: string
          store_account_id: string
        }[]
      }
      get_my_erp_permissions: {
        Args: never
        Returns: {
          allowed: boolean
          permission_key: string
          runtime_scope: string
        }[]
      }
      get_my_internal_chat_unread_count: { Args: never; Returns: number }
      get_staff_erp_permissions: {
        Args: { target_user_id: string }
        Returns: {
          description: string
          effective_allowed: boolean
          module_key: string
          name: string
          override_allowed: boolean
          permission_key: string
          runtime_scope: string
        }[]
      }
      get_store_data_sync_state: {
        Args: { p_location_id?: string }
        Returns: {
          last_changed_at: string
          module: string
          row_count: number
          signature: string
        }[]
      }
      get_store_operational_settings: {
        Args: never
        Returns: {
          block_sale_without_stock: boolean
        }[]
      }
      get_store_receipt_profile: {
        Args: never
        Returns: {
          address: string
          phone: string
          store_name: string
          tax_id: string
        }[]
      }
      happycash_normalized_person_name: {
        Args: { value: string }
        Returns: string
      }
      internal_chat_can_manage_group: {
        Args: { p_permission_key: string }
        Returns: boolean
      }
      internal_chat_is_owner: {
        Args: { p_store_account_id: string }
        Returns: boolean
      }
      internal_chat_user_is_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      list_internal_chat_audit: {
        Args: { p_conversation_id: string }
        Returns: {
          action: string
          actor_name: string
          created_at: string
          id: string
          metadata: Json
        }[]
      }
      list_internal_chat_contacts: {
        Args: never
        Returns: {
          display_name: string
          photo_url: string
          role_label: string
          user_id: string
        }[]
      }
      list_internal_chat_group_members: {
        Args: { p_conversation_id: string }
        Returns: {
          name: string
          photo_url: string
          user_id: string
        }[]
      }
      list_internal_chat_messages: {
        Args: { p_conversation_id: string }
        Returns: {
          body: string
          conversation_id: string
          created_at: string
          deleted_at: string
          id: string
          read_by_all: boolean
          sender_user_id: string
        }[]
      }
      list_my_internal_chat_conversations: {
        Args: never
        Returns: {
          archived_at: string
          id: string
          kind: string
          name: string
          peer_name: string
          peer_photo_url: string
          peer_role_label: string
          peer_user_id: string
          photo_url: string
          updated_at: string
        }[]
      }
      open_food_table_session: {
        Args: { p_guest_count?: number; p_notes?: string; p_table_id: string }
        Returns: {
          closed_at: string | null
          closed_by_user_id: string | null
          created_at: string
          guest_count: number | null
          id: string
          location_id: string
          notes: string
          opened_at: string
          opened_by_user_id: string | null
          owner_user_id: string
          service_ticket_id: string | null
          status: string
          store_account_id: string
          table_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "food_table_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalculate_sale_financials: {
        Args: { target_sale_id: string }
        Returns: undefined
      }
      receive_purchase_order: {
        Args: {
          p_create_payable?: boolean
          p_divergence_note?: string
          p_due_date?: string
          p_order_id: string
          p_receipts: Json
        }
        Returns: {
          approval_notes: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          divergence_status: string
          due_date: string | null
          freight_amount: number
          id: string
          invoice_number: string
          last_divergence_note: string
          location_id: string | null
          notes: string
          owner_user_id: string
          purchase_date: string
          received_at: string | null
          status: string
          subtotal: number
          supplier_id: string | null
          supplier_name: string
          tax_amount: number
          total_amount: number
          transport_company_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "purchase_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_food_table_payment_splits: {
        Args: { p_people_count: number; p_table_session_id: string }
        Returns: {
          amount_due: number
          amount_paid: number
          created_at: string
          id: string
          location_id: string
          owner_user_id: string
          paid_at: string | null
          payment_method: string | null
          person_number: number
          status: string
          store_account_id: string
          table_session_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "food_table_payment_splits"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      replace_product_packagings: {
        Args: { target_items: Json; target_product_id: string }
        Returns: {
          active: boolean
          auto_apply: boolean
          barcode: string
          base_quantity: number
          closed_only: boolean
          created_at: string
          id: string
          name: string
          owner_user_id: string
          product_id: string
          purchase_cost: number
          sale_price: number
          store_account_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_packagings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      replace_product_price_table_items: {
        Args: { target_items?: Json; target_product_id: string }
        Returns: undefined
      }
      report_delivery_incident: {
        Args: { p_delivery_id: string; p_note?: string; p_reason: string }
        Returns: {
          created_at: string
          delivery_id: string
          id: string
          note: string
          reason: string
          reporter_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "delivery_incidents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_food_table_bill: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      set_internal_chat_group_members: {
        Args: { p_conversation_id: string; p_member_ids: string[] }
        Returns: undefined
      }
      set_staff_erp_permission_override: {
        Args: {
          target_allowed: boolean
          target_permission_key: string
          target_user_id: string
        }
        Returns: undefined
      }
      start_miaifood_one_month_trial: {
        Args: { p_plan_id: string; p_store_account_id: string }
        Returns: {
          billing_type: string
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          current_period_ends_at: string | null
          current_period_starts_at: string | null
          external_reference: string | null
          id: string
          metadata: Json
          owner_user_id: string
          plan_id: string
          price: number
          product_context: string
          provider: string
          provider_payment_id: string | null
          provider_subscription_id: string | null
          status: string
          store_account_id: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "store_subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_authenticated_food_order: {
        Args: {
          p_customer_name?: string
          p_customer_phone?: string
          p_delivery_address?: string
          p_items: Json
          p_location_id: string
          p_source?: string
          p_store_account_id: string
        }
        Returns: string
      }
      submit_food_order: {
        Args: {
          p_customer_name?: string
          p_customer_phone?: string
          p_items: Json
          p_table_session_id: string
        }
        Returns: string
      }
      submit_food_order_for_guest: {
        Args: {
          p_customer_name?: string
          p_customer_phone?: string
          p_guest_session_id: string
          p_items: Json
        }
        Returns: string
      }
      submit_marketplace_food_order: {
        Args: {
          p_customer_name?: string
          p_customer_phone?: string
          p_delivery_address?: string
          p_items: Json
          p_source?: string
          p_store_account_id: string
        }
        Returns: string
      }
      transfer_location_stock: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_reason?: string
          p_source_location_id: string
          p_target_location_id: string
        }
        Returns: string
      }
      update_internal_chat_group: {
        Args: {
          p_clear_photo?: boolean
          p_conversation_id: string
          p_name?: string
          p_photo_url?: string
        }
        Returns: undefined
      }
      update_internal_chat_message: {
        Args: { p_body: string; p_message_id: string }
        Returns: undefined
      }
      update_my_hr_profile: {
        Args: {
          target_address_city: string
          target_address_complement: string
          target_address_neighborhood: string
          target_address_number: string
          target_address_state: string
          target_address_street: string
          target_address_zip_code: string
          target_email: string
          target_emergency_contact_phone: string
          target_phone: string
          target_photo_url: string
          target_preferred_name: string
        }
        Returns: undefined
      }
      update_my_internal_chat_avatar: {
        Args: { p_avatar_url: string }
        Returns: undefined
      }
      update_store_operational_settings: {
        Args: { p_block_sale_without_stock: boolean }
        Returns: {
          block_sale_without_stock: boolean
        }[]
      }
      update_store_payment_transaction_status: {
        Args: {
          p_payload?: Json
          p_provider_transaction_id?: string
          p_status: string
          p_transaction_id: string
        }
        Returns: boolean
      }
      upsert_store_payment_provider_secret: {
        Args: {
          p_display_name: string
          p_enabled: boolean
          p_encryption_key: string
          p_environment: string
          p_provider: string
          p_public_config: Json
          p_secret_config: string
          p_store_account_id: string
        }
        Returns: string
      }
      verify_admin_password_for_owner: {
        Args: {
          target_email: string
          target_owner_user_id: string
          target_password: string
        }
        Returns: string
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
