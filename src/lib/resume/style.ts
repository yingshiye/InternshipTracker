import type {
  StyleSettings,
  BodyFontSizePt,
  NameFontSizePt,
  HeadingFontSizePt,
  MarginIn,
  LineSpacing,
  BlockSpacing,
  DateFormat,
} from "@/types/supabase";

/**
 * Style settings live in the free-form `resumes.style_settings` jsonb column.
 * There is no DB migration for style — this module is the single source of
 * truth for allowed values, defaults, and normalization. Every write goes
 * through `normalizeStyleSettings` so the stored object is always the full,
 * validated shape with no unknown keys.
 */

export const BODY_FONT_SIZES: readonly BodyFontSizePt[] = [9.5, 10, 10.5, 11, 11.5, 12];
export const NAME_FONT_SIZES: readonly NameFontSizePt[] = [16, 18, 20, 22, 24];
export const HEADING_FONT_SIZES: readonly HeadingFontSizePt[] = [10, 11, 12, 13, 14];
export const MARGINS: readonly MarginIn[] = [0.4, 0.5, 0.6, 0.7, 0.75, 1];
export const LINE_SPACINGS: readonly LineSpacing[] = ["compact", "standard", "comfortable"];
export const BLOCK_SPACINGS: readonly BlockSpacing[] = ["tight", "standard", "wide"];
export const DATE_FORMATS: readonly DateFormat[] = ["MM YYYY", "MM/YYYY", "YYYY"];

export const DEFAULT_STYLE_SETTINGS: StyleSettings = {
  body_font_size_pt: 11,
  name_font_size_pt: 20,
  heading_font_size_pt: 12,
  margin_in: 0.5,
  line_spacing: "standard",
  section_spacing: "standard",
  bullet_spacing: "standard",
  date_format: "MM YYYY",
};

function pickNumber<T extends number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "number" && (allowed as readonly number[]).includes(value) ? (value as T) : fallback;
}

function pickString<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Fill every key with a default, coerce out-of-range values to the default,
 * and drop unknown keys. Older resumes stored `{}` (Step 1 never wrote style),
 * so they normalize to the full default set. Missing or invalid body font
 * always falls back to 11 pt.
 */
export function normalizeStyleSettings(raw: unknown): StyleSettings {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    body_font_size_pt: pickNumber(o.body_font_size_pt, BODY_FONT_SIZES, DEFAULT_STYLE_SETTINGS.body_font_size_pt),
    name_font_size_pt: pickNumber(o.name_font_size_pt, NAME_FONT_SIZES, DEFAULT_STYLE_SETTINGS.name_font_size_pt),
    heading_font_size_pt: pickNumber(o.heading_font_size_pt, HEADING_FONT_SIZES, DEFAULT_STYLE_SETTINGS.heading_font_size_pt),
    margin_in: pickNumber(o.margin_in, MARGINS, DEFAULT_STYLE_SETTINGS.margin_in),
    line_spacing: pickString(o.line_spacing, LINE_SPACINGS, DEFAULT_STYLE_SETTINGS.line_spacing),
    section_spacing: pickString(o.section_spacing, BLOCK_SPACINGS, DEFAULT_STYLE_SETTINGS.section_spacing),
    bullet_spacing: pickString(o.bullet_spacing, BLOCK_SPACINGS, DEFAULT_STYLE_SETTINGS.bullet_spacing),
    date_format: pickString(o.date_format, DATE_FORMATS, DEFAULT_STYLE_SETTINGS.date_format),
  };
}

// ── Rendering multipliers ──────────────────────────────────────────────────
// Deterministic mappings from the spacing enums to concrete CSS values, shared
// by the preview and the overflow measurement so they never disagree.

export const LINE_HEIGHT: Record<LineSpacing, number> = {
  compact: 1.15,
  standard: 1.3,
  comfortable: 1.5,
};

export const SECTION_GAP_PT: Record<BlockSpacing, number> = {
  tight: 6,
  standard: 10,
  wide: 16,
};

export const BULLET_GAP_PT: Record<BlockSpacing, number> = {
  tight: 1,
  standard: 3,
  wide: 6,
};
