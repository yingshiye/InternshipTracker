"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditor } from "./useEditorController";

/**
 * Saves the selected resume bullet as a NEW library bullet and re-links it.
 * The destination is always an explicit choice — either an existing owned
 * block, or a brand-new one created on the spot — we never silently create
 * a new library block.
 */
export function SaveAsLibraryBulletDialog({ bulletId, open, onOpenChange }: { bulletId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { library, draft, saveBulletToLibrary, createLibraryBlockAndSaveBullet } = useEditor();
  const bullet = draft.bullets.find((b) => b.id === bulletId);
  const entry = bullet ? draft.entries.find((e) => e.id === bullet.entry_id) : undefined;
  const section = entry ? draft.sections.find((s) => s.id === entry.section_id) : undefined;
  const layoutKind = section?.layout_kind ?? "entry";

  const [mode, setMode] = useState<"existing" | "new">(library.blocks.length > 0 ? "existing" : "new");
  // Prefer the entry's own source block, else any block.
  const [blockId, setBlockId] = useState<string>(entry?.source_block_id ?? library.blocks[0]?.id ?? "");
  const [newBlockName, setNewBlockName] = useState<string>(
    [entry?.title, entry?.organization].filter(Boolean).join(" — ") || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    let id: string | null = null;
    if (mode === "new") {
      if (!newBlockName.trim()) {
        setBusy(false);
        setError("Give the new block a name.");
        return;
      }
      id = await createLibraryBlockAndSaveBullet(bulletId, {
        name: newBlockName,
        defaultSectionTitle: section?.title ?? newBlockName,
        layoutKind,
        title: entry?.title ?? null,
        organization: entry?.organization ?? null,
        location: entry?.location ?? null,
        startDate: entry?.start_date ?? null,
        endDate: entry?.end_date ?? null,
        educationData: entry?.education_data ?? null,
      });
    } else if (blockId) {
      id = await saveBulletToLibrary(bulletId, blockId);
    }
    setBusy(false);
    if (id) onOpenChange(false);
    else setError("Couldn't save to the library. Try again.");
  };

  const canSave = mode === "new" ? newBlockName.trim().length > 0 : Boolean(blockId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Save as library bullet</DialogTitle>
          <DialogDescription>Add this bullet’s current text to a library block so you can reuse it. This bullet will be linked to the new library bullet.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="rounded bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">{bullet?.content}</p>

          {library.blocks.length > 0 && (
            <div className="flex gap-1 rounded-md bg-gray-100 p-0.5 text-sm dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`flex-1 rounded px-2 py-1 ${mode === "existing" ? "bg-white shadow-sm dark:bg-gray-900" : "text-gray-500"}`}
              >
                Existing block
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 rounded px-2 py-1 ${mode === "new" ? "bg-white shadow-sm dark:bg-gray-900" : "text-gray-500"}`}
              >
                New block
              </button>
            </div>
          )}

          {mode === "existing" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Destination block</span>
              <select value={blockId} onChange={(e) => setBlockId(e.target.value)} className="rounded border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                {library.blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.title ? ` — ${b.title}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-block-name">New block name</Label>
              <Input
                id="new-block-name"
                placeholder="Google SWE — Summer 2025"
                value={newBlockName}
                onChange={(e) => setNewBlockName(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Creates a new library block from this entry’s details, then saves this bullet into it.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save to library"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
