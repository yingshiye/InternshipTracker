"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { EducationData, LayoutKind, LibraryBlock, SkillsData } from "@/lib/resume/types";
import { LibraryBlockTypeFields } from "./LibraryBlockTypeFields";

const LAYOUT_KIND_OPTIONS: { value: LayoutKind; label: string }[] = [
  { value: "entry", label: "Entry (experience, project, leadership…)" },
  { value: "education", label: "Education" },
  { value: "skills", label: "Skills" },
];

const DEFAULT_SECTION_TITLES: Record<LayoutKind, string> = {
  entry: "Experience",
  education: "Education",
  skills: "Skills",
};

export function EditResumeBlockModal({
  block,
  open,
  onOpenChange,
}: {
  block: LibraryBlock;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const educationData = (block.education_data ?? {}) as EducationData;
  const skillsData = (block.skills_data ?? { categories: [] }) as SkillsData;
  const [form, setForm] = useState({
    name: block.name,
    defaultSectionTitle: block.default_section_title,
    layoutKind: block.layout_kind,
    title: block.title ?? "",
    organization: block.organization ?? "",
    location: block.location ?? "",
    startDate: block.start_date ?? "",
    endDate: block.end_date ?? "",
    isPresent: block.end_date === null,
    degree:
      [educationData.degree ?? block.subtitle, educationData.field_of_study]
        .filter(Boolean)
        .join(", ") || "",
    minor: educationData.minor ?? "",
    gpa: educationData.gpa ?? "",
    skillCategories:
      skillsData.categories.length > 0
        ? skillsData.categories.map((category) => ({ ...category, items: [...category.items] }))
        : [{ label: "", items: [""] }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      await updateLibraryBlock(supabase, block.id, {
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
                // honors/coursework/details have no editor field — carry
                // forward whatever the block already had so editing degree/
                // minor/gpa doesn't silently delete them. field_of_study is
                // intentionally dropped: its text is now folded into `degree`
                // on load (see the `form.degree` initializer above).
                honors: educationData.honors,
                coursework: educationData.coursework,
                details: educationData.details,
                degree: form.degree,
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
          <DialogDescription>Update this library block’s details. Changes don’t affect resumes already using it until you update them.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-name">Name (library-only label)</Label>
            <Input id="edit-block-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-block-layout-kind">Type</Label>
            <Select value={form.layoutKind} onValueChange={(v) => setLayoutKind(v as LayoutKind)}>
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
          <LibraryBlockTypeFields
            idPrefix="edit-block"
            layoutKind={form.layoutKind}
            details={form}
            setDetail={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
          />
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
