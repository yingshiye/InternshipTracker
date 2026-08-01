"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { useEditor } from "./useEditorController";
import { CustomLinksDialog } from "./CustomLinksDialog";
import { DPI } from "@/lib/resume/measure";
import type { CustomLinks } from "@/lib/resume/types";

const PT_TO_PX = DPI / 72;

/**
 * Inline-editable resume header. Controlled inputs styled to read like the
 * rendered resume — no contenteditable, so nothing but plain text is ever
 * stored. Edits debounce-save through the controller.
 */
export function EditableHeader() {
  const { draft, style, updateHeader } = useEditor();
  const [linksOpen, setLinksOpen] = useState(false);
  const h = draft.header;
  if (!h) return null;

  const nameSize = style.name_font_size_pt * PT_TO_PX;
  const customLinks = (h.custom_links as CustomLinks | null)?.links ?? [];

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
        {/* Custom links are read-only here and edited in their own dialog:
            they are an ordered list, and inline reordering inside the page
            header would fight the resume layout. */}
        {customLinks.map((link, i) => (
          <span key={i}>{`${link.label}: ${link.url}`}</span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setLinksOpen(true)}
        className="mt-1 inline-flex items-center gap-1 rounded text-xs text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-1 print:hidden"
      >
        <Link2 className="h-3 w-3" />
        {customLinks.length > 0 ? `Edit ${customLinks.length} custom link${customLinks.length === 1 ? "" : "s"}` : "Add custom links"}
      </button>

      {linksOpen && <CustomLinksDialog open={linksOpen} onOpenChange={setLinksOpen} />}
    </header>
  );
}
