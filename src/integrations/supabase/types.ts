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
      ad_accounts: {
        Row: {
          access_token: string | null
          account_id: string
          account_name: string | null
          active: boolean
          amount_spent_cents: number | null
          balance_cents: number | null
          balance_synced_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          funding_type: string | null
          id: string
          last_low_balance_days: number | null
          last_sync_at: string | null
          last_sync_error: string | null
          low_balance_days_threshold: number
          low_balance_notified_at: string | null
          provider: string
          refresh_token: string | null
          spend_cap_cents: number | null
          tax_rate: number
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          account_name?: string | null
          active?: boolean
          amount_spent_cents?: number | null
          balance_cents?: number | null
          balance_synced_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          funding_type?: string | null
          id?: string
          last_low_balance_days?: number | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          low_balance_days_threshold?: number
          low_balance_notified_at?: string | null
          provider: string
          refresh_token?: string | null
          spend_cap_cents?: number | null
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          account_name?: string | null
          active?: boolean
          amount_spent_cents?: number | null
          balance_cents?: number | null
          balance_synced_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          funding_type?: string | null
          id?: string
          last_low_balance_days?: number | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          low_balance_days_threshold?: number
          low_balance_notified_at?: string | null
          provider?: string
          refresh_token?: string | null
          spend_cap_cents?: number | null
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_billing_transactions: {
        Row: {
          ad_account_id: string
          amount_cents: number
          billing_end_time: string | null
          billing_start_time: string | null
          charge_type: string | null
          created_at: string
          currency: string | null
          id: string
          net_cents: number
          payment_option: string | null
          product_type: string | null
          raw: Json | null
          status: string | null
          transaction_id: string
          updated_at: string
          vat_cents: number
        }
        Insert: {
          ad_account_id: string
          amount_cents?: number
          billing_end_time?: string | null
          billing_start_time?: string | null
          charge_type?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          net_cents?: number
          payment_option?: string | null
          product_type?: string | null
          raw?: Json | null
          status?: string | null
          transaction_id: string
          updated_at?: string
          vat_cents?: number
        }
        Update: {
          ad_account_id?: string
          amount_cents?: number
          billing_end_time?: string | null
          billing_start_time?: string | null
          charge_type?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          net_cents?: number
          payment_option?: string | null
          product_type?: string | null
          raw?: Json | null
          status?: string | null
          transaction_id?: string
          updated_at?: string
          vat_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_billing_transactions_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaign_insights: {
        Row: {
          ad_account_id: string
          campaign_id: string
          campaign_name: string | null
          clicks: number
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number
          raw: Json | null
          reach: number
          results: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          campaign_id: string
          campaign_name?: string | null
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number
          raw?: Json | null
          reach?: number
          results?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number
          raw?: Json | null
          reach?: number
          results?: number
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_creatives: {
        Row: {
          ad_account_id: string
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number
          cost_per_initiate_checkout: number | null
          cost_per_landing_page_view: number | null
          cost_per_purchase: number | null
          cpc: number | null
          cpm: number | null
          cpp: number | null
          created_at: string
          ctr: number | null
          destination_url: string | null
          external_id: string
          frequency: number | null
          id: string
          impressions: number
          initiate_checkout: number
          initiate_checkout_value: number
          landing_page_views: number
          last_sync_at: string | null
          messaging_conversations_started: number
          name: string | null
          preview_url: string | null
          purchase_value: number
          purchases: number
          raw: Json | null
          reach: number
          results: number
          roas: number | null
          spend: number
          status: string | null
          thumbnail_url: string | null
          unique_link_clicks: number
          unique_link_cpc: number | null
          unique_link_ctr: number | null
          unique_outbound_clicks: number
          unique_outbound_cpc: number | null
          unique_outbound_ctr: number | null
          updated_at: string
          video_p3s: number
          video_p75: number
          video_plays: number
        }
        Insert: {
          ad_account_id: string
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          cost_per_initiate_checkout?: number | null
          cost_per_landing_page_view?: number | null
          cost_per_purchase?: number | null
          cpc?: number | null
          cpm?: number | null
          cpp?: number | null
          created_at?: string
          ctr?: number | null
          destination_url?: string | null
          external_id: string
          frequency?: number | null
          id?: string
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          landing_page_views?: number
          last_sync_at?: string | null
          messaging_conversations_started?: number
          name?: string | null
          preview_url?: string | null
          purchase_value?: number
          purchases?: number
          raw?: Json | null
          reach?: number
          results?: number
          roas?: number | null
          spend?: number
          status?: string | null
          thumbnail_url?: string | null
          unique_link_clicks?: number
          unique_link_cpc?: number | null
          unique_link_ctr?: number | null
          unique_outbound_clicks?: number
          unique_outbound_cpc?: number | null
          unique_outbound_ctr?: number | null
          updated_at?: string
          video_p3s?: number
          video_p75?: number
          video_plays?: number
        }
        Update: {
          ad_account_id?: string
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number
          cost_per_initiate_checkout?: number | null
          cost_per_landing_page_view?: number | null
          cost_per_purchase?: number | null
          cpc?: number | null
          cpm?: number | null
          cpp?: number | null
          created_at?: string
          ctr?: number | null
          destination_url?: string | null
          external_id?: string
          frequency?: number | null
          id?: string
          impressions?: number
          initiate_checkout?: number
          initiate_checkout_value?: number
          landing_page_views?: number
          last_sync_at?: string | null
          messaging_conversations_started?: number
          name?: string | null
          preview_url?: string | null
          purchase_value?: number
          purchases?: number
          raw?: Json | null
          reach?: number
          results?: number
          roas?: number | null
          spend?: number
          status?: string | null
          thumbnail_url?: string | null
          unique_link_clicks?: number
          unique_link_cpc?: number | null
          unique_link_ctr?: number | null
          unique_outbound_clicks?: number
          unique_outbound_cpc?: number | null
          unique_outbound_ctr?: number | null
          updated_at?: string
          video_p3s?: number
          video_p75?: number
          video_plays?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_funnel_whatsapp: {
        Row: {
          ad_account_id: string
          conversations_started: number
          created_at: string
          date: string
          first_replies: number
          id: string
          impressions: number
          link_clicks: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          conversations_started?: number
          created_at?: string
          date: string
          first_replies?: number
          id?: string
          impressions?: number
          link_clicks?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          conversations_started?: number
          created_at?: string
          date?: string
          first_replies?: number
          id?: string
          impressions?: number
          link_clicks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_funnel_whatsapp_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_geo: {
        Row: {
          ad_account_id: string
          city: string | null
          clicks: number
          country_code: string
          country_name: string | null
          created_at: string
          id: string
          impressions: number
          period_end: string
          period_start: string
          reach: number
          region: string | null
          region_name: string | null
          results: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          city?: string | null
          clicks?: number
          country_code: string
          country_name?: string | null
          created_at?: string
          id?: string
          impressions?: number
          period_end: string
          period_start: string
          reach?: number
          region?: string | null
          region_name?: string | null
          results?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          city?: string | null
          clicks?: number
          country_code?: string
          country_name?: string | null
          created_at?: string
          id?: string
          impressions?: number
          period_end?: string
          period_start?: string
          reach?: number
          region?: string | null
          region_name?: string | null
          results?: number
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_geo_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_hourly_leads: {
        Row: {
          ad_account_id: string
          clicks: number
          created_at: string
          date: string
          dow: number
          hour: number
          id: string
          impressions: number
          results: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          clicks?: number
          created_at?: string
          date: string
          dow: number
          hour: number
          id?: string
          impressions?: number
          results?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          clicks?: number
          created_at?: string
          date?: string
          dow?: number
          hour?: number
          id?: string
          impressions?: number
          results?: number
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_hourly_leads_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_insights: {
        Row: {
          ad_account_id: string
          clicks: number
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number
          raw: Json | null
          reach: number
          results: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number
          raw?: Json | null
          reach?: number
          results?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number
          raw?: Json | null
          reach?: number
          results?: number
          spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          agency_logo_url: string | null
          agency_name: string | null
          agency_primary_color: string | null
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          agency_logo_url?: string | null
          agency_name?: string | null
          agency_primary_color?: string | null
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          agency_logo_url?: string | null
          agency_name?: string | null
          agency_primary_color?: string | null
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      channel_members: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          last_read_at: string | null
          role: Database["public"]["Enums"]["channel_member_role"]
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["channel_member_role"]
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["channel_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          squad_id: string | null
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          squad_id?: string | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          squad_id?: string | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_access: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          login_url: string | null
          notes: string | null
          password: string | null
          platform: string
          updated_at: string
          username: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          login_url?: string | null
          notes?: string | null
          password?: string | null
          platform: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          login_url?: string | null
          notes?: string | null
          password?: string | null
          platform?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_activities: {
        Row: {
          action: string
          client_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_stages: {
        Row: {
          client_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          client_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          client_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_stages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reports: {
        Row: {
          ai_content: string | null
          ai_generated_at: string | null
          ai_model: string | null
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          title: string
          url: string | null
        }
        Insert: {
          ai_content?: string | null
          ai_generated_at?: string | null
          ai_model?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          title: string
          url?: string | null
        }
        Update: {
          ai_content?: string | null
          ai_generated_at?: string | null
          ai_model?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_routines: {
        Row: {
          active: boolean
          assignee_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          day_of_month: number | null
          day_of_week: number | null
          description: string | null
          frequency: string
          id: string
          last_generated: string | null
          title: string
        }
        Insert: {
          active?: boolean
          assignee_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          last_generated?: string | null
          title: string
        }
        Update: {
          active?: boolean
          assignee_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          day_of_week?: number | null
          description?: string | null
          frequency?: string
          id?: string
          last_generated?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_routines_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_routines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_routines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sales: {
        Row: {
          agendamentos: number
          client_id: string
          created_at: string
          created_by: string | null
          faturamento: number
          hour: number | null
          id: string
          leads: number
          notes: string | null
          ref_date: string
          updated_at: string
          vendas: number
          weekday: number | null
        }
        Insert: {
          agendamentos?: number
          client_id: string
          created_at?: string
          created_by?: string | null
          faturamento?: number
          hour?: number | null
          id?: string
          leads?: number
          notes?: string | null
          ref_date: string
          updated_at?: string
          vendas?: number
          weekday?: number | null
        }
        Update: {
          agendamentos?: number
          client_id?: string
          created_at?: string
          created_by?: string | null
          faturamento?: number
          hour?: number | null
          id?: string
          leads?: number
          notes?: string | null
          ref_date?: string
          updated_at?: string
          vendas?: number
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          brand_anniversary: string | null
          city_uf: string | null
          codigo: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string
          created_by: string | null
          cs_user_id: string | null
          id: string
          instagram: string | null
          investimento_mensal: number | null
          launch_commission_pct: number | null
          logo_url: string | null
          monthly_fee_amount: number | null
          monthly_fee_day: number | null
          name: string
          niche: string | null
          niche_id: string | null
          notes: string | null
          onboarding_template_id: string | null
          optimization_frequency: string | null
          performance_user_id: string | null
          plan_id: string | null
          platform: string | null
          primeiro_vencimento: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          site: string | null
          squad_id: string | null
          status: Database["public"]["Enums"]["client_status"]
          tempo_contrato_meses: number | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          brand_anniversary?: string | null
          city_uf?: string | null
          codigo?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          cs_user_id?: string | null
          id?: string
          instagram?: string | null
          investimento_mensal?: number | null
          launch_commission_pct?: number | null
          logo_url?: string | null
          monthly_fee_amount?: number | null
          monthly_fee_day?: number | null
          name: string
          niche?: string | null
          niche_id?: string | null
          notes?: string | null
          onboarding_template_id?: string | null
          optimization_frequency?: string | null
          performance_user_id?: string | null
          plan_id?: string | null
          platform?: string | null
          primeiro_vencimento?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          site?: string | null
          squad_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tempo_contrato_meses?: number | null
          type: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          brand_anniversary?: string | null
          city_uf?: string | null
          codigo?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          created_by?: string | null
          cs_user_id?: string | null
          id?: string
          instagram?: string | null
          investimento_mensal?: number | null
          launch_commission_pct?: number | null
          logo_url?: string | null
          monthly_fee_amount?: number | null
          monthly_fee_day?: number | null
          name?: string
          niche?: string | null
          niche_id?: string | null
          notes?: string | null
          onboarding_template_id?: string | null
          optimization_frequency?: string | null
          performance_user_id?: string | null
          plan_id?: string | null
          platform?: string | null
          primeiro_vencimento?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          site?: string | null
          squad_id?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          tempo_contrato_meses?: number | null
          type?: Database["public"]["Enums"]["client_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_cs_user_id_fkey"
            columns: ["cs_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_onboarding_template_id_fkey"
            columns: ["onboarding_template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_performance_user_id_fkey"
            columns: ["performance_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          created_at: string
          id: string
          label: string | null
          max_revenue: number | null
          min_revenue: number
          pct: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          max_revenue?: number | null
          min_revenue?: number
          pct: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          max_revenue?: number | null
          min_revenue?: number
          pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          parent_id: string | null
          recurrence: Database["public"]["Enums"]["expense_recurrence"]
          recurrence_day: number | null
          status: Database["public"]["Enums"]["expense_status"]
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          parent_id?: string | null
          recurrence?: Database["public"]["Enums"]["expense_recurrence"]
          recurrence_day?: number | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          parent_id?: string | null
          recurrence?: Database["public"]["Enums"]["expense_recurrence"]
          recurrence_day?: number | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      health_scores: {
        Row: {
          client_id: string
          id: string
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          score: number
        }
        Insert: {
          client_id: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          score: number
        }
        Update: {
          client_id?: string
          id?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_scores_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendees: string | null
          client_id: string
          created_at: string
          created_by: string | null
          drive_url: string | null
          held_at: string
          id: string
          notes: string | null
          recording_url: string | null
          title: string
          transcript: string | null
        }
        Insert: {
          attendees?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          held_at?: string
          id?: string
          notes?: string | null
          recording_url?: string | null
          title: string
          transcript?: string | null
        }
        Update: {
          attendees?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          drive_url?: string | null
          held_at?: string
          id?: string
          notes?: string | null
          recording_url?: string | null
          title?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_kind: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          attachment_url: string | null
          author_id: string | null
          body: string | null
          channel_id: string
          created_at: string
          edited_at: string | null
          id: string
          parent_id: string | null
          task_id: string | null
        }
        Insert: {
          attachment_kind?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          author_id?: string | null
          body?: string | null
          channel_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          task_id?: string | null
        }
        Update: {
          attachment_kind?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          attachment_url?: string | null
          author_id?: string | null
          body?: string | null
          channel_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          parent_id?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_fees: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number | null
          paid_at: string | null
          reference_month: string
          status: Database["public"]["Enums"]["fee_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          reference_month: string
          status?: Database["public"]["Enums"]["fee_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          reference_month?: string
          status?: Database["public"]["Enums"]["fee_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      moodboards: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          title: string
          url: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          title: string
          url?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moodboards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moodboards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      niches: {
        Row: {
          created_at: string
          id: string
          name: string
          sigla: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sigla?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sigla?: string | null
        }
        Relationships: []
      }
      nps_responses: {
        Row: {
          client_id: string
          comment: string | null
          created_at: string
          created_by: string | null
          id: string
          period: string | null
          respondent: string | null
          score: number
        }
        Insert: {
          client_id: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          period?: string | null
          respondent?: string | null
          score: number
        }
        Update: {
          client_id?: string
          comment?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          period?: string | null
          respondent?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_survey_responses: {
        Row: {
          answers: Json
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          respondent_email: string | null
          respondent_name: string | null
          score: number | null
          survey_id: string
        }
        Insert: {
          answers?: Json
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          score?: number | null
          survey_id: string
        }
        Update: {
          answers?: Json
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          score?: number | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_survey_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "nps_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_surveys: {
        Row: {
          active: boolean
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          public_token: string
          questions: Json
          ref_month: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          public_token?: string
          questions?: Json
          ref_month?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          public_token?: string
          questions?: Json
          ref_month?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignee_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          done: boolean
          done_at: string | null
          id: string
          position: number
          stage_id: string | null
          title: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: string
          position?: number
          stage_id?: string | null
          title: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignee_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          done?: boolean
          done_at?: string | null
          id?: string
          position?: number
          stage_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "client_onboarding_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_template_stages: {
        Row: {
          id: string
          name: string
          position: number
          prazo_dias: number | null
          template_id: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          prazo_dias?: number | null
          template_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          prazo_dias?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_template_tasks: {
        Row: {
          description: string | null
          id: string
          position: number
          prazo_dias: number | null
          stage_id: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          position?: number
          prazo_dias?: number | null
          stage_id: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          position?: number
          prazo_dias?: number | null
          stage_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_template_tasks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "onboarding_template_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          niche_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          niche_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          niche_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_templates_niche_id_fkey"
            columns: ["niche_id"]
            isOneToOne: false
            referencedRelation: "niches"
            referencedColumns: ["id"]
          },
        ]
      }
      pda_action_steps: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          pda_id: string
          position: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          pda_id: string
          position?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          pda_id?: string
          position?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pda_action_steps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pda_action_steps_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pda_action_steps_pda_id_fkey"
            columns: ["pda_id"]
            isOneToOne: false
            referencedRelation: "pdas"
            referencedColumns: ["id"]
          },
        ]
      }
      pdas: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          amount: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admissao: string | null
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          nivel: string | null
          obrigacoes: Json
          salario: number | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          admissao?: string | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          nivel?: string | null
          obrigacoes?: Json
          salario?: number | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          admissao?: string | null
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          nivel?: string | null
          obrigacoes?: Json
          salario?: number | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_reports: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          created_by: string | null
          default_period: string
          expires_at: string | null
          id: string
          password_hash: string | null
          title: string | null
          token: string
          updated_at: string
          view_count: number
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          created_by?: string | null
          default_period?: string
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          title?: string | null
          token: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          created_by?: string | null
          default_period?: string
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          title?: string | null
          token?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      role_analises: {
        Row: {
          analise: string
          created_at: string
          id: string
          ordem: number
          template_id: string
        }
        Insert: {
          analise: string
          created_at?: string
          id?: string
          ordem?: number
          template_id: string
        }
        Update: {
          analise?: string
          created_at?: string
          id?: string
          ordem?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_analises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_attribuicoes: {
        Row: {
          created_at: string
          descricao: string
          id: string
          ordem: number
          template_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          template_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_attribuicoes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_kpis: {
        Row: {
          created_at: string
          id: string
          kpi: string
          ordem: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kpi: string
          ordem?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kpi?: string
          ordem?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_kpis_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_reunioes: {
        Row: {
          created_at: string
          id: string
          ordem: number
          periodicidade: string
          template_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          periodicidade: string
          template_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          periodicidade?: string
          template_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_reunioes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_rotinas: {
        Row: {
          created_at: string
          entregavel: boolean
          entregavel_desc: string | null
          id: string
          ordem: number
          periodicidade: string
          tarefa: string
          template_id: string
        }
        Insert: {
          created_at?: string
          entregavel?: boolean
          entregavel_desc?: string | null
          id?: string
          ordem?: number
          periodicidade: string
          tarefa: string
          template_id: string
        }
        Update: {
          created_at?: string
          entregavel?: boolean
          entregavel_desc?: string | null
          id?: string
          ordem?: number
          periodicidade?: string
          tarefa?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_rotinas_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "role_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          cargo: string
          created_at: string
          descricao: string | null
          id: string
          nivel: string | null
          updated_at: string
        }
        Insert: {
          cargo: string
          created_at?: string
          descricao?: string | null
          id?: string
          nivel?: string | null
          updated_at?: string
        }
        Update: {
          cargo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nivel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      squad_members: {
        Row: {
          created_at: string
          id: string
          role: string
          squad_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          squad_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          squad_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_members_squad_id_fkey"
            columns: ["squad_id"]
            isOneToOne: false
            referencedRelation: "squads"
            referencedColumns: ["id"]
          },
        ]
      }
      squads: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          head_user_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_checklist_items: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklist_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          author_id: string | null
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          done_at: string | null
          due_date: string | null
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          done_at?: string | null
          due_date?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      generate_client_code: {
        Args: { _at?: string; _niche_id: string }
        Returns: string
      }
      get_employee_hr: {
        Args: { _user_id: string }
        Returns: {
          admissao: string
          cargo: string
          email: string
          full_name: string
          nivel: string
          obrigacoes: Json
          salario: number
          user_id: string
        }[]
      }
      get_public_report_payload: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_admin: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _uid?: string }; Returns: boolean }
      list_employees_hr: {
        Args: never
        Returns: {
          admissao: string
          cargo: string
          email: string
          full_name: string
          nivel: string
          obrigacoes: Json
          salario: number
          user_id: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_employee_hr: {
        Args: {
          _admissao: string
          _cargo: string
          _nivel: string
          _obrigacoes: Json
          _salario: number
          _user_id: string
        }
        Returns: undefined
      }
      user_can_see_client: {
        Args: { _client_id: string; _user_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor"
        | "operacional"
        | "financeiro"
        | "superadmin"
        | "head_conta"
        | "gestor_trafego_junior"
        | "gestor_trafego_senior"
        | "especialista_performance"
        | "sucesso_cliente"
      channel_member_role: "admin" | "member"
      channel_type: "public" | "private" | "dm" | "client" | "squad"
      client_status: "ativo" | "pausado" | "churn" | "onboarding"
      client_type: "local" | "perpetuo" | "autoria" | "lancamento"
      expense_recurrence: "none" | "monthly" | "annual"
      expense_status: "pendente" | "pago" | "atrasado" | "cancelado"
      fee_status: "pendente" | "pago" | "atrasado" | "cancelado"
      task_kind: "kickoff" | "rotina" | "demanda" | "auditoria"
      task_priority: "baixa" | "media" | "alta" | "urgente"
      task_status: "todo" | "doing" | "review" | "done"
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
      app_role: [
        "admin",
        "gestor",
        "operacional",
        "financeiro",
        "superadmin",
        "head_conta",
        "gestor_trafego_junior",
        "gestor_trafego_senior",
        "especialista_performance",
        "sucesso_cliente",
      ],
      channel_member_role: ["admin", "member"],
      channel_type: ["public", "private", "dm", "client", "squad"],
      client_status: ["ativo", "pausado", "churn", "onboarding"],
      client_type: ["local", "perpetuo", "autoria", "lancamento"],
      expense_recurrence: ["none", "monthly", "annual"],
      expense_status: ["pendente", "pago", "atrasado", "cancelado"],
      fee_status: ["pendente", "pago", "atrasado", "cancelado"],
      task_kind: ["kickoff", "rotina", "demanda", "auditoria"],
      task_priority: ["baixa", "media", "alta", "urgente"],
      task_status: ["todo", "doing", "review", "done"],
    },
  },
} as const
