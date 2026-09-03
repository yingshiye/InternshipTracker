"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RpcResult } from "@/lib/resume/rpc";
import type { StyleSettings, TargetLength, LayoutKind, CustomLinks } from "@/lib/resume/types";
import * as sectionsApi from "@/lib/resume/sections";
import * as entriesApi from "@/lib/resume/entries";
import * as resumesApi from "@/lib/resume/resumes";
import * as versionsApi from "@/lib/resume/versions";
import { describeRpcError } from "@/lib/resume/rpc";
import { normalizeStyleSettings } from "@/lib/resume/style";
import { loadResumeDraft } from "@/lib/resume/draft";
import type { VersionType } from "@/lib/resume/types";
import type { EditorDraft, SaveStatus, LibraryData, TabMessage, UndoThunk } from "./editor-types";
import type { ResumeEntry, ResumeEntryBullet } from "@/lib/resume/types";

type PerformArgs<T> = {
  call: (rev: number) => Promise<RpcResult<T>>;
  newRevision: (data: T) => number;
  onSuccess: (data: T, newRev: number) => void;
  inverse?: (data: T) => UndoThunk;
  record?: "undo" | "redo" | "none";
};

export type EditorController = {
  draft: EditorDraft;
  library: LibraryData;
  style: StyleSettings;
  saveStatus: SaveStatus;
  conflict: boolean;
  canUndo: boolean;
  canRedo: boolean;
  // header
  updateHeader: (patch: Partial<HeaderFields>) => void;
  // sections
  addSection: (title: string, layoutKind: LayoutKind) => Promise<void>;
  renameSection: (sectionId: string, title: string) => Promise<void>;
  deleteSection: (sectionId: string) => Promise<void>;
  reorderSections: (orderedIds: string[]) => Promise<void>;
  // entries
  copyBlock: (sectionId: string, blockId: string, bulletIds: string[]) => Promise<void>;
  addCustomEntry: (sectionId: string) => Promise<void>;
  updateEntry: (entryId: string, patch: Partial<EntryFields>) => void;
  removeEntry: (entryId: string) => Promise<void>;
  moveEntryToPosition: (entryId: string, targetSectionId: string, orderedIds: string[]) => Promise<void>;
  // bullets
  addCustomBullet: (entryId: string) => Promise<void>;
  addBulletFromLibrary: (entryId: string, libraryBulletId: string) => Promise<void>;
  updateBullet: (bulletId: string, content: string) => void;
  removeBullet: (bulletId: string) => Promise<void>;
  reorderBullets: (entryId: string, orderedIds: string[]) => Promise<void>;
  saveBulletToLibrary: (bulletId: string, blockId: string) => Promise<string | null>;
  applyLibraryUpdate: (entryId: string, sel: entriesApi.ApplyLibraryUpdateSelection) => Promise<boolean>;
  // resume metadata + style
  updateMetadata: (input: { name: string; targetCompany: string | null; targetRole: string | null }) => Promise<boolean>;
  setStyle: (patch: Partial<StyleSettings>) => void;
  setTargetLength: (t: TargetLength) => Promise<void>;
  // undo/redo + conflict
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  reconcile: () => void;
  retryLast: () => void;
  lastError: string | null;
  // ── Step 3 ────────────────────────────────────────────────────────────────
  /** True while a debounced write is scheduled but has not run yet. */
  hasUnsavedChanges: boolean;
  /**
   * Run every scheduled debounced write now and wait for the whole serial
   * queue to drain. Resolves true when the draft is fully persisted.
   * This is what makes "export the saved draft, not the editor state" real.
   */
  flushPendingSaves: () => Promise<boolean>;
  /** The revision currently persisted on the server, as far as this tab knows. */
  currentRevision: () => number;
  /**
   * Mint an immutable version. Never called by autosave — only by the
   * checkpoint button, the export flow, and the submit flow.
   */
  createVersion: (
    versionType: VersionType,
  ) => Promise<{ ok: true; versionId: string; versionNumber: number } | { ok: false; message: string; conflict: boolean }>;
  /** Atomic restore from one of this resume's own versions. */
  restoreFromVersion: (versionId: string) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export type HeaderFields = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  /** Ordered extra links. Edited as a whole array, never field by field. */
  custom_links: CustomLinks;
};

export type EntryFields = Pick<
  ResumeEntry,
  "title" | "subtitle" | "organization" | "location" | "start_date" | "end_date" | "education_data" | "skills_data"
>;

const Ctx = createContext<EditorController | null>(null);

export function useEditor(): EditorController {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}

