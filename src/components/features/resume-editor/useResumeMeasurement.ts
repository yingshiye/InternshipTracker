"use client";

import { useEffect, useState, type RefObject } from "react";
import type { StyleSettings } from "@/lib/resume/types";
import { LINE_HEIGHT } from "@/lib/resume/style";
import { computePageMetrics, estimateLineCount } from "@/lib/resume/measure";
import type { CheckMeasurements } from "@/lib/resume/check";

/**
 * Reads the rendered preview DOM (content height, per-entry block heights,
 * per-bullet heights) and turns them into deterministic page metrics via the
 * pure `measure` helpers. The preview marks measurable nodes with data
 * attributes: `data-measure="content"`, `data-entry-id`, `data-bullet-id`.
 */
export function useResumeMeasurement(
  containerRef: RefObject<HTMLElement | null>,
  style: StyleSettings,
  // A cheap signal that changes whenever content/layout changes, to retrigger.
  signal: unknown,
): CheckMeasurements {
  const [measurements, setMeasurements] = useState<CheckMeasurements>({
    pageCount: 1,
    overflowPx: 0,
    nearOverflowRatio: 0,
    unusedRatio: 0,
    renderFailed: false,
    clippedBulletIds: [],
    bulletLineCounts: {},
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setMeasurements((m) => ({ ...m, renderFailed: true }));
      return;
    }
    const measure = () => {
      const contentNode = container.querySelector<HTMLElement>('[data-measure="content"]') ?? container;
      const contentHeight = contentNode.scrollHeight;

      const bulletLineCounts: Record<string, number> = {};
      const lineHeightPx = style.body_font_size_pt * (96 / 72) * LINE_HEIGHT[style.line_spacing];
      container.querySelectorAll<HTMLElement>("[data-bullet-id]").forEach((el) => {
        const id = el.getAttribute("data-bullet-id");
        if (id) bulletLineCounts[id] = estimateLineCount(el.offsetHeight, lineHeightPx);
      });

      let maxBlockHeight = 0;
      container.querySelectorAll<HTMLElement>("[data-entry-id]").forEach((el) => {
        maxBlockHeight = Math.max(maxBlockHeight, el.offsetHeight);
      });

      const metrics = computePageMetrics(contentHeight, style.margin_in, maxBlockHeight);
      setMeasurements({
        ...metrics,
        renderFailed: false,
        clippedBulletIds: [],
        bulletLineCounts,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, style.body_font_size_pt, style.line_spacing, style.margin_in, signal]);

  return measurements;
}
