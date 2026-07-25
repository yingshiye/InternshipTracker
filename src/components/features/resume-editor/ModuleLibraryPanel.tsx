"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { useEditor } from "./useEditorController";
import type { LayoutKind } from "@/lib/resume/types";

const KIND_LABEL: Record<LayoutKind, string> = { entry: "Experience", education: "Education", skills: "Skills" };

export function ModuleLibraryPanel() {
  const { library } = useEditor();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return library.blocks.filter((b) => !q || b.name.toLowerCase().includes(q) || (b.title ?? "").toLowerCase().includes(q));
  }, [library.blocks, search]);

  const bulletCount = (blockId: string) => library.bullets.filter((b) => b.block_id === blockId).length;

  return (
    <aside className="flex flex-col overflow-hidden border-r border-gray-100 dark:border-gray-800">
      <div className="border-b border-gray-100 px-3 py-3 dark:border-gray-800">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Module Library</h2>
        <p className="mt-0.5 text-xs text-gray-500">Reusable blocks. Add them with a section’s “From library”.</p>
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
                <p className="mt-0.5 text-[11px] text-gray-400">{bulletCount(b.id)} bullet{bulletCount(b.id) === 1 ? "" : "s"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
