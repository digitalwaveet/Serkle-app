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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abuse_reports: {
        Row: {
          alert_id: string | null
          created_at: string | null
          description: string
          id: string
          report_type: string
          reported_user_id: string | null
          reporter_user_id: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          alert_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          report_type: string
          reported_user_id?: string | null
          reporter_user_id: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          alert_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          report_type?: string
          reported_user_id?: string | null
          reporter_user_id?: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abuse_reports_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "sos_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      admin_broadcasts: {
        Row: {
          channel: string
          created_at: string
          id: string
          message: string
          sender_id: string
          sent_at: string | null
          status: string
          target_audience: string
          title: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sent_at?: string | null
          status?: string
          target_audience?: string
          title: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sent_at?: string | null
          status?: string
          target_audience?: string
          title?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string | null
          metadata: Json | null
          notification_type: string
          severity: string
          title: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          notification_type?: string
          severity?: string
          title: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          metadata?: Json | null
          notification_type?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ai_moderation_results: {
        Row: {
          ai_reasoning: string | null
          auto_action: string | null
          content_id: string
          content_text: string | null
          content_type: string
          created_at: string | null
          hate_score: number | null
          id: string
          nsfw_score: number | null
          overall_risk: string | null
          review_action: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spam_score: number | null
          user_id: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          auto_action?: string | null
          content_id: string
          content_text?: string | null
          content_type: string
          created_at?: string | null
          hate_score?: number | null
          id?: string
          nsfw_score?: number | null
          overall_risk?: string | null
          review_action?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spam_score?: number | null
          user_id?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          auto_action?: string | null
          content_id?: string
          content_text?: string | null
          content_type?: string
          created_at?: string | null
          hate_score?: number | null
          id?: string
          nsfw_score?: number | null
          overall_risk?: string | null
          review_action?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spam_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      answer_votes: {
        Row: {
          answer_id: string
          created_at: string | null
          id: string
          user_id: string
          feedback_type: 'helpful' | 'not_helpful' | null
        }
        Insert: {
          answer_id: string
          created_at?: string | null
          id?: string
          user_id: string
          feedback_type?: 'helpful' | 'not_helpful' | null
        }
        Update: {
          answer_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
          feedback_type?: 'helpful' | 'not_helpful' | null
        }
        Relationships: [
          {
            foreignKeyName: "answer_votes_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_helpful: boolean | null
          helpful_count: number | null
          not_helpful_count: number | null
          total_feedback: number | null
          helpful_percentage: number | null
          question_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_helpful?: boolean | null
          helpful_count?: number | null
          not_helpful_count?: number | null
          total_feedback?: number | null
          helpful_percentage?: number | null
          question_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_helpful?: boolean | null
          helpful_count?: number | null
          not_helpful_count?: number | null
          total_feedback?: number | null
          helpful_percentage?: number | null
          question_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          appeal_type: string
          created_at: string | null
          evidence_urls: string[] | null
          id: string
          moderator_id: string | null
          moderator_notes: string | null
          reason: string
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          appeal_type?: string
          created_at?: string | null
          evidence_urls?: string[] | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          reason: string
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          appeal_type?: string
          created_at?: string | null
          evidence_urls?: string[] | null
          id?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      auto_moderation_rules: {
        Row: {
          action: string
          conditions: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          action?: string
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          rule_type?: string
          updated_at?: string | null
        }
        Update: {
          action?: string
          conditions?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bulk_action_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string
          status: string | null
          target_ids: string[]
          target_type: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by: string
          status?: string | null
          target_ids?: string[]
          target_type: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string
          status?: string | null
          target_ids?: string[]
          target_type?: string
        }
        Relationships: []
      }
      circle_event_attendees: {
        Row: {
          event_id: string
          id: string
          payment_status: string | null
          registered_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          payment_status?: string | null
          registered_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          payment_status?: string | null
          registered_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "circle_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_event_attendees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_events: {
        Row: {
          circle_id: string
          created_at: string | null
          creator_id: string
          current_attendees: number | null
          description: string
          duration_minutes: number
          event_date: string
          event_time: string
          event_type: string
          id: string
          max_attendees: number | null
          meeting_url: string | null
          platform: string | null
          price: number | null
          recording_url: string | null
          status: string
          timezone: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          circle_id: string
          created_at?: string | null
          creator_id: string
          current_attendees?: number | null
          description: string
          duration_minutes: number
          event_date: string
          event_time: string
          event_type: string
          id?: string
          max_attendees?: number | null
          meeting_url?: string | null
          platform?: string | null
          price?: number | null
          recording_url?: string | null
          status?: string
          timezone?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          circle_id?: string
          created_at?: string | null
          creator_id?: string
          current_attendees?: number | null
          description?: string
          duration_minutes?: number
          event_date?: string
          event_time?: string
          event_type?: string
          id?: string
          max_attendees?: number | null
          meeting_url?: string | null
          platform?: string | null
          price?: number | null
          recording_url?: string | null
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_events_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invitations: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          invitation_type: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          invitation_type: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          invitation_type?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_invitations_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_invitations_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_invitations_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          id: string
          joined_at: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_messages: {
        Row: {
          circle_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          circle_id: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          circle_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_messages_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_notification_preferences: {
        Row: {
          circle_id: string
          created_at: string | null
          enabled: boolean
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string | null
          enabled?: boolean
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_notification_preferences_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_resources: {
        Row: {
          circle_id: string
          created_at: string | null
          description: string
          downloads_count: number | null
          file_size_mb: number | null
          file_url: string
          id: string
          is_premium: boolean | null
          rating: number | null
          resource_type: string
          title: string
          updated_at: string | null
          uploader_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string | null
          description: string
          downloads_count?: number | null
          file_size_mb?: number | null
          file_url: string
          id?: string
          is_premium?: boolean | null
          rating?: number | null
          resource_type: string
          title: string
          updated_at?: string | null
          uploader_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string | null
          description?: string
          downloads_count?: number | null
          file_size_mb?: number | null
          file_url?: string
          id?: string
          is_premium?: boolean | null
          rating?: number | null
          resource_type?: string
          title?: string
          updated_at?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_resources_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_resources_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_service_bookings: {
        Row: {
          booking_date: string
          booking_time: string
          created_at: string | null
          id: string
          member_email: string
          member_name: string
          member_phone: string | null
          notes: string | null
          payment_status: string
          service_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          created_at?: string | null
          id?: string
          member_email: string
          member_name: string
          member_phone?: string | null
          notes?: string | null
          payment_status?: string
          service_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          created_at?: string | null
          id?: string
          member_email?: string
          member_name?: string
          member_phone?: string | null
          notes?: string | null
          payment_status?: string
          service_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_service_bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "circle_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_service_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_services: {
        Row: {
          category: string
          circle_id: string
          created_at: string | null
          description: string
          duration_minutes: number
          id: string
          is_active: boolean | null
          price: number
          provider_id: string
          rating: number | null
          reviews_count: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          circle_id: string
          created_at?: string | null
          description: string
          duration_minutes: number
          id?: string
          is_active?: boolean | null
          price: number
          provider_id: string
          rating?: number | null
          reviews_count?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          circle_id?: string
          created_at?: string | null
          description?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          price?: number
          provider_id?: string
          rating?: number | null
          reviews_count?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_services_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_stats: {
        Row: {
          circle_id: string
          created_at: string | null
          events_count: number | null
          last_activity_at: string | null
          members_count: number | null
          monthly_activity: number | null
          posts_count: number | null
          resources_count: number | null
          services_count: number | null
          updated_at: string | null
          videos_count: number | null
        }
        Insert: {
          circle_id: string
          created_at?: string | null
          events_count?: number | null
          last_activity_at?: string | null
          members_count?: number | null
          monthly_activity?: number | null
          posts_count?: number | null
          resources_count?: number | null
          services_count?: number | null
          updated_at?: string | null
          videos_count?: number | null
        }
        Update: {
          circle_id?: string
          created_at?: string | null
          events_count?: number | null
          last_activity_at?: string | null
          members_count?: number | null
          monthly_activity?: number | null
          posts_count?: number | null
          resources_count?: number | null
          services_count?: number | null
          updated_at?: string | null
          videos_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "circle_stats_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: true
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_subscriptions: {
        Row: {
          circle_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_subscriptions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_tips: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          post_id: string
          recipient_id: string
          status: string
          tipper_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          post_id: string
          recipient_id: string
          status?: string
          tipper_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          post_id?: string
          recipient_id?: string
          status?: string
          tipper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_tips_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_tips_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_tips_tipper_id_fkey"
            columns: ["tipper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          about_text: string | null
          avatar_url: string | null
          category: string
          circle_type: string
          cover_image_url: string | null
          created_at: string | null
          creator_id: string
          description: string
          enabled_features: string[]
          guidelines: string[] | null
          id: string
          invite_code: string
          is_active: boolean | null
          is_expert: boolean | null
          is_online: boolean
          is_premium: boolean | null
          is_private: boolean | null
          location: string | null
          member_benefits: string | null
          name: string
          posting_policy: string
          primary_language: string | null
          subscription_enabled: boolean
          subscription_method: string
          subscription_price: number
          target_audience: string | null
          updated_at: string | null
        }
        Insert: {
          about_text?: string | null
          avatar_url?: string | null
          category: string
          circle_type?: string
          cover_image_url?: string | null
          created_at?: string | null
          creator_id: string
          description: string
          enabled_features?: string[]
          guidelines?: string[] | null
          id?: string
          invite_code?: string
          is_active?: boolean | null
          is_expert?: boolean | null
          is_online?: boolean
          is_premium?: boolean | null
          is_private?: boolean | null
          location?: string | null
          member_benefits?: string | null
          name: string
          posting_policy?: string
          primary_language?: string | null
          subscription_enabled?: boolean
          subscription_method?: string
          subscription_price?: number
          target_audience?: string | null
          updated_at?: string | null
        }
        Update: {
          about_text?: string | null
          avatar_url?: string | null
          category?: string
          circle_type?: string
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string
          enabled_features?: string[]
          guidelines?: string[] | null
          id?: string
          invite_code?: string
          is_active?: boolean | null
          is_expert?: boolean | null
          is_online?: boolean
          is_premium?: boolean | null
          is_private?: boolean | null
          location?: string | null
          member_benefits?: string | null
          name?: string
          posting_policy?: string
          primary_language?: string | null
          subscription_enabled?: boolean
          subscription_method?: string
          subscription_price?: number
          target_audience?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "circles_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_topups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["coin_transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description: string
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["coin_transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["coin_transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_wallets: {
        Row: {
          balance: number
          created_at: string
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payout_method: string | null
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payout_method?: string | null
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payout_method?: string | null
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          description: string | null
          id: string
          priority: string | null
          reason: string
          reporter_id: string
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          reason: string
          reporter_id: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string | null
          reason?: string
          reporter_id?: string
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      content_review_queue: {
        Row: {
          assigned_to: string | null
          content_id: string
          content_preview: string | null
          content_type: string
          created_at: string | null
          id: string
          priority: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          assigned_to?: string | null
          content_id: string
          content_preview?: string | null
          content_type: string
          created_at?: string | null
          id?: string
          priority?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          assigned_to?: string | null
          content_id?: string
          content_preview?: string | null
          content_type?: string
          created_at?: string | null
          id?: string
          priority?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          group_avatar_url: string | null
          group_name: string | null
          id: string
          is_group: boolean
          pinned_message_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean
          pinned_message_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean
          pinned_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_pinned_message_id_fkey"
            columns: ["pinned_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          buyer_id: string
          created_at: string
          description: string
          id: string
          order_id: string
          reason: string
          resolution: string | null
          resolved_at: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          description: string
          id?: string
          order_id: string
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          contact_name: string
          contact_phone: string
          created_at: string
          id: string
          is_primary: boolean | null
          relationship: string | null
          user_id: string
        }
        Insert: {
          contact_name: string
          contact_phone: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          relationship?: string | null
          user_id: string
        }
        Update: {
          contact_name?: string
          contact_phone?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          relationship?: string | null
          user_id?: string
        }
        Relationships: []
      }
      expert_profiles: {
        Row: {
          bio: string | null
          certifications: string[] | null
          created_at: string | null
          featured_answer_id: string | null
          id: string
          institution: string | null
          is_verified: boolean | null
          professional_title: string | null
          qualification: string | null
          specialty: string
          updated_at: string | null
          user_id: string
          verified: boolean | null
          years_experience: number | null
        }
        Insert: {
          bio?: string | null
          certifications?: string[] | null
          created_at?: string | null
          featured_answer_id?: string | null
          id?: string
          institution?: string | null
          is_verified?: boolean | null
          professional_title?: string | null
          qualification?: string | null
          specialty: string
          updated_at?: string | null
          user_id: string
          verified?: boolean | null
          years_experience?: number | null
        }
        Update: {
          bio?: string | null
          certifications?: string[] | null
          created_at?: string | null
          featured_answer_id?: string | null
          id?: string
          institution?: string | null
          is_verified?: boolean | null
          professional_title?: string | null
          qualification?: string | null
          specialty?: string
          updated_at?: string | null
          user_id?: string
          verified?: boolean | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_profiles_featured_answer_id_fkey"
            columns: ["featured_answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_verification_requests: {
        Row: {
          admin_notes: string | null
          bio: string | null
          certifications: string[] | null
          created_at: string
          email: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          specialty: string
          status: string
          updated_at: string
          user_id: string
          years_experience: number | null
          professional_category: string | null
          full_legal_name: string | null
          public_display_name: string | null
          professional_title: string | null
          qualification: string | null
          institution: string | null
          country: string | null
          professional_organization: string | null
          license_number: string | null
          credential_documents: string[] | null
        }
        Insert: {
          admin_notes?: string | null
          bio?: string | null
          certifications?: string[] | null
          created_at?: string
          email: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty: string
          status?: string
          updated_at?: string
          user_id: string
          years_experience?: number | null
          professional_category?: string | null
          full_legal_name?: string | null
          public_display_name?: string | null
          professional_title?: string | null
          qualification?: string | null
          institution?: string | null
          country?: string | null
          professional_organization?: string | null
          license_number?: string | null
          credential_documents?: string[] | null
        }
        Update: {
          admin_notes?: string | null
          bio?: string | null
          certifications?: string[] | null
          created_at?: string
          email?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialty?: string
          status?: string
          updated_at?: string
          user_id?: string
          years_experience?: number | null
          professional_category?: string | null
          full_legal_name?: string | null
          public_display_name?: string | null
          professional_title?: string | null
          qualification?: string | null
          institution?: string | null
          country?: string | null
          professional_organization?: string | null
          license_number?: string | null
          credential_documents?: string[] | null
        }
        Relationships: []
      }
      flash_sales: {
        Row: {
          created_at: string
          end_time: string
          id: string
          item_id: string
          original_price: number
          quantity_limit: number | null
          quantity_sold: number
          sale_price: number
          start_time: string
          status: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          item_id: string
          original_price: number
          quantity_limit?: number | null
          quantity_sold?: number
          sale_price: number
          start_time: string
          status?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          item_id?: string
          original_price?: number
          quantity_limit?: number | null
          quantity_sold?: number
          sale_price?: number
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_admins: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_admins_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buy_participants: {
        Row: {
          group_buy_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_buy_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_buy_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_buy_participants_group_buy_id_fkey"
            columns: ["group_buy_id"]
            isOneToOne: false
            referencedRelation: "group_buys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_buy_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buys: {
        Row: {
          created_at: string
          current_participants: number
          discount_percentage: number
          end_time: string | null
          id: string
          item_id: string
          min_participants: number
          status: string
        }
        Insert: {
          created_at?: string
          current_participants?: number
          discount_percentage: number
          end_time?: string | null
          id?: string
          item_id: string
          min_participants: number
          status?: string
        }
        Update: {
          created_at?: string
          current_participants?: number
          discount_percentage?: number
          end_time?: string | null
          id?: string
          item_id?: string
          min_participants?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_buys_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      group_mutes: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          muted_until: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          muted_until?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          muted_until?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_mutes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      group_polls: {
        Row: {
          closes_at: string | null
          conversation_id: string
          created_at: string
          creator_id: string
          ended_at: string | null
          id: string
          is_anonymous: boolean
          is_multiple_choice: boolean
          options: Json
          question: string
          status: string
        }
        Insert: {
          closes_at?: string | null
          conversation_id: string
          created_at?: string
          creator_id: string
          ended_at?: string | null
          id?: string
          is_anonymous?: boolean
          is_multiple_choice?: boolean
          options?: Json
          question: string
          status?: string
        }
        Update: {
          closes_at?: string | null
          conversation_id?: string
          created_at?: string
          creator_id?: string
          ended_at?: string | null
          id?: string
          is_anonymous?: boolean
          is_multiple_choice?: boolean
          options?: Json
          question?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_polls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      helper_profiles: {
        Row: {
          availability_status: string | null
          average_rating: number | null
          average_response_time_minutes: number | null
          completion_count: number | null
          created_at: string
          current_streak_days: number | null
          helper_badge: string | null
          is_available: boolean | null
          last_active_at: string | null
          last_response_date: string | null
          location_lat: number | null
          location_lng: number | null
          response_count: number | null
          skills: string[] | null
          total_stars: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_status?: string | null
          average_rating?: number | null
          average_response_time_minutes?: number | null
          completion_count?: number | null
          created_at?: string
          current_streak_days?: number | null
          helper_badge?: string | null
          is_available?: boolean | null
          last_active_at?: string | null
          last_response_date?: string | null
          location_lat?: number | null
          location_lng?: number | null
          response_count?: number | null
          skills?: string[] | null
          total_stars?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_status?: string | null
          average_rating?: number | null
          average_response_time_minutes?: number | null
          completion_count?: number | null
          created_at?: string
          current_streak_days?: number | null
          helper_badge?: string | null
          is_available?: boolean | null
          last_active_at?: string | null
          last_response_date?: string | null
          location_lat?: number | null
          location_lng?: number | null
          response_count?: number | null
          skills?: string[] | null
          total_stars?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      helper_requests: {
        Row: {
          alert_id: string
          created_at: string
          estimated_arrival_minutes: number | null
          helper_id: string
          id: string
          request_message: string | null
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          estimated_arrival_minutes?: number | null
          helper_id: string
          id?: string
          request_message?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          estimated_arrival_minutes?: number | null
          helper_id?: string
          id?: string
          request_message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "helper_requests_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "sos_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          created_at: string | null
          id: string
          message_text: string
          message_type: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_text: string
          message_type?: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_text?: string
          message_type?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          circle_id: string | null
          created_at: string | null
          description: string | null
          ended_at: string | null
          id: string
          location_visible: boolean | null
          peak_viewers: number | null
          started_at: string
          status: string
          thumbnail_url: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
          viewer_count: number | null
          visibility: string | null
        }
        Insert: {
          circle_id?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          location_visible?: boolean | null
          peak_viewers?: number | null
          started_at?: string
          status?: string
          thumbnail_url?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
          viewer_count?: number | null
          visibility?: string | null
        }
        Update: {
          circle_id?: string | null
          created_at?: string | null
          description?: string | null
          ended_at?: string | null
          id?: string
          location_visible?: boolean | null
          peak_viewers?: number | null
          started_at?: string
          status?: string
          thumbnail_url?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
          viewer_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_streams_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_viewers: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string | null
          last_ping: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          last_ping?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          last_ping?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      message_deletions: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_deletions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          content: string
          conversation_id: string
          created_at: string
          deleted_for_everyone: boolean
          forwarded_from_name: string | null
          id: string
          is_edited: boolean
          message_type: string
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          content: string
          conversation_id: string
          created_at?: string
          deleted_for_everyone?: boolean
          forwarded_from_name?: string | null
          id?: string
          is_edited?: boolean
          message_type?: string
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_for_everyone?: boolean
          forwarded_from_name?: string | null
          id?: string
          is_edited?: boolean
          message_type?: string
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          alert_updates: boolean | null
          created_at: string | null
          emergency_contact_alerts: boolean | null
          enabled: boolean | null
          helper_responses: boolean | null
          id: string
          max_distance_km: number | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          sos_alerts: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_updates?: boolean | null
          created_at?: string | null
          emergency_contact_alerts?: boolean | null
          enabled?: boolean | null
          helper_responses?: boolean | null
          id?: string
          max_distance_km?: number | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sos_alerts?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_updates?: boolean | null
          created_at?: string | null
          emergency_contact_alerts?: boolean | null
          enabled?: boolean | null
          helper_responses?: boolean | null
          id?: string
          max_distance_km?: number | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          sos_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          item_id: string
          order_id: string
          price_at_purchase: number
          quantity: number
          seller_id: string
          status: string
        }
        Insert: {
          id?: string
          item_id: string
          order_id: string
          price_at_purchase: number
          quantity: number
          seller_id: string
          status?: string
        }
        Update: {
          id?: string
          item_id?: string
          order_id?: string
          price_at_purchase?: number
          quantity?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          created_at: string
          estimated_delivery: string | null
          id: string
          order_number: string
          shipping_cost: number
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          order_number: string
          shipping_cost?: number
          status?: string
          subtotal: number
          tax?: number
          total: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          order_number?: string
          shipping_cost?: number
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_brand: string | null
          created_at: string
          expiry_month: number | null
          expiry_year: number | null
          id: string
          is_default: boolean
          last_four: string | null
          type: string
          user_id: string
        }
        Insert: {
          card_brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean
          last_four?: string | null
          type: string
          user_id: string
        }
        Update: {
          card_brand?: string | null
          created_at?: string
          expiry_month?: number | null
          expiry_year?: number | null
          id?: string
          is_default?: boolean
          last_four?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_health_snapshots: {
        Row: {
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value?: number
          recorded_at?: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "group_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      post_stats: {
        Row: {
          comments_count: number | null
          created_at: string | null
          likes_count: number | null
          post_id: string
          saves_count: number | null
          shares_count: number | null
          updated_at: string | null
        }
        Insert: {
          comments_count?: number | null
          created_at?: string | null
          likes_count?: number | null
          post_id: string
          saves_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
        }
        Update: {
          comments_count?: number | null
          created_at?: string | null
          likes_count?: number | null
          post_id?: string
          saves_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_stats_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_unlocks: {
        Row: {
          amount_paid: number
          id: string
          post_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          id?: string
          post_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          id?: string
          post_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_unlocks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          circle_id: string | null
          content: string
          cover_image_url: string | null
          created_at: string | null
          has_tips_enabled: boolean | null
          id: string
          is_premium: boolean | null
          is_sponsored: boolean | null
          location_text: string | null
          media_alt: string | null
          media_color_from: string | null
          media_color_to: string | null
          media_url: string | null
          media_urls: string[] | null
          moderation_status: string
          pinned_at: string | null
          premium_price: number | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          voice_url: string | null
        }
        Insert: {
          circle_id?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          has_tips_enabled?: boolean | null
          id?: string
          is_premium?: boolean | null
          is_sponsored?: boolean | null
          location_text?: string | null
          media_alt?: string | null
          media_color_from?: string | null
          media_color_to?: string | null
          media_url?: string | null
          media_urls?: string[] | null
          moderation_status?: string
          pinned_at?: string | null
          premium_price?: number | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          voice_url?: string | null
        }
        Update: {
          circle_id?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          has_tips_enabled?: boolean | null
          id?: string
          is_premium?: boolean | null
          is_sponsored?: boolean | null
          location_text?: string | null
          media_alt?: string | null
          media_color_from?: string | null
          media_color_to?: string | null
          media_url?: string | null
          media_urls?: string[] | null
          moderation_status?: string
          pinned_at?: string | null
          premium_price?: number | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          comment: string
          created_at: string
          helpful_count: number
          id: string
          images: string[] | null
          item_id: string
          order_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          helpful_count?: number
          id?: string
          images?: string[] | null
          item_id: string
          order_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          helpful_count?: number
          id?: string
          images?: string[] | null
          item_id?: string
          order_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_stats: {
        Row: {
          created_at: string | null
          followers_count: number | null
          following_count: number | null
          posts_count: number | null
          replies_count: number | null
          saves_count: number | null
          updated_at: string | null
          user_id: string
          videos_count: number | null
        }
        Insert: {
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          posts_count?: number | null
          replies_count?: number | null
          saves_count?: number | null
          updated_at?: string | null
          user_id: string
          videos_count?: number | null
        }
        Update: {
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          posts_count?: number | null
          replies_count?: number | null
          saves_count?: number | null
          updated_at?: string | null
          user_id?: string
          videos_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_notes: string | null
          allow_messages_from: string
          avatar_color: string
          avatar_url: string | null
          banned_at: string | null
          bio: string | null
          cover_image_url: string | null
          created_at: string | null
          email: string
          fcm_token: string | null
          hide_followers: boolean
          hide_online_status: boolean
          id: string
          initials: string
          is_online: boolean | null
          is_private: boolean
          is_verified: boolean | null
          joined_date: string | null
          location: string | null
          name: string
          subtitle: string | null
          suspended_until: string | null
          updated_at: string | null
          username: string
          website: string | null
          phone: string | null
          birthday: string | null
        }
        Insert: {
          admin_notes?: string | null
          allow_messages_from?: string
          avatar_color?: string
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          email: string
          fcm_token?: string | null
          hide_followers?: boolean
          hide_online_status?: boolean
          id: string
          initials: string
          is_online?: boolean | null
          is_private?: boolean
          is_verified?: boolean | null
          joined_date?: string | null
          location?: string | null
          name: string
          subtitle?: string | null
          suspended_until?: string | null
          updated_at?: string | null
          username: string
          website?: string | null
          phone?: string | null
          birthday?: string | null
        }
        Update: {
          admin_notes?: string | null
          allow_messages_from?: string
          avatar_color?: string
          avatar_url?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          email?: string
          fcm_token?: string | null
          hide_followers?: boolean
          hide_online_status?: boolean
          id?: string
          initials?: string
          is_online?: boolean | null
          is_private?: boolean
          is_verified?: boolean | null
          joined_date?: string | null
          location?: string | null
          name?: string
          subtitle?: string | null
          suspended_until?: string | null
          updated_at?: string | null
          username?: string
          website?: string | null
          phone?: string | null
          birthday?: string | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          delivered_at: string | null
          id: string
          notification_type: string
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          delivered_at?: string | null
          id?: string
          notification_type: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          delivered_at?: string | null
          id?: string
          notification_type?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      question_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bookmarks_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_votes: {
        Row: {
          created_at: string | null
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          ai_discussion_summary: Json | null
          ai_response: string | null
          anonymous_name: string | null
          category: string
          created_at: string | null
          id: string
          is_anonymous: boolean | null
          is_thread: boolean | null
          question: string
          tags: string[] | null
          updated_at: string | null
          user_id: string | null
          views: number | null
        }
        Insert: {
          ai_discussion_summary?: Json | null
          ai_response?: string | null
          anonymous_name?: string | null
          category: string
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_thread?: boolean | null
          question: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          views?: number | null
        }
        Update: {
          ai_discussion_summary?: Json | null
          ai_response?: string | null
          anonymous_name?: string | null
          category?: string
          created_at?: string | null
          id?: string
          is_anonymous?: boolean | null
          is_thread?: boolean | null
          question?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string | null
          views?: number | null
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          dispute_id: string | null
          id: string
          order_id: string
          processed_at: string | null
          reason: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          dispute_id?: string | null
          id?: string
          order_id: string
          processed_at?: string | null
          reason: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          dispute_id?: string | null
          id?: string
          order_id?: string
          processed_at?: string | null
          reason?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      review_helpful: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_posts: {
        Row: {
          circle_id: string | null
          content: string
          created_at: string | null
          id: string
          media_url: string | null
          media_urls: string[] | null
          published_post_id: string | null
          scheduled_at: string
          status: string
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          circle_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          media_urls?: string[] | null
          published_post_id?: string | null
          scheduled_at: string
          status?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          media_urls?: string[] | null
          published_post_id?: string | null
          scheduled_at?: string
          status?: string
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      seller_follows: {
        Row: {
          created_at: string
          follower_id: string
          id: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          id?: string
          seller_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_follows_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          avg_response_time: string
          badges: string[]
          business_license_url: string | null
          business_name: string | null
          business_registration_number: string | null
          description: string | null
          email: string
          joined_date: string
          location: string
          phone: string | null
          response_rate: number
          seller_type: string
          tax_id: string | null
          total_revenue: number
          total_sales: number
          user_id: string
          verification_notes: string | null
          verification_status: string
          verification_submitted_at: string | null
          verified: boolean
        }
        Insert: {
          avg_response_time?: string
          badges?: string[]
          business_license_url?: string | null
          business_name?: string | null
          business_registration_number?: string | null
          description?: string | null
          email: string
          joined_date?: string
          location: string
          phone?: string | null
          response_rate?: number
          seller_type?: string
          tax_id?: string | null
          total_revenue?: number
          total_sales?: number
          user_id: string
          verification_notes?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          verified?: boolean
        }
        Update: {
          avg_response_time?: string
          badges?: string[]
          business_license_url?: string | null
          business_name?: string | null
          business_registration_number?: string | null
          description?: string | null
          email?: string
          joined_date?: string
          location?: string
          phone?: string | null
          response_rate?: number
          seller_type?: string
          tax_id?: string | null
          total_revenue?: number
          total_sales?: number
          user_id?: string
          verification_notes?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_reviews: {
        Row: {
          comment: string
          created_at: string
          id: string
          order_id: string
          rating: number
          reviewer_id: string
          seller_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reviewer_id: string
          seller_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reviewer_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_stats: {
        Row: {
          active_listings: number
          created_at: string
          followers_count: number
          rating: number
          reviews_count: number
          seller_id: string
          updated_at: string
        }
        Insert: {
          active_listings?: number
          created_at?: string
          followers_count?: number
          rating?: number
          reviews_count?: number
          seller_id: string
          updated_at?: string
        }
        Update: {
          active_listings?: number
          created_at?: string
          followers_count?: number
          rating?: number
          reviews_count?: number
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_stats_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean
          phone: string
          state: string
          street: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean
          phone: string
          state: string
          street: string
          user_id: string
          zip_code: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean
          phone?: string
          state?: string
          street?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          item_id: string | null
          last_message_at: string
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          item_id?: string | null
          last_message_at?: string
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          last_message_at?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_conversations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_item_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          item_id: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          item_id: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          item_id?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_item_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_item_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "shop_item_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_item_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_item_likes: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_item_likes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_item_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_item_saves: {
        Row: {
          created_at: string
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_item_saves_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_item_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_item_stats: {
        Row: {
          comments_count: number
          created_at: string
          item_id: string
          likes_count: number
          saves_count: number
          shares_count: number
          updated_at: string
          views_count: number
        }
        Insert: {
          comments_count?: number
          created_at?: string
          item_id: string
          likes_count?: number
          saves_count?: number
          shares_count?: number
          updated_at?: string
          views_count?: number
        }
        Update: {
          comments_count?: number
          created_at?: string
          item_id?: string
          likes_count?: number
          saves_count?: number
          shares_count?: number
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_item_stats_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_items: {
        Row: {
          brand: string | null
          category: string
          condition: string
          created_at: string
          description: string
          id: string
          images: string[]
          location: string
          original_price: number | null
          price: number
          seller_id: string
          status: string
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          condition: string
          created_at?: string
          description: string
          id?: string
          images?: string[]
          location: string
          original_price?: number | null
          price: number
          seller_id: string
          status?: string
          stock?: number
          title: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          condition?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          location?: string
          original_price?: number | null
          price?: number
          seller_id?: string
          status?: string
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "shop_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_alerts: {
        Row: {
          conscious_level: string | null
          created_at: string
          description: string
          id: string
          injury_type: string | null
          last_seen: string | null
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          person_age: string | null
          person_description: string | null
          photo_urls: string[] | null
          resolved_at: string | null
          share_live_location: boolean | null
          sos_type: string
          status: string
          sub_category: string | null
          threat_active: boolean | null
          updated_at: string
          urgency: string
          user_id: string
        }
        Insert: {
          conscious_level?: string | null
          created_at?: string
          description: string
          id?: string
          injury_type?: string | null
          last_seen?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          person_age?: string | null
          person_description?: string | null
          photo_urls?: string[] | null
          resolved_at?: string | null
          share_live_location?: boolean | null
          sos_type: string
          status?: string
          sub_category?: string | null
          threat_active?: boolean | null
          updated_at?: string
          urgency?: string
          user_id: string
        }
        Update: {
          conscious_level?: string | null
          created_at?: string
          description?: string
          id?: string
          injury_type?: string | null
          last_seen?: string | null
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          person_age?: string | null
          person_description?: string | null
          photo_urls?: string[] | null
          resolved_at?: string | null
          share_live_location?: boolean | null
          sos_type?: string
          status?: string
          sub_category?: string | null
          threat_active?: boolean | null
          updated_at?: string
          urgency?: string
          user_id?: string
        }
        Relationships: []
      }
      sos_helpers: {
        Row: {
          accepted_at: string
          alert_id: string
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          estimated_arrival_minutes: number | null
          helper_user_id: string
          id: string
          status: string
        }
        Insert: {
          accepted_at?: string
          alert_id: string
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          estimated_arrival_minutes?: number | null
          helper_user_id: string
          id?: string
          status?: string
        }
        Update: {
          accepted_at?: string
          alert_id?: string
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          estimated_arrival_minutes?: number | null
          helper_user_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_helpers_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "sos_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_messages: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          is_system_message: boolean | null
          message_text: string
          sender_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          is_system_message?: boolean | null
          message_text: string
          sender_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          is_system_message?: boolean | null
          message_text?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_messages_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "sos_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_reviews: {
        Row: {
          alert_id: string
          created_at: string
          helper_user_id: string
          id: string
          rating: number
          review_text: string | null
          reviewer_user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          helper_user_id: string
          id?: string
          rating: number
          review_text?: string | null
          reviewer_user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          helper_user_id?: string
          id?: string
          rating?: number
          review_text?: string | null
          reviewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_reviews_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "sos_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          live_stream_id: string | null
          media_type: string | null
          media_url: string
          reshared_post_id: string | null
          reshared_story_id: string | null
          sticker_data: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          live_stream_id?: string | null
          media_type?: string | null
          media_url: string
          reshared_post_id?: string | null
          reshared_story_id?: string | null
          sticker_data?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          live_stream_id?: string | null
          media_type?: string | null
          media_url?: string
          reshared_post_id?: string | null
          reshared_story_id?: string | null
          sticker_data?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_live_stream_id_fkey"
            columns: ["live_stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_reshared_post_id_fkey"
            columns: ["reshared_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_reshared_story_id_fkey"
            columns: ["reshared_story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string | null
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_mentions: {
        Row: {
          created_at: string | null
          id: string
          mentioned_user_id: string
          story_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentioned_user_id: string
          story_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentioned_user_id?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_mentions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          receiver_id: string
          sender_id: string
          story_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          receiver_id: string
          sender_id: string
          story_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          receiver_id?: string
          sender_id?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_messages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          id: string
          story_id: string
          viewed_at: string | null
          viewer_id: string
        }
        Insert: {
          id?: string
          story_id: string
          viewed_at?: string | null
          viewer_id: string
        }
        Update: {
          id?: string
          story_id?: string
          viewed_at?: string | null
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_followers: {
        Row: {
          created_at: string | null
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_followers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_update_votes: {
        Row: {
          created_at: string | null
          id: string
          thread_update_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          thread_update_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          thread_update_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_update_votes_thread_update_id_fkey"
            columns: ["thread_update_id"]
            isOneToOne: false
            referencedRelation: "thread_updates"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_updates: {
        Row: {
          created_at: string | null
          id: string
          media_url: string | null
          question_id: string
          title: string | null
          update_number: number
          update_text: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          media_url?: string | null
          question_id: string
          title?: string | null
          update_number?: number
          update_text: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          media_url?: string | null
          question_id?: string
          title?: string | null
          update_number?: number
          update_text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thread_updates_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
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
      user_warnings: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          issued_by: string
          reason: string
          severity: string
          user_id: string
          warning_type: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by: string
          reason: string
          severity?: string
          user_id: string
          warning_type?: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_by?: string
          reason?: string
          severity?: string
          user_id?: string
          warning_type?: string
        }
        Relationships: []
      }
      video_comment_likes: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      video_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          updated_at: string | null
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "video_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_likes: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_saves: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_saves_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_stats: {
        Row: {
          comments_count: number | null
          created_at: string | null
          likes_count: number | null
          saves_count: number | null
          shares_count: number | null
          updated_at: string | null
          video_id: string
          views_count: number | null
        }
        Insert: {
          comments_count?: number | null
          created_at?: string | null
          likes_count?: number | null
          saves_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
          video_id: string
          views_count?: number | null
        }
        Update: {
          comments_count?: number | null
          created_at?: string | null
          likes_count?: number | null
          saves_count?: number | null
          shares_count?: number | null
          updated_at?: string | null
          video_id?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_stats_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          moderation_status: string
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          moderation_status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          moderation_status?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string | null
          created_by: string | null
          event_types: string[]
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          secret: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          event_types?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          secret?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          event_types?: string[]
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          secret?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_circle_invitation: {
        Args: { _invitation_id: string; _user_id: string }
        Returns: boolean
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      create_group_conversation: {
        Args: {
          _creator_id: string
          _group_name: string
          _member_ids: string[]
        }
        Returns: string
      }
      generate_order_number: { Args: never; Returns: string }
      get_circle_feed: {
        Args: { _circle_id: string; page_num?: number; page_size?: number }
        Returns: {
          avatar_color: string
          avatar_url: string
          comments_count: number
          content: string
          created_at: string
          initials: string
          is_sponsored: boolean
          is_verified: boolean
          likes_count: number
          media_alt: string
          media_color_from: string
          media_color_to: string
          media_url: string
          media_urls: string[]
          name: string
          post_id: string
          saves_count: number
          shares_count: number
          tags: string[]
          user_has_liked: boolean
          user_id: string
          username: string
        }[]
      }
      get_feed_posts: {
        Args: { page_num: number; page_size: number }
        Returns: {
          avatar_color: string
          avatar_url: string
          circle_avatar_url: string
          circle_id: string
          circle_name: string
          comments_count: number
          content: string
          cover_image_url: string
          created_at: string
          initials: string
          is_premium: boolean
          is_sponsored: boolean
          is_verified: boolean
          likes_count: number
          location_text: string
          media_alt: string
          media_color_from: string
          media_color_to: string
          media_url: string
          media_urls: string[]
          name: string
          post_id: string
          saves_count: number
          shares_count: number
          tags: string[]
          user_has_liked: boolean
          user_id: string
          username: string
          voice_url: string
        }[]
      }
      get_live_streams: {
        Args: { page_num?: number; page_size?: number }
        Returns: {
          avatar_url: string
          circle_id: string
          circle_name: string
          description: string
          is_verified: boolean
          name: string
          started_at: string
          stream_id: string
          thumbnail_url: string
          title: string
          type: string
          user_id: string
          user_is_viewing: boolean
          username: string
          viewer_count: number
        }[]
      }
      get_nearby_alerts: {
        Args: { radius_miles?: number; user_lat: number; user_lng: number }
        Returns: {
          conscious_level: string
          created_at: string
          description: string
          distance_miles: number
          helper_count: number
          id: string
          injury_type: string
          last_seen: string
          location_address: string
          location_lat: number
          location_lng: number
          person_age: string
          person_description: string
          photo_urls: string[]
          resolved_at: string
          share_live_location: boolean
          sos_type: string
          status: string
          sub_category: string
          threat_active: boolean
          updated_at: string
          urgency: string
          user_id: string
        }[]
      }
      get_or_create_conversation: {
        Args: { _user1_id: string; _user2_id: string }
        Returns: string
      }
      get_post_comments: {
        Args: { _post_id: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          comment_id: string
          content: string
          created_at: string
          initials: string
          likes_count: number
          name: string
          parent_id: string
          user_has_liked: boolean
          user_id: string
          username: string
        }[]
      }
      get_user_conversations: {
        Args: { _user_id: string }
        Returns: {
          conversation_id: string
          group_avatar_url: string
          group_name: string
          is_group: boolean
          last_message: string
          last_message_at: string
          last_message_sender_id: string
          member_count: number
          other_user_avatar: string
          other_user_id: string
          other_user_initials: string
          other_user_name: string
          other_user_online: boolean
          other_user_username: string
          unread_count: number
        }[]
      }
      get_video_comments: {
        Args: { _video_id: string }
        Returns: {
          avatar_color: string
          avatar_url: string
          comment_id: string
          content: string
          created_at: string
          initials: string
          likes_count: number
          name: string
          parent_id: string
          user_has_liked: boolean
          user_id: string
          username: string
        }[]
      }
      get_video_feed: {
        Args: { page_num?: number; page_size?: number }
        Returns: {
          avatar_color: string
          avatar_url: string
          comments_count: number
          created_at: string
          description: string
          initials: string
          is_verified: boolean
          likes_count: number
          name: string
          saves_count: number
          shares_count: number
          tags: string[]
          thumbnail_url: string
          title: string
          user_has_liked: boolean
          user_has_saved: boolean
          user_id: string
          username: string
          video_id: string
          video_url: string
          views_count: number
        }[]
      }
      has_circle_subscription: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_unlocked_post: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      is_any_admin: { Args: { _user_id: string }; Returns: boolean }
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { conversation_id: string; user_id: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_buyer: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      is_order_seller: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: undefined
      }
      remove_group_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      request_withdrawal: {
        Args: { _amount: number; _payout_method?: string; _user_id: string }
        Returns: boolean
      }
      respond_circle_join_request: {
        Args: { _circle_id: string; _user_id: string; _approve: boolean }
        Returns: undefined
      }
      set_circle_post_pinned: {
        Args: { _post_id: string; _pinned: boolean }
        Returns: undefined
      }
      spend_coins: {
        Args: {
          _amount: number
          _description?: string
          _reference_id?: string
          _type: Database["public"]["Enums"]["coin_transaction_type"]
          _user_id: string
        }
        Returns: boolean
      }
      topup_coins: {
        Args: { _amount: number; _payment_method?: string; _user_id: string }
        Returns: boolean
      }
      transfer_coins: {
        Args: {
          _amount: number
          _description?: string
          _receiver_id: string
          _reference_id?: string
          _sender_id: string
          _type_received: Database["public"]["Enums"]["coin_transaction_type"]
          _type_sent: Database["public"]["Enums"]["coin_transaction_type"]
        }
        Returns: boolean
      }
      unlock_premium_post: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      update_item_stock: {
        Args: { item_id: string; quantity_sold: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "super_admin"
      coin_transaction_type:
        | "topup"
        | "tip_sent"
        | "tip_received"
        | "purchase"
        | "sale"
        | "event_payment"
        | "event_earned"
        | "service_payment"
        | "service_earned"
        | "subscription"
        | "withdrawal"
        | "refund"
        | "premium_unlock"
        | "premium_earning"
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
      app_role: ["admin", "moderator", "super_admin"],
      coin_transaction_type: [
        "topup",
        "tip_sent",
        "tip_received",
        "purchase",
        "sale",
        "event_payment",
        "event_earned",
        "service_payment",
        "service_earned",
        "subscription",
        "withdrawal",
        "refund",
        "premium_unlock",
        "premium_earning",
      ],
    },
  },
} as const
