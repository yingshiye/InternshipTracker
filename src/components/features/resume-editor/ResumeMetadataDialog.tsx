"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationError } from "@/lib/resume/validate";
import { useEditor } from "./useEditorController";

/**
 * Resume-level metadata: the name it is filed under, and the company/role it
 * is aimed at. Target company and role matter beyond bookkeeping — they seed
 * the export filename and are what an application is checked against before a
 * submitted version is created.
 */
export function ResumeMetadataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { draft, updateMetadata } = useEditor();
  const [name, setName] = useState(draft.resume.name);
  const [company, setCompany] = useState(draft.resume.target_company ?? "");
  const [role, setRole] = useState(draft.resume.target_role ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    if (busy) return;
    setError(null);
    if (!name.trim()) {
      setError("A resume needs a name.");
      return;
    }
    setBusy(true);
    try {
      const ok = await updateMetadata({
        name: name.trim(),
        targetCompany: company.trim() || null,
        targetRole: role.trim() || null,
      });
      if (ok) onOpenChange(false);
      else setError("That change could not be saved. Check the save status and try again.");
    } catch (e) {
      // The shared validators throw on HTML or embedded newlines.
      setError(e instanceof ValidationError ? e.message : "That value could not be used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resume details</DialogTitle>
          <DialogDescription>
            The target company and role appear in the suggested export filename and are checked against an
            application when you submit this resume.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-name">Resume name</Label>
            <Input id="resume-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-company">Target company</Label>
            <Input
              id="resume-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="resume-role">Target role</Label>
            <Input
              id="resume-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Software Engineer Intern"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
