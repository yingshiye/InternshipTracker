"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DPI } from "@/lib/resume/measure";
import { LINE_HEIGHT, SECTION_GAP_PT, BULLET_GAP_PT } from "@/lib/resume/style";
import { formatDateRange } from "@/lib/resume/dates";
import type { ParsedSnapshot, SnapshotEntry } from "@/lib/resume/snapshot";

const PT_TO_PX = DPI / 72;

/**
 * The thing that actually gets printed.
 *
 * Rendered from the *snapshot of the version just created*, never from live
 * editor state — that is what makes "the PDF and the immutable version are the
 * same document" true rather than merely likely.
 *
 * It is portaled to <body> so the print stylesheet can hide every other
 * top-level element with one rule; nesting it inside the editor would leave
 * the app shell as an ancestor that print CSS would have to unwind.
 */
export function PrintDocument({ snapshot }: { snapshot: ParsedSnapshot }) {
  // The host element is created once, in a lazy initializer rather than in an
  // effect: an effect would have to call setState to publish it, which this
  // project's lint rules (correctly) reject as a cascading render. This
  // component only ever mounts after a user action, so the initializer runs on
  // the client and `document` is available.
  const [container] = useState<HTMLElement | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.id = "resume-print-portal";
    return el;
  });

  useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    return () => {
      container.remove();
    };
  }, [container]);

  const style = snapshot.resume.style_settings;

  // The page margin is a style setting, so it has to reach @page, which cannot
  // read React props. A custom property on the root element is the bridge.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--resume-print-margin");
    root.style.setProperty("--resume-print-margin", `${style.margin_in}in`);
    return () => {
      if (previous) root.style.setProperty("--resume-print-margin", previous);
      else root.style.removeProperty("--resume-print-margin");
    };
  }, [style.margin_in]);

  if (!container) return null;

  return createPortal(
    <div
      className="resume-print-document"
      style={{
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: style.body_font_size_pt * PT_TO_PX,
        lineHeight: LINE_HEIGHT[style.line_spacing],
        color: "#000",
        background: "#fff",
      }}
    >
      {snapshot.header && (
        <header className="resume-print-header" style={{ textAlign: "center" }}>
          <div style={{ fontSize: style.name_font_size_pt * PT_TO_PX, fontWeight: 700 }}>
            {snapshot.header.full_name ?? ""}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", marginTop: 2 }}>
            {snapshot.header.email && <span>{snapshot.header.email}</span>}
            {snapshot.header.phone && <span>{snapshot.header.phone}</span>}
            {snapshot.header.location && <span>{snapshot.header.location}</span>}
            {/* Real anchors, so the PDF keeps clickable links and selectable text. */}
            {snapshot.header.linkedin_url && <PrintLink href={snapshot.header.linkedin_url} />}
            {snapshot.header.github_url && <PrintLink href={snapshot.header.github_url} />}
            {snapshot.header.portfolio_url && <PrintLink href={snapshot.header.portfolio_url} />}
            {snapshot.header.custom_links.links.map((link, i) => (
              <PrintLink key={i} href={link.url} label={link.label} />
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
          <section key={si} className="resume-print-section">
            <h2
              className="resume-print-section-heading"
              style={{
                fontSize: style.heading_font_size_pt * PT_TO_PX,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                borderBottom: "1px solid #000",
                marginBottom: 4,
              }}
            >
              {section.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {section.entries.map((entry, ei) => (
                <PrintEntry
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
    </div>,
    container,
  );
}

/**
 * Shows the human-readable form of a URL rather than the raw href when no
 * label is given — "github.com/someone" reads better in a printed header than
 * "https://github.com/someone/" and still parses cleanly for an ATS.
 */
function PrintLink({ href, label }: { href: string; label?: string }) {
  let text = label ?? href;
  if (!label) {
    try {
      const u = new URL(href);
      text = `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
    } catch {
      text = href;
    }
  }
  return (
    <a href={href} rel="noreferrer">
      {label ? `${label}: ${text}` : text}
    </a>
  );
}

function PrintEntry({
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
  if (layout === "skills") {
    return (
      <div className="resume-print-entry" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {(entry.skills_data?.categories ?? []).map((cat, i) => (
          <div key={i}>
            <span style={{ fontWeight: 700 }}>{cat.label}: </span>
            <span>{cat.items.join(", ")}</span>
          </div>
        ))}
      </div>
    );
  }

  const dates = formatDateRange(entry.start_date, entry.end_date, dateFormat);
  const edu = entry.education_data;

  return (
    <div className="resume-print-entry">
      <div className="resume-print-entry-head">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontWeight: 700 }}>{entry.title ?? ""}</span>
          {dates && <span style={{ fontStyle: "italic" }}>{dates}</span>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontStyle: "italic" }}>
            {layout === "education"
              ? [edu?.degree, edu?.field_of_study].filter(Boolean).join(", ")
              : (entry.organization ?? "")}
          </span>
          {entry.location && <span style={{ fontStyle: "italic" }}>{entry.location}</span>}
        </div>
      </div>

      {layout === "education" && edu && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {edu.minor && <span>Minor: {edu.minor}</span>}
          {edu.gpa && <span>GPA: {edu.gpa}</span>}
          {edu.honors && edu.honors.length > 0 && <span>Honors: {edu.honors.join(", ")}</span>}
          {edu.coursework && edu.coursework.length > 0 && <span>Relevant coursework: {edu.coursework.join(", ")}</span>}
          {edu.details?.map((d, i) => <span key={i}>{d}</span>)}
        </div>
      )}

      {entry.subtitle && <div>{entry.subtitle}</div>}

      {entry.bullets.length > 0 && (
        <ul>
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
