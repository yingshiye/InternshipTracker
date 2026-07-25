import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { LibraryBlock, LibraryBullet, ResumeEntry, ResumeEntryBullet } from "./types";

export type LibraryFieldDiff = { field: string; entryValue: unknown; blockValue: unknown };
export type LibraryBulletRemoval = { entryBulletId: string; content: string };
export type LibraryBulletChange = { entryBulletId: string; entryContent: string; libraryContent: string };

export type LibraryUpdateComparison = {
  blockChanged: boolean;
  blockFieldDiffs: LibraryFieldDiff[];
  bulletsAdded: LibraryBullet[];
  bulletsRemoved: LibraryBulletRemoval[];
  bulletsChanged: LibraryBulletChange[];
};

const COMPARABLE_FIELDS = ["title", "subtitle", "organization", "location", "start_date", "end_date"] as const;

/**
 * Pure, read-only diff between a resume entry (plus its copied bullets)
 * and its source library block (plus the library's current bullets).
 * Never mutates anything — "apply this update" is a separate, later
 * decision this function intentionally does not make.
 */
export function diffEntryAgainstLibrary(
  entry: Pick<ResumeEntry, (typeof COMPARABLE_FIELDS)[number] | "education_data" | "skills_data">,
  entryBullets: Pick<ResumeEntryBullet, "id" | "content" | "source_bullet_id">[],
  block: Pick<LibraryBlock, (typeof COMPARABLE_FIELDS)[number] | "education_data" | "skills_data">,
  libraryBullets: Pick<LibraryBullet, "id" | "content">[],
): LibraryUpdateComparison {
  const blockFieldDiffs: LibraryFieldDiff[] = [];

  for (const field of COMPARABLE_FIELDS) {
    if (entry[field] !== block[field]) {
      blockFieldDiffs.push({ field, entryValue: entry[field], blockValue: block[field] });
    }
  }
  if (JSON.stringify(entry.education_data) !== JSON.stringify(block.education_data)) {
    blockFieldDiffs.push({ field: "education_data", entryValue: entry.education_data, blockValue: block.education_data });
  }
  if (JSON.stringify(entry.skills_data) !== JSON.stringify(block.skills_data)) {
    blockFieldDiffs.push({ field: "skills_data", entryValue: entry.skills_data, blockValue: block.skills_data });
  }

  const libraryById = new Map(libraryBullets.map((b) => [b.id, b]));
  const copiedSourceIds = new Set(
    entryBullets.map((b) => b.source_bullet_id).filter((id): id is string => id !== null),
  );

  const bulletsAdded = libraryBullets.filter((lb) => !copiedSourceIds.has(lb.id)) as LibraryBullet[];

  const bulletsRemoved: LibraryBulletRemoval[] = entryBullets
    .filter((eb) => eb.source_bullet_id !== null && !libraryById.has(eb.source_bullet_id))
    .map((eb) => ({ entryBulletId: eb.id, content: eb.content }));

  const bulletsChanged: LibraryBulletChange[] = entryBullets
    .filter((eb) => eb.source_bullet_id !== null && libraryById.has(eb.source_bullet_id))
    .map((eb) => ({
      entryBulletId: eb.id,
      entryContent: eb.content,
      libraryContent: libraryById.get(eb.source_bullet_id as string)!.content,
    }))
    .filter((d) => d.entryContent !== d.libraryContent);

  return {
    blockChanged: blockFieldDiffs.length > 0,
    blockFieldDiffs,
    bulletsAdded,
    bulletsRemoved,
    bulletsChanged,
  };
}

/**
 * Fetches the live entry/block/bullets and runs the diff. Returns null
 * when there's nothing to compare against — either the entry was never
 * copied from a library block, or that block has since been deleted
 * (source_block_id was set null by the library block's own deletion).
 */
export async function prepareLibraryUpdateComparison(
  supabase: SupabaseClient<Database>,
  entryId: string,
): Promise<LibraryUpdateComparison | null> {
  const { data: entry, error: entryErr } = await supabase
    .from("resume_entries")
    .select("*")
    .eq("id", entryId)
    .single();
  if (entryErr) throw entryErr;
  if (!entry.source_block_id) return null;

  const { data: block, error: blockErr } = await supabase
    .from("resume_library_blocks")
    .select("*")
    .eq("id", entry.source_block_id)
    .maybeSingle();
  if (blockErr) throw blockErr;
  if (!block) return null;

  const { data: entryBullets, error: ebErr } = await supabase
    .from("resume_entry_bullets")
    .select("*")
    .eq("entry_id", entryId);
  if (ebErr) throw ebErr;

  const { data: libraryBullets, error: lbErr } = await supabase
    .from("resume_library_bullets")
    .select("*")
    .eq("block_id", block.id);
  if (lbErr) throw lbErr;

  return diffEntryAgainstLibrary(entry, entryBullets ?? [], block, libraryBullets ?? []);
}
