// Hand-written to match supabase/migrations/_create_applications.sql and
// supabase/migrations/20260723090546_create_resume_builder.sql.
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

// ─── Resume Builder domain enums ────────────────────────────────────────────

export type LayoutKind = "entry" | "education" | "skills";
export type TargetLength = "one_page" | "two_pages" | "no_limit";
export type VersionType = "manual" | "exported" | "submitted";

// ─── Resume Builder JSONB domain shapes ─────────────────────────────────────
// These are narrower than `Json` for the specific columns that hold them.
// Validated by src/lib/resume/validate.ts before ever reaching the database.

export type EducationData = {
  degree?: string;
  field_of_study?: string;
  minor?: string;
  gpa?: string;
  honors?: string[];
  coursework?: string[];
  details?: string[];
};

export type SkillsData = {
  categories: { label: string; items: string[] }[];
};

export type CustomLinks = {
  links: { label: string; url: string }[];
};

export type LineSpacing = "compact" | "standard" | "comfortable";
export type BlockSpacing = "tight" | "standard" | "wide";
export type DateFormat = "MM YYYY" | "MM/YYYY" | "YYYY";

export type BodyFontSizePt = 9.5 | 10 | 10.5 | 11 | 11.5 | 12;
export type NameFontSizePt = 16 | 18 | 20 | 22 | 24;
export type HeadingFontSizePt = 10 | 11 | 12 | 13 | 14;
export type MarginIn = 0.4 | 0.5 | 0.6 | 0.7 | 0.75 | 1;

