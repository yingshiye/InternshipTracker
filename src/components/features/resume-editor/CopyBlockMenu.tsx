"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEditor } from "./useEditorController";
import type { ResumeSection } from "@/lib/resume/types";

export function CopyBlockMenu({ section, onClose }: { section: ResumeSection; onClose: () => void }) {
  const { library, copyBlock } = useEditor();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedBullets, setSelectedBullets] = useState<Set<string>>(new Set());

  const compatibleBlocks = useMemo(
    () => library.blocks.filter((b) => b.layout_kind === section.layout_kind),
    [library.blocks, section.layout_kind],
  );
  const blockBullets = useMemo(
    () => (selectedBlockId ? library.bullets.filter((b) => b.block_id === selectedBlockId).sort((a, b) => a.sort_order - b.sort_order) : []),
    [library.bullets, selectedBlockId],
  );

  const selectBlock = (id: string) => {
    setSelectedBlockId(id);
    setSelectedBullets(new Set(library.bullets.filter((b) => b.block_id === id).map((b) => b.id)));
  };

  const handleCopy = () => {
    if (!selectedBlockId) return;
    void copyBlock(section.id, selectedBlockId, [...selectedBullets]);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Add from library</DialogTitle>
          <DialogDescription>Copy a {section.layout_kind} block from your library into “{section.title}”. You can edit the copy without changing the library.</DialogDescription>
        </DialogHeader>
        {compatibleBlocks.length === 0 ? (
          <p className="py-4 text-sm text-gray-500">No {section.layout_kind} blocks in your library yet.</p>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            <div className="flex flex-col gap-1">
              {compatibleBlocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => selectBlock(b.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm ${selectedBlockId === b.id ? "border-gray-900 dark:border-gray-100" : "border-gray-200 dark:border-gray-700"}`}
                >
                  <span className="font-medium">{b.name}</span>
                  {b.title && <span className="text-gray-500"> — {b.title}</span>}
                </button>
              ))}
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
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selectedBlockId} onClick={handleCopy}>
            Add to section
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
