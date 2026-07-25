import { test } from "node:test";
import assert from "node:assert/strict";
import { computePageMetrics, printableHeightPx, estimateLineCount, targetPageLimit, PAGE_HEIGHT_PX } from "./measure";

test("printableHeightPx subtracts both margins at 96 DPI", () => {
  // 11in - 2*0.5in = 10in * 96 = 960px
  assert.equal(printableHeightPx(0.5), 960);
  // 11in - 2*1in = 9in * 96 = 864px
  assert.equal(printableHeightPx(1), 864);
});

test("computePageMetrics: content under one page → 1 page, unused space", () => {
  const m = computePageMetrics(480, 0.5, 100); // half of 960
  assert.equal(m.pageCount, 1);
  assert.equal(m.overflowPx, 0);
  assert.ok(Math.abs(m.nearOverflowRatio - 0.5) < 1e-9);
  assert.ok(Math.abs(m.unusedRatio - 0.5) < 1e-9);
});

test("computePageMetrics: content just over one page → 2 pages", () => {
  const m = computePageMetrics(1000, 0.5, 100); // > 960
  assert.equal(m.pageCount, 2);
});

test("computePageMetrics: an unbreakable block taller than a page → overflowPx > 0", () => {
  const m = computePageMetrics(500, 0.5, 1000); // block 1000 > printable 960
  assert.ok(m.overflowPx > 0);
});

test("computePageMetrics: near-full page reports high nearOverflowRatio", () => {
  const m = computePageMetrics(940, 0.5, 200); // 940/960 ≈ 0.979
  assert.equal(m.pageCount, 1);
  assert.ok(m.nearOverflowRatio > 0.95);
});

test("computePageMetrics: empty content → 1 page, no overflow", () => {
  const m = computePageMetrics(0, 0.5, 0);
  assert.equal(m.pageCount, 1);
  assert.equal(m.overflowPx, 0);
});

test("estimateLineCount rounds height / line-height, min 1", () => {
  assert.equal(estimateLineCount(0, 16), 1);
  assert.equal(estimateLineCount(16, 16), 1);
  assert.equal(estimateLineCount(50, 16), 3);
  assert.equal(estimateLineCount(64, 16), 4);
});

test("targetPageLimit maps enums", () => {
  assert.equal(targetPageLimit("one_page"), 1);
  assert.equal(targetPageLimit("two_pages"), 2);
  assert.equal(targetPageLimit("no_limit"), null);
});

test("US Letter page height constant is 1056px at 96 DPI", () => {
  assert.equal(PAGE_HEIGHT_PX, 1056);
});
