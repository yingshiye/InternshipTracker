"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationError, validateCustomLinks } from "@/lib/resume/validate";
import type { CustomLinks } from "@/lib/resume/types";
import { useEditor } from "./useEditorController";

/**
 * Ordered extra header links, beyond the three fixed LinkedIn/GitHub/portfolio
 * fields. Order is the array order and is preserved exactly — the move
 * up/down buttons are the only thing that changes it.
 *
 * Validation is the shared `validateCustomLinks`, so the same plain-text and
 * http/https rules apply here as everywhere else, and it runs before saving so
 * a bad URL is reported in the dialog rather than as a failed save.
 */
export function CustomLinksDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { draft, updateHeader, flushPendingSaves } = useEditor();
  const existing = (draft.header?.custom_links as CustomLinks | null)?.links ?? [];
  const [links, setLinks] = useState<{ label: string; url: string }[]>(existing.map((l) => ({ ...l })));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (i: number, field: "label" | "url", value: string) =>
    setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, [field]: value } : l)));

  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= links.length) return;
    setLinks((prev) => {
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });
  };

  const handleSave = async () => {
    if (busy) return;
    setError(null);
    // Rows left completely blank are dropped rather than treated as errors —
    // that is what an untouched "Add link" row is.
    const candidate = links.filter((l) => l.label.trim() !== "" || l.url.trim() !== "");
    let validated: CustomLinks;
    try {
      validated = validateCustomLinks({ links: candidate });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : "One of these links is not valid.");
      return;
    }
    setBusy(true);
    updateHeader({ custom_links: validated });
    const ok = await flushPendingSaves();
    setBusy(false);
    if (ok) onOpenChange(false);
    else setError("The links could not be saved. Check the save status and try again.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Custom header links</DialogTitle>
          <DialogDescription>
            Extra links shown in the resume header, in this order. Labels are plain text; URLs must be http or https.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          {links.length === 0 && <p className="text-sm text-gray-500">No custom links yet.</p>}
          <ul className="flex flex-col gap-2">
            {links.map((link, i) => (
              <li key={i} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1">
                  <Label htmlFor={`link-label-${i}`} className="text-xs text-gray-500">
                    Label
                  </Label>
                  <Input
                    id={`link-label-${i}`}
                    value={link.label}
                    onChange={(e) => patch(i, "label", e.target.value)}
                    placeholder="Portfolio"
                  />
                </div>
                <div className="flex flex-[2] flex-col gap-1">
                  <Label htmlFor={`link-url-${i}`} className="text-xs text-gray-500">
                    URL
                  </Label>
                  <Input
                    id={`link-url-${i}`}
                    value={link.url}
                    onChange={(e) => patch(i, "url", e.target.value)}
                    placeholder="https://example.com/work"
                  />
                </div>
                <div className="flex items-center gap-0.5 pb-1">
                  <IconBtn label={`Move link ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label={`Move link ${i + 1} down`} disabled={i === links.length - 1} onClick={() => move(i, 1)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn
                    label={`Remove link ${i + 1}`}
                    onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="self-start gap-1.5"
            onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add link
          </Button>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={busy}>
              {busy ? "Saving…" : "Save links"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-1 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
