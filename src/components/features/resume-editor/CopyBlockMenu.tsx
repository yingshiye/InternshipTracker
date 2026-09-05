"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createLibraryBlock, libraryBlockFormToInput } from "@/lib/resume/library";
import { EMPTY_LIBRARY_BLOCK_FORM, LibraryBlockForm, type LibraryBlockFormValues } from "../LibraryBlockForm";
import { EditResumeBlockModal } from "../EditResumeBlockModal";
import { useEditor } from "./useEditorController";
import type { ResumeSection } from "@/lib/resume/types";

type View = { kind: "browse" } | { kind: "create" };

export function CopyBlockMenu({ section, onClose }: { section: ResumeSection; onClose: () => void }) {
  const { draft, library, copyBlock } = useEditor();
  const router = useRouter();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBullets, setSelectedBullets] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>({ kind: "browse" });
  const [createForm, setCreateForm] = useState<LibraryBlockFormValues>({
    ...EMPTY_LIBRARY_BLOCK_FORM,
    layoutKind: section.layout_kind,
    defaultSectionTitle: section.title,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const compatibleBlocks = useMemo(
    () => library.blocks.filter((b) => b.layout_kind === section.layout_kind),
    [library.blocks, section.layout_kind],
  );
  const blockBullets = useMemo(
    () => (selectedBlockId ? library.bullets.filter((b) => b.block_id === selectedBlockId).sort((a, b) => a.sort_order - b.sort_order) : []),
    [library.bullets, selectedBlockId],
  );
  const editingBlock = editingBlockId ? library.blocks.find((b) => b.id === editingBlockId) ?? null : null;

  const selectBlock = (id: string) => {
    setSelectedBlockId(id);
    setSelectedBullets(new Set(library.bullets.filter((b) => b.block_id === id).map((b) => b.id)));
  };

  const handleCopy = () => {
    if (!selectedBlockId) return;
    void copyBlock(section.id, selectedBlockId, [...selectedBullets]);
    onClose();
  };

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const block = await createLibraryBlock(supabase, draft.resume.user_id, libraryBlockFormToInput(createForm));
      router.refresh();
      setView({ kind: "browse" });
      selectBlock(block.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            {view.kind === "create" ? "New library block" : "Add from library"}
          </DialogTitle>
          <DialogDescription>
            {view.kind === "create"
              ? `Create a reusable ${section.layout_kind} block, then add it straight into “${section.title}”.`
              : `Copy a ${section.layout_kind} block from your library into “${section.title}”. You can edit the copy without changing the library.`}
          </DialogDescription>
        </DialogHeader>

        {view.kind === "create" ? (
          <LibraryBlockForm
            idPrefix="copy-menu-new-block"
            values={createForm}
            onChange={setCreateForm}
            lockLayoutKind
            onCancel={() => setView({ kind: "browse" })}
            onSubmit={() => void handleCreate()}
            loading={creating}
            error={createError}
            submitLabel="Create & select"
            submittingLabel="Creating…"
          />
        ) : (
          <>
            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
              <div className="flex flex-col gap-1">
                {compatibleBlocks.length === 0 && (
                  <p className="py-2 text-sm text-gray-500">No {section.layout_kind} blocks in your library yet.</p>
                )}
                {compatibleBlocks.map((b) => (
                  <div
                    key={b.id}
                    className={`flex items-center gap-1 rounded-md border pl-3 pr-1 ${selectedBlockId === b.id ? "border-gray-900 dark:border-gray-100" : "border-gray-200 dark:border-gray-700"}`}
                  >
                    <button type="button" onClick={() => selectBlock(b.id)} className="flex-1 py-2 text-left text-sm">
                      <span className="font-medium">{b.name}</span>
                      {b.title && <span className="text-gray-500"> — {b.title}</span>}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Edit ${b.name}`}
                      onClick={() => setEditingBlockId(b.id)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1 w-fit gap-1.5"
                  onClick={() => {
                    setCreateForm({ ...EMPTY_LIBRARY_BLOCK_FORM, layoutKind: section.layout_kind, defaultSectionTitle: section.title });
                    setView({ kind: "create" });
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> New block
                </Button>
              </div>
              {selectedBlockId && blockBullets.length > 0 && (
                <div className="rounded-md border border-gray-100 p-2 dark:border-gray-800">
                  <p className="mb-1 text-xs font-medium text-gray-500">Bullets to include</p>
                  {blockBullets.map((lb) => (
                    <label key={lb.id} className="flex items-start gap-2 py-0.5 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedBullets.has(lb.id)}
                        onChange={(e) => {
                          setSelectedBullets((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(lb.id);
                            else next.delete(lb.id);
                            return next;
                          });
                        }}
                        className="mt-1"
                      />
                      <span>{lb.content}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!selectedBlockId} onClick={handleCopy}>
                Add to section
              </Button>
            </div>
          </>
        )}
      </DialogContent>
      {editingBlock && (
        <EditResumeBlockModal
          block={editingBlock}
          open
          onOpenChange={(o) => !o && setEditingBlockId(null)}
        />
      )}
    </Dialog>
  );
}
