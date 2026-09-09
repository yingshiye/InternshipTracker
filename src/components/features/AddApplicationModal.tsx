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
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
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
import { normalizeUrl } from "@/lib/url";
import { withTimeout } from "@/lib/utils";
import { useFieldOptions } from "@/lib/hooks/useFieldOptions";
import type { ApplicationStatus } from "@/types/supabase";

const SUPABASE_TIMEOUT_MS = 10_000;

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "wishlist", label: "Wishlist" },
  { value: "applied", label: "Applied" },
  { value: "oa", label: "OA" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

const EMPTY_FORM = {
  company: "",
  role: "",
  location: "",
  status: "applied" as ApplicationStatus,
  applied_date: "",
  job_url: "",
  notes: "",
};

export function AddApplicationModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const router = useRouter();
  const roleOptions = useFieldOptions("role", userId);
  const locationOptions = useFieldOptions("location", userId);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    let normalizedJobUrl: string | null = null;
    if (form.job_url) {
      try {
        normalizedJobUrl = normalizeUrl(form.job_url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Enter a valid job posting URL");
        setLoading(false);
        return;
      }
    }

    const supabase = getSupabaseBrowserClient();

    try {
      const { error } = await withTimeout(
        supabase.from("applications").insert({
          user_id: userId,
          company: form.company,
          role: form.role,
          status: form.status,
          location: form.location || null,
          job_url: normalizedJobUrl,
          applied_date: form.applied_date || null,
          notes: form.notes || null,
        }),
        SUPABASE_TIMEOUT_MS
      );

      if (error) {
        setError(error.message);
        return;
      }

      roleOptions.addOption(form.role);
      if (form.location) locationOptions.addOption(form.location);

      setOpen(false);
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add application
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Add application
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              placeholder="Acme Corp"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Role</Label>
            <Combobox
              id="role"
              placeholder="Software Engineer Intern"
              value={form.role}
              onChange={(v) => set("role", v)}
              options={roleOptions.options}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location">Location</Label>
            <Combobox
              id="location"
              placeholder="New York, NY or Remote"
              value={form.location}
              onChange={(v) => set("location", v)}
              options={locationOptions.options}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v)}
            >
              <SelectTrigger id="status" className="w-full">
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
            <Label htmlFor="applied_date">Applied date</Label>
            <DatePicker
              id="applied_date"
              value={form.applied_date}
              onChange={(value) => set("applied_date", value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="job_url">Job posting URL</Label>
            <Input
              id="job_url"
              type="url"
              placeholder="https://jobs.example.com/..."
              value={form.job_url}
              onChange={(e) => set("job_url", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
