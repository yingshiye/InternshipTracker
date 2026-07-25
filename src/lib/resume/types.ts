import type {
  CustomLinks,
  EducationData,
  LayoutKind,
  SkillsData,
  StyleSettings,
  Tables,
  TargetLength,
  VersionType,
} from "@/types/supabase";

export const LAYOUT_KINDS: LayoutKind[] = ["entry", "education", "skills"];
export const TARGET_LENGTHS: TargetLength[] = ["one_page", "two_pages", "no_limit"];
export const VERSION_TYPES: VersionType[] = ["manual", "exported", "submitted"];

export type { LayoutKind, TargetLength, VersionType, EducationData, SkillsData, CustomLinks, StyleSettings };

export type LibraryBlock = Tables<"resume_library_blocks">;
export type LibraryBullet = Tables<"resume_library_bullets">;
export type Resume = Tables<"resumes">;
export type ResumeHeader = Tables<"resume_headers">;
export type ResumeSection = Tables<"resume_sections">;
export type ResumeEntry = Tables<"resume_entries">;
export type ResumeEntryBullet = Tables<"resume_entry_bullets">;
export type ResumeVersion = Tables<"resume_versions">;
