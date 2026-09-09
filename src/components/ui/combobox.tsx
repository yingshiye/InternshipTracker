"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "radix-ui";

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
  const [portalContainer, setPortalContainer] = useState<HTMLElement>();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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
          onFocus={(event) => {
            // A modal Dialog only permits wheel/touch scrolling within its
            // content. Keep the popover in that subtree instead of portaling
            // it to document.body, where Radix's scroll lock would block it.
            setPortalContainer(
              event.currentTarget.closest<HTMLElement>(
                "[data-slot='dialog-content']"
              ) ?? undefined
            );
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </Popover.Anchor>
      {rowCount > 0 && (
        <Popover.Portal container={portalContainer}>
          <Popover.Content
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="z-[100] w-(--radix-popover-trigger-width) rounded-lg border border-border bg-popover text-popover-foreground shadow-lg outline-none"
          >
            <div className="max-h-56 overflow-y-auto overscroll-contain p-1">
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
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}
