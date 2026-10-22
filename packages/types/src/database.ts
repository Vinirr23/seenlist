// supabase/types/database.ts (packages/types/src/database.ts)
//
// GERADO AUTOMATICAMENTE pelo Supabase CLI contra o schema real de
// produção (projeto `segqotlvondqbkkenfyy`), em 2026-10-20 — comando:
//
//   npx supabase gen types typescript --project-id segqotlvondqbkkenfyy
//
// NÃO EDITAR À MÃO. Pra atualizar (depois de uma migration nova),
// rode o mesmo comando de novo e substitua este arquivo inteiro.
//
// Cobre: 42 tabelas, 1 view (`series_status_anomalies`), 16 funções
// (RPCs) e 0 enums (o schema usa `text` + `check` em vez de enum do
// Postgres — confirmado, não é lacuna da geração).
//
// Usado por `apps/mobile/lib/supabase.ts` via `createClient<Database>(...)`
// (FASE B — correção da tipagem do cliente mobile, auditoria de
// 2026-10-20). Ainda NÃO usado por `apps/web` nesta etapa — fora do
// escopo autorizado.
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
      app_config: {
        Row: {
          force_update_android: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          force_update_android?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          force_update_android?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      beta_signups: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      beta_waitlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string | null
          contains_spoiler: boolean
          created_at: string
          deleted_at: string | null
          episode_number: number | null
          id: string
          image_url: string | null
          media_id: number
          media_type: string
          parent_comment_id: string | null
          season_number: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          contains_spoiler?: boolean
          created_at?: string
          deleted_at?: string | null
          episode_number?: number | null
          id?: string
          image_url?: string | null
          media_id: number
          media_type: string
          parent_comment_id?: string | null
          season_number?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          contains_spoiler?: boolean
          created_at?: string
          deleted_at?: string | null
          episode_number?: number | null
          id?: string
          image_url?: string | null
          media_id?: number
          media_type?: string
          parent_comment_id?: string | null
          season_number?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reporter_id: string
          reviewed_at: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id: string
          reviewed_at?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string
          reviewed_at?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          media_id: number
          media_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          media_id: number
          media_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          media_id?: number
          media_type?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_preferences: {
        Row: {
          updated_at: string
          user_id: string
          weights: Json
        }
        Insert: {
          updated_at?: string
          user_id: string
          weights?: Json
        }
        Update: {
          updated_at?: string
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      list_items: {
        Row: {
          added_at: string
          id: string
          list_id: string
          media_id: number
          media_type: string
        }
        Insert: {
          added_at?: string
          id?: string
          list_id: string
          media_id: number
          media_type: string
        }
        Update: {
          added_at?: string
          id?: string
          list_id?: string
          media_id?: number
          media_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_watch_progress: {
        Row: {
          created_at: string
          episode_number: number | null
          id: string
          list_id: string
          media_id: number
          media_type: string
          season_number: number | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          episode_number?: number | null
          id?: string
          list_id: string
          media_id: number
          media_type: string
          season_number?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          episode_number?: number | null
          id?: string
          list_id?: string
          media_id?: number
          media_type?: string
          season_number?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_watch_progress_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          co_owner_id: string | null
          co_owner_status: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          co_owner_id?: string | null
          co_owner_status?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          co_owner_id?: string | null
          co_owner_status?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      media_summaries_cache: {
        Row: {
          ended: boolean | null
          fetched_at: string
          genres: number[] | null
          language: string
          media_type: string
          origin_countries: string[] | null
          original_title: string | null
          poster_path: string | null
          production_countries: string[] | null
          release_date: string | null
          runtime_minutes: number | null
          title: string
          tmdb_id: number
          total_episodes: number | null
          vote_average: number | null
          vote_count: number | null
          year: number | null
        }
        Insert: {
          ended?: boolean | null
          fetched_at?: string
          genres?: number[] | null
          language?: string
          media_type: string
          origin_countries?: string[] | null
          original_title?: string | null
          poster_path?: string | null
          production_countries?: string[] | null
          release_date?: string | null
          runtime_minutes?: number | null
          title: string
          tmdb_id: number
          total_episodes?: number | null
          vote_average?: number | null
          vote_count?: number | null
          year?: number | null
        }
        Update: {
          ended?: boolean | null
          fetched_at?: string
          genres?: number[] | null
          language?: string
          media_type?: string
          origin_countries?: string[] | null
          original_title?: string | null
          poster_path?: string | null
          production_countries?: string[] | null
          release_date?: string | null
          runtime_minutes?: number | null
          title?: string
          tmdb_id?: number
          total_episodes?: number | null
          vote_average?: number | null
          vote_count?: number | null
          year?: number | null
        }
        Relationships: []
      }
      movie_status: {
        Row: {
          created_at: string
          movie_id: number
          rewatch_count: number
          status: string
          updated_at: string
          user_id: string
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          movie_id: number
          rewatch_count?: number
          status: string
          updated_at?: string
          user_id: string
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          movie_id?: number
          rewatch_count?: number
          status?: string
          updated_at?: string
          user_id?: string
          watched_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          comment_like: boolean
          comment_reply: boolean
          episode_new: boolean
          new_feedback: boolean | null
          new_follower: boolean | null
          post_like: boolean | null
          recommendation: boolean | null
          review_like: boolean
          season_premiere: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_like?: boolean
          comment_reply?: boolean
          episode_new?: boolean
          new_feedback?: boolean | null
          new_follower?: boolean | null
          post_like?: boolean | null
          recommendation?: boolean | null
          review_like?: boolean
          season_premiere?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_like?: boolean
          comment_reply?: boolean
          episode_new?: boolean
          new_feedback?: boolean | null
          new_follower?: boolean | null
          post_like?: boolean | null
          recommendation?: boolean | null
          review_like?: boolean
          season_premiere?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          group_count: number
          id: string
          payload: Json | null
          push_result: Json | null
          pushed_at: string | null
          read_at: string | null
          target_episode_number: number | null
          target_id: string | null
          target_media_id: number | null
          target_media_type: string | null
          target_season_number: number | null
          target_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          group_count?: number
          id?: string
          payload?: Json | null
          push_result?: Json | null
          pushed_at?: string | null
          read_at?: string | null
          target_episode_number?: number | null
          target_id?: string | null
          target_media_id?: number | null
          target_media_type?: string | null
          target_season_number?: number | null
          target_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          group_count?: number
          id?: string
          payload?: Json | null
          push_result?: Json | null
          pushed_at?: string | null
          read_at?: string | null
          target_episode_number?: number | null
          target_id?: string | null
          target_media_id?: number | null
          target_media_type?: string | null
          target_season_number?: number | null
          target_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      perf_measurements: {
        Row: {
          created_at: string
          id: string
          metric: string
          page: string | null
          rating: string | null
          user_agent: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          page?: string | null
          rating?: string | null
          user_agent?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          page?: string | null
          rating?: string | null
          user_agent?: string | null
          value?: number
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          id: string
          label: string
          position: number
          post_id: string
        }
        Insert: {
          id?: string
          label: string
          position?: number
          post_id: string
        }
        Update: {
          id?: string
          label?: string
          position?: number
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          option_id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string | null
          contains_spoiler: boolean
          created_at: string
          deleted_at: string | null
          gif_url: string | null
          id: string
          image_url: string | null
          media_id: number | null
          media_poster_path: string | null
          media_title: string | null
          media_type: string | null
          pinned: boolean
          rating: number | null
          recommended_media_id: number | null
          recommended_media_type: string | null
          review_watched_snapshot: boolean | null
          spoiler_episode_number: number | null
          spoiler_media_id: number | null
          spoiler_media_type: string | null
          spoiler_season_number: number | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          contains_spoiler?: boolean
          created_at?: string
          deleted_at?: string | null
          gif_url?: string | null
          id?: string
          image_url?: string | null
          media_id?: number | null
          media_poster_path?: string | null
          media_title?: string | null
          media_type?: string | null
          pinned?: boolean
          rating?: number | null
          recommended_media_id?: number | null
          recommended_media_type?: string | null
          review_watched_snapshot?: boolean | null
          spoiler_episode_number?: number | null
          spoiler_media_id?: number | null
          spoiler_media_type?: string | null
          spoiler_season_number?: number | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          contains_spoiler?: boolean
          created_at?: string
          deleted_at?: string | null
          gif_url?: string | null
          id?: string
          image_url?: string | null
          media_id?: number | null
          media_poster_path?: string | null
          media_title?: string | null
          media_type?: string | null
          pinned?: boolean
          rating?: number | null
          recommended_media_id?: number | null
          recommended_media_type?: string | null
          review_watched_snapshot?: boolean | null
          spoiler_episode_number?: number | null
          spoiler_media_id?: number | null
          spoiler_media_type?: string | null
          spoiler_season_number?: number | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_focal_y: number
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          favorites_visibility: string
          featured_achievement_ids: string[] | null
          id: string
          language: string
          library_visibility: string
          profile_visibility: string
          updated_at: string
          user_id: string
          username: string
          verified_tier: string | null
          whats_new_seen_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_focal_y?: number
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          favorites_visibility?: string
          featured_achievement_ids?: string[] | null
          id?: string
          language?: string
          library_visibility?: string
          profile_visibility?: string
          updated_at?: string
          user_id: string
          username: string
          verified_tier?: string | null
          whats_new_seen_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_focal_y?: number
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          favorites_visibility?: string
          featured_achievement_ids?: string[] | null
          id?: string
          language?: string
          library_visibility?: string
          profile_visibility?: string
          updated_at?: string
          user_id?: string
          username?: string
          verified_tier?: string | null
          whats_new_seen_at?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          id: string
          media_id: number
          media_type: string
          message: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          media_id: number
          media_type: string
          message?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_id?: number
          media_type?: string
          message?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          contains_spoiler: boolean
          created_at: string
          deleted_at: string | null
          episode_number: number | null
          favorite_character_id: number | null
          favorite_character_name: string | null
          id: string
          media_id: number
          media_type: string
          mood: string[] | null
          rating: number | null
          review_text: string | null
          season_number: number | null
          updated_at: string
          user_id: string
          watched_platform: string | null
        }
        Insert: {
          contains_spoiler?: boolean
          created_at?: string
          deleted_at?: string | null
          episode_number?: number | null
          favorite_character_id?: number | null
          favorite_character_name?: string | null
          id?: string
          media_id: number
          media_type: string
          mood?: string[] | null
          rating?: number | null
          review_text?: string | null
          season_number?: number | null
          updated_at?: string
          user_id: string
          watched_platform?: string | null
        }
        Update: {
          contains_spoiler?: boolean
          created_at?: string
          deleted_at?: string | null
          episode_number?: number | null
          favorite_character_id?: number | null
          favorite_character_name?: string | null
          id?: string
          media_id?: number
          media_type?: string
          mood?: string[] | null
          rating?: number | null
          review_text?: string | null
          season_number?: number | null
          updated_at?: string
          user_id?: string
          watched_platform?: string | null
        }
        Relationships: []
      }
      saved_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      season_recaps: {
        Row: {
          ai_provider: string
          episode_coverage: number
          generated_at: string
          in_thirty_seconds: string
          key_events: Json
          language: string
          prompt_version: number
          season_number: number
          source_hash: string
          tmdb_id: number
          where_it_ended: string | null
        }
        Insert: {
          ai_provider: string
          episode_coverage: number
          generated_at?: string
          in_thirty_seconds: string
          key_events: Json
          language?: string
          prompt_version: number
          season_number: number
          source_hash: string
          tmdb_id: number
          where_it_ended?: string | null
        }
        Update: {
          ai_provider?: string
          episode_coverage?: number
          generated_at?: string
          in_thirty_seconds?: string
          key_events?: Json
          language?: string
          prompt_version?: number
          season_number?: number
          source_hash?: string
          tmdb_id?: number
          where_it_ended?: string | null
        }
        Relationships: []
      }
      series_season_episode_counts: {
        Row: {
          episode_count: number
          fetched_at: string
          season_number: number
          series_id: number
        }
        Insert: {
          episode_count: number
          fetched_at?: string
          season_number: number
          series_id: number
        }
        Update: {
          episode_count?: number
          fetched_at?: string
          season_number?: number
          series_id?: number
        }
        Relationships: []
      }
      series_status: {
        Row: {
          created_at: string
          last_activity_at: string
          last_known_aired_count: number | null
          last_new_episode_at: string | null
          next_episode_number: number | null
          next_season_number: number | null
          series_id: number
          status: string
          status_computed_at: string | null
          total_watch_events: number | null
          tvtime_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_activity_at?: string
          last_known_aired_count?: number | null
          last_new_episode_at?: string | null
          next_episode_number?: number | null
          next_season_number?: number | null
          series_id: number
          status: string
          status_computed_at?: string | null
          total_watch_events?: number | null
          tvtime_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_activity_at?: string
          last_known_aired_count?: number | null
          last_new_episode_at?: string | null
          next_episode_number?: number | null
          next_season_number?: number | null
          series_id?: number
          status?: string
          status_computed_at?: string | null
          total_watch_events?: number | null
          tvtime_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      series_status_history: {
        Row: {
          changed_at: string
          id: number
          new_status: string
          old_status: string | null
          series_id: number
          source: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: never
          new_status: string
          old_status?: string | null
          series_id: number
          source?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: never
          new_status?: string
          old_status?: string | null
          series_id?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      tvtime_import_events: {
        Row: {
          ambiguous_titles: string[]
          auto_matched_shows: number
          created_at: string
          elapsed_seconds: number
          id: string
          imported_episodes: number
          manually_resolved_shows: number
          not_found_shows: number
          total_shows: number
          user_id: string
        }
        Insert: {
          ambiguous_titles?: string[]
          auto_matched_shows: number
          created_at?: string
          elapsed_seconds: number
          id?: string
          imported_episodes: number
          manually_resolved_shows: number
          not_found_shows: number
          total_shows: number
          user_id: string
        }
        Update: {
          ambiguous_titles?: string[]
          auto_matched_shows?: number
          created_at?: string
          elapsed_seconds?: number
          id?: string
          imported_episodes?: number
          manually_resolved_shows?: number
          not_found_shows?: number
          total_shows?: number
          user_id?: string
        }
        Relationships: []
      }
      tvtime_import_snapshots: {
        Row: {
          completed_count: number
          confidence: number
          created_at: string
          episodes_count: number
          favorites_count: number
          id: string
          import_type: string
          imported_at: string
          pending_review_count: number
          series_count: number
          user_id: string
          want_to_watch_count: number
        }
        Insert: {
          completed_count: number
          confidence: number
          created_at?: string
          episodes_count: number
          favorites_count: number
          id?: string
          import_type: string
          imported_at?: string
          pending_review_count: number
          series_count: number
          user_id: string
          want_to_watch_count: number
        }
        Update: {
          completed_count?: number
          confidence?: number
          created_at?: string
          episodes_count?: number
          favorites_count?: number
          id?: string
          import_type?: string
          imported_at?: string
          pending_review_count?: number
          series_count?: number
          user_id?: string
          want_to_watch_count?: number
        }
        Relationships: []
      }
      tvtime_tmdb_mappings: {
        Row: {
          confidence: string
          created_at: string
          tmdb_id: number
          tvtime_id: string
          tvtime_name: string
        }
        Insert: {
          confidence: string
          created_at?: string
          tmdb_id: number
          tvtime_id: string
          tvtime_name: string
        }
        Update: {
          confidence?: string
          created_at?: string
          tmdb_id?: number
          tvtime_id?: string
          tvtime_name?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          celebrated_at: string | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          celebrated_at?: string | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          celebrated_at?: string | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feed_categories: {
        Row: {
          category: string
          created_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          admin_replied_at: string | null
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          type: string
          user_id: string
        }
        Insert: {
          admin_replied_at?: string | null
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          type: string
          user_id: string
        }
        Update: {
          admin_replied_at?: string | null
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      watched_episodes: {
        Row: {
          episode_number: number
          is_special: boolean
          local_timezone: string | null
          rewatch_count: number
          season_number: number
          series_id: number
          source: string | null
          tmdb_episode_id: number | null
          user_id: string
          watched_at: string
        }
        Insert: {
          episode_number: number
          is_special?: boolean
          local_timezone?: string | null
          rewatch_count?: number
          season_number: number
          series_id: number
          source?: string | null
          tmdb_episode_id?: number | null
          user_id: string
          watched_at?: string
        }
        Update: {
          episode_number?: number
          is_special?: boolean
          local_timezone?: string | null
          rewatch_count?: number
          season_number?: number
          series_id?: number
          source?: string | null
          tmdb_episode_id?: number | null
          user_id?: string
          watched_at?: string
        }
        Relationships: []
      }
      web_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      week_review_pregenerated: {
        Row: {
          activity_count: number
          dominant_color: string | null
          generated_at: string
          media_id: number
          media_type: string
          rating: number | null
          season_number: number | null
          streak_weeks: number
          title: string | null
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          activity_count: number
          dominant_color?: string | null
          generated_at?: string
          media_id: number
          media_type: string
          rating?: number | null
          season_number?: number | null
          streak_weeks?: number
          title?: string | null
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          activity_count?: number
          dominant_color?: string | null
          generated_at?: string
          media_id?: number
          media_type?: string
          rating?: number | null
          season_number?: number | null
          streak_weeks?: number
          title?: string | null
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      whats_new_entries: {
        Row: {
          created_at: string
          description: string
          icon_key: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          icon_key: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          icon_key?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      series_status_anomalies: {
        Row: {
          cached_total_episodes: number | null
          has_identical_timestamp_batch: boolean | null
          largest_duplicate_timestamp_batch: number | null
          row_count_exceeds_cached_total: boolean | null
          rows_in_duplicate_timestamp_batches: number | null
          series_id: number | null
          user_id: string | null
          watched_row_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_pending_notifications: {
        Args: { p_limit: number }
        Returns: {
          actor_id: string | null
          created_at: string
          group_count: number
          id: string
          payload: Json | null
          push_result: Json | null
          pushed_at: string | null
          read_at: string | null
          target_episode_number: number | null
          target_id: string | null
          target_media_id: number | null
          target_media_type: string | null
          target_season_number: number | null
          target_type: string | null
          type: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      evaluate_achievements: { Args: never; Returns: undefined }
      evaluate_and_unlock_achievements: {
        Args: { p_user_id: string; p_utc_offset_minutes?: number }
        Returns: string[]
      }
      generate_unique_username: {
        Args: { base_email: string }
        Returns: string
      }
      get_achievement_progress_counts: {
        Args: { p_user_id: string }
        Returns: {
          comedy_titles_count: number
          comments_count: number
          completed_series_count: number
          countries_count: number
          drama_titles_count: number
          favorites_count: number
          following_count: number
          genres_count: number
          library_count: number
          reviews_count: number
          up_to_date_series_count: number
          watchlist_count: number
        }[]
      }
      get_achievement_rarity: {
        Args: never
        Returns: {
          achievement_id: string
          unlock_percentage: number
        }[]
      }
      get_last_activity: { Args: never; Returns: Json }
      get_movie_added_count: { Args: { p_movie_id: number }; Returns: number }
      get_observability_stats: { Args: never; Returns: Json }
      get_retention_cohorts: { Args: never; Returns: Json }
      get_watched_episode_stats: {
        Args: { p_user_id: string }
        Returns: {
          last_watched_at: string
          series_id: number
          watched_count: number
        }[]
      }
      get_year_activity_percentile: {
        Args: { p_year: number }
        Returns: number
      }
      mark_achievement_celebrated: {
        Args: { p_achievement_id: string }
        Returns: undefined
      }
      recalculate_top_percentile_achievements: { Args: never; Returns: number }
      restore_user_library: { Args: { snapshot: Json }; Returns: undefined }
      set_series_status_with_history:
        | {
            Args: {
              p_series_id: number
              p_source?: string
              p_status: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_series_id: number
              p_source?: string
              p_status: string
              p_status_computed_at?: string
              p_user_id: string
            }
            Returns: undefined
          }
      wipe_user_library: { Args: never; Returns: Json }
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
