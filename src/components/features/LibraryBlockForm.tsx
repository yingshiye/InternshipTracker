"use client";

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
import type { LayoutKind } from "@/lib/resume/types";
import { LibraryBlockTypeFields, type LibraryBlockDetails } from "./LibraryBlockTypeFields";

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

export type LibraryBlockFormValues = LibraryBlockDetails & {
  name: string;
  defaultSectionTitle: string;
  layoutKind: LayoutKind;
};

export const EMPTY_LIBRARY_BLOCK_FORM: LibraryBlockFormValues = {
  name: "",
  defaultSectionTitle: "Experience",
  layoutKind: "entry",
  title: "",
  organization: "",
  location: "",
  startDate: "",
  endDate: "",
  isPresent: false,
  degree: "",
  minor: "",
  gpa: "",
  skillCategories: [{ label: "", items: [""] }],
};

/**
 * Shared fields for creating or editing a library block. The Dialog chrome,
 * initial values, and submit handling (create vs. update) stay with the
 * caller so this can be reused both as a standalone modal and inline inside
 * an already-open dialog (the editor's "add from library" menu).
 */
export function LibraryBlockForm({
  idPrefix,
  values,
  onChange,
  lockLayoutKind,
  onCancel,
  onSubmit,
  loading,
  error,
  submitLabel,
  submittingLabel,
}: {
  idPrefix: string;
  values: LibraryBlockFormValues;
  onChange: (values: LibraryBlockFormValues) => void;
  lockLayoutKind?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  submitLabel: string;
  submittingLabel: string;
}) {
  function set<K extends keyof LibraryBlockFormValues>(field: K, value: LibraryBlockFormValues[K]) {
    onChange({ ...values, [field]: value });
  }

  function setLayoutKind(layoutKind: LayoutKind) {
    onChange({
      ...values,
      layoutKind,
      defaultSectionTitle:
        !values.defaultSectionTitle || Object.values(DEFAULT_SECTION_TITLES).includes(values.defaultSectionTitle)
          ? DEFAULT_SECTION_TITLES[layoutKind]
          : values.defaultSectionTitle,
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pt-2"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name (library-only label)</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="Google SWE — Summer 2025"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-layout-kind`}>Type</Label>
        <Select value={values.layoutKind} onValueChange={(v) => setLayoutKind(v as LayoutKind)} disabled={lockLayoutKind}>
          <SelectTrigger id={`${idPrefix}-layout-kind`} className="w-full">
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
        <Label htmlFor={`${idPrefix}-default-section`}>Default section title</Label>
        <Input
          id={`${idPrefix}-default-section`}
          placeholder="Experience"
          value={values.defaultSectionTitle}
          onChange={(e) => set("defaultSectionTitle", e.target.value)}
          required
        />
      </div>
      <LibraryBlockTypeFields
        idPrefix={idPrefix}
        layoutKind={values.layoutKind}
        details={values}
        setDetail={(field, value) => onChange({ ...values, [field]: value })}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? submittingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
