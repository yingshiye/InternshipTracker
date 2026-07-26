"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, AlertTriangle } from "lucide-react";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { useResumeMeasurement } from "./useResumeMeasurement";
import { EditableHeader } from "./EditableHeader";
import { SectionBlock } from "./SectionBlock";
import { SortableList } from "./dnd/SortableList";
import { PAGE_WIDTH_PX, DPI, printableHeightPx, targetPageLimit } from "@/lib/resume/measure";
import { LINE_HEIGHT, SECTION_GAP_PT } from "@/lib/resume/style";

const PT_TO_PX = DPI / 72;
const ZOOM_STEPS = [0.6, 0.75, 0.9, 1, 1.15, 1.3];

export function ResumePreview() {
  const { draft, style, reorderSections } = useEditor();
  const { setMeasurements } = useMeasurements();
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomIndex, setZoomIndex] = useState(3); // 100%

  const orderedSections = useMemo(
    () => [...draft.sections].sort((a, b) => a.sort_order - b.sort_order),
    [draft.sections],
  );

  // Signature that changes on any structural/text change, to retrigger measurement.
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

  const zoom = ZOOM_STEPS[zoomIndex];
  const pagePadding = style.margin_in * DPI;
  const printable = printableHeightPx(style.margin_in);
  const limit = targetPageLimit(draft.resume.target_length);
  const overTarget = limit !== null && measurements.pageCount > limit;

  // One boundary line per page break. Positioned from the same printable
  // height the page-count maths uses, so the indicator and the warning can
  // never disagree about where page 2 starts.
  const boundaries = Array.from({ length: Math.max(0, measurements.pageCount - 1) }, (_, i) => ({
    index: i + 1,
    top: pagePadding + (i + 1) * printable,
  }));

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
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-1.5 text-xs print:hidden dark:border-gray-800">
        <span
          className={`flex items-center gap-1.5 ${overTarget ? "text-amber-700 dark:text-amber-400" : "text-gray-500"}`}
          role="status"
          aria-live="polite"
        >
          {overTarget && <AlertTriangle className="h-3.5 w-3.5" />}
          {measurements.pageCount} page{measurements.pageCount === 1 ? "" : "s"}
          {limit !== null && ` · target ${limit} page${limit > 1 ? "s" : ""}`}
          {overTarget && " — over target"}
        </span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center tabular-nums text-gray-500">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            aria-label="Zoom in"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="flex-1 overflow-auto bg-gray-100 p-8 dark:bg-gray-900">
        {/* Zoom scales the rendered page without changing its layout width, so
            measurement keeps working in real Letter pixels at any zoom. */}
        <div
          style={{
            width: PAGE_WIDTH_PX * zoom,
            margin: "0 auto",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <div className="relative shadow-sm ring-1 ring-gray-200 dark:ring-gray-700" style={pageStyle} ref={containerRef}>
            {boundaries.map((b) => (
              <div
                key={b.index}
                aria-hidden
                className="resume-print-page-marker pointer-events-none absolute left-0 right-0 print:hidden"
                style={{ top: b.top }}
              >
                <div className="border-t border-dashed border-red-300" />
                <span className="absolute right-1 -top-4 text-[10px] text-red-400">page {b.index + 1}</span>
              </div>
            ))}

            <div data-measure="content">
              <EditableHeader />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SECTION_GAP_PT[style.section_spacing] * PT_TO_PX,
                  marginTop: 8,
                }}
              >
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
      </div>
    </div>
  );
}
