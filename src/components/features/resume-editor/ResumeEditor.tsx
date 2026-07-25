"use client";

import { useState } from "react";
import { EditorProvider } from "./useEditorController";
import { MeasurementProvider } from "./MeasurementContext";
import { EditorTopBar } from "./EditorTopBar";
import { ModuleLibraryPanel } from "./ModuleLibraryPanel";
import { ResumePreview } from "./ResumePreview";
import { RightRail } from "./RightRail";
import type { EditorDraft, LibraryData } from "./editor-types";

export function ResumeEditor({
  initialDraft,
  library,
  userId,
}: {
  initialDraft: EditorDraft;
  library: LibraryData;
  userId: string;
}) {
  // A stable per-tab id for BroadcastChannel conflict attribution.
  const [tabId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  );

  return (
    <EditorProvider initialDraft={initialDraft} library={library} tabId={tabId}>
      <MeasurementProvider>
        <div className="flex h-screen flex-col">
          <EditorTopBar resumeName={initialDraft.resume.name} />
          <div className="grid flex-1 grid-cols-[260px_1fr_320px] overflow-hidden">
            <ModuleLibraryPanel />
            <ResumePreview />
            <RightRail userId={userId} />
          </div>
        </div>
      </MeasurementProvider>
    </EditorProvider>
  );
}
