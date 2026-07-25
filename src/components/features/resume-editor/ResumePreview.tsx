"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { useResumeMeasurement } from "./useResumeMeasurement";
import { EditableHeader } from "./EditableHeader";
import { SectionBlock } from "./SectionBlock";
import { SortableList } from "./dnd/SortableList";
import { PAGE_WIDTH_PX, DPI } from "@/lib/resume/measure";
import { LINE_HEIGHT, SECTION_GAP_PT } from "@/lib/resume/style";
import type { LayoutKind } from "@/lib/resume/types";

const PT_TO_PX = DPI / 72;

export function ResumePreview() {
  const { draft, style, reorderSections, addSection } = useEditor();
  const { setMeasurements } = useMeasurements();
  const containerRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);

  const orderedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.sort_order - b.sort_order),
    [draft.sections],
  );

  // Signature that changes on any structural/text change to retrigger measurement.
  const signal = useMemo(
    () =>
      JSON.stringify({
        s: orderedSections.map((s) => s.id),
        e: draft.entries.map((e) => `${e.id}:${e.section_id}:${(e.title ?? "").length}`),
        b: draft.bullets.map((b) => `${b.id}:${b.content.length}`),
      }),
    [orderedSections, draft.entries, draft.bullets],
  );

  const measurements = useResumeMeasurement(containerRef, style, signal);
  useEffect(() => setMeasurements(measurements), [measurements, setMeasurements]);

  const pagePadding = style.margin_in * DPI;
  const pageStyle: React.CSSProperties = {
    width: PAGE_WIDTH_PX,
    minHeight: 11 * DPI,
    padding: pagePadding,
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: style.body_font_size_pt * PT_TO_PX,
    lineHeight: LINE_HEIGHT[style.line_spacing],
    color: "#111",
    background: "#fff",
  };

  return (
    <div className="overflow-auto bg-gray-100 p-8 dark:bg-gray-900">
      <div className="mx-auto shadow-sm ring-1 ring-gray-200 dark:ring-gray-700" style={pageStyle} ref={containerRef}>
        <div data-measure="content">
          <EditableHeader />
          <div style={{ display: "flex", flexDirection: "column", gap: SECTION_GAP_PT[style.section_spacing] * PT_TO_PX, marginTop: 8 }}>
            <SortableList ids={orderedSections.map((s) => s.id)} onReorder={(ids) => void reorderSections(ids)}>
              {orderedSections.map((section, i) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  index={i}
                  total={orderedSections.length}
                  orderedSectionIds={orderedSections.map((s) => s.id)}
                />
              ))}
            </SortableList>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-4 flex items-center gap-2" style={{ width: PAGE_WIDTH_PX }}>
        {adding ? (
          <AddSectionInline
            onCancel={() => setAdding(false)}
            onAdd={(title, kind) => {
              void addSection(title, kind);
              setAdding(false);
            }}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add section
          </Button>
        )}
      </div>
    </div>
  );
}

function AddSectionInline({ onAdd, onCancel }: { onAdd: (title: string, kind: LayoutKind) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<LayoutKind>("entry");
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-950">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Section title"
        className="rounded border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
      />
      <Select value={kind} onValueChange={(v) => setKind(v as LayoutKind)}>
        <SelectTrigger className="h-8 w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="entry">Experience</SelectItem>
          <SelectItem value="education">Education</SelectItem>
          <SelectItem value="skills">Skills</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!title.trim()} onClick={() => onAdd(title.trim(), kind)}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
