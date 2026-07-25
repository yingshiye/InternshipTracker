"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, BookmarkPlus, Library } from "lucide-react";
import { useEditor } from "./useEditorController";
import { SortableItem } from "./dnd/SortableItem";
import { SortableList } from "./dnd/SortableList";
import { SaveAsLibraryBulletDialog } from "./SaveAsLibraryBulletDialog";
import type { ResumeEntryBullet } from "@/lib/resume/types";

export function BulletList({ entryId, hasSourceBlock }: { entryId: string; hasSourceBlock: boolean }) {
  const { draft, library, addCustomBullet, addBulletFromLibrary, reorderBullets } = useEditor();

  const bullets = useMemo(
    () => draft.bullets.filter((b) => b.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order),
    [draft.bullets, entryId],
  );
  const ids = bullets.map((b) => b.id);
  const entry = draft.entries.find((e) => e.id === entryId);

  // Library bullets from this entry's source block that aren't already present.
  const availableLibraryBullets = useMemo(() => {
    if (!entry?.source_block_id) return [];
    const usedSources = new Set(bullets.map((b) => b.source_bullet_id).filter(Boolean));
    return library.bullets.filter((lb) => lb.block_id === entry.source_block_id && !usedSources.has(lb.id));
  }, [entry, library.bullets, bullets]);

  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  return (
    <div style={{ marginTop: 2 }}>
      <ul style={{ listStyle: "disc", paddingLeft: "1.2em", margin: 0 }}>
        <SortableList ids={ids} onReorder={(next) => void reorderBullets(entryId, next)}>
          {bullets.map((bullet, i) => (
            <BulletRow key={bullet.id} bullet={bullet} index={i} total={bullets.length} entryId={entryId} />
          ))}
        </SortableList>
      </ul>

      <div className="mt-1 flex items-center gap-2 print:hidden">
        <button type="button" onClick={() => void addCustomBullet(entryId)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <Plus className="h-3 w-3" /> Add bullet
        </button>
        {hasSourceBlock && availableLibraryBullets.length > 0 && (
          <div className="relative">
            <button type="button" onClick={() => setLibraryPickerOpen((o) => !o)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <Library className="h-3 w-3" /> From library
            </button>
            {libraryPickerOpen && (
              <div className="absolute left-0 top-6 z-20 w-72 rounded-md border border-gray-200 bg-white p-1 shadow-md dark:border-gray-700 dark:bg-gray-900">
                {availableLibraryBullets.map((lb) => (
                  <button
                    key={lb.id}
                    type="button"
                    className="block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => {
                      void addBulletFromLibrary(entryId, lb.id);
                      setLibraryPickerOpen(false);
                    }}
                  >
                    {lb.content}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BulletRow({ bullet, index, total, entryId }: { bullet: ResumeEntryBullet; index: number; total: number; entryId: string }) {
  const { library, updateBullet, removeBullet, reorderBullets, draft } = useEditor();
  const [saveOpen, setSaveOpen] = useState(false);

  const move = (dir: -1 | 1) => {
    const ids = draft.bullets.filter((b) => b.entry_id === entryId).sort((a, b) => a.sort_order - b.sort_order).map((b) => b.id);
    const to = index + dir;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    void reorderBullets(entryId, ids);
  };

  return (
    <li data-bullet-id={bullet.id} className="group" style={{ marginBottom: 1 }}>
      <SortableItem id={bullet.id} handleLabel="Reorder bullet">
        <div className="flex items-start gap-1">
          <textarea
            value={bullet.content}
            onChange={(e) => updateBullet(bullet.id, e.target.value)}
            onKeyDown={(e) => {
              // Enter saves/creates a new bullet — never a paragraph break inside one bullet.
              if (e.key === "Enter") e.preventDefault();
            }}
            aria-label="Bullet text"
            rows={1}
            className="flex-1 resize-none overflow-hidden"
            style={{ border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: "inherit", lineHeight: "inherit" }}
            ref={(el) => {
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
          />
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
            <MiniBtn label="Move bullet up" onClick={() => move(-1)} disabled={index === 0}>
              <ChevronUp className="h-3 w-3" />
            </MiniBtn>
            <MiniBtn label="Move bullet down" onClick={() => move(1)} disabled={index === total - 1}>
              <ChevronDown className="h-3 w-3" />
            </MiniBtn>
            {library.blocks.length > 0 && (
              <MiniBtn label="Save as library bullet" onClick={() => setSaveOpen(true)}>
                <BookmarkPlus className="h-3 w-3" />
              </MiniBtn>
            )}
            <MiniBtn label="Delete bullet" onClick={() => void removeBullet(bullet.id)}>
              <Trash2 className="h-3 w-3" />
            </MiniBtn>
          </div>
        </div>
      </SortableItem>
      {saveOpen && <SaveAsLibraryBulletDialog bulletId={bullet.id} open={saveOpen} onOpenChange={setSaveOpen} />}
    </li>
  );
}

function MiniBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-800">
      {children}
    </button>
  );
}
