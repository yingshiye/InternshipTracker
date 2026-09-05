"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditor } from "./useEditorController";

export function SaveEntryToLibraryDialog({ entryId, open, onOpenChange }: {
  entryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { draft, saveEntryToLibrary } = useEditor();
  const entry = draft.entries.find((item) => item.id === entryId);
  const section = entry ? draft.sections.find((item) => item.id === entry.section_id) : undefined;
  const bulletCount = draft.bullets.filter((bullet) => bullet.entry_id === entryId).length;
  const [name, setName] = useState([entry?.title, entry?.organization].filter(Boolean).join(" — "));
  const [defaultSectionTitle, setDefaultSectionTitle] = useState(section?.title ?? "Experience");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !defaultSectionTitle.trim()) return;
    setBusy(true);
    setError(null);
    const saved = await saveEntryToLibrary(entryId, name, defaultSectionTitle);
    setBusy(false);
    if (saved) onOpenChange(false);
    else setError("Couldn’t save this entry to the library. Try again.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Save entry to library</DialogTitle>
          <DialogDescription>
            Copies this entry’s details and {bulletCount} {bulletCount === 1 ? "bullet" : "bullets"} into a new reusable block. Your resume entry stays unchanged.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`save-entry-name-${entryId}`}>Library name</Label>
            <Input id={`save-entry-name-${entryId}`} autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="UCLA Learning Assistant" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`save-entry-section-${entryId}`}>Default section</Label>
            <Input id={`save-entry-section-${entryId}`} value={defaultSectionTitle} onChange={(event) => setDefaultSectionTitle(event.target.value)} placeholder="Experience" />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy || !name.trim() || !defaultSectionTitle.trim()}>
              {busy ? "Saving…" : "Save to library"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
