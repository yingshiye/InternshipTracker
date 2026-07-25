import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import { callResumeRpc, type RpcResult } from "./rpc";
import { normalizeOptionalText, normalizePlainText, validateEducationData, validateSkillsData } from "./validate";

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
 * Creates a resume-specific entry (source_block_id = null) in a section.
 * Content must be compatible with the section's layout_kind — enforced
 * inside the RPC.
 */
export async function addCustomEntry(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  sectionId: string,
  input: UpdateEntryInput,
): Promise<RpcResult<{ entry_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "add_custom_entry", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_section_id: sectionId,
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

/** Creates a resume-specific bullet (source_bullet_id = null) on an entry. */
export async function addCustomBullet(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  content: string,
): Promise<RpcResult<{ bullet_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "add_custom_bullet", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_content: normalizePlainText(content, "content"),
  });
}

/**
 * Combined atomic move + reorder. `orderedEntryIds` must be the complete
 * final ordering of the target section including the moved entry.
 */
export async function moveEntryToPosition(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  targetSectionId: string,
  orderedEntryIds: string[],
): Promise<RpcResult<{ revision: number; section_id: string; ordered_entry_ids: string[] }[]>> {
  return callResumeRpc(supabase, "move_entry_to_position", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_target_section_id: targetSectionId,
    p_ordered_entry_ids: orderedEntryIds,
  });
}

export type ApplyLibraryUpdateSelection = {
  applyFields: string[];
  updateBulletIds: string[];
  addLibraryBulletIds: string[];
  removeBulletIds: string[];
  confirmRemovals: boolean;
};

/**
 * Atomically syncs selected library changes into an entry. Content is read
 * authoritatively from the library inside the RPC; only ids/field names are
 * sent. Rejects the whole transaction if any selected source is stale.
 */
export async function applyLibraryUpdate(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  selection: ApplyLibraryUpdateSelection,
): Promise<
  RpcResult<
    { revision: number; fields_applied: number; bullets_updated: number; bullets_added: number; bullets_removed: number }[]
  >
> {
  return callResumeRpc(supabase, "apply_library_update", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_apply_fields: selection.applyFields,
    p_update_bullet_ids: selection.updateBulletIds,
    p_add_library_bullet_ids: selection.addLibraryBulletIds,
    p_remove_bullet_ids: selection.removeBulletIds,
    p_confirm_removals: selection.confirmRemovals,
  });
}

export type RestoreEntrySnapshot = {
  sectionId: string;
  position: number;
  title: string | null;
  subtitle: string | null;
  organization: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  educationData: Json | null;
  skillsData: Json | null;
  sourceBlockId: string | null;
  bullets: { content: string; source_bullet_id: string | null }[];
};

/**
 * Undo of an entry deletion. Recreates the entry (new id) with captured
 * content/bullets at the captured position. Source references are kept only
 * when still valid/owned/compatible; otherwise nulled inside the RPC.
 */
export async function restoreEntry(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  snapshot: RestoreEntrySnapshot,
): Promise<RpcResult<{ entry_id: string; bullet_ids: string[]; revision: number }[]>> {
  return callResumeRpc(supabase, "restore_entry", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_section_id: snapshot.sectionId,
    p_position: snapshot.position,
    p_title: snapshot.title,
    p_subtitle: snapshot.subtitle,
    p_organization: snapshot.organization,
    p_location: snapshot.location,
    p_start_date: snapshot.startDate,
    p_end_date: snapshot.endDate,
    p_education_data: snapshot.educationData,
    p_skills_data: snapshot.skillsData,
    p_source_block_id: snapshot.sourceBlockId,
    p_bullets: snapshot.bullets,
  });
}

/** Undo of a bullet deletion. Recreates the bullet (new id) at position. */
export async function restoreBullet(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  entryId: string,
  position: number,
  content: string,
  sourceBulletId: string | null,
): Promise<RpcResult<{ bullet_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "restore_bullet", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_entry_id: entryId,
    p_position: position,
    p_content: content,
    p_source_bullet_id: sourceBulletId,
  });
}

/**
 * Saves a resume bullet's current text as a NEW library bullet and atomically
 * re-links the resume bullet to it. Never overwrites an existing library
 * bullet; never changes the resume bullet text. Bumps the draft revision
 * because the source relationship changed.
 */
export async function saveBulletAsLibraryBullet(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  bulletId: string,
  targetBlockId: string,
): Promise<RpcResult<{ library_bullet_id: string; revision: number }[]>> {
  return callResumeRpc(supabase, "save_bullet_as_library_bullet", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_bullet_id: bulletId,
    p_block_id: targetBlockId,
  });
}
