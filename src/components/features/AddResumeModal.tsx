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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createResume } from "@/lib/resume/resumes";
import { createSection } from "@/lib/resume/sections";
import type { LayoutKind } from "@/lib/resume/types";

const EMPTY_FORM = { name: "", targetCompany: "", targetRole: "", template: "engineering" };
const ENGINEERING_SECTIONS: { title: string; layoutKind: LayoutKind }[] = [
  { title: "Education", layoutKind: "education" },
  { title: "Experience", layoutKind: "entry" },
  { title: "Projects", layoutKind: "entry" },
  { title: "Skills", layoutKind: "skills" },
];

export function AddResumeModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const router = useRouter();

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const result = await createResume(supabase, {
      name: form.name,
      targetCompany: form.targetCompany,
      targetRole: form.targetRole,
    });

    if (!result.ok) {
      setLoading(false);
      setError(result.message);
      return;
    }

    const created = result.data[0];
    if (form.template === "engineering") {
      let revision = created.revision;
      for (const section of ENGINEERING_SECTIONS) {
        const sectionResult = await createSection(supabase, created.resume_id, revision, section);
        if (!sectionResult.ok) {
          setError(`Resume created, but the template could not be completed: ${sectionResult.message}`);
          setLoading(false);
          return;
        }
        revision = sectionResult.data[0].revision;
      }
    }

    setOpen(false);
    setLoading(false);
    setForm(EMPTY_FORM);
    router.push(`/resumes/${created.resume_id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          New resume
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">New resume</DialogTitle>
          <DialogDescription>Name your new resume and optionally set a target role and company. You can change these later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-template">Template</Label>
            <select
              id="resume-template"
              value={form.template}
              onChange={(e) => set("template", e.target.value)}
              className="h-9 rounded-md border border-gray-200 bg-transparent px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="engineering">Engineering Resume</option>
              <option value="blank">Blank resume</option>
            </select>
            <p className="text-xs text-gray-500">Engineering Resume creates Education, Experience, Projects, and Skills.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-name">Name</Label>
            <Input
              id="resume-name"
              placeholder="Software Engineer Resume"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-company">Target company (optional)</Label>
            <Input
              id="target-company"
              placeholder="Acme Corp"
              value={form.targetCompany}
              onChange={(e) => set("targetCompany", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-role">Target role (optional)</Label>
            <Input
              id="target-role"
              placeholder="Software Engineer Intern"
              value={form.targetRole}
              onChange={(e) => set("targetRole", e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : "Create resume"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
