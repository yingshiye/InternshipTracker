"use client";

import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { DPI, PAGE_WIDTH_PX } from "@/lib/resume/measure";
import type { ParsedSnapshot } from "@/lib/resume/snapshot";
import { ResumeDocumentContent } from "./PrintDocument";

/**
 * Read-only, automatically fitted rendering of a stored version snapshot.
 * It uses the exact static document component used by PDF export, so a
 * historical version cannot acquire a separate layout or clip horizontally.
 */
export function SnapshotViewer({ snapshot }: { snapshot: ParsedSnapshot }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(11 * DPI);
  const style = snapshot.resume.style_settings;
  const pagePadding = style.margin_in * DPI;

  useEffect(() => {
    const host = hostRef.current;
    const page = pageRef.current;
    if (!host || !page) return;

    const measure = () => {
      const available = Math.max(280, host.clientWidth - 32);
      const nextScale = Math.min(1, available / PAGE_WIDTH_PX);
      setScale(nextScale);
      setPageHeight(Math.max(11 * DPI, page.scrollHeight));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    observer.observe(page);
    return () => observer.disconnect();
  }, [snapshot]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" role="note">
        <Lock className="size-3.5 shrink-0" />
        <span>
          Read-only snapshot
          {snapshot.versionNumber !== null ? ` of version ${snapshot.versionNumber}` : ""}. Versions can never be
          edited or deleted.
        </span>
      </div>

      {snapshot.issues.length > 0 && (
        <ul className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {snapshot.issues.map((issue, i) => <li key={i}>{issue}</li>)}
        </ul>
      )}

      <div
        ref={hostRef}
        data-testid="snapshot-viewer-host"
        className="min-w-0 overflow-y-auto overflow-x-hidden rounded-md bg-muted/60 p-4"
      >
        <div className="mx-auto origin-top-left" style={{ width: PAGE_WIDTH_PX * scale, height: pageHeight * scale }}>
          <div
            ref={pageRef}
            className="bg-white text-[#111] shadow-sm ring-1 ring-black/10"
            style={{
              width: PAGE_WIDTH_PX,
              minHeight: 11 * DPI,
              padding: pagePadding,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <ResumeDocumentContent snapshot={snapshot} />
          </div>
        </div>
      </div>
    </div>
  );
}
