"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RpcResult } from "@/lib/resume/rpc";
import type { StyleSettings, TargetLength, LayoutKind } from "@/lib/resume/types";
import * as sectionsApi from "@/lib/resume/sections";
import * as entriesApi from "@/lib/resume/entries";
import * as resumesApi from "@/lib/resume/resumes";
import { normalizeStyleSettings } from "@/lib/resume/style";
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
  // style
  setStyle: (patch: Partial<StyleSettings>) => void;
  setTargetLength: (t: TargetLength) => Promise<void>;
  // undo/redo + conflict
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  reconcile: () => void;
  retryLast: () => void;
  lastError: string | null;
};

export type HeaderFields = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
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

  const revisionRef = useRef(initialDraft.resume.revision);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const undoStack = useRef<UndoThunk[]>([]);
  const redoStack = useRef<UndoThunk[]>([]);
  const lastFailedRef = useRef<(() => void) | null>(null);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const resumeId = initialDraft.resume.id;

  const syncStackDepth = useCallback(() => {
    setUndoDepth(undoStack.current.length);
    setRedoDepth(redoStack.current.length);
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
          setConflict(true);
          setSaveStatus("failed");
          setLastError("This resume changed elsewhere. Reload to continue.");
          return null;
        }
        setSaveStatus("failed");
        setLastError(result.message || "Save failed.");
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

  // Latest-state refs so debounced timer callbacks read current values.
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
      setDraft((d) => (d.header ? { ...d, header: { ...d.header, ...patch } } : d));
      const key = "header";
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
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
        }, 700),
      );
    },
    [perform, resumeId, supabase],
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
        onSuccess: () => router.refresh(),
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntry(supabase, resumeId, rev, d[0].entry_id),
            newRevision: (r) => r,
            onSuccess: () => router.refresh(),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase, router],
  );

  const addCustomEntry = useCallback(
    async (sectionId: string) => {
      await perform({
        call: (rev) => entriesApi.addCustomEntry(supabase, resumeId, rev, sectionId, { title: "" }),
        newRevision: (d) => d[0].revision,
        onSuccess: () => router.refresh(),
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntry(supabase, resumeId, rev, d[0].entry_id),
            newRevision: (r) => r,
            onSuccess: () => router.refresh(),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase, router],
  );

  const entriesRef = useRef(draft.entries);
  useEffect(() => {
    entriesRef.current = draft.entries;
  }, [draft.entries]);
  const updateEntry = useCallback(
    (entryId: string, patch: Partial<EntryFields>) => {
      const prev = entriesRef.current.find((e) => e.id === entryId);
      patchEntryLocal(entryId, patch);
      const key = `entry:${entryId}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
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
        }, 700),
      );
    },
    [perform, resumeId, supabase, patchEntryLocal],
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
      await perform({
        call: (rev) => entriesApi.addBulletFromLibrary(supabase, resumeId, rev, entryId, libraryBulletId),
        newRevision: (d) => d[0].revision,
        onSuccess: () => router.refresh(),
        inverse: (d) => async () => {
          await perform({
            call: (rev) => entriesApi.removeEntryBullet(supabase, resumeId, rev, d[0].bullet_id),
            newRevision: (r) => r,
            onSuccess: () => router.refresh(),
            record: "redo",
          });
        },
      });
    },
    [perform, resumeId, supabase, router],
  );

  const bulletsRef = useRef(draft.bullets);
  useEffect(() => {
    bulletsRef.current = draft.bullets;
  }, [draft.bullets]);
  const updateBullet = useCallback(
    (bulletId: string, content: string) => {
      const before = bulletsRef.current.find((b) => b.id === bulletId)?.content ?? "";
      patchBulletLocal(bulletId, { content });
      const key = `bullet:${bulletId}`;
      const existing = debounceTimers.current.get(key);
      if (existing) clearTimeout(existing);
      debounceTimers.current.set(
        key,
        setTimeout(() => {
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
        }, 700),
      );
    },
    [perform, resumeId, supabase, patchBulletLocal],
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
          router.refresh();
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
        onSuccess: () => router.refresh(),
      });
      return data !== null;
    },
    [perform, resumeId, supabase, router],
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

  const controller: EditorController = {
    draft, library, style, saveStatus, conflict,
    canUndo: undoDepth > 0, canRedo: redoDepth > 0,
    updateHeader, addSection, renameSection, deleteSection, reorderSections,
    copyBlock, addCustomEntry, updateEntry, removeEntry, moveEntryToPosition,
    addCustomBullet, addBulletFromLibrary, updateBullet, removeBullet, reorderBullets,
    saveBulletToLibrary, applyLibraryUpdate,
    setStyle, setTargetLength, undo, redo, reconcile, retryLast, lastError,
  };

  useEffect(() => {
    selfRef.current = controller;
  });

  return <Ctx.Provider value={controller}>{children}</Ctx.Provider>;
}
