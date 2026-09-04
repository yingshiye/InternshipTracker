"use client";

import { useEffect, useMemo, useRef } from "react";
import { DPI, PAGE_WIDTH_PX } from "@/lib/resume/measure";
import { draftToComparable } from "@/lib/resume/snapshot";
import { useEditor } from "./useEditorController";
import { useMeasurements } from "./MeasurementContext";
import { useResumeMeasurement } from "./useResumeMeasurement";
import { ResumeDocumentContent } from "./PrintDocument";

/**
 * Off-screen, print-faithful document used for every page and line metric.
 * It stays mounted when the visible editor switches to Library or Settings,
 * so those panes cannot accidentally measure a display:none preview as zero.
 */
export function ResumeMeasurementDocument() {
  const { draft, style } = useEditor();
  const { setMeasurements } = useMeasurements();
  const containerRef = useRef<HTMLDivElement>(null);

  const snapshot = useMemo(
    () =>
      draftToComparable({
        resume: draft.resume,
        header: draft.header,
        sections: draft.sections,
        entries: draft.entries,
        bullets: draft.bullets,
      }),
    [draft],
  );

  const bulletIds = useMemo(() => {
    const sections = [...draft.sections].sort((a, b) => a.sort_order - b.sort_order);
    return sections.flatMap((section) =>
      draft.entries
        .filter((entry) => entry.section_id === section.id)
        .sort((a, b) => a.sort_order - b.sort_order)
        .flatMap((entry) =>
          draft.bullets
            .filter((bullet) => bullet.entry_id === entry.id)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((bullet) => bullet.id),
        ),
    );
  }, [draft.sections, draft.entries, draft.bullets]);

  const signal = useMemo(() => JSON.stringify(snapshot), [snapshot]);
  const measurements = useResumeMeasurement(containerRef, style, signal, bulletIds);

  useEffect(() => setMeasurements(measurements), [measurements, setMeasurements]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: -10000,
        top: 0,
        width: PAGE_WIDTH_PX - style.margin_in * DPI * 2,
        visibility: "hidden",
        pointerEvents: "none",
      }}
    >
      <ResumeDocumentContent snapshot={snapshot} />
    </div>
  );
}
