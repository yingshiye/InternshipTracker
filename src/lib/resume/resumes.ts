import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { callResumeRpc, type RpcResult } from "./rpc";
import type { Resume, StyleSettings, TargetLength } from "./types";
import { TARGET_LENGTHS } from "./types";
import { ValidationError, normalizeOptionalText, normalizePlainText, validateCustomLinks, validateHttpUrl } from "./validate";

// Every mutation in this file goes through a SECURITY DEFINER RPC —
// `resumes`/`resume_headers` allow the client SELECT only; there is no
// direct .insert()/.update()/.delete() anywhere below.

export async function listResumes(
  supabase: SupabaseClient<Database>,
  options?: { archived?: boolean },
): Promise<Resume[]> {
  let query = supabase.from("resumes").select("*").order("updated_at", { ascending: false });
  query = options?.archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getResume(supabase: SupabaseClient<Database>, resumeId: string): Promise<Resume | null> {
  const { data, error } = await supabase.from("resumes").select("*").eq("id", resumeId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createResume(
  supabase: SupabaseClient<Database>,
  input: { name: string; targetCompany?: string | null; targetRole?: string | null },
): Promise<RpcResult<{ resume_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "create_resume", {
    p_name: normalizePlainText(input.name, "name"),
    p_target_company: normalizeOptionalText(input.targetCompany, "target_company"),
    p_target_role: normalizeOptionalText(input.targetRole, "target_role"),
  });
}

export async function updateResumeMetadata(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  input: { name: string; targetCompany?: string | null; targetRole?: string | null },
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "update_resume_metadata", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_name: normalizePlainText(input.name, "name"),
    p_target_company: normalizeOptionalText(input.targetCompany, "target_company"),
    p_target_role: normalizeOptionalText(input.targetRole, "target_role"),
  });
}

export async function updateResumeStyle(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  styleSettings: StyleSettings,
): Promise<RpcResult<number>> {
  if (typeof styleSettings !== "object" || styleSettings === null || Array.isArray(styleSettings)) {
    throw new ValidationError("style_settings must be an object");
  }
  return callResumeRpc(supabase, "update_resume_style", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_style_settings: styleSettings,
  });
}

export async function updateResumeTargetLength(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  targetLength: TargetLength,
): Promise<RpcResult<number>> {
  if (!TARGET_LENGTHS.includes(targetLength)) throw new ValidationError("Invalid target_length");
  return callResumeRpc(supabase, "update_resume_target_length", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_target_length: targetLength,
  });
}

export async function setResumeArchived(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  archived: boolean,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "set_resume_archived", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_archived: archived,
  });
}

export type ResumeHeaderInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  customLinks?: unknown;
};

function normalizeOptionalUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return validateHttpUrl(trimmed);
}

export async function updateResumeHeader(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  input: ResumeHeaderInput,
): Promise<RpcResult<number>> {
  const customLinks = validateCustomLinks(input.customLinks);
  return callResumeRpc(supabase, "update_resume_header", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_full_name: normalizeOptionalText(input.fullName, "full_name"),
    p_email: normalizeOptionalText(input.email, "email"),
    p_phone: normalizeOptionalText(input.phone, "phone"),
    p_location: normalizeOptionalText(input.location, "location"),
    p_linkedin_url: normalizeOptionalUrl(input.linkedinUrl),
    p_github_url: normalizeOptionalUrl(input.githubUrl),
    p_portfolio_url: normalizeOptionalUrl(input.portfolioUrl),
    p_custom_links: customLinks,
  });
}

export async function deleteResume(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
): Promise<RpcResult<{ deleted: boolean }[]>> {
  return callResumeRpc(supabase, "delete_resume", { p_resume_id: resumeId, p_expected_revision: expectedRevision });
}

export async function duplicateResume(
  supabase: SupabaseClient<Database>,
  sourceResumeId: string,
  newName?: string,
): Promise<RpcResult<string>> {
  return callResumeRpc(supabase, "duplicate_resume", {
    p_source_resume_id: sourceResumeId,
    p_new_name: newName ? normalizePlainText(newName, "name") : null,
  });
}
