"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker, DateTimePicker } from "@/components/ui/date-picker";
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
type Event = Tables<"events">;

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "wishlist", label: "Wishlist" },
  { value: "applied", label: "Applied" },
  { value: "oa", label: "OA" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

const EVENT_TYPE_OPTIONS = [
  { value: "oa", label: "OA" },
  { value: "interview", label: "Interview" },
  { value: "deadline", label: "Deadline" },
  { value: "recruiter_call", label: "Recruiter call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

type EventForm = {
  title: string;
  event_type: string;
  event_date: string;
  notes: string;
};

const EMPTY_EVENT_FORM: EventForm = {
  title: "",
  event_type: "",
  event_date: "",
  notes: "",
};

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function eventFormFrom(event: Event): EventForm {
  return {
    title: event.title,
    event_type: event.event_type ?? "",
    event_date: toLocalDateTime(event.event_date),
    notes: event.notes ?? "",
  };
}

function formatEventDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EditApplicationModal({
  application,
  events,
  open,
  onOpenChange,
}: {
  application: Application;
  events: Event[];
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
  const [localEvents, setLocalEvents] = useState(events);
  const [editingEventId, setEditingEventId] = useState<string | "new" | null>(
    null,
  );
  const [eventForm, setEventForm] = useState<EventForm>(EMPTY_EVENT_FORM);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const router = useRouter();

  const orderedEvents = useMemo(
    () =>
      [...localEvents].sort(
        (a, b) =>
          new Date(b.event_date).getTime() -
          new Date(a.event_date).getTime(),
      ),
    [localEvents],
  );

  function set(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function setEventField(field: keyof EventForm, value: string) {
    setEventForm((previous) => ({ ...previous, [field]: value }));
  }

  function beginNewEvent() {
    setEventError(null);
    setEventForm(EMPTY_EVENT_FORM);
    setEditingEventId("new");
  }

  function beginEditEvent(event: Event) {
    setEventError(null);
    setEventForm(eventFormFrom(event));
    setEditingEventId(event.id);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null);
      setEventError(null);
      setEditingEventId(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
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

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    handleOpenChange(false);
    router.refresh();
  }

  async function handleEventSubmit(event: React.FormEvent) {
    event.preventDefault();
    setEventError(null);

    if (!eventForm.event_date) {
      setEventError("Choose a date and time.");
      return;
    }

    setEventLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const eventValues = {
        title: eventForm.title,
        event_type: eventForm.event_type || null,
        event_date: new Date(eventForm.event_date).toISOString(),
        notes: eventForm.notes || null,
      };

      if (editingEventId === "new") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setEventError("Not authenticated.");
          return;
        }

        const { data, error: insertError } = await supabase
          .from("events")
          .insert({
            ...eventValues,
            user_id: user.id,
            application_id: application.id,
          })
          .select("*")
          .single();

        if (insertError) {
          setEventError(insertError.message);
          return;
        }
        setLocalEvents((previous) => [...previous, data]);
      } else if (editingEventId) {
        const { data, error: updateError } = await supabase
          .from("events")
          .update(eventValues)
          .eq("id", editingEventId)
          .select("*")
          .single();

        if (updateError) {
          setEventError(updateError.message);
          return;
        }
        setLocalEvents((previous) =>
          previous.map((item) => (item.id === data.id ? data : item)),
        );
      }

      setEditingEventId(null);
      setEventForm(EMPTY_EVENT_FORM);
      router.refresh();
    } catch {
      setEventError("The event couldn’t be saved. Try again.");
    } finally {
      setEventLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            {application.company} — {application.role}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Edit application details and access every related event in one place.
          </p>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)]">
          <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">
                Application details
              </h3>
              {application.submitted_resume_version_id && (
                <span className="text-xs text-muted-foreground">
                  Resume attached
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                placeholder="Acme Corp"
                value={form.company}
                onChange={(event) => set("company", event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <Input
                id="edit-role"
                placeholder="Software Engineer Intern"
                value={form.role}
                onChange={(event) => set("role", event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                placeholder="New York, NY or Remote"
                value={form.location}
                onChange={(event) => set("location", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => set("status", value)}
              >
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-applied_date">Applied date</Label>
              <DatePicker
                id="edit-applied_date"
                value={form.applied_date}
                onChange={(value) => set("applied_date", value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-job_url">Job posting URL</Label>
              <Input
                id="edit-job_url"
                type="url"
                placeholder="https://jobs.example.com/..."
                value={form.job_url}
                onChange={(event) => set("job_url", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Any notes…"
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save application"}
              </Button>
            </div>
          </form>

          <section className="min-w-0 border-t border-border pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Events</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {localEvents.length}{" "}
                  {localEvents.length === 1 ? "event" : "events"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={beginNewEvent}
              >
                <CalendarPlus data-icon="inline-start" />
                Add event
              </Button>
            </div>

            {editingEventId ? (
              <form
                onSubmit={handleEventSubmit}
                className="mt-4 flex flex-col gap-3"
              >
                <div>
                  <h4 className="text-sm font-medium text-foreground">
                    {editingEventId === "new" ? "New event" : "Edit event"}
                  </h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {application.company} · {application.role}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="application-event-title">Title</Label>
                  <Input
                    id="application-event-title"
                    placeholder="Phone screen"
                    value={eventForm.title}
                    onChange={(event) =>
                      setEventField("title", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="application-event-type">Type</Label>
                  <Select
                    value={eventForm.event_type}
                    onValueChange={(value) =>
                      setEventField("event_type", value)
                    }
                  >
                    <SelectTrigger
                      id="application-event-type"
                      className="w-full"
                    >
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="application-event-date">
                    Date &amp; time
                  </Label>
                  <DateTimePicker
                    id="application-event-date"
                    value={eventForm.event_date}
                    onChange={(value) =>
                      setEventField("event_date", value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="application-event-notes">Notes</Label>
                  <Textarea
                    id="application-event-notes"
                    placeholder="Any notes…"
                    value={eventForm.notes}
                    onChange={(event) =>
                      setEventField("notes", event.target.value)
                    }
                    rows={3}
                  />
                </div>
                {eventError && (
                  <p className="text-sm text-destructive">{eventError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingEventId(null)}
                  >
                    Back to events
                  </Button>
                  <Button type="submit" size="sm" disabled={eventLoading}>
                    {eventLoading ? "Saving…" : "Save event"}
                  </Button>
                </div>
              </form>
            ) : orderedEvents.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No events yet.</p>
                <button
                  type="button"
                  onClick={beginNewEvent}
                  className="mt-2 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Add the first event
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-1.5">
                {orderedEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => beginEditEvent(event)}
                    className="group/event flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Edit event: ${event.title}`}
                  >
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-4" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {event.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatEventDate(event.event_date)}
                      </span>
                      {event.notes && (
                        <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">
                          {event.notes}
                        </span>
                      )}
                    </span>
                    <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover/event:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
