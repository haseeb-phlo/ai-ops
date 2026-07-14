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
          workflow_id: string | null
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
          workflow_id?: string | null
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
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intervention_suggestions_intervention_id_fkey"
            columns: ["intervention_id"]
            isOneToOne: false
            referencedRelation: "ai_interventions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intervention_suggestions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
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
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
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
      can_delete_workflow: { Args: { p_workflow_id: string }; Returns: boolean }
      can_edit_intervention: {
        Args: { p_intervention_id: string }
        Returns: boolean
      }
      delete_intervention: { Args: { p_id: string }; Returns: string }
      is_workflow_name_owner: {
        Args: { p_workflow_id: string }
        Returns: boolean
      }
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
      recent_logins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          last_sign_in_at: string
        }[]
      }
      set_intervention_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      signed_in_emails: { Args: never; Returns: string[] }
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
