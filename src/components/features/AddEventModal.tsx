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
import type { Tables } from "@/types/supabase";

type Application = Tables<"applications">;

const EVENT_TYPE_OPTIONS = [
  { value: "oa", label: "OA" },
  { value: "interview", label: "Interview" },
  { value: "deadline", label: "Deadline" },
  { value: "recruiter_call", label: "Recruiter call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  title: "",
  event_type: "",
  event_date: "",
  notes: "",
};

export function AddEventModal({
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
  const [form, setForm] = useState(EMPTY_FORM);
  const router = useRouter();

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm(EMPTY_FORM);
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("events").insert({
      user_id: user.id,
      application_id: application.id,
      title: form.title,
      event_type: form.event_type || null,
      event_date: new Date(form.event_date).toISOString(),
      notes: form.notes || null,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      handleOpenChange(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Add event — {application.company}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              placeholder="Phone screen"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-type">Type</Label>
            <Select
              value={form.event_type}
              onValueChange={(v) => set("event_type", v)}
            >
              <SelectTrigger id="event-type" className="w-full">
                <SelectValue placeholder="Select type…" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-date">Date &amp; time</Label>
            <Input
              id="event-date"
              type="datetime-local"
              value={form.event_date}
              onChange={(e) => set("event_date", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-notes">Notes</Label>
            <Textarea
              id="event-notes"
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
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
