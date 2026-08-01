"use client";

import { Plus, Minus, PencilLine, ArrowUpDown, Equal } from "lucide-react";
import type { ChangeKind, FieldChange, SnapshotDiff } from "@/lib/resume/version-compare";

/**
 * Read-only presentation of a snapshot diff.
 *
 * Every change kind carries an icon and a word as well as a colour, so the
 * comparison is readable without relying on colour perception — "Added" says
 * Added, it is not merely green.
 */

const KIND_META: Record<ChangeKind, { label: string; icon: typeof Plus; className: string }> = {
  added: { label: "Added", icon: Plus, className: "text-green-700 dark:text-green-400" },
  removed: { label: "Removed", icon: Minus, className: "text-red-700 dark:text-red-400" },
  changed: { label: "Changed", icon: PencilLine, className: "text-amber-700 dark:text-amber-400" },
  reordered: { label: "Moved", icon: ArrowUpDown, className: "text-blue-700 dark:text-blue-400" },
  unchanged: { label: "Unchanged", icon: Equal, className: "text-gray-400" },
};

function KindTag({ kind }: { kind: ChangeKind }) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}

function FieldChangeRow({ change }: { change: FieldChange }) {
  return (
    <li className="grid grid-cols-[8rem_1fr] gap-2 py-0.5 text-xs sm:grid-cols-[10rem_1fr_1fr]">
      <span className="text-gray-500">{change.label}</span>
      <span className="text-red-700 line-through decoration-red-400/60 dark:text-red-400">
        {change.before ?? <span className="not-italic text-gray-400 no-underline">(empty)</span>}
      </span>
      <span className="text-green-700 dark:text-green-400">
        {change.after ?? <span className="text-gray-400">(empty)</span>}
      </span>
    </li>
  );
}

export function VersionCompareView({
  diff,
  beforeLabel,
  afterLabel,
}: {
  diff: SnapshotDiff;
  beforeLabel: string;
  afterLabel: string;
}) {
  if (!diff.hasChanges) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
        No differences between {beforeLabel} and {afterLabel}.
      </p>
    );
  }

  const changedSections = diff.sections.filter((s) => s.kind !== "unchanged");

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-xs text-gray-500">
        Comparing <span className="font-medium text-gray-700 dark:text-gray-300">{beforeLabel}</span> (struck through)
        with <span className="font-medium text-gray-700 dark:text-gray-300">{afterLabel}</span>.
      </p>

      {diff.headerChanges.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Header</h4>
          <ul>
            {diff.headerChanges.map((c) => (
              <FieldChangeRow key={c.field} change={c} />
            ))}
          </ul>
        </section>
      )}

      {diff.metaChanges.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Resume settings</h4>
          <ul>
            {diff.metaChanges.map((c) => (
              <FieldChangeRow key={c.field} change={c} />
            ))}
          </ul>
        </section>
      )}

      {diff.styleChanges.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Style</h4>
          <ul>
            {diff.styleChanges.map((c) => (
              <FieldChangeRow key={c.field} change={c} />
            ))}
          </ul>
        </section>
      )}

      {changedSections.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Sections</h4>
          <ul className="flex flex-col gap-2">
            {changedSections.map((section) => (
              <li key={section.key} className="rounded-md border border-gray-100 p-2 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{section.title}</span>
                  <KindTag kind={section.kind} />
                </div>
                {section.titleChange && (
                  <ul>
                    <FieldChangeRow change={section.titleChange} />
                  </ul>
                )}
                {section.kind === "reordered" && section.fromIndex !== null && section.toIndex !== null && (
                  <p className="text-xs text-gray-500">
                    Moved from position {section.fromIndex + 1} to {section.toIndex + 1}.
                  </p>
                )}
                <ul className="mt-1 flex flex-col gap-1.5">
                  {section.entries
                    .filter((e) => e.kind !== "unchanged")
                    .map((entry) => (
                      <li key={entry.key} className="rounded border border-gray-100 p-1.5 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-700 dark:text-gray-300">{entry.label}</span>
                          <KindTag kind={entry.kind} />
                        </div>
                        {entry.kind === "reordered" && entry.fromIndex !== null && entry.toIndex !== null && (
                          <p className="text-xs text-gray-500">
                            Moved from position {entry.fromIndex + 1} to {entry.toIndex + 1}.
                          </p>
                        )}
                        {entry.fieldChanges.length > 0 && (
                          <ul className="mt-0.5">
                            {entry.fieldChanges.map((c) => (
                              <FieldChangeRow key={c.field} change={c} />
                            ))}
                          </ul>
                        )}
                        {entry.bulletChanges.some((b) => b.kind !== "unchanged") && (
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {entry.bulletChanges
                              .filter((b) => b.kind !== "unchanged")
                              .map((b, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs">
                                  <span className="shrink-0">
                                    <KindTag kind={b.kind} />
                                  </span>
                                  <span className="min-w-0">
                                    {b.kind === "changed" ? (
                                      <>
                                        <span className="text-red-700 line-through dark:text-red-400">{b.before}</span>{" "}
                                        <span className="text-green-700 dark:text-green-400">{b.after}</span>
                                      </>
                                    ) : (
                                      <span className="text-gray-700 dark:text-gray-300">{b.after ?? b.before}</span>
                                    )}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
