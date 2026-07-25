"use client";

import { useEditor } from "./useEditorController";
import { DPI } from "@/lib/resume/measure";

const PT_TO_PX = DPI / 72;

/**
 * Inline-editable resume header. Controlled inputs styled to read like the
 * rendered resume — no contenteditable, so nothing but plain text is ever
 * stored. Edits debounce-save via the controller.
 */
export function EditableHeader() {
  const { draft, style, updateHeader } = useEditor();
  const h = draft.header;
  if (!h) return null;

  const nameSize = style.name_font_size_pt * PT_TO_PX;

  return (
    <header style={{ textAlign: "center" }}>
      <input
        value={h.full_name ?? ""}
        onChange={(e) => updateHeader({ full_name: e.target.value })}
        placeholder="Your Name"
        aria-label="Full name"
        style={{
          fontSize: nameSize,
          fontWeight: 700,
          textAlign: "center",
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "inherit",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", marginTop: 2 }}>
        {(
          [
            ["email", "Email", h.email],
            ["phone", "Phone", h.phone],
            ["location", "Location", h.location],
            ["linkedin_url", "LinkedIn URL", h.linkedin_url],
            ["github_url", "GitHub URL", h.github_url],
            ["portfolio_url", "Portfolio URL", h.portfolio_url],
          ] as const
        ).map(([field, label, value]) => (
          <input
            key={field}
            value={value ?? ""}
            onChange={(e) => updateHeader({ [field]: e.target.value })}
            placeholder={label}
            aria-label={label}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "inherit",
              textAlign: "center",
              width: `${Math.max(label.length, (value ?? "").length) + 1}ch`,
            }}
          />
        ))}
      </div>
    </header>
  );
}
