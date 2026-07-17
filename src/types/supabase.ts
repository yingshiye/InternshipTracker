// Hand-written to match supabase/migrations/_create_applications.sql.
// Replace with `npx supabase gen types typescript --local > src/types/supabase.ts`
// once a local Supabase stack (Docker) is available.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ApplicationStatus =
  | "wishlist"
  | "applied"
  | "oa"
  | "interview"
  | "offer"
  | "rejected";

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          id: string;
          user_id: string;
          company: string;
          role: string;
          status: ApplicationStatus;
          location: string | null;
          job_url: string | null;
          notes: string | null;
          applied_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company: string;
          role: string;
          status?: ApplicationStatus;
          location?: string | null;
          job_url?: string | null;
          notes?: string | null;
          applied_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company?: string;
          role?: string;
          status?: ApplicationStatus;
          location?: string | null;
          job_url?: string | null;
          notes?: string | null;
          applied_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          user_id: string;
          application_id: string;
          title: string;
          event_type: string | null;
          event_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          application_id: string;
          title: string;
          event_type?: string | null;
          event_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          application_id?: string;
          title?: string;
          event_type?: string | null;
          event_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      // TODO: regenerate with supabase gen types once Docker is available
      url_snapshots: {
        Row: {
          id: string;
          url: string;
          content_hash: string | null;
          last_checked: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          content_hash?: string | null;
          last_checked?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          content_hash?: string | null;
          last_checked?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_watchlist: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          company: string;
          notified_hash: string | null;
          has_changes: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          company: string;
          notified_hash?: string | null;
          has_changes?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          company?: string;
          notified_hash?: string | null;
          has_changes?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
