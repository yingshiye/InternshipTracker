"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LayoutKind } from "@/lib/resume/types";

export type SkillCategoryForm = {
  label: string;
  items: string[];
};

export type LibraryBlockDetails = {
  title: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  isPresent: boolean;
  degree: string;
  minor: string;
  gpa: string;
  skillCategories: SkillCategoryForm[];
};

type Props = {
  idPrefix: string;
  layoutKind: LayoutKind;
  details: LibraryBlockDetails;
  setDetail: <K extends keyof LibraryBlockDetails>(field: K, value: LibraryBlockDetails[K]) => void;
};

export function LibraryBlockTypeFields({ idPrefix, layoutKind, details, setDetail }: Props) {
  if (layoutKind === "skills") {
    const updateCategory = (categoryIndex: number, patch: Partial<SkillCategoryForm>) => {
      setDetail(
        "skillCategories",
        details.skillCategories.map((category, index) =>
          index === categoryIndex ? { ...category, ...patch } : category,
        ),
      );
    };

    const updateSkill = (categoryIndex: number, skillIndex: number, value: string) => {
      const category = details.skillCategories[categoryIndex];
      updateCategory(categoryIndex, {
        items: category.items.map((item, index) => (index === skillIndex ? value : item)),
      });
    };

    return (
      <div className="flex flex-col gap-3">
        <div>
          <Label>Skill categories</Label>
          <p className="mt-1 text-xs text-gray-500">Examples: Languages, Frameworks, Tools</p>
        </div>
        {details.skillCategories.map((category, categoryIndex) => (
          <div key={categoryIndex} className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Skill category ${categoryIndex + 1}`}
                placeholder="Category name"
                value={category.label}
                onChange={(event) => updateCategory(categoryIndex, { label: event.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove skill category ${categoryIndex + 1}`}
                onClick={() =>
                  setDetail(
                    "skillCategories",
                    details.skillCategories.filter((_, index) => index !== categoryIndex),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {category.items.map((skill, skillIndex) => (
              <div key={skillIndex} className="flex items-center gap-2 pl-3">
                <Input
                  aria-label={`Skill ${skillIndex + 1} in category ${categoryIndex + 1}`}
                  placeholder="Skill"
                  value={skill}
                  onChange={(event) => updateSkill(categoryIndex, skillIndex, event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove skill ${skillIndex + 1}`}
                  onClick={() =>
                    updateCategory(categoryIndex, {
                      items: category.items.filter((_, index) => index !== skillIndex),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-fit gap-1"
              onClick={() => updateCategory(categoryIndex, { items: [...category.items, ""] })}
            >
              <Plus className="h-3.5 w-3.5" /> Add skill
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-1"
          onClick={() =>
            setDetail("skillCategories", [...details.skillCategories, { label: "", items: [""] }])
          }
        >
          <Plus className="h-3.5 w-3.5" /> Add category
        </Button>
      </div>
    );
  }

  return (
    <>
      {layoutKind === "entry" ? (
        <>
          <TextField
            id={`${idPrefix}-title`}
            label="Job title / Role"
            placeholder="Software Engineer Intern"
            value={details.title}
            onChange={(value) => setDetail("title", value)}
          />
          <TextField
            id={`${idPrefix}-organization`}
            label="Organization"
            placeholder="Google"
            value={details.organization}
            onChange={(value) => setDetail("organization", value)}
          />
        </>
      ) : (
        <>
          <TextField
            id={`${idPrefix}-title`}
            label="School / University"
            placeholder="University of California, Los Angeles"
            value={details.title}
            onChange={(value) => setDetail("title", value)}
          />
          <TextField
            id={`${idPrefix}-degree`}
            label="Degree"
            placeholder="Bachelor of Science in Computer Science"
            value={details.degree}
            onChange={(value) => setDetail("degree", value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id={`${idPrefix}-minor`}
              label="Minor"
              placeholder="Optional"
              value={details.minor}
              onChange={(value) => setDetail("minor", value)}
            />
            <TextField
              id={`${idPrefix}-gpa`}
              label="GPA"
              placeholder="3.8 / 4.0"
              value={details.gpa}
              onChange={(value) => setDetail("gpa", value)}
            />
          </div>
        </>
      )}

      <TextField
        id={`${idPrefix}-location`}
        label="Location"
        placeholder={layoutKind === "education" ? "Los Angeles, CA" : "Mountain View, CA"}
        value={details.location}
        onChange={(value) => setDetail("location", value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-start-date`}>Start date</Label>
          <Input
            id={`${idPrefix}-start-date`}
            type="date"
            value={details.startDate}
            onChange={(event) => setDetail("startDate", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-end-date`}>End date</Label>
          <Input
            id={`${idPrefix}-end-date`}
            type="date"
            value={details.endDate}
            onChange={(event) => setDetail("endDate", event.target.value)}
            disabled={details.isPresent}
          />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={details.isPresent}
              onChange={(event) => {
                setDetail("isPresent", event.target.checked);
                if (event.target.checked) setDetail("endDate", "");
              }}
            />
            Present
          </label>
        </div>
      </div>
    </>
  );
}

function TextField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
