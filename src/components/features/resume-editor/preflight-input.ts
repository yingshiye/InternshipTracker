import { diffEntryAgainstLibrary } from "@/lib/resume/compare";
import type { PreflightInput } from "@/lib/resume/preflight";
import type { EducationData, SkillsData } from "@/lib/resume/types";
import type { EditorDraft, LibraryData } from "./editor-types";

/**
 * Build the entry list that preflight and Resume Check consume, including the
 * two library-derived flags neither of them can work out on its own.
 *
 * The library is already in memory (it is a prop on the editor), so the
 * comparison runs against local data — no per-entry round trip, which is what
 * an N+1 would look like here.
 */
export function buildPreflightEntries(draft: EditorDraft, library: LibraryData): PreflightInput["entries"] {
  const blockById = new Map(library.blocks.map((b) => [b.id, b]));
  const bulletsByBlock = new Map<string, typeof library.bullets>();
  for (const lb of library.bullets) {
    const list = bulletsByBlock.get(lb.block_id) ?? [];
    list.push(lb);
    bulletsByBlock.set(lb.block_id, list);
  }
  const bulletsByEntry = new Map<string, typeof draft.bullets>();
  for (const b of draft.bullets) {
    const list = bulletsByEntry.get(b.entry_id) ?? [];
    list.push(b);
    bulletsByEntry.set(b.entry_id, list);
  }

  return draft.entries.map((e) => {
    const block = e.source_block_id ? blockById.get(e.source_block_id) : undefined;
    // source_block_id set but the block gone means the library block was
    // deleted: the FK nulls nothing here because the entry keeps its own
    // content, but the link is dangling.
    const sourceMissing = Boolean(e.source_block_id) && block === undefined;

    let libraryUpdateAvailable = false;
    if (block) {
      const comparison = diffEntryAgainstLibrary(
        e,
        bulletsByEntry.get(e.id) ?? [],
        block,
        bulletsByBlock.get(block.id) ?? [],
      );
      libraryUpdateAvailable =
        comparison.blockChanged ||
        comparison.bulletsAdded.length > 0 ||
        comparison.bulletsChanged.length > 0 ||
        comparison.bulletsRemoved.length > 0;
    }

    return {
      id: e.id,
      section_id: e.section_id,
      title: e.title,
      organization: e.organization,
      education_data: (e.education_data ?? null) as EducationData | null,
      skills_data: (e.skills_data ?? null) as SkillsData | null,
      source_block_id: e.source_block_id,
      sourceMissing,
      libraryUpdateAvailable,
    };
  });
}