export function EditorProvider({
  initialDraft,
  library,
  tabId,
  children,
}: {
  initialDraft: EditorDraft;
  library: LibraryData;
  tabId: string;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [draft, setDraft] = useState<EditorDraft>(initialDraft);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [conflict, setConflict] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const revisionRef = useRef(initialDraft.resume.revision);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const undoStack = useRef<UndoThunk[]>([]);
  const redoStack = useRef<UndoThunk[]>([]);
  const lastFailedRef = useRef<(() => void) | null>(null);
  // Each pending debounce keeps its timer *and* the work it was going to do,
  // so `flushPendingSaves` can run that work immediately instead of waiting
  // out the delay. Without the stored thunk there would be no way to make
  // "save everything now, then export" reliable.
  const debounceTimers = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>>(new Map());
  const conflictRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const resumeId = initialDraft.resume.id;

  const syncStackDepth = useCallback(() => {
    setUndoDepth(undoStack.current.length);
    setRedoDepth(redoStack.current.length);
  }, []);

  /**
   * Schedule a debounced write, replacing any pending write for the same key.
   * `pendingCount` drives the "Unsaved changes" indicator, so it must be
   * decremented on exactly one path — here, when the timer fires.
   */
  const scheduleDebounced = useCallback((key: string, run: () => void, delayMs = 700) => {
    const existing = debounceTimers.current.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      debounceTimers.current.delete(key);
      setPendingCount((n) => Math.max(0, n - 1));
    }
    const fire = () => {
      debounceTimers.current.delete(key);
      setPendingCount((n) => Math.max(0, n - 1));
      run();
    };
    const timer = setTimeout(fire, delayMs);
    debounceTimers.current.set(key, { timer, run: fire });
    setPendingCount((n) => n + 1);
    setSaveStatus((s) => (s === "failed" || s === "offline" ? s : "unsaved"));
  }, []);

  // ── Cross-tab conflict detection via BroadcastChannel ─────────────────────
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(`resume-editor:${resumeId}`);
    channelRef.current = ch;
    ch.onmessage = (ev: MessageEvent<TabMessage>) => {
      const msg = ev.data;
      if (!msg || msg.sourceTabId === tabId || msg.resumeId !== resumeId) return;
      if (msg.revision > revisionRef.current) setConflict(true);
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [resumeId, tabId]);

  const broadcast = useCallback(
    (revision: number) => {
      channelRef.current?.postMessage({ resumeId, revision, sourceTabId: tabId, ts: Date.now() } satisfies TabMessage);
    },
    [resumeId, tabId],
  );

  const enqueue = useCallback(<T,>(op: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(op, op);
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  const perform = useCallback(
    <T,>(args: PerformArgs<T>): Promise<T | null> => {
      const record = args.record ?? "undo";
      return enqueue(async () => {
        // Once the server is known to be ahead, every queued write behind this
        // point is based on a stale revision. Dropping them is what makes this
        // not last-write-wins: nothing newer on the server is ever overwritten,
        // and the local text stays in state for the user to re-apply.
        if (conflictRef.current) return null;
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setSaveStatus("offline");
          setLastError("You appear to be offline.");
          return null;
        }
        setSaveStatus("saving");
        const result = await args.call(revisionRef.current);
        if (result.ok) {
          const newRev = args.newRevision(result.data);
          revisionRef.current = newRev;
          args.onSuccess(result.data, newRev);
          setDraft((d) => ({ ...d, resume: { ...d.resume, revision: newRev } }));
          setSaveStatus("saved");
          setLastError(null);
          broadcast(newRev);
          if (args.inverse && record !== "none") {
            const thunk = args.inverse(result.data);
            if (record === "undo") {
              undoStack.current.push(thunk);
              redoStack.current = [];
            } else {
              redoStack.current.push(thunk);
            }
            syncStackDepth();
          }
          return result.data;
        }
        if (result.reason === "revision_conflict") {
          conflictRef.current = true;
          setConflict(true);
          setSaveStatus("failed");
          setLastError(
            "This resume changed somewhere else, so your last change was not saved. Reload to get the latest version — your unsaved text stays on screen until you do.",
          );
          return null;
        }
        setSaveStatus("failed");
        // Raw Postgres/PostgREST text never reaches the UI.
        setLastError(describeRpcError(result.reason));
        return null;
      });
    },
    [enqueue, broadcast, syncStackDepth],
  );

  // ── Local immutable helpers ───────────────────────────────────────────────
  const patchEntryLocal = useCallback((entryId: string, patch: Partial<ResumeEntry>) => {
    setDraft((d) => ({ ...d, entries: d.entries.map((e) => (e.id === entryId ? { ...e, ...patch } : e)) }));
  }, []);
  const patchBulletLocal = useCallback((bulletId: string, patch: Partial<ResumeEntryBullet>) => {
    setDraft((d) => ({ ...d, bullets: d.bullets.map((b) => (b.id === bulletId ? { ...b, ...patch } : b)) }));
  }, []);

  // Re-load the full draft from the database. Used after operations whose RPCs
  // don't return the ids of newly-created child rows (copy_block_into_section,
  // apply_library_update), so the client state always carries real ids. The
  // client draft is useState-owned, so router.refresh() alone cannot update it.
  //
  // A field with a debounced write still pending (scheduled but not yet fired)
  // has not reached the database yet, so the row this just read back is stale
  // for that field specifically. Keeping the local value there — instead of
  // letting this refetch clobber it — is what stops "copy a block right after
  // editing the header" from reverting the edit: without this guard, the
  // in-flight debounce would later fire reading `headerRef.current`, which the
  // sync effect below would by then have overwritten with the stale value,
  // turning a transient UI flicker into a real, persisted loss.
  const refetchDraft = useCallback(
    async (opts?: { force?: boolean }) => {
      const fresh = await loadResumeDraft(supabase, resumeId);
      if (!fresh) return;
      revisionRef.current = fresh.resume.revision;
      if (opts?.force) {
        setDraft(fresh);
        return;
      }
      setDraft((prev) => {
        const header = debounceTimers.current.has("header") ? prev.header : fresh.header;
        const entries = fresh.entries.map((e) => {
          const local = prev.entries.find((p) => p.id === e.id);
          return local && debounceTimers.current.has(`entry:${e.id}`) ? local : e;
        });
        const bullets = fresh.bullets.map((b) => {
          const local = prev.bullets.find((p) => p.id === b.id);
          return local && debounceTimers.current.has(`bullet:${b.id}`) ? local : b;
        });
        return { ...fresh, header, entries, bullets };
      });
    },
    [supabase, resumeId],
  );

  // Latest-state refs so debounced timer callbacks read current values. Kept
  // in sync two ways: this effect (for state changes that don't go through
  // the update* helpers below, e.g. refetchDraft/restoreFromVersion), and a
  // direct synchronous assignment inside each update* helper itself — the
  // effect alone is not enough, because it only runs after React commits the
  // render, which is too late for a caller that patches state and then
  // immediately flushes the pending write in the same synchronous tick (see
  // CustomLinksDialog.handleSave: updateHeader() followed straight away by
  // flushPendingSaves(), with no render in between).
  const headerRef = useRef(draft.header);
  useEffect(() => {
    headerRef.current = draft.header;
  }, [draft.header]);
  // A ref to the controller itself, so undo/redo thunks can re-invoke the
  // high-level methods without a declaration-order (TDZ) cycle.
  const selfRef = useRef<EditorController | null>(null);

  // ── Header (debounced text) ───────────────────────────────────────────────
  const updateHeader = useCallback(
    (patch: Partial<HeaderFields>) => {
      if (!headerRef.current) return;
      // Synchronous, not via the effect above: a caller may read headerRef
      // through a debounce fired by an immediate flushPendingSaves() call
      // before React has re-rendered, and that read must see this patch.
      const next = { ...headerRef.current, ...patch };
      headerRef.current = next;
      setDraft((d) => (d.header ? { ...d, header: next } : d));
      scheduleDebounced("header", () => {
          const h = headerRef.current;
          if (!h) return;
          void perform({
            call: (rev) =>
              resumesApi.updateResumeHeader(supabase, resumeId, rev, {
                fullName: h.full_name,
                email: h.email,
                phone: h.phone,
                location: h.location,
                linkedinUrl: h.linkedin_url,
                githubUrl: h.github_url,
                portfolioUrl: h.portfolio_url,
                customLinks: h.custom_links,
              }),
            newRevision: (r) => r,
            onSuccess: () => {},
            record: "none",
          });
      });
    },
    [perform, resumeId, supabase, scheduleDebounced],
  );

  // ── Sections ──────────────────────────────────────────────────────────────
  const addSection = useCallback(
    async (title: string, layoutKind: LayoutKind) => {
      await perform({
        call: (rev) => sectionsApi.createSection(supabase, resumeId, rev, { title, layoutKind }),
        newRevision: (d) => d[0].revision,
        onSuccess: (d, rev) => {
          const newId = d[0].section_id;
          setDraft((prev) => ({
            ...prev,
            sections: [...prev.sections, {
              id: newId, user_id: prev.resume.user_id, resume_id: resumeId, title, layout_kind: layoutKind,
              sort_order: prev.sections.length + 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }],
          }));
          void rev;
        },
        inverse: (d) => async () => {
          await perform({
            call: (rev) => sectionsApi.deleteSection(supabase, resumeId, rev, d[0].section_id),
            newRevision: (r) => r,
            onSuccess: () => setDraft((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== d[0].section_id) })),
            record: "redo",
            inverse: () => async () => { await selfRef.current?.addSection(title, layoutKind); },
          });
        },
      });
    },
    [perform, resumeId, supabase],
  );

  const renameSection = useCallback(
    async (sectionId: string, title: string) => {
      const prevTitle = draft.sections.find((s) => s.id === sectionId)?.title ?? "";
      await perform({
        call: (rev) => sectionsApi.renameSection(supabase, resumeId, rev, sectionId, title),
        newRevision: (r) => r,
        onSuccess: () => setDraft((p) => ({ ...p, sections: p.sections.map((s) => (s.id === sectionId ? { ...s, title } : s)) })),
        inverse: () => async () => { await selfRef.current?.renameSection(sectionId, prevTitle); },
      });
    },
    [perform, resumeId, supabase, draft.sections],
  );

  const deleteSection = useCallback(
    async (sectionId: string) => {
      const sec = draft.sections.find((s) => s.id === sectionId);
      if (!sec) return;
      const position = draft.sections.filter((s) => s.sort_order <= sec.sort_order).length;
      await perform({
        call: (rev) => sectionsApi.deleteSection(supabase, resumeId, rev, sectionId),
        newRevision: (r) => r,
        onSuccess: () => setDraft((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== sectionId) })),
        inverse: () => async () => {
          await perform({
            call: (rev) => sectionsApi.restoreSection(supabase, resumeId, rev, { position, title: sec.title, layoutKind: sec.layout_kind }),
            newRevision: (d) => d[0].revision,
            onSuccess: (d) =>
              setDraft((p) => ({
                ...p,
                sections: [...p.sections, { ...sec, id: d[0].section_id }].sort((a, b) => a.sort_order - b.sort_order),
              })),
            record: "redo",
            inverse: (d) => async () => {
              await perform({
                call: (rev) => sectionsApi.deleteSection(supabase, resumeId, rev, d[0].section_id),
                newRevision: (r) => r,
                onSuccess: () => setDraft((p) => ({ ...p, sections: p.sections.filter((s) => s.id !== d[0].section_id) })),
                record: "undo",
              });
            },
          });
        },
      });
    },
    [perform, resumeId, supabase, draft.sections],
  );

  const reorderSections = useCallback(
    async (orderedIds: string[]) => {
      const prevOrder = [...draft.sections].sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id);
      const applyOrder = (ids: string[]) =>
        setDraft((p) => ({ ...p, sections: p.sections.map((s) => ({ ...s, sort_order: ids.indexOf(s.id) + 1 })) }));
      await perform({
        call: (rev) => sectionsApi.reorderSections(supabase, resumeId, rev, orderedIds),
        newRevision: (r) => r,
        onSuccess: () => applyOrder(orderedIds),
        inverse: () => async () => { await selfRef.current?.reorderSections(prevOrder); },
      });
    },
    [perform, resumeId, supabase, draft.sections],
  );

  // ── Entries ───────────────────────────────────────────────────────────────
  const removeEntry = useCallback(
    async (entryId: string) => {
      const entry = draft.entries.find((e) => e.id === entryId);
      if (!entry) return;
      const entryBullets = draft.bullets.filter((b) => b.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order);
      const sectionEntries = draft.entries.filter((e) => e.section_id === entry.section_id).sort((a, b) => a.sort_order - b.sort_order);
      const position = sectionEntries.findIndex((e) => e.id === entryId) + 1;
      const snapshot = {
        sectionId: entry.section_id, position,
        title: entry.title, subtitle: entry.subtitle, organization: entry.organization, location: entry.location,
        startDate: entry.start_date, endDate: entry.end_date, educationData: entry.education_data, skillsData: entry.skills_data,
        sourceBlockId: entry.source_block_id,
        bullets: entryBullets.map((b) => ({ content: b.content, source_bullet_id: b.source_bullet_id })),
      };
      await perform({
        call: (rev) => entriesApi.removeEntry(supabase, resumeId, rev, entryId),
        newRevision: (r) => r,
        onSuccess: () =>
          setDraft((p) => ({
            ...p,
            entries: p.entries.filter((e) => e.id !== entryId),
            bullets: p.bullets.filter((b) => b.entry_id !== entryId),
          })),
        inverse: () => async () => {
          await perform({
            call: (rev) => entriesApi.restoreEntry(supabase, resumeId, rev, snapshot),
            newRevision: (d) => d[0].revision,
            onSuccess: (d) => {
              const newEntry: ResumeEntry = { ...entry, id: d[0].entry_id };
              const newBullets: ResumeEntryBullet[] = entryBullets.map((b, i) => ({
                ...b, id: d[0].bullet_ids[i], entry_id: d[0].entry_id,
              }));
              setDraft((p) => ({ ...p, entries: [...p.entries, newEntry], bullets: [...p.bullets, ...newBullets] }));
            },
            record: "redo",
            inverse: (d) => async () => {
              await perform({
                call: (rev) => entriesApi.removeEntry(supabase, resumeId, rev, d[0].entry_id),
                newRevision: (r) => r,
                onSuccess: () =>
                  setDraft((p) => ({
                    ...p,
                    entries: p.entries.filter((e) => e.id !== d[0].entry_id),
                    bullets: p.bullets.filter((b) => b.entry_id !== d[0].entry_id),
                  })),
                record: "undo",
              });
            },
          });
        },
      });
    },
    [perform, resumeId, supabase, draft.entries, draft.bullets],
  );

  const copyBlock = useCallback(
    async (sectionId: string, blockId: string, bulletIds: string[]) => {
      await perform({
        call: (rev) => entriesApi.copyBlockIntoSection(supabase, resumeId, rev, sectionId, blockId, bulletIds),
        newRevision: (d) => d[0].revision,
        // The RPC mints new bullet ids we don't receive — re-fetch for real ids.
        onSuccess: () => void refetchDraft(),
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntry(supabase, resumeId, rev, d[0].entry_id),
            newRevision: (r) => r,
            onSuccess: () => void refetchDraft(),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase, refetchDraft],
  );

  const addCustomEntry = useCallback(
    async (sectionId: string) => {
      await perform({
        call: (rev) => entriesApi.addCustomEntry(supabase, resumeId, rev, sectionId, { title: "" }),
        newRevision: (d) => d[0].revision,
        onSuccess: (d) => {
          const now = new Date().toISOString();
          setDraft((p) => ({
            ...p,
            entries: [...p.entries, {
              id: d[0].entry_id, user_id: p.resume.user_id, resume_id: resumeId, section_id: sectionId,
              source_block_id: null, source_block_updated_at: null,
              title: "", subtitle: null, organization: null, location: null, start_date: null, end_date: null,
              education_data: null, skills_data: null,
              sort_order: p.entries.filter((e) => e.section_id === sectionId).length + 1,
              created_at: now, updated_at: now,
            }],
          }));
        },
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntry(supabase, resumeId, rev, d[0].entry_id),
            newRevision: (r) => r,
            onSuccess: () => setDraft((p) => ({ ...p, entries: p.entries.filter((e) => e.id !== d[0].entry_id) })),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase],
  );

  const entriesRef = useRef(draft.entries);
  useEffect(() => {
    entriesRef.current = draft.entries;
  }, [draft.entries]);
  const updateEntry = useCallback(
    (entryId: string, patch: Partial<EntryFields>) => {
      const prev = entriesRef.current.find((e) => e.id === entryId);
      patchEntryLocal(entryId, patch);
      scheduleDebounced(`entry:${entryId}`, () => {
          const e = entriesRef.current.find((x) => x.id === entryId);
          if (!e) return;
          const before = prev;
          void perform({
            call: (rev) =>
              entriesApi.updateEntry(supabase, resumeId, rev, entryId, {
                title: e.title, subtitle: e.subtitle, organization: e.organization, location: e.location,
                startDate: e.start_date, endDate: e.end_date,
                educationData: e.education_data ?? undefined, skillsData: e.skills_data ?? undefined,
              }),
            newRevision: (r) => r,
            onSuccess: () => {},
            inverse: before
              ? () => async () => {
                  patchEntryLocal(entryId, before);
                  await perform({
                    call: (rev) =>
                      entriesApi.updateEntry(supabase, resumeId, rev, entryId, {
                        title: before.title, subtitle: before.subtitle, organization: before.organization,
                        location: before.location, startDate: before.start_date, endDate: before.end_date,
                        educationData: before.education_data ?? undefined, skillsData: before.skills_data ?? undefined,
                      }),
                    newRevision: (r) => r,
                    onSuccess: () => {},
                    record: "redo",
                  });
                }
              : undefined,
          });
      });
    },
    [perform, resumeId, supabase, patchEntryLocal, scheduleDebounced],
  );

  const moveEntryToPosition = useCallback(
    async (entryId: string, targetSectionId: string, orderedIds: string[]) => {
      const entry = draft.entries.find((e) => e.id === entryId);
      if (!entry) return;
      const prevSection = entry.section_id;
      const prevOrder = draft.entries.filter((e) => e.section_id === prevSection).sort((a, b) => a.sort_order - b.sort_order).map((e) => e.id);
      await perform({
        call: (rev) => entriesApi.moveEntryToPosition(supabase, resumeId, rev, entryId, targetSectionId, orderedIds),
        newRevision: (d) => d[0].revision,
        onSuccess: () => {
          setDraft((p) => {
            const entries = p.entries.map((e) => {
              if (e.id === entryId) return { ...e, section_id: targetSectionId };
              return e;
            });
            // renumber target per orderedIds
            const renum = entries.map((e) =>
              e.section_id === targetSectionId ? { ...e, sort_order: orderedIds.indexOf(e.id) + 1 } : e,
            );
            return { ...p, entries: renum };
          });
        },
        inverse: () => async () => { await selfRef.current?.moveEntryToPosition(entryId, prevSection, prevOrder); },
      });
    },
    [perform, resumeId, supabase, draft.entries],
  );

  // ── Bullets ───────────────────────────────────────────────────────────────
  const addCustomBullet = useCallback(
    async (entryId: string) => {
      await perform({
        call: (rev) => entriesApi.addCustomBullet(supabase, resumeId, rev, entryId, "New bullet"),
        newRevision: (d) => d[0].revision,
        onSuccess: (d) => {
          setDraft((p) => ({
            ...p,
            bullets: [...p.bullets, {
              id: d[0].bullet_id, user_id: p.resume.user_id, resume_id: resumeId, entry_id: entryId,
              source_bullet_id: null, content: "New bullet",
              sort_order: p.bullets.filter((b) => b.entry_id === entryId).length + 1,
              created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            }],
          }));
        },
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntryBullet(supabase, resumeId, rev, d[0].bullet_id),
            newRevision: (r) => r,
            onSuccess: () => setDraft((p) => ({ ...p, bullets: p.bullets.filter((b) => b.id !== d[0].bullet_id) })),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase],
  );

  const addBulletFromLibrary = useCallback(
    async (entryId: string, libraryBulletId: string) => {
      const libBullet = library.bullets.find((b) => b.id === libraryBulletId);
      await perform({
        call: (rev) => entriesApi.addBulletFromLibrary(supabase, resumeId, rev, entryId, libraryBulletId),
        newRevision: (d) => d[0].revision,
        onSuccess: (d) => {
          const now = new Date().toISOString();
          setDraft((p) => ({
            ...p,
            bullets: [...p.bullets, {
              id: d[0].bullet_id, user_id: p.resume.user_id, resume_id: resumeId, entry_id: entryId,
              source_bullet_id: libraryBulletId, content: libBullet?.content ?? "",
              sort_order: p.bullets.filter((b) => b.entry_id === entryId).length + 1,
              created_at: now, updated_at: now,
            }],
          }));
        },
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntryBullet(supabase, resumeId, rev, d[0].bullet_id),
            newRevision: (r) => r,
            onSuccess: () => setDraft((p) => ({ ...p, bullets: p.bullets.filter((b) => b.id !== d[0].bullet_id) })),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase, library.bullets],
  );

  const bulletsRef = useRef(draft.bullets);
  useEffect(() => {
    bulletsRef.current = draft.bullets;
  }, [draft.bullets]);
  const updateBullet = useCallback(
    (bulletId: string, content: string) => {
      const before = bulletsRef.current.find((b) => b.id === bulletId)?.content ?? "";
      patchBulletLocal(bulletId, { content });
      scheduleDebounced(`bullet:${bulletId}`, () => {
          const b = bulletsRef.current.find((x) => x.id === bulletId);
          if (!b) return;
          void perform({
            call: (rev) => entriesApi.updateEntryBullet(supabase, resumeId, rev, bulletId, b.content),
            newRevision: (r) => r,
            onSuccess: () => {},
            inverse: () => async () => {
              patchBulletLocal(bulletId, { content: before });
              await perform({
                call: (rev) => entriesApi.updateEntryBullet(supabase, resumeId, rev, bulletId, before),
                newRevision: (r) => r,
                onSuccess: () => {},
                record: "redo",
              });
            },
          });
      });
    },
    [perform, resumeId, supabase, patchBulletLocal, scheduleDebounced],
  );

  const removeBullet = useCallback(
    async (bulletId: string) => {
      const bullet = draft.bullets.find((b) => b.id === bulletId);
      if (!bullet) return;
      const entryBullets = draft.bullets.filter((b) => b.entry_id === bullet.entry_id).sort((a, b) => a.sort_order - b.sort_order);
      const position = entryBullets.findIndex((b) => b.id === bulletId) + 1;
      await perform({
        call: (rev) => entriesApi.removeEntryBullet(supabase, resumeId, rev, bulletId),
        newRevision: (r) => r,
        onSuccess: () => setDraft((p) => ({ ...p, bullets: p.bullets.filter((b) => b.id !== bulletId) })),
        inverse: () => async () => {
          await perform({
            call: (rev) => entriesApi.restoreBullet(supabase, resumeId, rev, bullet.entry_id, position, bullet.content, bullet.source_bullet_id),
            newRevision: (d) => d[0].revision,
            onSuccess: (d) => setDraft((p) => ({ ...p, bullets: [...p.bullets, { ...bullet, id: d[0].bullet_id }] })),
            record: "redo",
            inverse: (d) => async () => {
              await perform({
                call: (rev) => entriesApi.removeEntryBullet(supabase, resumeId, rev, d[0].bullet_id),
                newRevision: (r) => r,
                onSuccess: () => setDraft((p) => ({ ...p, bullets: p.bullets.filter((b) => b.id !== d[0].bullet_id) })),
                record: "undo",
              });
            },
          });
        },
      });
    },
    [perform, resumeId, supabase, draft.bullets],
  );

  const reorderBullets = useCallback(
    async (entryId: string, orderedIds: string[]) => {
      const prevOrder = draft.bullets.filter((b) => b.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order).map((b) => b.id);
      const applyOrder = (ids: string[]) =>
        setDraft((p) => ({
          ...p,
          bullets: p.bullets.map((b) => (b.entry_id === entryId ? { ...b, sort_order: ids.indexOf(b.id) + 1 } : b)),
        }));
      await perform({
        call: (rev) => entriesApi.reorderEntryBullets(supabase, resumeId, rev, entryId, orderedIds),
        newRevision: (r) => r,
        onSuccess: () => applyOrder(orderedIds),
        inverse: () => async () => { await selfRef.current?.reorderBullets(entryId, prevOrder); },
      });
    },
    [perform, resumeId, supabase, draft.bullets],
  );

  const saveBulletToLibrary = useCallback(
    async (bulletId: string, blockId: string): Promise<string | null> => {
      const data = await perform({
        call: (rev) => entriesApi.saveBulletAsLibraryBullet(supabase, resumeId, rev, bulletId, blockId),
        newRevision: (d) => d[0].revision,
        onSuccess: (d) => {
          patchBulletLocal(bulletId, { source_bullet_id: d[0].library_bullet_id });
          router.refresh(); // refresh library data (a prop) so the new bullet appears
        },
      });
      return data ? data[0].library_bullet_id : null;
    },
    [perform, resumeId, supabase, patchBulletLocal, router],
  );

  const applyLibraryUpdate = useCallback(
    async (entryId: string, sel: entriesApi.ApplyLibraryUpdateSelection): Promise<boolean> => {
      const data = await perform({
        call: (rev) => entriesApi.applyLibraryUpdate(supabase, resumeId, rev, entryId, sel),
        newRevision: (d) => d[0].revision,
        // Adds/updates/removes multiple bullets with new ids — re-fetch for truth.
        onSuccess: () => void refetchDraft(),
      });
      return data !== null;
    },
    [perform, resumeId, supabase, refetchDraft],
  );

  // ── Style + target length ─────────────────────────────────────────────────
  const style = useMemo(() => normalizeStyleSettings(draft.resume.style_settings), [draft.resume.style_settings]);
  const styleRef = useRef(style);
  useEffect(() => {
    styleRef.current = style;
  }, [style]);

  const setStyle = useCallback(
    (patch: Partial<StyleSettings>) => {
      const before = styleRef.current;
      const next = normalizeStyleSettings({ ...before, ...patch });
      setDraft((p) => ({ ...p, resume: { ...p.resume, style_settings: next } }));
      void perform({
        call: (rev) => resumesApi.updateResumeStyle(supabase, resumeId, rev, next),
        newRevision: (r) => r,
        onSuccess: () => {},
        inverse: () => async () => {
          setDraft((p) => ({ ...p, resume: { ...p.resume, style_settings: before } }));
          await perform({
            call: (rev) => resumesApi.updateResumeStyle(supabase, resumeId, rev, before),
            newRevision: (r) => r,
            onSuccess: () => {},
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase],
  );

  const setTargetLength = useCallback(
    async (t: TargetLength) => {
      const before = draft.resume.target_length;
      setDraft((p) => ({ ...p, resume: { ...p.resume, target_length: t } }));
      await perform({
        call: (rev) => resumesApi.updateResumeTargetLength(supabase, resumeId, rev, t),
        newRevision: (r) => r,
        onSuccess: () => {},
        inverse: () => async () => {
          setDraft((p) => ({ ...p, resume: { ...p.resume, target_length: before } }));
          await perform({
            call: (rev) => resumesApi.updateResumeTargetLength(supabase, resumeId, rev, before),
            newRevision: (r) => r,
            onSuccess: () => {},
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase, draft.resume.target_length],
  );

  // ── Resume metadata ───────────────────────────────────────────────────────
  const updateMetadata = useCallback(
    async (input: { name: string; targetCompany: string | null; targetRole: string | null }) => {
      const before = {
        name: draft.resume.name,
        targetCompany: draft.resume.target_company,
        targetRole: draft.resume.target_role,
      };
      const result = await perform({
        call: (rev) => resumesApi.updateResumeMetadata(supabase, resumeId, rev, input),
        newRevision: (r) => r,
        onSuccess: () =>
          setDraft((p) => ({
            ...p,
            resume: {
              ...p.resume,
              name: input.name,
              target_company: input.targetCompany,
              target_role: input.targetRole,
            },
          })),
        inverse: () => async () => { await selfRef.current?.updateMetadata(before); },
      });
      return result !== null;
    },
    [perform, resumeId, supabase, draft.resume.name, draft.resume.target_company, draft.resume.target_role],
  );

  // ── Step 3: flush, versions, restore ──────────────────────────────────────
  const flushPendingSaves = useCallback(async (): Promise<boolean> => {
    // Fire every pending debounce right now…
    for (const [, entry] of [...debounceTimers.current]) {
      clearTimeout(entry.timer);
      entry.run();
    }
    // …then wait for the serial write queue to drain past them. Enqueuing a
    // no-op is enough: the queue runs strictly in order.
    await enqueue(async () => undefined);
    return !conflictRef.current && debounceTimers.current.size === 0;
  }, [enqueue]);

  const currentRevision = useCallback(() => revisionRef.current, []);

  const versionInFlight = useRef(false);
  const createVersion = useCallback(
    async (versionType: VersionType) => {
      // A second click while the first request is open would mint a duplicate
      // version, and versions cannot be deleted.
      if (versionInFlight.current) {
        return { ok: false as const, message: "A version is already being created.", conflict: false };
      }
      versionInFlight.current = true;
      try {
        const result = await enqueue(() =>
          versionsApi.createResumeVersion(supabase, resumeId, revisionRef.current, versionType),
        );
        if (result.ok) {
          const row = result.data[0];
          // create_resume_version deliberately does not bump the draft
          // revision — a checkpoint is a photograph, not an edit.
          return { ok: true as const, versionId: row.version_id, versionNumber: row.version_number };
        }
        if (result.reason === "revision_conflict") {
          conflictRef.current = true;
          setConflict(true);
          return { ok: false as const, message: describeRpcError(result.reason), conflict: true };
        }
        return { ok: false as const, message: describeRpcError(result.reason), conflict: false };
      } finally {
        versionInFlight.current = false;
      }
    },
    [enqueue, resumeId, supabase],
  );

  const restoreInFlight = useRef(false);
  const restoreFromVersion = useCallback(
    async (versionId: string) => {
      if (restoreInFlight.current) {
        return { ok: false as const, message: "A restore is already running." };
      }
      restoreInFlight.current = true;
      try {
        setSaveStatus("saving");
        const result = await enqueue(() =>
          versionsApi.restoreResumeFromVersion(supabase, resumeId, revisionRef.current, versionId),
        );
        if (!result.ok) {
          if (result.reason === "revision_conflict") {
            conflictRef.current = true;
            setConflict(true);
          }
          setSaveStatus("failed");
          setLastError(describeRpcError(result.reason));
          return { ok: false as const, message: describeRpcError(result.reason) };
        }
        // The restore replaced every section/entry/bullet with new rows, so
        // local ids are all stale — re-read rather than trying to patch.
        // Forced: a restore is an intentional, atomic full replace, so it must
        // win even over a field with a (stale, pre-restore) pending debounce.
        revisionRef.current = result.data;
        await refetchDraft({ force: true });
        undoStack.current = [];
        redoStack.current = [];
        syncStackDepth();
        setSaveStatus("saved");
        setLastError(null);
        broadcast(result.data);
        return { ok: true as const };
      } finally {
        restoreInFlight.current = false;
      }
    },
    [enqueue, resumeId, supabase, refetchDraft, syncStackDepth, broadcast],
  );

  // ── Undo / redo ───────────────────────────────────────────────────────────
  const undo = useCallback(async () => {
    if (conflict) return;
    const thunk = undoStack.current.pop();
    syncStackDepth();
    if (thunk) await thunk();
  }, [conflict, syncStackDepth]);
  const redo = useCallback(async () => {
    if (conflict) return;
    const thunk = redoStack.current.pop();
    syncStackDepth();
    if (thunk) await thunk();
  }, [conflict, syncStackDepth]);

  const reconcile = useCallback(() => {
    router.refresh();
    setConflict(false);
    window.location.reload();
  }, [router]);

  const retryLast = useCallback(() => {
    const t = lastFailedRef.current;
    if (t) t();
  }, []);

  const hasUnsavedChanges = pendingCount > 0;
  // "Unsaved changes" must win over a stale "Saved": a debounce scheduled
  // after the last successful write means the screen is ahead of the server.
  const effectiveStatus: SaveStatus =
    hasUnsavedChanges && saveStatus !== "saving" && saveStatus !== "failed" && saveStatus !== "offline"
      ? "unsaved"
      : saveStatus;

  const controller: EditorController = {
    draft, library, style, saveStatus: effectiveStatus, conflict,
    canUndo: undoDepth > 0, canRedo: redoDepth > 0,
    updateHeader, addSection, renameSection, deleteSection, reorderSections,
    copyBlock, addCustomEntry, updateEntry, removeEntry, moveEntryToPosition,
    addCustomBullet, addBulletFromLibrary, updateBullet, removeBullet, reorderBullets,
    saveBulletToLibrary, applyLibraryUpdate,
    updateMetadata, setStyle, setTargetLength, undo, redo, reconcile, retryLast, lastError,
    hasUnsavedChanges, flushPendingSaves, currentRevision, createVersion, restoreFromVersion,
  };

  useEffect(() => {
    selfRef.current = controller;
  });

  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}
