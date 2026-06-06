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
      match_events: {
        Row: {
          assist_player_id: string | null
          card_player_id: string | null
          card_type: string | null
          created_at: string
          created_by: string | null
          foul_outcome: string | null
          id: string
          match_id: string
          minute: number | null
          note: string | null
          player_id: string | null
          sub_in_player_id: string | null
          team_id: string | null
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          assist_player_id?: string | null
          card_player_id?: string | null
          card_type?: string | null
          created_at?: string
          created_by?: string | null
          foul_outcome?: string | null
          id?: string
          match_id: string
          minute?: number | null
          note?: string | null
          player_id?: string | null
          sub_in_player_id?: string | null
          team_id?: string | null
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          assist_player_id?: string | null
          card_player_id?: string | null
          card_type?: string | null
          created_at?: string
          created_by?: string | null
          foul_outcome?: string | null
          id?: string
          match_id?: string
          minute?: number | null
          note?: string | null
          player_id?: string | null
          sub_in_player_id?: string | null
          team_id?: string | null
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "match_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_card_player_id_fkey"
            columns: ["card_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_sub_in_player_id_fkey"
            columns: ["sub_in_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_scorers: {
        Row: {
          match_id: string
          user_id: string
        }
        Insert: {
          match_id: string
          user_id: string
        }
        Update: {
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_scorers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_squads: {
        Row: {
          is_starter: boolean
          match_id: string
          player_id: string
          team_id: string
        }
        Insert: {
          is_starter?: boolean
          match_id: string
          player_id: string
          team_id: string
        }
        Update: {
          is_starter?: boolean
          match_id?: string
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_squads_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_squads_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          accumulated_seconds: number
          actual_started_at: string | null
          away_score: number
          away_team_id: string
          created_at: string
          current_half: number
          extra_time_minutes_per_half: number
          first_half_actual_seconds: number | null
          first_half_stoppage_seconds: number
          home_score: number
          home_team_id: string
          id: string
          minutes_per_half: number
          number_of_halves: number
          scheduled_at: string | null
          second_half_actual_seconds: number | null
          second_half_minutes: number | null
          second_half_stoppage_seconds: number
          started_by_user_id: string | null
          status: Database["public"]["Enums"]["match_status"]
          timer_started_at: string | null
          tournament_id: string
        }
        Insert: {
          accumulated_seconds?: number
          actual_started_at?: string | null
          away_score?: number
          away_team_id: string
          created_at?: string
          current_half?: number
          extra_time_minutes_per_half?: number
          first_half_actual_seconds?: number | null
          first_half_stoppage_seconds?: number
          home_score?: number
          home_team_id: string
          id?: string
          minutes_per_half?: number
          number_of_halves?: number
          scheduled_at?: string | null
          second_half_actual_seconds?: number | null
          second_half_minutes?: number | null
          second_half_stoppage_seconds?: number
          started_by_user_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          timer_started_at?: string | null
          tournament_id: string
        }
        Update: {
          accumulated_seconds?: number
          actual_started_at?: string | null
          away_score?: number
          away_team_id?: string
          created_at?: string
          current_half?: number
          extra_time_minutes_per_half?: number
          first_half_actual_seconds?: number | null
          first_half_stoppage_seconds?: number
          home_score?: number
          home_team_id?: string
          id?: string
          minutes_per_half?: number
          number_of_halves?: number
          scheduled_at?: string | null
          second_half_actual_seconds?: number | null
          second_half_minutes?: number | null
          second_half_stoppage_seconds?: number
          started_by_user_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          timer_started_at?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          date_of_birth: string | null
          id: string
          jersey_number: number | null
          last_modified_at: string | null
          last_modified_by: string | null
          name: string
          photo_url: string | null
          position: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          jersey_number?: number | null
          last_modified_at?: string | null
          last_modified_by?: string | null
          name: string
          photo_url?: string | null
          position?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          jersey_number?: number | null
          last_modified_at?: string | null
          last_modified_by?: string | null
          name?: string
          photo_url?: string | null
          position?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_private_contacts: {
        Row: {
          contact_info: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          contact_info?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          contact_info?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_private_contacts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          archived_at: string | null
          created_at: string
          description: string | null
          home_ground: string | null
          id: string
          is_archived: boolean
          last_modified_at: string | null
          last_modified_by: string | null
          logo_url: string | null
          name: string
          owner_id: string
          team_colors: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          home_ground?: string | null
          id?: string
          is_archived?: boolean
          last_modified_at?: string | null
          last_modified_by?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          team_colors?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          description?: string | null
          home_ground?: string | null
          id?: string
          is_archived?: boolean
          last_modified_at?: string | null
          last_modified_by?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          team_colors?: string | null
        }
        Relationships: []
      }
      tournament_teams: {
        Row: {
          added_at: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          added_at?: string
          team_id: string
          tournament_id: string
        }
        Update: {
          added_at?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          format: Database["public"]["Enums"]["tournament_format"]
          id: string
          name: string
          status: Database["public"]["Enums"]["tournament_status"]
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          format?: Database["public"]["Enums"]["tournament_format"]
          id?: string
          name: string
          status?: Database["public"]["Enums"]["tournament_status"]
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          format?: Database["public"]["Enums"]["tournament_format"]
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["tournament_status"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_score_match: {
        Args: { _match_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      is_team_owner: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_tournament_admin: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_tournament_admin: {
        Args: { _tournament_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "platform_owner" | "admin" | "user"
      event_type:
        | "goal"
        | "yellow_card"
        | "red_card"
        | "substitution"
        | "kickoff"
        | "halftime"
        | "second_half"
        | "fulltime"
        | "pause"
        | "resume"
        | "foul"
      match_status:
        | "scheduled"
        | "first_half"
        | "halftime"
        | "second_half"
        | "paused"
        | "finished"
      tournament_format: "league" | "knockout"
      tournament_status: "draft" | "active" | "completed"
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
      app_role: ["platform_owner", "admin", "user"],
      event_type: [
        "goal",
        "yellow_card",
        "red_card",
        "substitution",
        "kickoff",
        "halftime",
        "second_half",
        "fulltime",
        "pause",
        "resume",
        "foul",
      ],
      match_status: [
        "scheduled",
        "first_half",
        "halftime",
        "second_half",
        "paused",
        "finished",
      ],
      tournament_format: ["league", "knockout"],
      tournament_status: ["draft", "active", "completed"],
    },
  },
} as const
