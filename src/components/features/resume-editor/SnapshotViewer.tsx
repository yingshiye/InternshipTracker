"use client";

import { Lock } from "lucide-react";
import { DPI, PAGE_WIDTH_PX } from "@/lib/resume/measure";
import { LINE_HEIGHT, SECTION_GAP_PT, BULLET_GAP_PT } from "@/lib/resume/style";
import { formatDateRange } from "@/lib/resume/dates";
import type { ParsedSnapshot, SnapshotEntry } from "@/lib/resume/snapshot";

const PT_TO_PX = DPI / 72;

/**
 * Read-only rendering of a stored version snapshot.
 *
 * Everything on screen comes from the snapshot argument. Nothing here reads
 * the current draft or the library — a version is a historical record, and
 * filling gaps in it from today's data would quietly turn it into a lie.
 *
 * All text is rendered as React children (text nodes), never as markup, so a
 * snapshot containing HTML displays that HTML literally.
 */
export function SnapshotViewer({ snapshot }: { snapshot: ParsedSnapshot }) {
  const style = snapshot.resume.style_settings;
  const pagePadding = style.margin_in * DPI;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        role="note"
      >
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span>
          Read-only snapshot
          {snapshot.versionNumber !== null ? ` of version ${snapshot.versionNumber}` : ""}. Versions can never be
          edited or deleted.
        </span>
      </div>

      {snapshot.issues.length > 0 && (
        <ul className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {snapshot.issues.map((issue, i) => (
            <li key={i}>{issue}</li>
          ))}
        </ul>
      )}

      <div className="overflow-auto bg-gray-100 p-4 dark:bg-gray-900">
        <div
          className="mx-auto ring-1 ring-gray-200 dark:ring-gray-700"
          style={{
            width: PAGE_WIDTH_PX,
            minHeight: 11 * DPI,
            padding: pagePadding,
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: style.body_font_size_pt * PT_TO_PX,
            lineHeight: LINE_HEIGHT[style.line_spacing],
            color: "#111",
            background: "#fff",
          }}
        >
          {snapshot.header && (
            <header style={{ textAlign: "center" }}>
              <div style={{ fontSize: style.name_font_size_pt * PT_TO_PX, fontWeight: 700 }}>
                {snapshot.header.full_name ?? ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", marginTop: 2 }}>
                {[
                  snapshot.header.email,
                  snapshot.header.phone,
                  snapshot.header.location,
                  snapshot.header.linkedin_url,
                  snapshot.header.github_url,
                  snapshot.header.portfolio_url,
                  ...snapshot.header.custom_links.links.map((l) => `${l.label}: ${l.url}`),
                ]
                  .filter((v): v is string => Boolean(v && v.trim()))
                  .map((value, i) => (
                    <span key={i}>{value}</span>
                  ))}
              </div>
            </header>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SECTION_GAP_PT[style.section_spacing] * PT_TO_PX,
              marginTop: 8,
            }}
          >
            {snapshot.sections.map((section, si) => (
              <section key={si}>
                <h3
                  style={{
                    fontSize: style.heading_font_size_pt * PT_TO_PX,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    borderBottom: "1px solid #d1d5db",
                    marginBottom: 4,
                  }}
                >
                  {section.title}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {section.entries.map((entry, ei) => (
                    <SnapshotEntryView
                      key={ei}
                      entry={entry}
                      layout={section.layout_kind}
                      dateFormat={style.date_format}
                      bulletGapPx={BULLET_GAP_PT[style.bullet_spacing] * PT_TO_PX}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SnapshotEntryView({
  entry,
  layout,
  dateFormat,
  bulletGapPx,
}: {
  entry: SnapshotEntry;
  layout: "entry" | "education" | "skills";
  dateFormat: Parameters<typeof formatDateRange>[2];
  bulletGapPx: number;
}) {
  const dates = formatDateRange(entry.start_date, entry.end_date, dateFormat);

  if (layout === "skills") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(entry.skills_data?.categories ?? []).map((cat, i) => (
          <div key={i}>
            <span style={{ fontWeight: 700 }}>{cat.label}: </span>
            <span>{cat.items.join(", ")}</span>
          </div>
        ))}
      </div>
    );
  }

  const edu = entry.education_data;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700 }}>{entry.title ?? ""}</span>
        {dates && <span style={{ fontStyle: "italic" }}>{dates}</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontStyle: "italic" }}>
          {layout === "education"
            ? [edu?.degree, edu?.field_of_study].filter(Boolean).join(", ")
            : entry.organization ?? ""}
        </span>
        {entry.location && <span style={{ fontStyle: "italic" }}>{entry.location}</span>}
      </div>
      {/* field_of_study/minor/gpa/honors/coursework/details have no editor UI
          any more, but existing snapshots may still carry this data — keep
          rendering it read-only so version history stays accurate. */}
      {layout === "education" && edu && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {edu.minor && <span>Minor: {edu.minor}</span>}
          {edu.gpa && <span>GPA: {edu.gpa}</span>}
          {edu.honors && edu.honors.length > 0 && <span>Honors: {edu.honors.join(", ")}</span>}
          {edu.coursework && edu.coursework.length > 0 && <span>Coursework: {edu.coursework.join(", ")}</span>}
          {edu.details?.map((d, i) => <span key={i}>{d}</span>)}
        </div>
      )}
      {entry.bullets.length > 0 && (
        <ul style={{ listStyle: "disc", paddingLeft: "1.2em", margin: 0 }}>
          {entry.bullets.map((b, i) => (
            <li key={i} style={{ marginBottom: bulletGapPx }}>
              {b.content}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
