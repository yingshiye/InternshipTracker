import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/types/supabase";
import { LAYOUT_KINDS, type LayoutKind, type LibraryBlock, type LibraryBullet } from "./types";
import { ValidationError, assertPlainText, normalizePlainText, validateEducationData, validateSkillsData } from "./validate";

// Library tables (resume_library_blocks/resume_library_bullets) are the
// one part of the schema that allows direct client CRUD — they aren't
// part of the revision-gated draft, so plain .from() calls plus RLS are
// the whole story here, no RPC involved.

function normalizeOptionalText(value: string | null | undefined, fieldName: string): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  assertPlainText(trimmed, fieldName);
  return trimmed;
}

export type LibraryBlockInput = {
  name: string;
  defaultSectionTitle: string;
  layoutKind: LayoutKind;
  title?: string | null;
  subtitle?: string | null;
  organization?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  educationData?: unknown;
  skillsData?: unknown;
  sortOrder?: number;
};

export async function listLibraryBlocks(
  supabase: SupabaseClient<Database>,
  filters?: { layoutKind?: LayoutKind; search?: string },
): Promise<LibraryBlock[]> {
  let query = supabase.from("resume_library_blocks").select("*").order("sort_order", { ascending: true });
  if (filters?.layoutKind) {
    query = query.eq("layout_kind", filters.layoutKind);
  }
  if (filters?.search && filters.search.trim()) {
    const escaped = filters.search.trim().replace(/[%_]/g, (c) => `\\${c}`);
    const term = `%${escaped}%`;
    query = query.or(`name.ilike.${term},title.ilike.${term},organization.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createLibraryBlock(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: LibraryBlockInput,
): Promise<LibraryBlock> {
  if (!LAYOUT_KINDS.includes(input.layoutKind)) throw new ValidationError("Invalid layout_kind");

  const { data, error } = await supabase
    .from("resume_library_blocks")
    .insert({
      user_id: userId,
      name: normalizePlainText(input.name, "name"),
      default_section_title: normalizePlainText(input.defaultSectionTitle, "default_section_title"),
      layout_kind: input.layoutKind,
      title: normalizeOptionalText(input.title, "title"),
      subtitle: normalizeOptionalText(input.subtitle, "subtitle"),
      organization: normalizeOptionalText(input.organization, "organization"),
      location: normalizeOptionalText(input.location, "location"),
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
      education_data: input.layoutKind === "education" ? validateEducationData(input.educationData) : null,
      skills_data: input.layoutKind === "skills" ? validateSkillsData(input.skillsData) : null,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLibraryBlock(
  supabase: SupabaseClient<Database>,
  blockId: string,
  input: Partial<LibraryBlockInput>,
): Promise<LibraryBlock> {
  const patch: TablesUpdate<"resume_library_blocks"> = {};
  if (input.name !== undefined) patch.name = normalizePlainText(input.name, "name");
  if (input.defaultSectionTitle !== undefined) {
    patch.default_section_title = normalizePlainText(input.defaultSectionTitle, "default_section_title");
  }
  if (input.layoutKind !== undefined) {
    if (!LAYOUT_KINDS.includes(input.layoutKind)) throw new ValidationError("Invalid layout_kind");
    patch.layout_kind = input.layoutKind;
  }
  if (input.title !== undefined) patch.title = normalizeOptionalText(input.title, "title");
  if (input.subtitle !== undefined) patch.subtitle = normalizeOptionalText(input.subtitle, "subtitle");
  if (input.organization !== undefined) patch.organization = normalizeOptionalText(input.organization, "organization");
  if (input.location !== undefined) patch.location = normalizeOptionalText(input.location, "location");
  if (input.startDate !== undefined) patch.start_date = input.startDate;
  if (input.endDate !== undefined) patch.end_date = input.endDate;
  if (input.educationData !== undefined) patch.education_data = validateEducationData(input.educationData);
  if (input.skillsData !== undefined) patch.skills_data = validateSkillsData(input.skillsData);
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const { data, error } = await supabase.from("resume_library_blocks").update(patch).eq("id", blockId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLibraryBlock(supabase: SupabaseClient<Database>, blockId: string): Promise<void> {
  const { error } = await supabase.from("resume_library_blocks").delete().eq("id", blockId);
  if (error) throw error;
}

export async function listLibraryBullets(
  supabase: SupabaseClient<Database>,
  blockId: string,
): Promise<LibraryBullet[]> {
  const { data, error } = await supabase
    .from("resume_library_bullets")
    .select("*")
    .eq("block_id", blockId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function nextBulletSortOrder(supabase: SupabaseClient<Database>, blockId: string): Promise<number> {
  const { data } = await supabase
    .from("resume_library_bullets")
    .select("sort_order")
    .eq("block_id", blockId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

export async function addLibraryBullet(
  supabase: SupabaseClient<Database>,
  userId: string,
  blockId: string,
  content: string,
): Promise<LibraryBullet> {
  const cleaned = normalizePlainText(content, "content");
  const sortOrder = await nextBulletSortOrder(supabase, blockId);
  const { data, error } = await supabase
    .from("resume_library_bullets")
    .insert({ user_id: userId, block_id: blockId, content: cleaned, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLibraryBullet(
  supabase: SupabaseClient<Database>,
  bulletId: string,
  content: string,
): Promise<LibraryBullet> {
  const cleaned = normalizePlainText(content, "content");
  const { data, error } = await supabase
    .from("resume_library_bullets")
    .update({ content: cleaned })
    .eq("id", bulletId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteLibraryBullet(supabase: SupabaseClient<Database>, bulletId: string): Promise<void> {
  const { error } = await supabase.from("resume_library_bullets").delete().eq("id", bulletId);
  if (error) throw error;
}

/**
 * Renumbers sort_order to match the given order. Direct table writes are
 * allowed here (library tables only) — a handful of sequential updates is
 * fine at this record scale, no RPC needed.
 */
export async function reorderLibraryBullets(
  supabase: SupabaseClient<Database>,
  blockId: string,
  orderedBulletIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedBulletIds.length; i++) {
    const { error } = await supabase
      .from("resume_library_bullets")
      .update({ sort_order: i + 1 })
      .eq("id", orderedBulletIds[i])
      .eq("block_id", blockId);
    if (error) throw error;
  }
}
