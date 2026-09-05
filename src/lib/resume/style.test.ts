import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStyleSettings, DEFAULT_STYLE_SETTINGS } from "./style";

test("normalizeStyleSettings: empty object → all defaults (older resumes with {})", () => {
  assert.deepEqual(normalizeStyleSettings({}), DEFAULT_STYLE_SETTINGS);
});

test("normalizeStyleSettings: null/undefined → all defaults", () => {
  assert.deepEqual(normalizeStyleSettings(null), DEFAULT_STYLE_SETTINGS);
  assert.deepEqual(normalizeStyleSettings(undefined), DEFAULT_STYLE_SETTINGS);
});

test("body font defaults to 11 pt and missing/invalid values fall back to 11", () => {
  assert.equal(normalizeStyleSettings({}).body_font_size_pt, 11);
  assert.equal(normalizeStyleSettings({ body_font_size_pt: 8 }).body_font_size_pt, 11);
  assert.equal(normalizeStyleSettings({ body_font_size_pt: "big" }).body_font_size_pt, 11);
  assert.equal(normalizeStyleSettings({ body_font_size_pt: 13 }).body_font_size_pt, 11);
});

test("valid user-selected values are preserved", () => {
  const s = normalizeStyleSettings({
    body_font_size_pt: 10.5,
    name_font_size_pt: 24,
    heading_font_size_pt: 14,
    margin_in: 0.75,
    line_spacing: "comfortable",
    section_spacing: "wide",
    bullet_spacing: "tight",
    date_format: "YYYY",
  });
  assert.equal(s.body_font_size_pt, 10.5);
  assert.equal(s.name_font_size_pt, 24);
  assert.equal(s.heading_font_size_pt, 14);
  assert.equal(s.margin_in, 0.75);
  assert.equal(s.line_spacing, "comfortable");
  assert.equal(s.section_spacing, "wide");
  assert.equal(s.bullet_spacing, "tight");
  assert.equal(s.date_format, "YYYY");
});

test("date_format defaults to 'MM YYYY' and accepts the English long-month format", () => {
  assert.equal(normalizeStyleSettings({}).date_format, "MM YYYY");
  assert.equal(normalizeStyleSettings({ date_format: "MMMM YYYY" }).date_format, "MMMM YYYY");
  // An unsupported abbreviated value still falls back to the default.
  assert.equal(normalizeStyleSettings({ date_format: "MMM YYYY" }).date_format, "MM YYYY");
  assert.equal(normalizeStyleSettings({ date_format: "garbage" }).date_format, "MM YYYY");
});

test("unknown properties are dropped on normalization", () => {
  const s = normalizeStyleSettings({ body_font_size_pt: 12, font_family: "Comic Sans", extra: true }) as Record<string, unknown>;
  assert.equal(s.body_font_size_pt, 12);
  assert.equal("font_family" in s, false);
  assert.equal("extra" in s, false);
  assert.deepEqual(Object.keys(s).sort(), Object.keys(DEFAULT_STYLE_SETTINGS).sort());
});

test("out-of-range enum values coerce to defaults", () => {
  assert.equal(normalizeStyleSettings({ line_spacing: "loose" }).line_spacing, "standard");
  assert.equal(normalizeStyleSettings({ section_spacing: "huge" }).section_spacing, "standard");
  assert.equal(normalizeStyleSettings({ margin_in: 2 }).margin_in, 0.5);
});
