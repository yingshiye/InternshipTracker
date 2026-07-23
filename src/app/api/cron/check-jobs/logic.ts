import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../types/supabase";
import { normalizeUrl } from "../../../../lib/url";

type Supa = SupabaseClient<Database>;

const MAX_CONCURRENCY = 5;
const MIN_RECHECK_MS = 20 * 60 * 60 * 1000;

export function isAuthorized(
  authHeader: string | null,
  cronSecret: string | undefined
): boolean {
  return !!cronSecret && authHeader === `Bearer ${cronSecret}`;
}

async function hashContent(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checkUrl(rawUrl: string, supabase: Supa): Promise<{ ok: boolean }> {
  let url: string;
  try {
    url = normalizeUrl(rawUrl);
  } catch (err) {
    console.error(`check-jobs: skipping unnormalizable url ${rawUrl}`, err);
    return { ok: true };
  }

  const { data: snapshot, error: selectError } = await supabase
    .from("url_snapshots")
    .select("*")
    .eq("url", url)
    .maybeSingle();

  if (selectError) {
    console.error(`check-jobs: failed to read snapshot for ${url}`, selectError);
    return { ok: false };
  }

  if (
    snapshot?.last_checked &&
    Date.now() - new Date(snapshot.last_checked).getTime() < MIN_RECHECK_MS
  ) {
    return { ok: true };
  }

  let text: string;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.error(`check-jobs: ${url} returned ${response.status}`);
      return { ok: true };
    }
    text = await response.text();
  } catch (err) {
    console.error(`check-jobs: failed to fetch ${url}`, err);
    return { ok: true };
  }

  const newHash = await hashContent(text);
  const previousHash = snapshot?.content_hash ?? null;

  const { error: upsertError } = await supabase.from("url_snapshots").upsert(
    { url, content_hash: newHash, last_checked: new Date().toISOString() },
    { onConflict: "url" }
  );

  if (upsertError) {
    console.error(`check-jobs: failed to upsert snapshot for ${url}`, upsertError);
    return { ok: false };
  }

  if (previousHash !== null && previousHash !== newHash) {
    const { error: updateError } = await supabase
      .from("user_watchlist")
      .update({ has_changes: true })
      .eq("url", url);

    if (updateError) {
      console.error(
        `check-jobs: failed to flag watchlist rows for ${url}`,
        updateError
      );
      return { ok: false };
    }
  }

  return { ok: true };
}

export type CheckJobsResult = { status: number; body: Record<string, unknown> };

export async function runCheckJobs(supabase: Supa): Promise<CheckJobsResult> {
  const { data: rows, error: rowsError } = await supabase
    .from("user_watchlist")
    .select("url");

  if (rowsError) {
    console.error("check-jobs: failed to list watchlist urls", rowsError);
    return { status: 500, body: { ok: false, error: "Internal server error" } };
  }

  const urls = Array.from(new Set((rows ?? []).map((r) => r.url)));

  let checked = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i += MAX_CONCURRENCY) {
    const batch = urls.slice(i, i + MAX_CONCURRENCY);
    const results = await Promise.all(batch.map((url) => checkUrl(url, supabase)));
    for (const result of results) {
      if (result.ok) checked += 1;
      else failed += 1;
    }
  }

  if (failed > 0) {
    console.error(`check-jobs: ${failed} of ${urls.length} url checks failed`);
    return {
      status: 500,
      body: { ok: false, error: "Internal server error", checked, failed },
    };
  }

  return { status: 200, body: { ok: true, checked } };
}
