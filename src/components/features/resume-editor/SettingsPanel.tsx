"use client";

import { useEditor } from "./useEditorController";
import {
  BODY_FONT_SIZES,
  NAME_FONT_SIZES,
  HEADING_FONT_SIZES,
  MARGINS,
  LINE_SPACINGS,
  BLOCK_SPACINGS,
  DATE_FORMATS,
} from "@/lib/resume/style";
import type { StyleSettings, TargetLength } from "@/lib/resume/types";

const TARGET_LABELS: Record<TargetLength, string> = {
  one_page: "One page",
  two_pages: "Two pages",
  no_limit: "No limit",
};

const DATE_FORMAT_EXAMPLE: Record<StyleSettings["date_format"], string> = {
  "MMMM YYYY": "June 2025",
  "MM YYYY": "06 2025",
  "MM/YYYY": "06/2025",
  YYYY: "2025",
};

export function SettingsPanel() {
  const { style, setStyle, draft, setTargetLength } = useEditor();

  return (
    <div className="border-b border-gray-100 p-3 dark:border-gray-800">
      <h2 className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-100">Settings</h2>
      <div className="flex flex-col gap-2">
        <Row label="Target length">
          <NativeSelect value={draft.resume.target_length} onChange={(v) => void setTargetLength(v as TargetLength)}>
            {(["one_page", "two_pages", "no_limit"] as TargetLength[]).map((t) => (
              <option key={t} value={t}>
                {TARGET_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Body font">
          <NativeSelect value={String(style.body_font_size_pt)} onChange={(v) => setStyle({ body_font_size_pt: Number(v) as StyleSettings["body_font_size_pt"] })}>
            {BODY_FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s} pt</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Name size">
          <NativeSelect value={String(style.name_font_size_pt)} onChange={(v) => setStyle({ name_font_size_pt: Number(v) as StyleSettings["name_font_size_pt"] })}>
            {NAME_FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s} pt</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Heading size">
          <NativeSelect value={String(style.heading_font_size_pt)} onChange={(v) => setStyle({ heading_font_size_pt: Number(v) as StyleSettings["heading_font_size_pt"] })}>
            {HEADING_FONT_SIZES.map((s) => (
              <option key={s} value={s}>{s} pt</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Margin">
          <NativeSelect value={String(style.margin_in)} onChange={(v) => setStyle({ margin_in: Number(v) as StyleSettings["margin_in"] })}>
            {MARGINS.map((s) => (
              <option key={s} value={s}>{s}&quot;</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Line spacing">
          <NativeSelect value={style.line_spacing} onChange={(v) => setStyle({ line_spacing: v as StyleSettings["line_spacing"] })}>
            {LINE_SPACINGS.map((s) => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Section spacing">
          <NativeSelect value={style.section_spacing} onChange={(v) => setStyle({ section_spacing: v as StyleSettings["section_spacing"] })}>
            {BLOCK_SPACINGS.map((s) => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Bullet spacing">
          <NativeSelect value={style.bullet_spacing} onChange={(v) => setStyle({ bullet_spacing: v as StyleSettings["bullet_spacing"] })}>
            {BLOCK_SPACINGS.map((s) => (
              <option key={s} value={s}>{cap(s)}</option>
            ))}
          </NativeSelect>
        </Row>
        <Row label="Date format">
          <NativeSelect value={style.date_format} onChange={(v) => setStyle({ date_format: v as StyleSettings["date_format"] })}>
            {DATE_FORMATS.map((s) => (
              <option key={s} value={s}>{DATE_FORMAT_EXAMPLE[s]}</option>
            ))}
          </NativeSelect>
        </Row>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-32 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      {children}
    </select>
  );
}
