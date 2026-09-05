"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  addLibraryBullet,
  deleteLibraryBlock,
  deleteLibraryBullet,
  reorderLibraryBullets,
  updateLibraryBullet,
} from "@/lib/resume/library";
import type { LayoutKind, LibraryBlock, LibraryBullet } from "@/lib/resume/types";
import type { Resume, ResumeSection } from "@/lib/resume/types";
import { createSection } from "@/lib/resume/sections";
import { copyBlockIntoSection } from "@/lib/resume/entries";
import { AddResumeBlockModal } from "./AddResumeBlockModal";
import { EditResumeBlockModal } from "./EditResumeBlockModal";

const LAYOUT_KIND_LABELS: Record<LayoutKind, string> = {
  entry: "Entry",
  education: "Education",
  skills: "Skills",
};

const FILTER_OPTIONS: { value: LayoutKind | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "entry", label: "Entry" },
  { value: "education", label: "Education" },
  { value: "skills", label: "Skills" },
];

export function ResumeBlocksPanel({
  blocks,
  bullets,
  resumes,
  sections,
  userId,
}: {
  blocks: LibraryBlock[];
  bullets: LibraryBullet[];
  resumes: Resume[];
  sections: ResumeSection[];
  userId: string;
}) {
  const [layoutFilter, setLayoutFilter] = useState<LayoutKind | "all">("all");
  const [search, setSearch] = useState("");

  const bulletsByBlock = useMemo(() => {
    const map = new Map<string, LibraryBullet[]>();
    for (const bullet of bullets) {
      const list = map.get(bullet.block_id) ?? [];
      list.push(bullet);
      map.set(bullet.block_id, list);
    }
    return map;
  }, [bullets]);

  const filteredBlocks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return blocks.filter((block) => {
      if (layoutFilter !== "all" && block.layout_kind !== layoutFilter) return false;
      if (!term) return true;
      return (
        block.name.toLowerCase().includes(term) ||
        (block.title ?? "").toLowerCase().includes(term) ||
        (block.organization ?? "").toLowerCase().includes(term)
      );
    });
  }, [blocks, layoutFilter, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={layoutFilter} onValueChange={(v) => setLayoutFilter(v as LayoutKind | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search blocks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        </div>
        <AddResumeBlockModal userId={userId} />
      </div>

      {filteredBlocks.length === 0 ? (
        <Card className="items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {blocks.length === 0
              ? "No blocks yet. Add your first experience, education, or skills block."
              : "No blocks match this filter."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredBlocks.map((block) => (
            <LibraryBlockCard key={block.id} block={block} bullets={bulletsByBlock.get(block.id) ?? []} resumes={resumes} sections={sections} />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryBlockCard({ block, bullets, resumes, sections }: { block: LibraryBlock; bullets: LibraryBullet[]; resumes: Resume[]; sections: ResumeSection[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteBlock() {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      await deleteLibraryBlock(supabase, block.id);
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const subtitleParts = [block.title, block.organization].filter(Boolean);

  return (
    <>
      <Card className="gap-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{LAYOUT_KIND_LABELS[block.layout_kind]}</Badge>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{block.name}</p>
            </div>
            {subtitleParts.length > 0 && (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{subtitleParts.join(" · ")}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              title="Add to resume"
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
            >
              <FilePlus2 className="h-3.5 w-3.5" /> Add to resume
            </button>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Hide bullets" : "Show bullets"}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              {bullets.length} {bullets.length === 1 ? "bullet" : "bullets"}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              title="Edit"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              title="Delete"
              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {expanded && <BulletsEditor blockId={block.id} bullets={bullets} />}
      </Card>

      <EditResumeBlockModal block={block} open={editOpen} onOpenChange={setEditOpen} />
      <AddBlockToResumeDialog block={block} bullets={bullets} resumes={resumes} sections={sections} open={addOpen} onOpenChange={setAddOpen} />

      <Dialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!next) setError(null);
          setDeleteOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-medium">Delete block?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This removes <span className="font-medium text-gray-900 dark:text-gray-100">{block.name}</span>{" "}
            and its bullets from your library. Resumes that already copied content from it keep their own
            copy — nothing on an existing resume changes.
          </p>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteBlock} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddBlockToResumeDialog({ block, bullets, resumes, sections, open, onOpenChange }: {
  block: LibraryBlock;
  bullets: LibraryBullet[];
  resumes: Resume[];
  sections: ResumeSection[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [sectionId, setSectionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resume = resumes.find((item) => item.id === resumeId);
  const compatible = sections.filter((section) => section.resume_id === resumeId && section.layout_kind === block.layout_kind);

  async function handleAdd() {
    if (!resume) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    let revision = resume.revision;
    let targetSectionId = sectionId;
    if (!targetSectionId) {
      const created = await createSection(supabase, resume.id, revision, {
        title: block.default_section_title || LAYOUT_KIND_LABELS[block.layout_kind],
        layoutKind: block.layout_kind,
      });
      if (!created.ok) {
        setError(created.message);
        setBusy(false);
        return;
      }
      targetSectionId = created.data[0].section_id;
      revision = created.data[0].revision;
    }
    const copied = await copyBlockIntoSection(supabase, resume.id, revision, targetSectionId, block.id, bullets.map((bullet) => bullet.id));
    setBusy(false);
    if (!copied.ok) {
      setError(copied.message);
      return;
    }
    onOpenChange(false);
    router.push(`/resumes/${resume.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add “{block.name}” to a resume</DialogTitle>
          <DialogDescription>Choose a resume and a compatible section. If needed, a section is created automatically.</DialogDescription>
        </DialogHeader>
        {resumes.length === 0 ? (
          <p className="text-sm text-gray-500">Create a resume first, then add this block.</p>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Resume</span>
              <select value={resumeId} onChange={(event) => { setResumeId(event.target.value); setSectionId(""); }} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 dark:border-gray-700 dark:bg-gray-900">
                {resumes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Section</span>
              <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="h-9 rounded-md border border-gray-200 bg-transparent px-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="">Create “{block.default_section_title || LAYOUT_KIND_LABELS[block.layout_kind]}”</option>
                {compatible.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
              </select>
            </label>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => void handleAdd()} disabled={busy}>{busy ? "Adding…" : "Add and open resume"}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BulletsEditor({ blockId, bullets }: { blockId: string; bullets: LibraryBullet[] }) {
  const router = useRouter();
  const [newContent, setNewContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    await withBusy(async () => {
      const supabase = getSupabaseBrowserClient();
      await addLibraryBullet(supabase, (await supabase.auth.getUser()).data.user!.id, blockId, newContent);
      setNewContent("");
    });
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= bullets.length) return;
    const reordered = [...bullets];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    await withBusy(async () => {
      const supabase = getSupabaseBrowserClient();
      await reorderLibraryBullets(supabase, blockId, reordered.map((b) => b.id));
    });
  }

  async function handleDelete(bulletId: string) {
    await withBusy(async () => {
      const supabase = getSupabaseBrowserClient();
      await deleteLibraryBullet(supabase, bulletId);
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
      {bullets.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">No bullets yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {bullets.map((bullet, index) => (
            <BulletRow
              key={bullet.id}
              bullet={bullet}
              onMoveUp={index > 0 ? () => handleMove(index, -1) : undefined}
              onMoveDown={index < bullets.length - 1 ? () => handleMove(index, 1) : undefined}
              onDelete={() => handleDelete(bullet.id)}
              busy={busy}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-start gap-2 pt-1">
        <Textarea
          placeholder="Add a reusable bullet…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={busy || !newContent.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function BulletRow({
  bullet,
  onMoveUp,
  onMoveDown,
  onDelete,
  busy,
}: {
  bullet: LibraryBullet;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(bullet.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      await updateLibraryBullet(supabase, bullet.id, content);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="flex flex-col gap-1.5 rounded-md bg-gray-50 p-2 dark:bg-gray-900">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setContent(bullet.content);
              setEditing(false);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-2 rounded-md px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-900">
      <span className="text-sm text-gray-700 dark:text-gray-300">{bullet.content}</span>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!onMoveUp || busy}
          title="Move up"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!onMoveDown || busy}
          title="Move down"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Edit"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title="Delete"
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
