import type { Resume, ResumeHeader, ResumeSection, ResumeEntry, ResumeEntryBullet, LibraryBlock, LibraryBullet } from "@/lib/resume/types";

/** Client-side mirror of the full resume draft graph, kept ordered. */
export type EditorDraft = {
  resume: Resume;
  header: ResumeHeader | null;
  sections: ResumeSection[];
  entries: ResumeEntry[];
  bullets: ResumeEntryBullet[];
};

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "failed" | "retrying";

/** A same-browser cross-tab notification carried over BroadcastChannel. */
export type TabMessage = {
  resumeId: string;
  revision: number;
  sourceTabId: string;
  ts: number;
};

/** Library data for the Module Library panel and copy/compare flows. */
export type LibraryData = {
  blocks: LibraryBlock[];
  bullets: LibraryBullet[];
};

/** An undo/redo entry: a thunk that performs the reverse mutation. */
export type UndoThunk = () => Promise<void>;
