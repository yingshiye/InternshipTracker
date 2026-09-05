"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEditor } from "./useEditorController";
import { AddSectionDialog } from "./AddSectionDialog";
import type { LayoutKind } from "@/lib/resume/types";

const KIND_LABEL: Record<LayoutKind, string> = { entry: "Experience", education: "Education", skills: "Skills" };

export function ModuleLibraryPanel() {
  const { draft, library, addSection, copyBlock } = useEditor();
  const [search, setSearch] = useState("");
  const [choosingBlockId, setChoosingBlockId] = useState<string | null>(null);
  const [busyBlockId, setBusyBlockId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.blocks.filter((b) => !q || b.name.toLowerCase().includes(q) || (b.title ?? "").toLowerCase().includes(q));
  }, [library.blocks, search]);

  const bulletCount = (blockId: string) => library.bullets.filter((b) => b.block_id === blockId).length;
  const addBlock = async (blockId: string, sectionId?: string) => {
    const block = library.blocks.find((item) => item.id === blockId);
    if (!block) return;
    setBusyBlockId(blockId);
    let targetId = sectionId;
    if (!targetId) {
      const compatible = draft.sections.filter((section) => section.layout_kind === block.layout_kind);
      if (compatible.length > 1) {
        setBusyBlockId(null);
        setChoosingBlockId(blockId);
        return;
      }
      targetId = compatible[0]?.id;
    }
    if (!targetId) {
      targetId = await addSection(block.default_section_title || KIND_LABEL[block.layout_kind], block.layout_kind) ?? undefined;
    }
    if (targetId) {
      const bulletIds = library.bullets.filter((bullet) => bullet.block_id === blockId).map((bullet) => bullet.id);
      await copyBlock(targetId, blockId, bulletIds);
    }
    setBusyBlockId(null);
    setChoosingBlockId(null);
  };
  const choosingBlock = library.blocks.find((block) => block.id === choosingBlockId) ?? null;
  const compatibleChoices = choosingBlock
    ? draft.sections.filter((section) => section.layout_kind === choosingBlock.layout_kind)
    : [];

  return (
    <aside className="flex flex-col overflow-hidden border-r border-gray-100 dark:border-gray-800">
      <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-800">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Module Library</h2>
        <p className="mt-0.5 text-xs text-gray-500">Reusable blocks you can add straight to this resume.</p>
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks"
            aria-label="Search library blocks"
            className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="mt-2">
          <AddSectionDialog />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <p className="px-1 py-3 text-xs text-gray-500">
            No blocks. Create them in{" "}
            <Link href="/resume-blocks" className="underline">
              Resume blocks
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((b) => (
              <li key={b.id} className="rounded-md border border-gray-100 px-2.5 py-2 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">{KIND_LABEL[b.layout_kind]}</span>
                </div>
                {b.title && <p className="truncate text-xs text-gray-500">{b.title}</p>}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-gray-400">{bulletCount(b.id)} bullet{bulletCount(b.id) === 1 ? "" : "s"}</p>
                  <button
                    type="button"
                    onClick={() => void addBlock(b.id)}
                    disabled={busyBlockId !== null}
                    className="rounded px-1.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-950"
                  >
                    {busyBlockId === b.id ? "Adding…" : "Add to resume"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={choosingBlock !== null} onOpenChange={(open) => !open && setChoosingBlockId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to resume</DialogTitle>
            <DialogDescription>Choose where to add “{choosingBlock?.name}”.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            {compatibleChoices.map((section) => (
              <Button key={section.id} variant="outline" className="justify-start" onClick={() => void addBlock(choosingBlock!.id, section.id)}>
                {section.title}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="justify-start gap-1.5 text-gray-600"
              onClick={async () => {
                if (!choosingBlock) return;
                const sectionId = await addSection(choosingBlock.default_section_title || KIND_LABEL[choosingBlock.layout_kind], choosingBlock.layout_kind);
                if (sectionId) await addBlock(choosingBlock.id, sectionId);
              }}
            >
              <Plus className="h-4 w-4" /> Create a new section
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
