import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { callResumeRpc, type RpcResult } from "./rpc";
import { LAYOUT_KINDS, type LayoutKind } from "./types";
import { ValidationError, normalizePlainText } from "./validate";

export async function createSection(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  input: { title: string; layoutKind: LayoutKind },
): Promise<RpcResult<{ section_id: string; revision: number }[]>> {
  if (!LAYOUT_KINDS.includes(input.layoutKind)) throw new ValidationError("Invalid layout_kind");
  return callResumeRpc(supabase, "create_section", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_title: normalizePlainText(input.title, "title"),
    p_layout_kind: input.layoutKind,
  });
}

export async function renameSection(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  sectionId: string,
  title: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "rename_section", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_section_id: sectionId,
    p_title: normalizePlainText(title, "title"),
  });
}

export async function deleteSection(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  sectionId: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "delete_section", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_section_id: sectionId,
  });
}

export async function reorderSections(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  orderedSectionIds: string[],
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "reorder_sections", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_ordered_section_ids: orderedSectionIds,
  });
}
