"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { listResumes } from "@/lib/resume/resumes";
import { listVersionSummaries, type VersionSummary } from "@/lib/resume/versions";
import { setApplicationResumeVersion, findTargetMismatches } from "@/lib/resume/applications";
import { describeRpcError } from "@/lib/resume/rpc";
import type { Resume } from "@/lib/resume/types";
import type { Tables } from "@/types/supabase";

type Application = Tables<"applications">;

/**
 * Attach an immutable `submitted` resume version to an application.
 *
 * Two routes, deliberately kept separate:
 *  - the full flow, which happens in the resume editor (confirm the target,
 *    save, preflight, create the submitted version, then attach) — this dialog
 *    only sends the user there rather than re-implementing the editor;
 *  - attaching a submitted version that already exists, for the case where the
 *    resume was prepared earlier.
 *
 * The latest draft is never attached automatically: a draft is mutable, so it
 * cannot be the record of what was actually sent.
 */
export function AttachResumeVersionDialog({
  application,
  open,
  onOpenChange,
}: {
  application: Application;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();

  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  // Keyed by the resume they belong to, so a stale list from a previous
  // selection is never shown while the new one loads.
  const [versionsFor, setVersionsFor] = useState<{ resumeId: string; rows: VersionSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingReplace, setPendingReplace] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listResumes(supabase)
      .then((rows) => !cancelled && setResumes(rows))
      .catch(() => !cancelled && setError("Your resumes could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!selectedResumeId) return;
    let cancelled = false;
    const resumeId = selectedResumeId;
    listVersionSummaries(supabase, resumeId)
      .then(
        (rows) =>
          !cancelled &&
          setVersionsFor({ resumeId, rows: rows.filter((v) => v.version_type === "submitted") }),
      )
      .catch(() => !cancelled && setError("That resume's versions could not be loaded."));
    return () => {
      cancelled = true;
    };
  }, [supabase, selectedResumeId]);

  const versions =
    selectedResumeId && versionsFor?.resumeId === selectedResumeId ? versionsFor.rows : null;

  const selectedResume = resumes?.find((r) => r.id === selectedResumeId) ?? null;
  const mismatches = selectedResume
    ? findTargetMismatches(
        { company: application.company, role: application.role },
        { target_company: selectedResume.target_company, target_role: selectedResume.target_role },
      )
    : [];

  const attach = async (versionId: string | null, confirmReplace: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await setApplicationResumeVersion(supabase, application.id, versionId, confirmReplace);
    setBusy(false);
    if (result.ok) {
      setPendingReplace(null);
      onOpenChange(false);
      router.refresh();
      return;
    }
    if (result.reason === "replacement_not_confirmed") {
      // Never silent: the user is asked before an existing link is overwritten.
      setPendingReplace(versionId);
      return;
    }
    setError(describeRpcError(result.reason));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Resume for this application</DialogTitle>
          <DialogDescription>
            {application.company} — {application.role}. An application records the exact immutable version that was
            submitted, not a draft that can still change.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {application.submitted_resume_version_id && (
            <div className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
              <span className="text-gray-700 dark:text-gray-300">A submitted version is currently attached.</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={busy}
                onClick={() => void attach(null, true)}
              >
                <Link2Off className="h-3 w-3" /> Remove link
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="attach-resume" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Resume
            </label>
            {resumes === null ? (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading resumes…
              </p>
            ) : resumes.length === 0 ? (
              <p className="text-sm text-gray-500">
                You have no resumes yet. <Link href="/resumes" className="underline">Create one first</Link>.
              </p>
            ) : (
              <select
                id="attach-resume"
                value={selectedResumeId ?? ""}
                onChange={(e) => setSelectedResumeId(e.target.value || null)}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">Choose a resume…</option>
                {resumes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedResume && mismatches.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" /> This resume is aimed somewhere else
              </p>
              <ul className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                {mismatches.map((m) => (
                  <li key={m.field}>
                    {m.field === "company" ? "Company" : "Role"}: application says{" "}
                    <span className="font-medium">{m.applicationValue}</span>, resume targets{" "}
                    <span className="font-medium">{m.resumeValue ?? "nothing"}</span>.
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Neither side is changed automatically — continue if that is intentional, or edit the resume&apos;s
                target first.
              </p>
            </div>
          )}

          {selectedResume && (
            <>
              <Button asChild variant="default" size="sm" className="gap-1.5 self-start">
                <Link href={`/resumes/${selectedResume.id}?application=${application.id}`}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open editor to prepare and submit
                </Link>
              </Button>

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Or attach an existing submitted version
                </p>
                {versions === null ? (
                  <p className="text-sm text-gray-500">Loading versions…</p>
                ) : versions.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    This resume has no submitted versions yet. Use the editor flow above to create one.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-gray-100 px-2.5 py-1.5 text-sm dark:border-gray-800"
                      >
                        <span>
                          Version {v.version_number}
                          <span className="ml-2 text-xs text-gray-500">
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={busy || v.id === application.submitted_resume_version_id}
                          onClick={() => void attach(v.id, false)}
                        >
                          {v.id === application.submitted_resume_version_id ? "Attached" : "Attach"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {pendingReplace !== null && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p className="font-medium text-amber-900 dark:text-amber-200">Replace the attached version?</p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                This application already points at a submitted version. Replacing it changes the record of what was
                sent. The old version is not deleted.
              </p>
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setPendingReplace(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void attach(pendingReplace, true)} disabled={busy}>
                  Replace
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
