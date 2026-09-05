"use client";

import { useMemo, useState } from "react";
import { Trash2, ChevronUp, ChevronDown, MoveRight, RefreshCw, BookmarkPlus } from "lucide-react";
import { useEditor } from "./useEditorController";
import { SortableItem } from "./dnd/SortableItem";
import { BulletList } from "./BulletList";
import { LibraryUpdateDialog } from "./LibraryUpdateDialog";
import { EducationExtraLines } from "./EducationExtras";
import { SaveEntryToLibraryDialog } from "./SaveEntryToLibraryDialog";
import { MonthPicker } from "@/components/ui/date-picker";
import { formatDateRange, formatMonth } from "@/lib/resume/dates";
import type { ResumeEntry, ResumeSection, EducationData, SkillsData } from "@/lib/resume/types";

const inputStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: "inherit",
  fontSize: "inherit",
};

export function EntryCard({
  entry,
  section,
  index,
  total,
  sectionEntryIds,
}: {
  entry: ResumeEntry;
  section: ResumeSection;
  index: number;
  total: number;
  sectionEntryIds: string[];
}) {
  const { draft, style, updateEntry, removeEntry, moveEntryToPosition } = useEditor();
  const [updateOpen, setUpdateOpen] = useState(false);
  const [saveEntryOpen, setSaveEntryOpen] = useState(false);
  const [selected, setSelected] = useState(false);

  const compatibleSections = useMemo(
    () => draft.sections.filter((s) => s.layout_kind === section.layout_kind && s.id !== section.id),
    [draft.sections, section],
  );

  const hasLibraryLink = entry.source_block_id !== null;

  const moveWithin = (dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= total) return;
    const next = [...sectionEntryIds];
    [next[index], next[to]] = [next[to], next[index]];
    void moveEntryToPosition(entry.id, section.id, next);
  };

  const moveToSection = (targetSectionId: string) => {
    const targetIds = draft.entries
      .filter((e) => e.section_id === targetSectionId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((e) => e.id);
    void moveEntryToPosition(entry.id, targetSectionId, [...targetIds, entry.id]);
  };

  return (
    <SortableItem id={entry.id} handleLabel="Reorder entry">
      <div
        data-entry-id={entry.id}
        className="group relative"
        tabIndex={0}
        onClick={() => setSelected(true)}
        onFocus={() => setSelected(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSelected(false);
        }}
      >
        <div className={`absolute left-full top-0 z-20 ml-2 flex items-center gap-0.5 rounded-md bg-white/95 p-0.5 shadow-sm ring-1 ring-gray-200 transition-opacity print:hidden dark:bg-gray-900/95 dark:ring-gray-700 ${selected ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {hasLibraryLink && (
            <EntryIconBtn label="View library changes" onClick={() => setUpdateOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
            </EntryIconBtn>
          )}
          {!hasLibraryLink && (
            <EntryIconBtn label="Save entry to library" onClick={() => setSaveEntryOpen(true)}>
              <BookmarkPlus className="h-3.5 w-3.5" />
            </EntryIconBtn>
          )}
          <EntryIconBtn label="Move entry up" onClick={() => moveWithin(-1)} disabled={index === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </EntryIconBtn>
          <EntryIconBtn label="Move entry down" onClick={() => moveWithin(1)} disabled={index === total - 1}>
            <ChevronDown className="h-3.5 w-3.5" />
          </EntryIconBtn>
          {compatibleSections.length > 0 && (
            <div className="relative">
              <select
                aria-label="Move entry to section"
                className="h-6 cursor-pointer rounded border border-gray-200 bg-white text-xs dark:border-gray-700 dark:bg-gray-900"
                value=""
                onChange={(e) => {
                  if (e.target.value) moveToSection(e.target.value);
                }}
              >
                <option value="">Move to…</option>
                {compatibleSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <MoveRight className="pointer-events-none absolute right-1 top-1 hidden h-3 w-3" />
            </div>
          )}
          {/* Wording matters: this only detaches the entry from this resume.
              The master library block, if there is one, is untouched. */}
          <EntryIconBtn label="Remove from this resume" onClick={() => void removeEntry(entry.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </EntryIconBtn>
        </div>

        {section.layout_kind === "entry" && <EntryLayout entry={entry} onUpdate={(p) => updateEntry(entry.id, p)} dateFormat={style.date_format} />}
        {section.layout_kind === "education" && <EducationLayout entry={entry} onUpdate={(p) => updateEntry(entry.id, p)} dateFormat={style.date_format} />}
        {section.layout_kind === "skills" && <SkillsLayout entry={entry} onUpdate={(p) => updateEntry(entry.id, p)} />}

        {(section.layout_kind === "entry" || section.layout_kind === "education") && (
          <BulletList
            entryId={entry.id}
            hasSourceBlock={hasLibraryLink}
            addLabel={section.layout_kind === "education" ? "Add bullet (e.g. GPA, honors, relevant coursework)" : undefined}
          />
        )}

        {updateOpen && <LibraryUpdateDialog entryId={entry.id} open={updateOpen} onOpenChange={setUpdateOpen} />}
        {saveEntryOpen && <SaveEntryToLibraryDialog entryId={entry.id} open={saveEntryOpen} onOpenChange={setSaveEntryOpen} />}
      </div>
    </SortableItem>
  );
}

type UpdateFn = (patch: Partial<Pick<ResumeEntry, "title" | "subtitle" | "organization" | "location" | "start_date" | "end_date" | "education_data" | "skills_data">>) => void;

function DateRangeEditor({ entry, onUpdate, dateFormat }: { entry: ResumeEntry; onUpdate: UpdateFn; dateFormat: import("@/lib/resume/types").StyleSettings["date_format"] }) {
  const preview = formatDateRange(entry.start_date, entry.end_date, dateFormat);
  const entryLabel = entry.title || entry.organization || "Untitled entry";
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-right" style={{ fontStyle: "italic" }}>
      <MonthPicker
        aria-label={`${entryLabel} start month`}
        value={entry.start_date}
        displayValue={formatMonth(entry.start_date, dateFormat)}
        placeholder="Start"
        onChange={(value) => onUpdate({ start_date: value || null })}
        className="max-w-none text-xs print:hidden"
        inline
      />
      {entry.start_date && <span className="print:hidden">–</span>}
      {entry.start_date && (
      <MonthPicker
        aria-label={`${entryLabel} end month (blank for Present)`}
        value={entry.end_date}
        displayValue={entry.end_date ? formatMonth(entry.end_date, dateFormat) : entry.start_date ? "Present" : ""}
        placeholder="End"
        onChange={(value) => onUpdate({ end_date: value || null })}
        className="max-w-none text-xs print:hidden"
        inline
      />
      )}
      <span className="hidden print:inline">{preview}</span>
    </span>
  );
}

function EntryLayout({ entry, onUpdate, dateFormat }: { entry: ResumeEntry; onUpdate: UpdateFn; dateFormat: import("@/lib/resume/types").StyleSettings["date_format"] }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <input value={entry.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Title / Role" aria-label="Entry title" style={{ ...inputStyle, fontWeight: 700, flex: 1, minWidth: 0 }} />
        <DateRangeEditor entry={entry} onUpdate={onUpdate} dateFormat={dateFormat} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <input value={entry.organization ?? ""} onChange={(e) => onUpdate({ organization: e.target.value })} placeholder="Organization" aria-label="Organization" style={{ ...inputStyle, fontStyle: "italic", flex: 1, minWidth: 0 }} />
        <input value={entry.location ?? ""} onChange={(e) => onUpdate({ location: e.target.value })} placeholder="Location" aria-label="Location" style={{ ...inputStyle, fontStyle: "italic", textAlign: "right", width: "20ch" }} />
      </div>
    </div>
  );
}

function EducationLayout({ entry, onUpdate, dateFormat }: { entry: ResumeEntry; onUpdate: UpdateFn; dateFormat: import("@/lib/resume/types").StyleSettings["date_format"] }) {
  const edu = (entry.education_data ?? {}) as EducationData;
  const setEdu = (patch: Partial<EducationData>) => onUpdate({ education_data: { ...edu, ...patch } });
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <input value={entry.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="School / University" aria-label="School" style={{ ...inputStyle, fontWeight: 700, flex: 1, minWidth: 0 }} />
        <DateRangeEditor entry={entry} onUpdate={onUpdate} dateFormat={dateFormat} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", flex: 1, alignItems: "baseline", fontStyle: "italic" }}>
          <input
            value={edu.degree ?? ""}
            onChange={(e) => setEdu({ degree: e.target.value })}
            placeholder="Degree (e.g. B.S. in Computer Science)"
            aria-label="Degree"
            style={{ ...inputStyle, flex: edu.field_of_study ? "0 0 auto" : 1, minWidth: "12ch" }}
          />
          {/* field_of_study has no editor input any more (see EducationData
              comment below) — shown read-only so the on-screen entry matches
              what PrintDocument actually renders, instead of silently hiding it. */}
          {edu.field_of_study && <span>{edu.degree ? ", " : ""}{edu.field_of_study}</span>}
        </span>
        <input value={entry.location ?? ""} onChange={(e) => onUpdate({ location: e.target.value })} placeholder="Location" aria-label="Location" style={{ ...inputStyle, fontStyle: "italic", textAlign: "right", width: "18ch" }} />
      </div>

      <EducationExtraLines edu={edu} />
    </div>
  );
}

/**
 * Structured skills editing. Categories and the items inside them are both
 * ordered lists, and order is what the printed resume shows, so both levels
 * get explicit move up/down controls rather than relying on drag alone.
 *
 * Items are edited individually rather than as one comma-joined string: a
 * single field cannot express "move this one skill left" and would silently
 * mangle any skill containing a comma.
 */
function SkillsLayout({ entry, onUpdate }: { entry: ResumeEntry; onUpdate: UpdateFn }) {
  const skills = (entry.skills_data ?? { categories: [] }) as SkillsData;
  const categories = skills.categories ?? [];
  const labelWidth = Math.min(
    26,
    Math.max(10, ...categories.map((category) => category.label.length + 1)),
  );
  const setCategories = (next: SkillsData["categories"]) => onUpdate({ skills_data: { categories: next } });

  const patchCategory = (i: number, patch: Partial<SkillsData["categories"][number]>) =>
    setCategories(categories.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const moveIn = <T,>(list: T[], from: number, dir: -1 | 1): T[] | null => {
    const to = from + dir;
    if (to < 0 || to >= list.length) return null;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {categories.map((cat, i) => (
        <div
          key={i}
          className="group/cat relative grid items-start gap-x-1.5"
          style={{ gridTemplateColumns: `${labelWidth}ch auto minmax(0, 1fr)` }}
        >
          <input
            value={cat.label}
            onChange={(e) => patchCategory(i, { label: e.target.value })}
            placeholder="Category"
            aria-label={`Skill category ${i + 1} name`}
            style={{ ...inputStyle, fontWeight: 700, width: "100%" }}
          />
          <span style={{ fontWeight: 700 }}>:</span>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              {cat.items.map((item, k) => (
                <span key={k} className="group/item relative inline-flex shrink-0 items-center">
                  <input
                    value={item}
                    size={Math.max(3, item.length)}
                    onChange={(e) =>
                      patchCategory(i, { items: cat.items.map((s, m) => (m === k ? e.target.value : s)) })
                    }
                    aria-label={`${cat.label || `Category ${i + 1}`} skill ${k + 1}`}
                    className="min-w-[3ch] max-w-full [field-sizing:content]"
                    style={inputStyle}
                  />
                  {k < cat.items.length - 1 && <span aria-hidden="true">,</span>}
                  <span className="absolute left-0 top-full z-20 hidden items-center rounded bg-white p-0.5 shadow-sm ring-1 ring-gray-200 group-hover/item:inline-flex group-focus-within/item:inline-flex print:hidden dark:bg-gray-900 dark:ring-gray-700">
                    <MicroBtn
                      label={`Move skill ${k + 1} left`}
                      disabled={k === 0}
                      onClick={() => {
                        const next = moveIn(cat.items, k, -1);
                        if (next) patchCategory(i, { items: next });
                      }}
                    >
                      <ChevronUp className="h-2.5 w-2.5 -rotate-90" />
                    </MicroBtn>
                    <MicroBtn
                      label={`Move skill ${k + 1} right`}
                      disabled={k === cat.items.length - 1}
                      onClick={() => {
                        const next = moveIn(cat.items, k, 1);
                        if (next) patchCategory(i, { items: next });
                      }}
                    >
                      <ChevronDown className="h-2.5 w-2.5 -rotate-90" />
                    </MicroBtn>
                    <MicroBtn
                      label={`Delete skill ${k + 1}`}
                      onClick={() => patchCategory(i, { items: cat.items.filter((_, m) => m !== k) })}
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </MicroBtn>
                  </span>
                </span>
              ))}
              <button
                type="button"
                onClick={() => patchCategory(i, { items: [...cat.items, "New skill"] })}
                className="rounded text-xs text-gray-400 opacity-0 transition-opacity hover:text-gray-600 focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 group-hover/cat:opacity-100 group-focus-within/cat:opacity-100 print:hidden"
              >
                + skill
              </button>
          </div>
          <span className="absolute -right-1 top-0 z-10 hidden items-center gap-0.5 rounded bg-white p-0.5 shadow-sm ring-1 ring-gray-200 group-hover/cat:flex group-focus-within/cat:flex print:hidden dark:bg-gray-900 dark:ring-gray-700">
              <MicroBtn
                label={`Move category ${i + 1} up`}
                disabled={i === 0}
                onClick={() => {
                  const next = moveIn(categories, i, -1);
                  if (next) setCategories(next);
                }}
              >
                <ChevronUp className="h-3 w-3" />
              </MicroBtn>
              <MicroBtn
                label={`Move category ${i + 1} down`}
                disabled={i === categories.length - 1}
                onClick={() => {
                  const next = moveIn(categories, i, 1);
                  if (next) setCategories(next);
                }}
              >
                <ChevronDown className="h-3 w-3" />
              </MicroBtn>
              <MicroBtn
                label={`Delete category ${i + 1}`}
                onClick={() => setCategories(categories.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-3 w-3" />
              </MicroBtn>
          </span>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setCategories([...categories, { label: "New category", items: ["New skill"] }])}
        className="self-start rounded text-xs text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-1 print:hidden"
      >
        + Add category
      </button>
    </div>
  );
}

function MicroBtn({
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
      className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-1 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}

function EntryIconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded bg-white/80 p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:bg-gray-900/80 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
