"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "./useEditorController";
import { SortableItem } from "./dnd/SortableItem";
import { SortableList } from "./dnd/SortableList";
import { EntryCard } from "./EntryCard";
import { CopyBlockMenu } from "./CopyBlockMenu";
import { DPI } from "@/lib/resume/measure";
import type { ResumeSection } from "@/lib/resume/types";

const PT_TO_PX = DPI / 72;

export function SectionBlock({
  section,
  index,
  total,
  orderedSectionIds,
}: {
  section: ResumeSection;
  index: number;
  total: number;
  orderedSectionIds: string[];
}) {
  const { draft, style, renameSection, deleteSection, reorderSections, addCustomEntry, moveEntryToPosition } = useEditor();
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const entries = useMemo(
    () => draft.entries.filter((e) => e.section_id === section.id).sort((a, b) => a.sort_order - b.sort_order),
    [draft.entries, section.id],
  );
  const entryIds = entries.map((e) => e.id);

  const moveSection = (dir: -1 | 1) => {
    const next = [...orderedSectionIds];
    const from = index;
    const to = index + dir;
    if (to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    void reorderSections(next);
  };

  const handleDelete = async () => {
    setDeleteError(null);
    if (entries.length > 0) {
      setDeleteError("Remove all entries before deleting this section.");
      return;
    }
    await deleteSection(section.id);
  };

  const headingSize = style.heading_font_size_pt * PT_TO_PX;

  return (
    <SortableItem id={section.id} handleLabel={`Reorder section ${section.title}`}>
      <section>
        <div className="group flex items-center gap-1 border-b border-gray-300" style={{ marginBottom: 4 }}>
          <input
            value={section.title}
            onChange={(e) => void renameSection(section.id, e.target.value)}
            aria-label="Section title"
            style={{
              fontSize: headingSize,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              flex: 1,
            }}
          />
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <IconBtn label="Move section up" onClick={() => moveSection(-1)} disabled={index === 0}>
              <ChevronUp className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Move section down" onClick={() => moveSection(1)} disabled={index === total - 1}>
              <ChevronDown className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn label="Delete section" onClick={() => void handleDelete()}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>

        {deleteError && <p className="mb-1 text-xs text-red-600">{deleteError}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SortableList
            id={`entries:${section.id}`}
            ids={entryIds}
            onReorder={(ids) => {
              // Within-section reorder: any in-section entry id is a valid pivot.
              if (ids.length > 0) void moveEntryToPosition(ids[0], section.id, ids);
            }}
          >
            {entries.map((entry, i) => (
              <EntryCard key={entry.id} entry={entry} section={section} index={i} total={entries.length} sectionEntryIds={entryIds} />
            ))}
          </SortableList>
        </div>

        <div className="mt-1.5 flex items-center gap-2 print:hidden">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gray-500" onClick={() => void addCustomEntry(section.id)}>
            <Plus className="h-3 w-3" /> Add entry
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gray-500" onClick={() => setCopyOpen(true)}>
            <BookOpen className="h-3 w-3" /> From library
          </Button>
        </div>

        {copyOpen && <CopyBlockMenu section={section} onClose={() => setCopyOpen(false)} />}
      </section>
    </SortableItem>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
