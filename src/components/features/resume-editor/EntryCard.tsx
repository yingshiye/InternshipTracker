"use client";

import { useMemo, useState } from "react";
import { Trash2, ChevronUp, ChevronDown, MoveRight, RefreshCw } from "lucide-react";
import { useEditor } from "./useEditorController";
import { SortableItem } from "./dnd/SortableItem";
import { BulletList } from "./BulletList";
import { LibraryUpdateDialog } from "./LibraryUpdateDialog";
import { formatDateRange, toMonthInputValue, fromMonthInputValue } from "@/lib/resume/dates";
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
      <div data-entry-id={entry.id} className="group relative">
        <div className="absolute -right-1 -top-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
          {hasLibraryLink && (
            <EntryIconBtn label="View library changes" onClick={() => setUpdateOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
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
          <EntryIconBtn label="Delete entry" onClick={() => void removeEntry(entry.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </EntryIconBtn>
        </div>

        {section.layout_kind === "entry" && <EntryLayout entry={entry} onUpdate={(p) => updateEntry(entry.id, p)} dateFormat={style.date_format} />}
        {section.layout_kind === "education" && <EducationLayout entry={entry} onUpdate={(p) => updateEntry(entry.id, p)} dateFormat={style.date_format} />}
        {section.layout_kind === "skills" && <SkillsLayout entry={entry} onUpdate={(p) => updateEntry(entry.id, p)} />}

        {section.layout_kind === "entry" && <BulletList entryId={entry.id} hasSourceBlock={hasLibraryLink} />}

        {updateOpen && <LibraryUpdateDialog entryId={entry.id} open={updateOpen} onOpenChange={setUpdateOpen} />}
      </div>
    </SortableItem>
  );
}

type UpdateFn = (patch: Partial<Pick<ResumeEntry, "title" | "subtitle" | "organization" | "location" | "start_date" | "end_date" | "education_data" | "skills_data">>) => void;

function DateRangeEditor({ entry, onUpdate, dateFormat }: { entry: ResumeEntry; onUpdate: UpdateFn; dateFormat: import("@/lib/resume/types").StyleSettings["date_format"] }) {
  const preview = formatDateRange(entry.start_date, entry.end_date, dateFormat);
  return (
    <span className="inline-flex items-center gap-1 text-right" style={{ fontStyle: "italic" }}>
      <input
        type="month"
        aria-label="Start month"
        value={toMonthInputValue(entry.start_date)}
        onChange={(e) => onUpdate({ start_date: fromMonthInputValue(e.target.value) })}
        className="w-[13ch] text-xs print:hidden"
        style={inputStyle}
      />
      <span className="print:hidden">–</span>
      <input
        type="month"
        aria-label="End month (blank for Present)"
        value={toMonthInputValue(entry.end_date)}
        onChange={(e) => onUpdate({ end_date: fromMonthInputValue(e.target.value) })}
        className="w-[13ch] text-xs print:hidden"
        style={inputStyle}
      />
      <span className="hidden print:inline">{preview}</span>
      {preview && <span className="ml-1 text-gray-400 print:hidden">({preview})</span>}
    </span>
  );
}

function EntryLayout({ entry, onUpdate, dateFormat }: { entry: ResumeEntry; onUpdate: UpdateFn; dateFormat: import("@/lib/resume/types").StyleSettings["date_format"] }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <input value={entry.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="Title / Role" aria-label="Entry title" style={{ ...inputStyle, fontWeight: 700, flex: 1 }} />
        <DateRangeEditor entry={entry} onUpdate={onUpdate} dateFormat={dateFormat} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <input value={entry.organization ?? ""} onChange={(e) => onUpdate({ organization: e.target.value })} placeholder="Organization" aria-label="Organization" style={{ ...inputStyle, fontStyle: "italic", flex: 1 }} />
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
        <input value={entry.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value })} placeholder="School / University" aria-label="School" style={{ ...inputStyle, fontWeight: 700, flex: 1 }} />
        <DateRangeEditor entry={entry} onUpdate={onUpdate} dateFormat={dateFormat} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontStyle: "italic", flex: 1 }} className="flex items-center gap-1">
          <input value={edu.degree ?? ""} onChange={(e) => setEdu({ degree: e.target.value })} placeholder="Degree" aria-label="Degree" style={{ ...inputStyle, fontStyle: "italic", width: "18ch" }} />
          <input value={edu.field_of_study ?? ""} onChange={(e) => setEdu({ field_of_study: e.target.value })} placeholder="Field of study" aria-label="Field of study" style={{ ...inputStyle, fontStyle: "italic", width: "20ch" }} />
        </span>
        <input value={entry.location ?? ""} onChange={(e) => onUpdate({ location: e.target.value })} placeholder="Location" aria-label="Location" style={{ ...inputStyle, fontStyle: "italic", textAlign: "right", width: "18ch" }} />
      </div>
      <input value={edu.gpa ?? ""} onChange={(e) => setEdu({ gpa: e.target.value })} placeholder="GPA (optional)" aria-label="GPA" style={{ ...inputStyle }} />
    </div>
  );
}

function SkillsLayout({ entry, onUpdate }: { entry: ResumeEntry; onUpdate: UpdateFn }) {
  const skills = (entry.skills_data ?? { categories: [] }) as SkillsData;
  const setCategories = (categories: SkillsData["categories"]) => onUpdate({ skills_data: { categories } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {skills.categories.map((cat, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input
            value={cat.label}
            onChange={(e) => setCategories(skills.categories.map((c, j) => (j === i ? { ...c, label: e.target.value } : c)))}
            placeholder="Category"
            aria-label="Skill category"
            style={{ ...inputStyle, fontWeight: 700, width: "16ch" }}
          />
          <input
            value={cat.items.join(", ")}
            onChange={(e) => setCategories(skills.categories.map((c, j) => (j === i ? { ...c, items: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : c)))}
            placeholder="Comma, separated, skills"
            aria-label="Skills"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="button" aria-label="Remove category" onClick={() => setCategories(skills.categories.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 print:hidden">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setCategories([...skills.categories, { label: "", items: [] }])}
        className="self-start text-xs text-gray-400 hover:text-gray-600 print:hidden"
      >
        + Add category
      </button>
    </div>
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
