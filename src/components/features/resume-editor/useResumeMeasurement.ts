"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { StyleSettings } from "@/lib/resume/types";
import { LINE_HEIGHT } from "@/lib/resume/style";
import { computePageMetrics, estimateLineCount } from "@/lib/resume/measure";
import type { CheckMeasurements } from "@/lib/resume/check";

const EMPTY: CheckMeasurements = {
  pageCount: 1,
  overflowPx: 0,
  nearOverflowRatio: 0,
  unusedRatio: 0,
  renderFailed: false,
  clippedBulletIds: [],
  bulletLineCounts: {},
};

/** Cheap equality so an identical measurement never triggers a re-render. */
function sameMeasurements(a: CheckMeasurements, b: CheckMeasurements): boolean {
  if (
    a.pageCount !== b.pageCount ||
    a.renderFailed !== b.renderFailed ||
    Math.round(a.overflowPx) !== Math.round(b.overflowPx) ||
    Math.round(a.nearOverflowRatio * 100) !== Math.round(b.nearOverflowRatio * 100) ||
    Math.round(a.unusedRatio * 100) !== Math.round(b.unusedRatio * 100) ||
    a.clippedBulletIds.length !== b.clippedBulletIds.length
  ) {
    return false;
  }
  const aKeys = Object.keys(a.bulletLineCounts);
  const bKeys = Object.keys(b.bulletLineCounts);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) => a.bulletLineCounts[k] === b.bulletLineCounts[k]);
}

/**
 * Turn the rendered preview DOM into page metrics.
 *
 * Real measurement, not a character-count estimate: the preview marks nodes
 * with `data-measure="content"`, `data-entry-id` and `data-bullet-id`, and
 * those measured pixels go through the pure helpers in `measure.ts`.
 *
 * Three things keep this from thrashing:
 *  - measurement waits for `document.fonts.ready`, because Times New Roman
 *    metrics decide every height on the page;
 *  - ResizeObserver callbacks are coalesced into one animation frame, so an
 *    observer that fires during its own re-layout cannot spin;
 *  - an identical result is dropped rather than set, so React does not
 *    re-render on every observer tick.
 */
export function useResumeMeasurement(
  containerRef: RefObject<HTMLElement | null>,
  style: StyleSettings,
  signal: unknown,
  bulletIds: string[] = [],
): CheckMeasurements {
  const [measurements, setMeasurements] = useState<CheckMeasurements>(EMPTY);
  const latest = useRef<CheckMeasurements>(EMPTY);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      setMeasurements((m) => (m.renderFailed ? m : { ...m, renderFailed: true }));
      return;
    }

    let cancelled = false;
    let frame = 0;

    const measure = () => {
      frame = 0;
      if (cancelled) return;
      const contentNode = container.querySelector<HTMLElement>('[data-measure="content"]') ?? container;
      const contentHeight = contentNode.scrollHeight;
      // A hidden responsive pane has no layout. Keep the last real result
      // instead of publishing a false one-page / unused-page measurement.
      if (contentHeight <= 0 || container.getBoundingClientRect().width <= 0) return;

      const bulletLineCounts: Record<string, number> = {};
      const lineHeightPx = style.body_font_size_pt * (96 / 72) * LINE_HEIGHT[style.line_spacing];
      container.querySelectorAll<HTMLElement>(".resume-print-bullet").forEach((el, index) => {
        const id = bulletIds[index];
        if (id) bulletLineCounts[id] = estimateLineCount(el.offsetHeight, lineHeightPx);
      });

      let maxBlockHeight = 0;
      container.querySelectorAll<HTMLElement>(".resume-print-entry").forEach((el) => {
        maxBlockHeight = Math.max(maxBlockHeight, el.offsetHeight);
      });

      const next: CheckMeasurements = {
        ...computePageMetrics(contentHeight, style.margin_in, maxBlockHeight),
        renderFailed: false,
        clippedBulletIds: [],
        bulletLineCounts,
      };
      if (sameMeasurements(latest.current, next)) return;
      latest.current = next;
      setMeasurements(next);
    };

    // Coalesce bursts of observer callbacks into a single measurement per
    // frame. Without this, measuring inside the observed subtree can schedule
    // the observer again and again.
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(measure);
    };

    schedule();

    // Font metrics decide every height here, so a measurement taken before the
    // font is ready is simply wrong.
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    fonts?.ready.then(() => {
      if (!cancelled) schedule();
    });

    const ro = new ResizeObserver(schedule);
    ro.observe(container);

    return () => {
      cancelled = true;
      if (frame !== 0) cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [containerRef, style.body_font_size_pt, style.line_spacing, style.margin_in, signal, bulletIds]);

  return measurements;
}
