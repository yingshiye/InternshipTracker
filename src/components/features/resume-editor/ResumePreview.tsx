"use client";

import { useEffect, useMemo, useRef } from "react";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { useResumeMeasurement } from "./useResumeMeasurement";
import { EditableHeader } from "./EditableHeader";
import { SectionBlock } from "./SectionBlock";
import { SortableList } from "./dnd/SortableList";
import { PAGE_WIDTH_PX, DPI } from "@/lib/resume/measure";
import { LINE_HEIGHT, SECTION_GAP_PT } from "@/lib/resume/style";

const PT_TO_PX = DPI / 72;

export function ResumePreview() {
  const { draft, style, reorderSections } = useEditor();
  const { setMeasurements } = useMeasurements();
  const containerRef = useRef<HTMLDivElement>(null);

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

    </div>
  );
}
