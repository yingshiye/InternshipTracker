"use client";

import { useCallback, useState } from "react";

/**
 * localStorage-backed dismissal of resume-check findings. UI-preference only —
 * Supabase remains the source of truth for all resume content. We store only
 * finding fingerprints (hashes), never any resume text. A finding reappears
 * when its fingerprint changes (problem changed) or severity changes; resolved
 * findings are pruned from the stored set. Storage failures degrade to an
 * in-memory set so the feature still works when localStorage is unavailable.
 */
function storageKey(userId: string, resumeId: string): string {
  return `resume-check:dismissed:v1:${userId}:${resumeId}`;
}

function safeRead(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function safeWrite(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / unavailable — session-memory only */
  }
}

export function useDismissedFindings(userId: string, resumeId: string) {
  const key = storageKey(userId, resumeId);
  // Lazy init reads localStorage on the client's first render (empty during
  // SSR). userId/resumeId are stable for the editor's lifetime, so there's no
  // need to reload on key change.
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : new Set(safeRead(key)),
  );

  const isDismissed = useCallback((fingerprint: string) => dismissed.has(fingerprint), [dismissed]);

  const dismiss = useCallback(
    (fingerprint: string) => {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(fingerprint);
        safeWrite(key, [...next]);
        return next;
      });
    },
    [key],
  );

  const restoreAll = useCallback(() => {
    setDismissed(new Set());
    safeWrite(key, []);
  }, [key]);

  /** Drop any stored fingerprints that are no longer among active findings. */
  const pruneTo = useCallback(
    (activeFingerprints: Set<string>) => {
      setDismissed((prev) => {
        const next = new Set([...prev].filter((f) => activeFingerprints.has(f)));
        if (next.size !== prev.size) safeWrite(key, [...next]);
        return next;
      });
    },
    [key],
  );

  return { isDismissed, dismiss, restoreAll, pruneTo, dismissedCount: dismissed.size };
}
