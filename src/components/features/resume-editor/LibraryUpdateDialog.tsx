"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { prepareLibraryUpdateComparison, type LibraryUpdateComparison } from "@/lib/resume/compare";
import { useEditor } from "./useEditorController";

export function LibraryUpdateDialog({ entryId, open, onOpenChange }: { entryId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { applyLibraryUpdate } = useEditor();
  const [comparison, setComparison] = useState<LibraryUpdateComparison | null | "loading">("loading");
  const [fields, setFields] = useState<Set<string>>(new Set());
  const [updates, setUpdates] = useState<Set<string>>(new Set());
  const [adds, setAdds] = useState<Set<string>>(new Set());
  const [removes, setRemoves] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowserClient();
    prepareLibraryUpdateComparison(supabase, entryId)
      .then((c) => {
        if (!active) return;
        setComparison(c);
        if (c) {
          setFields(new Set(c.blockFieldDiffs.map((d) => d.field)));
          setUpdates(new Set(c.bulletsChanged.map((b) => b.entryBulletId)));
          setAdds(new Set(c.bulletsAdded.map((b) => b.id)));
        }
      })
      .catch(() => active && setComparison(null));
    return () => {
      active = false;
    };
  }, [entryId]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const hasChanges =
    comparison && comparison !== "loading" &&
    (comparison.blockFieldDiffs.length > 0 || comparison.bulletsChanged.length > 0 || comparison.bulletsAdded.length > 0 || comparison.bulletsRemoved.length > 0);

  const apply = async () => {
    setBusy(true);
    setError(null);
    const ok = await applyLibraryUpdate(entryId, {
      applyFields: [...fields],
      updateBulletIds: [...updates],
      addLibraryBulletIds: [...adds],
      removeBulletIds: [...removes],
      confirmRemovals: removes.size > 0,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
    else setError("The library changed since this comparison. Reopen to see the latest.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Library changes</DialogTitle>
          <DialogDescription>Choose which changes from the source library block to apply. Your resume-specific edits stay unless you select them.</DialogDescription>
        </DialogHeader>

        {comparison === "loading" && <p className="py-4 text-sm text-gray-500">Comparing…</p>}
        {comparison === null && <p className="py-4 text-sm text-gray-500">This entry is no longer linked to a library block.</p>}
        {comparison && comparison !== "loading" && !hasChanges && <p className="py-4 text-sm text-gray-500">This entry matches its library block.</p>}

        {comparison && comparison !== "loading" && hasChanges && (
          <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto text-sm">
            {comparison.blockFieldDiffs.length > 0 && (
              <Section title="Field changes">
                {comparison.blockFieldDiffs.map((d) => (
                  <Row key={d.field} checked={fields.has(d.field)} onChange={() => toggle(fields, setFields, d.field)}>
                    <span className="font-medium">{d.field}</span>: <span className="text-gray-400 line-through">{String(d.entryValue ?? "—")}</span> → <span>{String(d.blockValue ?? "—")}</span>
                  </Row>
                ))}
              </Section>
            )}
            {comparison.bulletsChanged.length > 0 && (
              <Section title="Updated bullets (reset to library text)">
                {comparison.bulletsChanged.map((b) => (
                  <Row key={b.entryBulletId} checked={updates.has(b.entryBulletId)} onChange={() => toggle(updates, setUpdates, b.entryBulletId)}>
                    <span className="text-gray-400 line-through">{b.entryContent}</span> → <span>{b.libraryContent}</span>
                  </Row>
                ))}
              </Section>
            )}
            {comparison.bulletsAdded.length > 0 && (
              <Section title="New library bullets">
                {comparison.bulletsAdded.map((b) => (
                  <Row key={b.id} checked={adds.has(b.id)} onChange={() => toggle(adds, setAdds, b.id)}>
                    {b.content}
                  </Row>
                ))}
              </Section>
            )}
            {comparison.bulletsRemoved.length > 0 && (
              <Section title="Removed from library (delete from resume)">
                {comparison.bulletsRemoved.map((b) => (
                  <Row key={b.entryBulletId} checked={removes.has(b.entryBulletId)} onChange={() => toggle(removes, setRemoves, b.entryBulletId)}>
                    {b.content}
                  </Row>
                ))}
              </Section>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {hasChanges && (
            <Button onClick={() => void apply()} disabled={busy}>
              {busy ? "Applying…" : "Apply selected"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">{title}</p>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Row({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-1" />
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
