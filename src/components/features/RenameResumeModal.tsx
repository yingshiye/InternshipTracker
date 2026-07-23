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
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateResumeMetadata } from "@/lib/resume/resumes";
import type { Resume } from "@/lib/resume/types";

export function RenameResumeModal({
  resume,
  open,
  onOpenChange,
}: {
  resume: Resume;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(resume.name);
  const [targetCompany, setTargetCompany] = useState(resume.target_company ?? "");
  const [targetRole, setTargetRole] = useState(resume.target_role ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const result = await updateResumeMetadata(supabase, resume.id, resume.revision, {
      name,
      targetCompany,
      targetRole,
    });

    setLoading(false);
    if (!result.ok) {
      setError(
        result.reason === "revision_conflict"
          ? "This resume changed elsewhere — refresh and try again."
          : result.message,
      );
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Edit resume</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-resume-name">Name</Label>
            <Input
              id="edit-resume-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-target-company">Target company</Label>
            <Input
              id="edit-target-company"
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-target-role">Target role</Label>
            <Input
              id="edit-target-role"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
            />
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
