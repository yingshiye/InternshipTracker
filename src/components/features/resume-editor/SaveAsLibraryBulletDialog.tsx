"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEditor } from "./useEditorController";

/**
 * Saves the selected resume bullet as a NEW library bullet and re-links it.
 * Requires choosing an owned destination block — we never silently create a
 * new library block.
 */
export function SaveAsLibraryBulletDialog({ bulletId, open, onOpenChange }: { bulletId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { library, draft, saveBulletToLibrary } = useEditor();
  const bullet = draft.bullets.find((b) => b.id === bulletId);
  const entry = bullet ? draft.entries.find((e) => e.id === bullet.entry_id) : undefined;
  // Prefer the entry's own source block, else any block.
  const [blockId, setBlockId] = useState<string>(entry?.source_block_id ?? library.blocks[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!blockId) return;
    setBusy(true);
    setError(null);
    const id = await saveBulletToLibrary(bulletId, blockId);
    setBusy(false);
    if (id) onOpenChange(false);
    else setError("Couldn't save to the library. Try again.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Save as library bullet</DialogTitle>
          <DialogDescription>Add this bullet’s current text to a library block so you can reuse it. This bullet will be linked to the new library bullet.</DialogDescription>
        </DialogHeader>
        {library.blocks.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">Create a library block first in Resume blocks.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="rounded bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">{bullet?.content}</p>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!blockId || busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save to library"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
