"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createLibraryBlock } from "@/lib/resume/library";
import type { LayoutKind } from "@/lib/resume/types";

const LAYOUT_KIND_OPTIONS: { value: LayoutKind; label: string }[] = [
  { value: "entry", label: "Entry (experience, project, leadership…)" },
  { value: "education", label: "Education" },
  { value: "skills", label: "Skills" },
];

const EMPTY_FORM = {
  name: "",
  defaultSectionTitle: "",
  layoutKind: "entry" as LayoutKind,
  title: "",
  subtitle: "",
  organization: "",
  location: "",
  startDate: "",
  endDate: "",
};

export function AddResumeBlockModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
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
      await createLibraryBlock(supabase, userId, {
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
      setOpen(false);
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add block
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Add block</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-name">Name (library-only label)</Label>
            <Input
              id="block-name"
              placeholder="Google SWE — Summer 2025"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-layout-kind">Type</Label>
            <Select value={form.layoutKind} onValueChange={(v) => set("layoutKind", v as LayoutKind)}>
              <SelectTrigger id="block-layout-kind" className="w-full">
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
            <Label htmlFor="block-default-section">Default section title</Label>
            <Input
              id="block-default-section"
              placeholder="Experience"
              value={form.defaultSectionTitle}
              onChange={(e) => set("defaultSectionTitle", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-title">Title (shown on the resume)</Label>
            <Input
              id="block-title"
              placeholder="Software Engineer Intern"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-subtitle">Subtitle</Label>
            <Input
              id="block-subtitle"
              value={form.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-organization">Organization</Label>
            <Input
              id="block-organization"
              placeholder="Google"
              value={form.organization}
              onChange={(e) => set("organization", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-location">Location</Label>
            <Input
              id="block-location"
              placeholder="Mountain View, CA"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-start-date">Start date</Label>
              <Input
                id="block-start-date"
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-end-date">End date</Label>
              <Input
                id="block-end-date"
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add block"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
