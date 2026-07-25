import type { MarginIn, TargetLength } from "@/types/supabase";

/**
 * Pure US-Letter page geometry. DOM reads (scrollHeight, per-block heights,
 * line heights) happen in the editor's measurement hook; this module turns
 * those raw pixel measurements into page metrics deterministically so the math
 * is unit-testable and the preview and Resume Check never disagree.
 *
 * US Letter is 8.5in × 11in. At the CSS reference 96 px/in that's 816 × 1056 px.
 */
export const DPI = 96;
export const PAGE_WIDTH_IN = 8.5;
export const PAGE_HEIGHT_IN = 11;
export const PAGE_WIDTH_PX = PAGE_WIDTH_IN * DPI;
export const PAGE_HEIGHT_PX = PAGE_HEIGHT_IN * DPI;

export function printableWidthPx(marginIn: MarginIn): number {
  return (PAGE_WIDTH_IN - 2 * marginIn) * DPI;
}

export function printableHeightPx(marginIn: MarginIn): number {
  return (PAGE_HEIGHT_IN - 2 * marginIn) * DPI;
}

export function targetPageLimit(target: TargetLength): number | null {
  if (target === "one_page") return 1;
  if (target === "two_pages") return 2;
  return null;
}

export type PageMetrics = {
  pageCount: number;
  nearOverflowRatio: number;
  unusedRatio: number;
  overflowPx: number;
};

/**
 * @param contentHeightPx  total rendered height of the resume content
 * @param marginIn         resume margin (drives printable height)
 * @param maxBlockHeightPx tallest single unbreakable block (an entry). If it
 *                         exceeds one printable page it cannot fit → overflow.
 */
export function computePageMetrics(
  contentHeightPx: number,
  marginIn: MarginIn,
  maxBlockHeightPx: number,
): PageMetrics {
  const printable = printableHeightPx(marginIn);
  const safeContent = Math.max(0, contentHeightPx);
  const pageCount = Math.max(1, Math.ceil(safeContent / printable));
  const lastPageUsed = safeContent - (pageCount - 1) * printable;
  const nearOverflowRatio = printable > 0 ? Math.min(1, lastPageUsed / printable) : 0;
  const totalCapacity = pageCount * printable;
  const unusedRatio = totalCapacity > 0 ? Math.max(0, (totalCapacity - safeContent) / totalCapacity) : 0;
  // A single block taller than a full printable page physically cannot fit.
  const overflowPx = Math.max(0, maxBlockHeightPx - printable);
  return { pageCount, nearOverflowRatio, unusedRatio, overflowPx };
}

/** Estimate rendered line count of a block from its height and line-height. */
export function estimateLineCount(blockHeightPx: number, lineHeightPx: number): number {
  if (lineHeightPx <= 0) return 0;
  return Math.max(1, Math.round(blockHeightPx / lineHeightPx));
}
