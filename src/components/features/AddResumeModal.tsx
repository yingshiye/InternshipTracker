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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createResume } from "@/lib/resume/resumes";

const EMPTY_FORM = { name: "", targetCompany: "", targetRole: "" };

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

    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setOpen(false);
    setForm(EMPTY_FORM);
    router.refresh();
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
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
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
