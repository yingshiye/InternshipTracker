"use client";

import { useState } from "react";
import { Library, FileText, SlidersHorizontal, MonitorSmartphone } from "lucide-react";
import { EditorProvider } from "./useEditorController";
import { MeasurementProvider } from "./MeasurementContext";
import { EditorTopBar } from "./EditorTopBar";
import { ModuleLibraryPanel } from "./ModuleLibraryPanel";
import { ResumePreview } from "./ResumePreview";
import { SettingsPanel } from "./SettingsPanel";
import { ResumeCheckPanel } from "./ResumeCheckPanel";
import { SubmitForApplicationPanel, type SubmitTargetApplication } from "./SubmitForApplicationPanel";
import type { EditorDraft, LibraryData } from "./editor-types";
import "@/app/resume-print.css";

type Pane = "library" | "resume" | "settings";

const PANES: { id: Pane; label: string; icon: typeof Library }[] = [
  { id: "library", label: "Library", icon: Library },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "settings", label: "Settings", icon: SlidersHorizontal },
];

export function ResumeEditor({
  initialDraft,
  library,
  userId,
  application,
}: {
  initialDraft: EditorDraft;
  library: LibraryData;
  userId: string;
  /** Present only when the editor was opened from an application. */
  application?: SubmitTargetApplication | null;
}) {
  // A stable per-tab id for BroadcastChannel conflict attribution.
  const [tabId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  );
  // Below xl the three columns cannot all be usable at once, so they become
  // tabs instead of three unreadable slivers. The Letter preview keeps its
  // real width and scrolls; it is never squeezed to fit.
  const [pane, setPane] = useState<Pane>("resume");

  return (
    <EditorProvider initialDraft={initialDraft} library={library} tabId={tabId}>
      <MeasurementProvider>
        <div className="flex h-screen flex-col">
          <EditorTopBar userId={userId} />
          {application && <SubmitForApplicationPanel application={application} />}

          {/* Tab bar: only present on narrow screens. */}
          <div
            className="flex items-center gap-1 border-b border-gray-100 px-2 py-1.5 xl:hidden print:hidden dark:border-gray-800"
            role="tablist"
            aria-label="Editor panes"
          >
            {PANES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`editor-tab-${id}`}
                aria-selected={pane === id}
                aria-controls={`editor-pane-${id}`}
                onClick={() => setPane(id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  pane === id
                    ? "bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="grid flex-1 overflow-hidden xl:grid-cols-[260px_1fr_340px]">
            <div
              role="tabpanel"
              id="editor-pane-library"
              aria-labelledby="editor-tab-library"
              className={`overflow-y-auto ${pane === "library" ? "" : "hidden"} xl:block`}
            >
              <ModuleLibraryPanel />
            </div>

            <div
              role="tabpanel"
              id="editor-pane-resume"
              aria-labelledby="editor-tab-resume"
              className={`overflow-hidden ${pane === "resume" ? "" : "hidden"} xl:block`}
            >
              <ResumePreview />
            </div>

            <aside
              role="tabpanel"
              id="editor-pane-settings"
              aria-labelledby="editor-tab-settings"
              className={`flex-col overflow-y-auto border-l border-gray-100 dark:border-gray-800 ${
                pane === "settings" ? "flex" : "hidden"
              } xl:flex`}
            >
              <p className="flex items-start gap-2 border-b border-gray-100 px-3 py-2 text-xs text-gray-500 xl:hidden dark:border-gray-800">
                <MonitorSmartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Reliable Letter-size PDF export needs desktop Google Chrome. Everything else — editing, version
                history, snapshots — works here.
              </p>
              <SettingsPanel />
              <ResumeCheckPanel userId={userId} />
            </aside>
          </div>
        </div>
      </MeasurementProvider>
    </EditorProvider>
  );
}
