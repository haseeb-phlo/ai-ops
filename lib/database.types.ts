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
      ai_intervention_comments: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          intervention_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          intervention_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          intervention_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_intervention_comments_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interventions: {
        Row: {
          adoption_status: string | null
          attribution_confidence: string | null
          cost_saved_per_use: number | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_gbp_saved_per_week: number | null
          estimated_revenue_per_week: number | null
          frequency_cadence: string | null
          id: string
          minutes_saved_per_use: number | null
          minutes_saved_per_week: number | null
          name: string
          notes: string | null
          owner: string | null
          queue_rank: number | null
          recipient_emails: string[]
          revenue_per_use: number | null
          satisfaction: number | null
          shipped_at: string | null
          status: string | null
          tools_used: string[]
          types: string[]
          uses_per_week: number | null
          vendor: string | null
        }
        Insert: {
          adoption_status?: string | null
          attribution_confidence?: string | null
          cost_saved_per_use?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_gbp_saved_per_week?: number | null
          estimated_revenue_per_week?: number | null
          frequency_cadence?: string | null
          id?: string
          minutes_saved_per_use?: number | null
          minutes_saved_per_week?: number | null
          name: string
          notes?: string | null
          owner?: string | null
          queue_rank?: number | null
          recipient_emails?: string[]
          revenue_per_use?: number | null
          satisfaction?: number | null
          shipped_at?: string | null
          status?: string | null
          tools_used?: string[]
          types?: string[]
          uses_per_week?: number | null
          vendor?: string | null
        }
        Update: {
          adoption_status?: string | null
          attribution_confidence?: string | null
          cost_saved_per_use?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_gbp_saved_per_week?: number | null
          estimated_revenue_per_week?: number | null
          frequency_cadence?: string | null
          id?: string
          minutes_saved_per_use?: number | null
          minutes_saved_per_week?: number | null
          name?: string
          notes?: string | null
          owner?: string | null
          queue_rank?: number | null
          recipient_emails?: string[]
          revenue_per_use?: number | null
          satisfaction?: number | null
          shipped_at?: string | null
          status?: string | null
          tools_used?: string[]
          types?: string[]
          uses_per_week?: number | null
          vendor?: string | null
        }
        Relationships: []
      }
      ai_score_responses: {
        Row: {
          answers_json: Json
          cohort_id: string | null
          created_at: string
          duration_seconds: number | null
          email: string
          flow: string | null
          id: string
          source: string
          submitted_at: string
          updated_at: string
          user_id: string | null
          wave: string
        }
        Insert: {
          answers_json?: Json
          cohort_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          email: string
          flow?: string | null
          id?: string
          source?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          wave: string
        }
        Update: {
          answers_json?: Json
          cohort_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          email?: string
          flow?: string | null
          id?: string
          source?: string
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          wave?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_score_responses_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      champion_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          target_id: string
          target_type: string
          team: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_id: string
          target_type: string
          team: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          target_id?: string
          target_type?: string
          team?: string
          updated_at?: string
        }
        Relationships: []
      }
      champions: {
        Row: {
          blurb: string | null
          chewing_on: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          last_check_in: string | null
          team: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          blurb?: string | null
          chewing_on?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          last_check_in?: string | null
          team: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          blurb?: string | null
          chewing_on?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          last_check_in?: string | null
          team?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      digest_sends: {
        Row: {
          forced: boolean
          period_key: string
          recipient_count: number | null
          sent_at: string
        }
        Insert: {
          forced?: boolean
          period_key: string
          recipient_count?: number | null
          sent_at?: string
        }
        Update: {
          forced?: boolean
          period_key?: string
          recipient_count?: number | null
          sent_at?: string
        }
        Relationships: []
      }
      intervention_cosigns: {
        Row: {
          intervention_id: string
          signed_at: string
          signed_by: string | null
          signed_by_name: string | null
          team: string
        }
        Insert: {
          intervention_id: string
          signed_at?: string
          signed_by?: string | null
          signed_by_name?: string | null
          team: string
        }
        Update: {
          intervention_id?: string
          signed_at?: string
          signed_by?: string | null
          signed_by_name?: string | null
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_cosigns_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_edits: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          field: string | null
          id: string
          intervention_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          intervention_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          field?: string | null
          id?: string
          intervention_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_edits_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_metrics: {
        Row: {
          adoption_status: string | null
          cost_value: number | null
          created_at: string
          created_by: string | null
          errors_value: number | null
          id: string
          intervention_id: string
          notes: string | null
          people_value: number | null
          revenue_value: number | null
          satisfaction: number | null
          snapshot_date: string
          time_value: number | null
        }
        Insert: {
          adoption_status?: string | null
          cost_value?: number | null
          created_at?: string
          created_by?: string | null
          errors_value?: number | null
          id?: string
          intervention_id: string
          notes?: string | null
          people_value?: number | null
          revenue_value?: number | null
          satisfaction?: number | null
          snapshot_date?: string
          time_value?: number | null
        }
        Update: {
          adoption_status?: string | null
          cost_value?: number | null
          created_at?: string
          created_by?: string | null
          errors_value?: number | null
          id?: string
          intervention_id?: string
          notes?: string | null
          people_value?: number | null
          revenue_value?: number | null
          satisfaction?: number | null
          snapshot_date?: string
          time_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_metrics_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_suggestion_comments: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          suggestion_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          suggestion_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_suggestion_comments_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "intervention_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_suggestion_votes: {
        Row: {
          created_at: string
          suggestion_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          suggestion_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          suggestion_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "intervention_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_suggestions: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          decline_reason: string | null
          id: string
          intervention_id: string | null
          queue_rank: number | null
          status: string
          team: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          id?: string
          intervention_id?: string | null
          queue_rank?: number | null
          status?: string
          team?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          decline_reason?: string | null
          id?: string
          intervention_id?: string | null
          queue_rank?: number | null
          status?: string
          team?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_suggestions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
        ]
      }
      intervention_workflows: {
        Row: {
          intervention_id: string
          workflow_id: string
        }
        Insert: {
          intervention_id: string
          workflow_id: string
        }
        Update: {
          intervention_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intervention_workflows_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_workflows_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_resources: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          id: string
          title: string
          url: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title: string
          url: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      learn_video_comments: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          video_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          video_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_video_comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "learn_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_video_completions: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_video_completions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "learn_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_video_plays: {
        Row: {
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_video_plays_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "learn_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_video_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_video_reactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "learn_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_video_resources: {
        Row: {
          added_by: string | null
          created_at: string
          file_mime: string | null
          file_name: string | null
          file_size: number | null
          id: string
          kind: string
          storage_path: string | null
          title: string
          url: string | null
          video_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          kind: string
          storage_path?: string | null
          title: string
          url?: string | null
          video_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          file_mime?: string | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          storage_path?: string | null
          title?: string
          url?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learn_video_resources_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "learn_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_videos: {
        Row: {
          added_by: string | null
          created_at: string
          description: string | null
          id: string
          loom_embed_id: string
          loom_share_url: string
          position: number
          subtopic: string | null
          thumbnail_url: string | null
          title: string
          topic: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          loom_embed_id: string
          loom_share_url: string
          position?: number
          subtopic?: string | null
          thumbnail_url?: string | null
          title: string
          topic?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          loom_embed_id?: string
          loom_share_url?: string
          position?: number
          subtopic?: string | null
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          start_date: string | null
          team: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id?: string
          start_date?: string | null
          team: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          start_date?: string | null
          team?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          slack_user_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          slack_user_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          slack_user_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programme_cohort_members: {
        Row: {
          certificate_declined_at: string | null
          certificate_issued_at: string | null
          certificate_issued_by: string | null
          certificate_note: string | null
          cohort_id: string
          completed_at: string | null
          created_at: string
          id: string
          is_champion: boolean
          joined_at: string
          notification_opt_out: boolean
          rag_computed_at: string | null
          rag_status: string | null
          team_lead_user_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_declined_at?: string | null
          certificate_issued_at?: string | null
          certificate_issued_by?: string | null
          certificate_note?: string | null
          cohort_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_champion?: boolean
          joined_at?: string
          notification_opt_out?: boolean
          rag_computed_at?: string | null
          rag_status?: string | null
          team_lead_user_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_declined_at?: string | null
          certificate_issued_at?: string | null
          certificate_issued_by?: string | null
          certificate_note?: string | null
          cohort_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_champion?: boolean
          joined_at?: string
          notification_opt_out?: boolean
          rag_computed_at?: string | null
          rag_status?: string | null
          team_lead_user_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_cohorts: {
        Row: {
          created_at: string
          default_approver_user_id: string | null
          id: string
          is_test: boolean
          join_code: string | null
          join_open: boolean
          name: string
          review_mode: string
          session_dates: Json
          slack_channel: string | null
          start_date: string
          status: string
          track_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_approver_user_id?: string | null
          id?: string
          is_test?: boolean
          join_code?: string | null
          join_open?: boolean
          name: string
          review_mode?: string
          session_dates?: Json
          slack_channel?: string | null
          start_date: string
          status?: string
          track_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_approver_user_id?: string | null
          id?: string
          is_test?: boolean
          join_code?: string | null
          join_open?: boolean
          name?: string
          review_mode?: string
          session_dates?: Json
          slack_channel?: string | null
          start_date?: string
          status?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_cohorts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "programme_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_item_progress: {
        Row: {
          cohort_member_id: string
          completed_at: string | null
          created_at: string
          id: string
          meta_json: Json
          status: string
          track_item_id: string
          updated_at: string
        }
        Insert: {
          cohort_member_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          meta_json?: Json
          status?: string
          track_item_id: string
          updated_at?: string
        }
        Update: {
          cohort_member_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          meta_json?: Json
          status?: string
          track_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_item_progress_cohort_member_id_fkey"
            columns: ["cohort_member_id"]
            isOneToOne: false
            referencedRelation: "programme_cohort_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_item_progress_track_item_id_fkey"
            columns: ["track_item_id"]
            isOneToOne: false
            referencedRelation: "programme_track_items"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_pending_enrolments: {
        Row: {
          added_by: string | null
          claimed_at: string | null
          claimed_member_id: string | null
          cohort_id: string
          created_at: string
          email: string
          id: string
          team_lead_user_id: string | null
        }
        Insert: {
          added_by?: string | null
          claimed_at?: string | null
          claimed_member_id?: string | null
          cohort_id: string
          created_at?: string
          email: string
          id?: string
          team_lead_user_id?: string | null
        }
        Update: {
          added_by?: string | null
          claimed_at?: string | null
          claimed_member_id?: string | null
          cohort_id?: string
          created_at?: string
          email?: string
          id?: string
          team_lead_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_pending_enrolments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_pending_enrolments_claimed_member_id_fkey"
            columns: ["claimed_member_id"]
            isOneToOne: false
            referencedRelation: "programme_cohort_members"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_notification_sends: {
        Row: {
          channel: string | null
          detail: string | null
          id: string
          kind: string
          period_key: string
          sent_at: string
          succeeded: boolean
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          detail?: string | null
          id?: string
          kind: string
          period_key: string
          sent_at?: string
          succeeded?: boolean
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          detail?: string | null
          id?: string
          kind?: string
          period_key?: string
          sent_at?: string
          succeeded?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      programme_quiz_attempts: {
        Row: {
          answers_json: Json
          cohort_member_id: string
          created_at: string
          id: string
          score: number
          track_item_id: string
        }
        Insert: {
          answers_json?: Json
          cohort_member_id: string
          created_at?: string
          id?: string
          score: number
          track_item_id: string
        }
        Update: {
          answers_json?: Json
          cohort_member_id?: string
          created_at?: string
          id?: string
          score?: number
          track_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_quiz_attempts_cohort_member_id_fkey"
            columns: ["cohort_member_id"]
            isOneToOne: false
            referencedRelation: "programme_cohort_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_quiz_attempts_track_item_id_fkey"
            columns: ["track_item_id"]
            isOneToOne: false
            referencedRelation: "programme_track_items"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_session_attendance: {
        Row: {
          cohort_id: string
          created_at: string
          id: string
          marked_by: string | null
          meta_json: Json
          slot: number | null
          status: string
          track_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          id?: string
          marked_by?: string | null
          meta_json?: Json
          slot?: number | null
          status: string
          track_item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          id?: string
          marked_by?: string | null
          meta_json?: Json
          slot?: number | null
          status?: string
          track_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_session_attendance_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "programme_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_session_attendance_track_item_id_fkey"
            columns: ["track_item_id"]
            isOneToOne: false
            referencedRelation: "programme_track_items"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_submissions: {
        Row: {
          ai_decision: string | null
          ai_review_json: Json | null
          ai_reviewed_at: string | null
          artefact_url: string | null
          cohort_member_id: string
          created_at: string
          id: string
          kind: string
          prompt_text: string | null
          signed_at: string | null
          signed_by: string | null
          signoff_comment: string | null
          signoff_rubric_json: Json
          signoff_status: string
          superseded_by: string | null
          task_solved: string | null
          time_saved_estimate: string | null
          track_item_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          ai_decision?: string | null
          ai_review_json?: Json | null
          ai_reviewed_at?: string | null
          artefact_url?: string | null
          cohort_member_id: string
          created_at?: string
          id?: string
          kind: string
          prompt_text?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signoff_comment?: string | null
          signoff_rubric_json?: Json
          signoff_status?: string
          superseded_by?: string | null
          task_solved?: string | null
          time_saved_estimate?: string | null
          track_item_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          ai_decision?: string | null
          ai_review_json?: Json | null
          ai_reviewed_at?: string | null
          artefact_url?: string | null
          cohort_member_id?: string
          created_at?: string
          id?: string
          kind?: string
          prompt_text?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signoff_comment?: string | null
          signoff_rubric_json?: Json
          signoff_status?: string
          superseded_by?: string | null
          task_solved?: string | null
          time_saved_estimate?: string | null
          track_item_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_submissions_cohort_member_id_fkey"
            columns: ["cohort_member_id"]
            isOneToOne: false
            referencedRelation: "programme_cohort_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_submissions_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "programme_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_submissions_track_item_id_fkey"
            columns: ["track_item_id"]
            isOneToOne: false
            referencedRelation: "programme_track_items"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_track_items: {
        Row: {
          config_json: Json
          created_at: string
          day_index: number
          description: string | null
          id: string
          learn_video_id: string | null
          sort_order: number
          title: string
          track_id: string
          type: string
          updated_at: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          day_index: number
          description?: string | null
          id?: string
          learn_video_id?: string | null
          sort_order?: number
          title: string
          track_id: string
          type: string
          updated_at?: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          day_index?: number
          description?: string | null
          id?: string
          learn_video_id?: string | null
          sort_order?: number
          title?: string
          track_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programme_track_items_learn_video_id_fkey"
            columns: ["learn_video_id"]
            isOneToOne: false
            referencedRelation: "learn_videos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programme_track_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "programme_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_tracks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      regulatory_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          resolved_at: string | null
          severity: string
          step_id: string | null
          summary: string
          workflow_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          severity: string
          step_id?: string | null
          summary: string
          workflow_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          severity?: string
          step_id?: string | null
          summary?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regulatory_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regulatory_events_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      role_grants: {
        Row: {
          created_at: string
          role: string
          team: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          team?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          team?: string | null
          user_id?: string
        }
        Relationships: []
      }
      step_revisions: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          step_id: string
          workflow_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          step_id: string
          workflow_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          step_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_revisions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_revisions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_workflows: {
        Row: {
          suggestion_id: string
          workflow_id: string
        }
        Insert: {
          suggestion_id: string
          workflow_id: string
        }
        Update: {
          suggestion_id?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_workflows_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "intervention_suggestions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestion_workflows_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_baselines: {
        Row: {
          captured_at: string
          cost_value: number | null
          errors_value: number | null
          id: string
          intervention_id: string
          people_value: number | null
          revenue_value: number | null
          time_value: number | null
          workflow_id: string
        }
        Insert: {
          captured_at?: string
          cost_value?: number | null
          errors_value?: number | null
          id?: string
          intervention_id: string
          people_value?: number | null
          revenue_value?: number | null
          time_value?: number | null
          workflow_id: string
        }
        Update: {
          captured_at?: string
          cost_value?: number | null
          errors_value?: number | null
          id?: string
          intervention_id?: string
          people_value?: number | null
          revenue_value?: number | null
          time_value?: number | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_baselines_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_baselines_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_metrics: {
        Row: {
          cost_baseline: number | null
          cost_current: number | null
          errors_baseline: number | null
          errors_current: number | null
          people_baseline: number | null
          people_current: number | null
          revenue_baseline: number | null
          revenue_current: number | null
          time_baseline: number | null
          time_current: number | null
          updated_at: string
          workflow_id: string
        }
        Insert: {
          cost_baseline?: number | null
          cost_current?: number | null
          errors_baseline?: number | null
          errors_current?: number | null
          people_baseline?: number | null
          people_current?: number | null
          revenue_baseline?: number | null
          revenue_current?: number | null
          time_baseline?: number | null
          time_current?: number | null
          updated_at?: string
          workflow_id: string
        }
        Update: {
          cost_baseline?: number | null
          cost_current?: number | null
          errors_baseline?: number | null
          errors_current?: number | null
          people_baseline?: number | null
          people_current?: number | null
          revenue_baseline?: number | null
          revenue_current?: number | null
          time_baseline?: number | null
          time_current?: number | null
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_metrics_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: true
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_metrics_history: {
        Row: {
          id: string
          metric: string
          snapshot_date: string
          value: number
          workflow_id: string
        }
        Insert: {
          id?: string
          metric: string
          snapshot_date: string
          value: number
          workflow_id: string
        }
        Update: {
          id?: string
          metric?: string
          snapshot_date?: string
          value?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_metrics_history_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_revisions: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          workflow_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          workflow_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_revisions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          owner: string | null
          position: number
          regulatory_flag: string | null
          title: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          owner?: string | null
          position: number
          regulatory_flag?: string | null
          title: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          owner?: string | null
          position?: number
          regulatory_flag?: string | null
          title?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          active: boolean
          business_kpi: string | null
          created_at: string
          created_by: string | null
          criticality: string | null
          criticality_score: number | null
          deleted_at: string | null
          deleted_by: string | null
          frequency: string | null
          frequency_cadence: string | null
          frequency_per_week: number | null
          id: string
          name: string
          notes: string | null
          owner_names: string[]
          regulatory: boolean
          team: string | null
          tools_used: string[]
          updated_at: string
          visibility: string
          walkthrough: string | null
        }
        Insert: {
          active?: boolean
          business_kpi?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string | null
          criticality_score?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          frequency?: string | null
          frequency_cadence?: string | null
          frequency_per_week?: number | null
          id?: string
          name: string
          notes?: string | null
          owner_names?: string[]
          regulatory?: boolean
          team?: string | null
          tools_used?: string[]
          updated_at?: string
          visibility?: string
          walkthrough?: string | null
        }
        Update: {
          active?: boolean
          business_kpi?: string | null
          created_at?: string
          created_by?: string | null
          criticality?: string | null
          criticality_score?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          frequency?: string | null
          frequency_cadence?: string | null
          frequency_per_week?: number | null
          id?: string
          name?: string
          notes?: string | null
          owner_names?: string[]
          regulatory?: boolean
          team?: string | null
          tools_used?: string[]
          updated_at?: string
          visibility?: string
          walkthrough?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_score_company_average: { Args: never; Returns: number }
      can_delete_workflow: { Args: { p_workflow_id: string }; Returns: boolean }
      can_edit_intervention: {
        Args: { p_intervention_id: string }
        Returns: boolean
      }
      can_edit_suggestion: {
        Args: { p_suggestion_id: string }
        Returns: boolean
      }
      can_view_cohort_member: {
        Args: { p_cohort_member_id: string }
        Returns: boolean
      }
      current_user_email: { Args: never; Returns: string }
      delete_intervention: { Args: { p_id: string }; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      is_workflow_name_owner: {
        Args: { p_workflow_id: string }
        Returns: boolean
      }
      join_programme_cohort: {
        Args: { p_join_code: string; p_team_lead_user_id?: string }
        Returns: Json
      }
      leads_user_in_cohort: {
        Args: { p_cohort_id: string; p_user_id: string }
        Returns: boolean
      }
      link_ai_score_responses: { Args: never; Returns: number }
      log_intervention: {
        Args: {
          p_adoption_status?: string
          p_attribution_confidence?: string
          p_cost_saved_per_use: number
          p_description?: string
          p_frequency_cadence?: string
          p_minutes_saved_per_use: number
          p_name: string
          p_recipient_emails?: string[]
          p_revenue_per_use: number
          p_satisfaction?: number
          p_tools_used?: string[]
          p_types: string[]
          p_uses_per_week: number
          p_workflow_ids: string[]
        }
        Returns: string
      }
      owns_cohort_member: {
        Args: { p_cohort_member_id: string }
        Returns: boolean
      }
      programme_cohort_day_activity: {
        Args: { p_cohort_id: string }
        Returns: {
          completions: number
          day_index: number
          peers: number
        }[]
      }
      programme_delete_cohort: {
        Args: { p_cohort_id: string; p_confirm_name: string }
        Returns: Json
      }
      programme_edit_feedback: {
        Args: { p_comment: string; p_submission_id: string }
        Returns: Json
      }
      programme_set_cohort_test: {
        Args: { p_cohort_id: string; p_is_test: boolean }
        Returns: Json
      }
      programme_sign_off: {
        Args: {
          p_accuracy?: number
          p_capstone_credits?: number
          p_comment?: string
          p_completeness?: number
          p_decision: string
          p_reusability?: number
          p_submission_id: string
          p_usefulness?: number
        }
        Returns: Json
      }
      recent_logins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
        }[]
      }
      reset_programme_preview: { Args: never; Returns: Json }
      set_intervention_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      signed_in_emails: { Args: never; Returns: string[] }
      start_programme_preview: { Args: never; Returns: Json }
      swap_step_positions: {
        Args: { p_step_a: string; p_step_b: string }
        Returns: undefined
      }
      update_intervention: {
        Args: {
          p_adoption_status?: string
          p_attribution_confidence: string
          p_cost_saved_per_use: number
          p_description: string
          p_frequency_cadence?: string
          p_id: string
          p_minutes_saved_per_use: number
          p_name: string
          p_revenue_per_use: number
          p_satisfaction?: number
          p_types: string[]
          p_uses_per_week: number
        }
        Returns: undefined
      }
      user_emails: {
        Args: { p_user_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      programme_claim_pending_enrolments: { Args: Record<PropertyKey, never>; Returns: number }
      user_id_for_email: { Args: { p_email: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