// Canonical (post-normalization) style settings. The DB stores a free-form
// validated JSON object; `normalizeStyleSettings` fills every key with a
// default, so the in-memory shape is fully required. No font-family field.
export type StyleSettings = {
  body_font_size_pt: BodyFontSizePt;
  name_font_size_pt: NameFontSizePt;
  heading_font_size_pt: HeadingFontSizePt;
  margin_in: MarginIn;
  line_spacing: LineSpacing;
  section_spacing: BlockSpacing;
  bullet_spacing: BlockSpacing;
  date_format: DateFormat;
};

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
          // Step 3: the immutable resume version submitted with this
          // application. Writable only through set_application_resume_version
          // — a database trigger rejects any other write to this column.
          submitted_resume_version_id: string | null;
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
          has_changes: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          company: string;
          has_changes?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          company?: string;
          has_changes?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── Resume Builder: master library ────────────────────────────────
      resume_library_blocks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          default_section_title: string;
          layout_kind: LayoutKind;
          title: string | null;
          subtitle: string | null;
          organization: string | null;
          location: string | null;
          start_date: string | null;
          end_date: string | null;
          education_data: EducationData | null;
          skills_data: SkillsData | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          default_section_title: string;
          layout_kind: LayoutKind;
          title?: string | null;
          subtitle?: string | null;
          organization?: string | null;
          location?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          education_data?: EducationData | null;
          skills_data?: SkillsData | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          default_section_title?: string;
          layout_kind?: LayoutKind;
          title?: string | null;
          subtitle?: string | null;
          organization?: string | null;
          location?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          education_data?: EducationData | null;
          skills_data?: SkillsData | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resume_library_bullets: {
        Row: {
          id: string;
          user_id: string;
          block_id: string;
          content: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          block_id: string;
          content: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          block_id?: string;
          content?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ─── Resume Builder: editable draft (read-only via the Data API — ──
      // all mutation happens through the RPC functions below) ────────────
      resumes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          target_company: string | null;
          target_role: string | null;
          style_settings: StyleSettings;
          target_length: TargetLength;
          revision: number;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      resume_headers: {
        Row: {
          id: string;
          resume_id: string;
          user_id: string;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          location: string | null;
          linkedin_url: string | null;
          github_url: string | null;
          portfolio_url: string | null;
          custom_links: CustomLinks;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      resume_sections: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          title: string;
          layout_kind: LayoutKind;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      resume_entries: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          section_id: string;
          source_block_id: string | null;
          source_block_updated_at: string | null;
          title: string | null;
          subtitle: string | null;
          organization: string | null;
          location: string | null;
          start_date: string | null;
          end_date: string | null;
          education_data: EducationData | null;
          skills_data: SkillsData | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      resume_entry_bullets: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          entry_id: string;
          source_bullet_id: string | null;
          content: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      // ─── Resume Builder: immutable versions (insert only via RPC) ──────
      resume_versions: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          version_number: number;
          version_type: VersionType;
          snapshot: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_resume: {
        Args: { p_name: string; p_target_company?: string | null; p_target_role?: string | null };
        Returns: { resume_id: string; revision: number }[];
      };
      update_resume_metadata: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_name: string;
          p_target_company: string | null;
          p_target_role: string | null;
        };
        Returns: number;
      };
      update_resume_style: {
        Args: { p_resume_id: string; p_expected_revision: number; p_style_settings: Json };
        Returns: number;
      };
      update_resume_target_length: {
        Args: { p_resume_id: string; p_expected_revision: number; p_target_length: TargetLength };
        Returns: number;
      };
      set_resume_archived: {
        Args: { p_resume_id: string; p_expected_revision: number; p_archived: boolean };
        Returns: number;
      };
      update_resume_header: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_full_name: string | null;
          p_email: string | null;
          p_phone: string | null;
          p_location: string | null;
          p_linkedin_url: string | null;
          p_github_url: string | null;
          p_portfolio_url: string | null;
          p_custom_links: Json;
        };
        Returns: number;
      };
      delete_resume: {
        Args: { p_resume_id: string; p_expected_revision: number };
        Returns: { deleted: boolean }[];
      };
      duplicate_resume: {
        Args: { p_source_resume_id: string; p_new_name?: string | null };
        Returns: string;
      };
      create_section: {
        Args: { p_resume_id: string; p_expected_revision: number; p_title: string; p_layout_kind: LayoutKind };
        Returns: { section_id: string; revision: number }[];
      };
      rename_section: {
        Args: { p_resume_id: string; p_expected_revision: number; p_section_id: string; p_title: string };
        Returns: number;
      };
      delete_section: {
        Args: { p_resume_id: string; p_expected_revision: number; p_section_id: string };
        Returns: number;
      };
      reorder_sections: {
        Args: { p_resume_id: string; p_expected_revision: number; p_ordered_section_ids: string[] };
        Returns: number;
      };
      copy_block_into_section: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_section_id: string;
          p_block_id: string;
          p_bullet_ids: string[];
        };
        Returns: { entry_id: string; revision: number }[];
      };
      update_entry: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_entry_id: string;
          p_title: string | null;
          p_subtitle: string | null;
          p_organization: string | null;
          p_location: string | null;
          p_start_date: string | null;
          p_end_date: string | null;
          p_education_data: Json | null;
          p_skills_data: Json | null;
        };
        Returns: number;
      };
      remove_entry: {
        Args: { p_resume_id: string; p_expected_revision: number; p_entry_id: string };
        Returns: number;
      };
      move_entry: {
        Args: { p_resume_id: string; p_expected_revision: number; p_entry_id: string; p_target_section_id: string };
        Returns: number;
      };
      reorder_entries: {
        Args: { p_resume_id: string; p_expected_revision: number; p_section_id: string; p_ordered_entry_ids: string[] };
        Returns: number;
      };
      update_entry_bullet: {
        Args: { p_resume_id: string; p_expected_revision: number; p_bullet_id: string; p_content: string };
        Returns: number;
      };
      remove_entry_bullet: {
        Args: { p_resume_id: string; p_expected_revision: number; p_bullet_id: string };
        Returns: number;
      };
      reorder_entry_bullets: {
        Args: { p_resume_id: string; p_expected_revision: number; p_entry_id: string; p_ordered_bullet_ids: string[] };
        Returns: number;
      };
      add_bullet_from_library: {
        Args: { p_resume_id: string; p_expected_revision: number; p_entry_id: string; p_library_bullet_id: string };
        Returns: { bullet_id: string; revision: number }[];
      };
      create_resume_version: {
        Args: { p_resume_id: string; p_expected_revision: number; p_version_type: VersionType };
        Returns: { version_id: string; version_number: number; created_at: string }[];
      };
      add_custom_entry: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_section_id: string;
          p_title: string | null;
          p_subtitle: string | null;
          p_organization: string | null;
          p_location: string | null;
          p_start_date: string | null;
          p_end_date: string | null;
          p_education_data: Json | null;
          p_skills_data: Json | null;
        };
        Returns: { entry_id: string; revision: number }[];
      };
      add_custom_bullet: {
        Args: { p_resume_id: string; p_expected_revision: number; p_entry_id: string; p_content: string };
        Returns: { bullet_id: string; revision: number }[];
      };
      apply_library_update: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_entry_id: string;
          p_apply_fields: string[];
          p_update_bullet_ids: string[];
          p_add_library_bullet_ids: string[];
          p_remove_bullet_ids: string[];
          p_confirm_removals: boolean;
        };
        Returns: {
          revision: number;
          fields_applied: number;
          bullets_updated: number;
          bullets_added: number;
          bullets_removed: number;
        }[];
      };
      move_entry_to_position: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_entry_id: string;
          p_target_section_id: string;
          p_ordered_entry_ids: string[];
        };
        Returns: { revision: number; section_id: string; ordered_entry_ids: string[] }[];
      };
      save_bullet_as_library_bullet: {
        Args: { p_resume_id: string; p_expected_revision: number; p_bullet_id: string; p_block_id: string };
        Returns: { library_bullet_id: string; revision: number }[];
      };
      restore_entry: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_section_id: string;
          p_position: number;
          p_title: string | null;
          p_subtitle: string | null;
          p_organization: string | null;
          p_location: string | null;
          p_start_date: string | null;
          p_end_date: string | null;
          p_education_data: Json | null;
          p_skills_data: Json | null;
          p_source_block_id: string | null;
          p_bullets: { content: string; source_bullet_id: string | null }[];
        };
        Returns: { entry_id: string; bullet_ids: string[]; revision: number }[];
      };
      restore_bullet: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_entry_id: string;
          p_position: number;
          p_content: string;
          p_source_bullet_id: string | null;
        };
        Returns: { bullet_id: string; revision: number }[];
      };
      restore_section: {
        Args: {
          p_resume_id: string;
          p_expected_revision: number;
          p_position: number;
          p_title: string;
          p_layout_kind: LayoutKind;
        };
        Returns: { section_id: string; revision: number }[];
      };
      // ── Step 3 ────────────────────────────────────────────────────────────
      restore_resume_from_version: {
        Args: { p_resume_id: string; p_expected_revision: number; p_version_id: string };
        Returns: number;
      };
      set_application_resume_version: {
        Args: {
          p_application_id: string;
          p_resume_version_id: string | null;
          p_confirm_replace?: boolean;
        };
        Returns: boolean;
      };
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

export type Functions<T extends keyof Database["public"]["Functions"]> =
  Database["public"]["Functions"][T];
