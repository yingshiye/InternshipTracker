import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { addLibraryBullet } from "./library";
import { callResumeRpc, type RpcResult } from "./rpc";
import type { LibraryBullet } from "./types";
import { normalizeOptionalText, validateEducationData, validateSkillsData } from "./validate";

export async function copyBlockIntoSection(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  sectionId: string,
  blockId: string,
  selectedBulletIds: string[],
): Promise<RpcResult<{ entry_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "copy_block_into_section", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_section_id: sectionId,
    p_block_id: blockId,
    p_bullet_ids: selectedBulletIds,
  });
}

export type UpdateEntryInput = {
  title?: string | null;
  subtitle?: string | null;
  organization?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  educationData?: unknown;
  skillsData?: unknown;
};

export async function updateEntry(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  input: UpdateEntryInput,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "update_entry", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_title: normalizeOptionalText(input.title, "title"),
    p_subtitle: normalizeOptionalText(input.subtitle, "subtitle"),
    p_organization: normalizeOptionalText(input.organization, "organization"),
    p_location: normalizeOptionalText(input.location, "location"),
    p_start_date: input.startDate ?? null,
    p_end_date: input.endDate ?? null,
    p_education_data: input.educationData !== undefined ? (validateEducationData(input.educationData) as Json) : null,
    p_skills_data: input.skillsData !== undefined ? (validateSkillsData(input.skillsData) as Json) : null,
  });
}

export async function removeEntry(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "remove_entry", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
  });
}

export async function moveEntry(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  targetSectionId: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "move_entry", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_target_section_id: targetSectionId,
  });
}

export async function reorderEntries(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  sectionId: string,
  orderedEntryIds: string[],
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "reorder_entries", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_section_id: sectionId,
    p_ordered_entry_ids: orderedEntryIds,
  });
}

export async function updateEntryBullet(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  bulletId: string,
  content: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "update_entry_bullet", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_bullet_id: bulletId,
    p_content: content,
  });
}

export async function removeEntryBullet(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  bulletId: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "remove_entry_bullet", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_bullet_id: bulletId,
  });
}

export async function reorderEntryBullets(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  orderedBulletIds: string[],
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "reorder_entry_bullets", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_ordered_bullet_ids: orderedBulletIds,
  });
}

/** Only from the entry's own source_block_id — enforced inside the RPC. */
export async function addBulletFromLibrary(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  libraryBulletId: string,
): Promise<RpcResult<{ bullet_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "add_bullet_from_library", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_library_bullet_id: libraryBulletId,
  });
}

/**
 * Pushes a new bullet into the library — writes to the library, not the
 * draft, so it does not go through an RPC and does not touch the
 * resume's revision. Does not relink the existing resume bullet to the
 * newly created library bullet; the resume bullet is left exactly as is.
 */
export async function saveBulletAsLibraryBullet(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetBlockId: string,
  content: string,
): Promise<LibraryBullet> {
  return addLibraryBullet(supabase, userId, targetBlockId, content);
}
