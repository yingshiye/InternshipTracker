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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Tables, ApplicationStatus } from "@/types/supabase";

type Application = Tables<"applications">;

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "wishlist", label: "Wishlist" },
  { value: "applied", label: "Applied" },
  { value: "oa", label: "OA" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

export function EditApplicationModal({
  application,
  open,
  onOpenChange,
}: {
  application: Application;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: application.company,
    role: application.role,
    location: application.location ?? "",
    status: application.status,
    applied_date: application.applied_date ?? "",
    job_url: application.job_url ?? "",
    notes: application.notes ?? "",
  });
  const router = useRouter();

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("applications")
      .update({
        company: form.company,
        role: form.role,
        status: form.status,
        location: form.location || null,
        job_url: form.job_url || null,
        applied_date: form.applied_date || null,
        notes: form.notes || null,
      })
      .eq("id", application.id);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      onOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Edit application
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-company">Company</Label>
            <Input
              id="edit-company"
              placeholder="Acme Corp"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Input
              id="edit-role"
              placeholder="Software Engineer Intern"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              placeholder="New York, NY or Remote"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v)}
            >
              <SelectTrigger id="edit-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-applied_date">Applied date</Label>
            <Input
              id="edit-applied_date"
              type="date"
              value={form.applied_date}
              onChange={(e) => set("applied_date", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-job_url">Job posting URL</Label>
            <Input
              id="edit-job_url"
              type="url"
              placeholder="https://jobs.example.com/..."
              value={form.job_url}
              onChange={(e) => set("job_url", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              placeholder="Any notes…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
