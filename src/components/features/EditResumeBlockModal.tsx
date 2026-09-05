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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { libraryBlockFormToInput, updateLibraryBlock } from "@/lib/resume/library";
import type { EducationData, LibraryBlock, SkillsData } from "@/lib/resume/types";
import { LibraryBlockForm } from "./LibraryBlockForm";

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

  async function handleSubmit() {
    setError(null);
    setLoading(true);

    try {
      const supabase = getSupabaseBrowserClient();
      await updateLibraryBlock(
        supabase,
        block.id,
        libraryBlockFormToInput({
          ...form,
          // field_of_study is intentionally dropped: its text is folded into
          // `degree` on load (see the `form.degree` initializer above).
          existingEducationExtras: {
            honors: educationData.honors,
            coursework: educationData.coursework,
            details: educationData.details,
          },
        }),
      );
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
        <LibraryBlockForm
          idPrefix="edit-block"
          values={form}
          onChange={setForm}
          onCancel={() => onOpenChange(false)}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          submitLabel="Save changes"
          submittingLabel="Saving…"
        />
      </DialogContent>
    </Dialog>
  );
}
