"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";

import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type PickerProps = {
  id?: string;
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDate(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function parseMonth(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

function dateLabel(value: string | null) {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return `${MONTHS[parsed.month]} ${parsed.day}, ${parsed.year}`;
}

function PickerTrigger({
  id,
  label,
  placeholder,
  disabled,
  className,
  ariaLabel,
  inline = false,
  ...triggerProps
}: {
  id?: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  inline?: boolean;
} & Omit<React.ComponentProps<"button">, "id" | "disabled" | "className" | "aria-label">) {
  return (
    <button
      id={id}
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      {...triggerProps}
      className={cn(
        "group/date flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        inline && "h-auto w-auto rounded border-0 bg-transparent px-0.5 py-0 font-[inherit] text-inherit italic hover:bg-black/5 focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:hover:bg-white/5",
        className,
      )}
    >
      <span className={cn("truncate", !label && "text-muted-foreground")}>{label || placeholder}</span>
      <CalendarDays className={cn("size-3.5 shrink-0 text-muted-foreground", inline && "opacity-0 transition-opacity group-hover/date:opacity-70 group-focus-visible/date:opacity-70")} />
    </button>
  );
}

function PickerPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Popover.Portal>
      <Popover.Content
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className={cn("z-[100] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg outline-none", className)}
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}

export function DatePicker({ id, value, onChange, disabled, className, placeholder = "Select date", "aria-label": ariaLabel }: PickerProps) {
  const selected = parseDate(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => ({
    year: selected?.year ?? today.getFullYear(),
    month: selected?.month ?? today.getMonth(),
  }));

  const changeOpen = (next: boolean) => {
    if (next && selected) setView({ year: selected.year, month: selected.month });
    setOpen(next);
  };
  const moveMonth = (amount: number) => {
    const next = new Date(view.year, view.month + amount, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };
  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const dayCount = new Date(view.year, view.month + 1, 0).getDate();
  const cells = [...Array<null>(firstWeekday).fill(null), ...Array.from({ length: dayCount }, (_, index) => index + 1)];
  const isCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <PickerTrigger id={id} label={dateLabel(value)} placeholder={placeholder} disabled={disabled} className={className} ariaLabel={ariaLabel} />
      </Popover.Trigger>
      <PickerPanel className="w-[19rem]">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-sm font-medium">{MONTHS[view.month]} {view.year}</div>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
          {WEEKDAYS.map((weekday) => <span key={weekday} className="pb-1.5">{weekday}</span>)}
          {cells.map((day, index) => day === null ? <span key={`empty-${index}`} /> : (
            <button
              key={day}
              type="button"
              aria-label={`${MONTHS[view.month]} ${day}, ${view.year}`}
              aria-pressed={selected?.year === view.year && selected.month === view.month && selected.day === day}
              onClick={() => {
                onChange(`${view.year}-${pad(view.month + 1)}-${pad(day)}`);
                setOpen(false);
              }}
              className={cn(
                "mx-auto grid size-8 place-items-center rounded-md text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected?.year === view.year && selected.month === view.month && selected.day === day && "bg-primary text-primary-foreground hover:bg-primary",
                isCurrentMonth && day === today.getDate() && !(selected?.year === view.year && selected.month === view.month && selected.day === day) && "font-semibold text-primary",
              )}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
          <button type="button" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
          <button type="button" className="rounded px-1.5 py-1 font-medium text-primary hover:bg-muted" onClick={() => {
            onChange(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
            setOpen(false);
          }}>Today</button>
        </div>
      </PickerPanel>
    </Popover.Root>
  );
}

export function MonthPicker({
  id,
  value,
  onChange,
  disabled,
  className,
  placeholder = "Select month",
  displayValue,
  inline = false,
  "aria-label": ariaLabel,
}: PickerProps & { displayValue?: string; inline?: boolean }) {
  const selected = parseMonth(value);
  const currentYear = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selected?.year ?? currentYear);
  const changeOpen = (next: boolean) => {
    if (next && selected) setYear(selected.year);
    setOpen(next);
  };

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger asChild>
        <PickerTrigger id={id} label={displayValue ?? (selected ? `${MONTHS[selected.month]} ${selected.year}` : "")} placeholder={placeholder} disabled={disabled} className={className} ariaLabel={ariaLabel} inline={inline} />
      </Popover.Trigger>
      <PickerPanel className="w-72">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => setYear((value) => value - 1)} aria-label="Previous year" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-medium">{year}</span>
          <button type="button" onClick={() => setYear((value) => value + 1)} aria-label="Next year" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-4" /></button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTHS.map((month, monthIndex) => (
            <button
              key={month}
              type="button"
              aria-pressed={selected?.year === year && selected.month === monthIndex}
              onClick={() => {
                onChange(`${year}-${pad(monthIndex + 1)}-01`);
                setOpen(false);
              }}
              className={cn(
                "h-9 rounded-md text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected?.year === year && selected.month === monthIndex && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >{month}</button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-xs">
          <button type="button" className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
          <button type="button" className="rounded px-1.5 py-1 font-medium text-primary hover:bg-muted" onClick={() => {
            const now = new Date();
            onChange(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
            setOpen(false);
          }}>This month</button>
        </div>
      </PickerPanel>
    </Popover.Root>
  );
}

export function DateTimePicker({ id, value, onChange, disabled, className, placeholder = "Select date", "aria-label": ariaLabel }: PickerProps) {
  const [datePart = "", timePart = ""] = value?.split("T") ?? [];
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_7rem] gap-2", className)}>
      <DatePicker
        id={id}
        value={datePart}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(date) => onChange(date ? `${date}T${timePart || "09:00"}` : "")}
      />
      <input
        type="time"
        aria-label="Time"
        value={timePart}
        disabled={disabled || !datePart}
        onChange={(event) => onChange(datePart ? `${datePart}T${event.target.value}` : "")}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
      />
    </div>
  );
}
