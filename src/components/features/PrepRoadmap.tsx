"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, ExternalLink } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  PREP_ROADMAP,
  PREP_TASK_COUNT,
  PREP_TOTAL_MINUTES,
  type PrepTaskStatus,
} from "@/lib/prep/roadmap";
import { cn } from "@/lib/utils";

type InitialProgress = {
  task_id: string;
  status: PrepTaskStatus;
};

const STATUS_OPTIONS: Array<{ value: PrepTaskStatus; label: string }> = [
  { value: "not_started", label: "Not started" },
  { value: "review", label: "Review needed" },
  { value: "completed", label: "Completed" },
];

const KIND_LABELS = {
  recall: "Recall",
  learn: "Learn",
  practice: "Practice",
  review: "Review",
  mock: "Mock OA",
  interview: "Interview",
};

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

export function PrepRoadmap({
  userId,
  initialProgress,
}: {
  userId: string;
  initialProgress: InitialProgress[];
}) {
  const [progress, setProgress] = useState<Record<string, PrepTaskStatus>>(() =>
    Object.fromEntries(initialProgress.map((item) => [item.task_id, item.status])),
  );
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentDay = useMemo(
    () =>
      PREP_ROADMAP.find((day) =>
        day.tasks.some((task) => progress[task.id] !== "completed"),
      )?.day ?? 21,
    [progress],
  );
  const [week, setWeek] = useState<1 | 2 | 3>(() =>
    Math.ceil(currentDay / 7) as 1 | 2 | 3,
  );
  const [expandedDay, setExpandedDay] = useState(currentDay);

  const completedTaskIds = useMemo(
    () => new Set(Object.entries(progress).filter(([, status]) => status === "completed").map(([id]) => id)),
    [progress],
  );
  const completedMinutes = useMemo(
    () =>
      PREP_ROADMAP.flatMap((day) => day.tasks).reduce(
        (sum, task) => sum + (completedTaskIds.has(task.id) ? task.minutes : 0),
        0,
      ),
    [completedTaskIds],
  );
  const reviewCount = Object.values(progress).filter((status) => status === "review").length;
  const completionPercent = Math.round((completedTaskIds.size / PREP_TASK_COUNT) * 100);

  async function updateStatus(taskId: string, nextStatus: PrepTaskStatus) {
    const previousStatus = progress[taskId] ?? "not_started";
    setProgress((current) => ({ ...current, [taskId]: nextStatus }));
    setSavingTaskId(taskId);
    setError(null);

    const supabase = getSupabaseBrowserClient();
    const { error: saveError } = await supabase.from("study_task_progress").upsert(
      {
        user_id: userId,
        task_id: taskId,
        status: nextStatus,
        completed_at: nextStatus === "completed" ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,task_id" },
    );

    if (saveError) {
      setProgress((current) => ({ ...current, [taskId]: previousStatus }));
      setError("Progress could not be saved. Apply the latest Supabase migration and try again.");
    }
    setSavingTaskId((current) => (current === taskId ? null : current));
  }

  function showCurrentDay() {
    const nextWeek = Math.ceil(currentDay / 7) as 1 | 2 | 3;
    setWeek(nextWeek);
    setExpandedDay(currentDay);
  }

  const visibleDays = PREP_ROADMAP.filter((day) => day.week === week);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Plan progress" className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          <div className="border-b border-r border-border p-4 sm:border-b-0 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Current focus</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">Day {currentDay}</p>
          </div>
          <div className="border-b border-border p-4 sm:border-b-0 sm:border-r sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Sessions complete</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">
              {completedTaskIds.size}<span className="text-sm font-normal text-muted-foreground"> / {PREP_TASK_COUNT}</span>
            </p>
          </div>
          <div className="border-r border-border p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Focused time</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">{formatMinutes(completedMinutes)}</p>
          </div>
          <div className="p-4 sm:p-5">
            <p className="text-xs font-medium text-muted-foreground">Review queue</p>
            <p className="mt-2 text-xl font-semibold tracking-tight">{reviewCount}</p>
          </div>
        </div>
        <div className="border-t border-border px-4 py-3 sm:px-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{completionPercent}% of the sprint complete</span>
            <span>{formatMinutes(PREP_TOTAL_MINUTES)} planned</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${completionPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card" aria-labelledby="method-title">
        <div className="border-b border-border px-4 py-3">
          <h2 id="method-title" className="text-sm font-semibold">How to run each session</h2>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-4">
          {[
            ["1. Attempt", "Work independently: 20 minutes for easy, 35 for medium."],
            ["2. Hint", "If blocked, take one hint before opening a full explanation."],
            ["3. Re-code", "Close the solution and implement it again from a blank editor."],
            ["4. Revisit", "Mark Review needed and return after 2–3 days."],
          ].map(([title, detail]) => (
            <div key={title} className="bg-card p-4">
              <p className="text-xs font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="roadmap-title">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="roadmap-title" className="text-sm font-semibold">21-day roadmap</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Study time only; applications remain separate.</p>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Choose roadmap week">
            {([1, 2, 3] as const).map((weekNumber) => (
              <button
                key={weekNumber}
                type="button"
                onClick={() => setWeek(weekNumber)}
                aria-pressed={week === weekNumber}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                  week === weekNumber
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                Week {weekNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={showCurrentDay}
              className="ml-1 h-8 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              Today
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="border-b border-border bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="divide-y divide-border">
          {visibleDays.map((day) => {
            const isExpanded = expandedDay === day.day;
            const completeCount = day.tasks.filter((task) => completedTaskIds.has(task.id)).length;
            const dayMinutes = day.tasks.reduce((sum, task) => sum + task.minutes, 0);
            const isComplete = completeCount === day.tasks.length;

            return (
              <article key={day.day}>
                <button
                  type="button"
                  onClick={() => setExpandedDay(isExpanded ? 0 : day.day)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
                >
                  <span className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border text-[11px] font-semibold",
                    isComplete ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                  )}>
                    {isComplete ? <Check className="size-3.5" aria-label="Complete" /> : day.day}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium text-foreground">{day.focus}</span>
                      <span className="text-xs text-muted-foreground">{formatMinutes(dayMinutes)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{day.outcome}</span>
                  </span>
                  <span className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                    {completeCount}/{day.tasks.length}
                  </span>
                  <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 px-4 py-2 sm:pl-[3.25rem]">
                    <div className="divide-y divide-border">
                      {day.tasks.map((task) => {
                        const status = progress[task.id] ?? "not_started";
                        return (
                          <div key={task.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_142px] sm:items-start">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">{task.title}</span>
                                <span className="text-[11px] text-muted-foreground">{KIND_LABELS[task.kind]} · {formatMinutes(task.minutes)}</span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.description}</p>
                              {(task.resourceUrl || task.problems) && (
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
                                  {task.resourceUrl && (
                                    <a
                                      href={task.resourceUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                    >
                                      {task.resourceLabel}<ExternalLink className="size-3" />
                                    </a>
                                  )}
                                  {task.problems?.map((item) => (
                                    <a
                                      key={item.url}
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                                    >
                                      {item.title}<ExternalLink className="size-3 text-muted-foreground" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <label className="sr-only" htmlFor={`status-${task.id}`}>Status for {task.title}</label>
                            <select
                              id={`status-${task.id}`}
                              value={status}
                              disabled={savingTaskId === task.id}
                              onChange={(event) => updateStatus(task.id, event.target.value as PrepTaskStatus)}
                              className={cn(
                                "h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                                status === "completed" && "border-primary/40 bg-primary/5",
                                status === "review" && "border-amber-500/40 bg-amber-500/5",
                              )}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
