"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { ChevronUpIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type ComboboxProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
};

// Scrolls the list by a fixed step while the button is held down, mirroring
// select.tsx's SelectScrollUpButton/SelectScrollDownButton — native wheel
// scroll on a Popover portaled inside a modal Dialog is unreliable, so this
// gives a working affordance for lists taller than the panel's max height.
function ScrollButton({
  direction,
  onScroll,
}: {
  direction: "up" | "down";
  onScroll: (amount: number) => void;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function start() {
    stop();
    const amount = direction === "up" ? -40 : 40;
    onScroll(amount);
    intervalRef.current = setInterval(() => onScroll(amount), 60);
  }

  function stop() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => stop, []);

  const Icon = direction === "up" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(event) => {
        event.preventDefault();
        start();
      }}
      onMouseUp={stop}
      onMouseLeave={stop}
      className="flex w-full cursor-default items-center justify-center py-1 text-muted-foreground hover:text-foreground"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  required,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function updateScrollState() {
    const el = listRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, value]);

  const showAddRow =
    value.trim().length > 0 &&
    !options.some((option) => option.toLowerCase() === value.trim().toLowerCase());

  const rowCount = filtered.length + (showAddRow ? 1 : 0);

  useEffect(() => {
    if (open) itemRefs.current[highlighted]?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  useEffect(() => {
    if (open) updateScrollState();
  }, [open, filtered, showAddRow]);

  function selectValue(next: string) {
    onChange(next);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlighted((prev) => Math.min(prev + 1, rowCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      if (open && rowCount > 0) {
        event.preventDefault();
        const selected =
          highlighted < filtered.length ? filtered[highlighted] : value.trim();
        selectValue(selected);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Popover.Root open={open}>
      <Popover.Anchor asChild>
        <Input
          id={id}
          ref={inputRef}
          className={className}
          placeholder={placeholder}
          required={required}
          value={value}
          autoComplete="off"
          onChange={(event) => {
            onChange(event.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </Popover.Anchor>
      {rowCount > 0 && (
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="z-[100] flex max-h-56 w-(--radix-popover-trigger-width) flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none"
          >
            {canScrollUp && (
              <ScrollButton
                direction="up"
                onScroll={(amount) => {
                  if (listRef.current) listRef.current.scrollTop += amount;
                  updateScrollState();
                }}
              />
            )}
            <div
              ref={listRef}
              onScroll={updateScrollState}
              className="overflow-y-auto p-1"
            >
              {filtered.map((option, index) => (
                <button
                  key={option}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  // onMouseDown fires before the input's onBlur closes the popover
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectValue(option);
                  }}
                  className={cn(
                    "flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    highlighted === index && "bg-accent text-accent-foreground"
                  )}
                >
                  {option}
                </button>
              ))}
              {showAddRow && (
                <button
                  ref={(el) => {
                    itemRefs.current[filtered.length] = el;
                  }}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectValue(value.trim());
                  }}
                  className={cn(
                    "flex w-full cursor-default items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    highlighted === filtered.length && "bg-accent text-accent-foreground"
                  )}
                >
                  Add &ldquo;{value.trim()}&rdquo;
                </button>
              )}
            </div>
            {canScrollDown && (
              <ScrollButton
                direction="down"
                onScroll={(amount) => {
                  if (listRef.current) listRef.current.scrollTop += amount;
                  updateScrollState();
                }}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
