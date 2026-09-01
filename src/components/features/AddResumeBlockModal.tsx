"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { LibraryBlockTypeFields } from "./LibraryBlockTypeFields";

const LAYOUT_KIND_OPTIONS: { value: LayoutKind; label: string }[] = [
  { value: "entry", label: "Entry (experience, project, leadership…)" },
  { value: "education", label: "Education" },
  { value: "skills", label: "Skills" },
];

const EMPTY_FORM = {
  name: "",
  defaultSectionTitle: "Experience",
  layoutKind: "entry" as LayoutKind,
  title: "",
  organization: "",
  location: "",
  startDate: "",
  endDate: "",
  isPresent: false,
  degree: "",
  fieldOfStudy: "",
  minor: "",
  gpa: "",
  skillCategories: [{ label: "", items: [""] }],
};

const DEFAULT_SECTION_TITLES: Record<LayoutKind, string> = {
  entry: "Experience",
  education: "Education",
  skills: "Skills",
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

  function setLayoutKind(layoutKind: LayoutKind) {
    setForm((prev) => ({
      ...prev,
      layoutKind,
      defaultSectionTitle:
        !prev.defaultSectionTitle || Object.values(DEFAULT_SECTION_TITLES).includes(prev.defaultSectionTitle)
          ? DEFAULT_SECTION_TITLES[layoutKind]
          : prev.defaultSectionTitle,
    }));
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
        title: form.layoutKind === "skills" ? null : form.title || null,
        subtitle: null,
        organization: form.layoutKind === "entry" ? form.organization || null : null,
        location: form.layoutKind === "skills" ? null : form.location || null,
        startDate: form.layoutKind === "skills" ? null : form.startDate || null,
        endDate: form.layoutKind === "skills" ? null : form.endDate || null,
        educationData:
          form.layoutKind === "education"
            ? {
                degree: form.degree,
                field_of_study: form.fieldOfStudy,
                minor: form.minor,
                gpa: form.gpa,
              }
            : null,
        skillsData:
          form.layoutKind === "skills"
            ? {
                categories: form.skillCategories
                  .filter(
                    (category) =>
                      category.label.trim() || category.items.some((item) => item.trim()),
                  )
                  .map((category) => ({ label: category.label, items: category.items })),
              }
            : null,
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
          <DialogDescription>Create a reusable library block you can copy into any resume.</DialogDescription>
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
            <Select value={form.layoutKind} onValueChange={(v) => setLayoutKind(v as LayoutKind)}>
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
          <LibraryBlockTypeFields
            idPrefix="block"
            layoutKind={form.layoutKind}
            details={form}
            setDetail={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
          />
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
