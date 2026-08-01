import type { Resume, ResumeHeader, ResumeSection, ResumeEntry, ResumeEntryBullet, LibraryBlock, LibraryBullet } from "@/lib/resume/types";

/** Client-side mirror of the full resume draft graph, kept ordered. */
export type EditorDraft = {
  resume: Resume;
  header: ResumeHeader | null;
  sections: ResumeSection[];
  entries: ResumeEntry[];
  bullets: ResumeEntryBullet[];
};

/**
 * "unsaved" means a debounced write is scheduled but has not run yet — the
 * one state the top bar must never render as "Saved". "saved" is only ever
 * set after an RPC has actually returned ok.
 */
export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "offline" | "failed" | "retrying";

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
