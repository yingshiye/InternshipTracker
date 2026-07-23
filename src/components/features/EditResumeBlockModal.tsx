"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateLibraryBlock } from "@/lib/resume/library";
import type { LayoutKind, LibraryBlock } from "@/lib/resume/types";

const LAYOUT_KIND_OPTIONS: { value: LayoutKind; label: string }[] = [
  { value: "entry", label: "Entry (experience, project, leadership…)" },
  { value: "education", label: "Education" },
  { value: "skills", label: "Skills" },
];

export function EditResumeBlockModal({
  block,
  open,
  onOpenChange,
}: {
  block: LibraryBlock;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState({
    name: block.name,
    defaultSectionTitle: block.default_section_title,
    layoutKind: block.layout_kind,
    title: block.title ?? "",
    subtitle: block.subtitle ?? "",
    organization: block.organization ?? "",
    location: block.location ?? "",
    startDate: block.start_date ?? "",
    endDate: block.end_date ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      await updateLibraryBlock(supabase, block.id, {
        name: form.name,
        defaultSectionTitle: form.defaultSectionTitle,
        layoutKind: form.layoutKind,
        title: form.title || null,
        subtitle: form.subtitle || null,
        organization: form.organization || null,
        location: form.location || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      });
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Edit block</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-name">Name (library-only label)</Label>
            <Input id="edit-block-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-layout-kind">Type</Label>
            <Select value={form.layoutKind} onValueChange={(v) => set("layoutKind", v as LayoutKind)}>
              <SelectTrigger id="edit-block-layout-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-default-section">Default section title</Label>
            <Input
              id="edit-block-default-section"
              value={form.defaultSectionTitle}
              onChange={(e) => set("defaultSectionTitle", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-title">Title (shown on the resume)</Label>
            <Input id="edit-block-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-subtitle">Subtitle</Label>
            <Input id="edit-block-subtitle" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-organization">Organization</Label>
            <Input
              id="edit-block-organization"
              value={form.organization}
              onChange={(e) => set("organization", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-location">Location</Label>
            <Input id="edit-block-location" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-block-start-date">Start date</Label>
              <Input
                id="edit-block-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-block-end-date">End date</Label>
              <Input
                id="edit-block-end-date"
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
