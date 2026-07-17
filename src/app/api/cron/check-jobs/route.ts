import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_CONCURRENCY = 5;
const MIN_RECHECK_MS = 20 * 60 * 60 * 1000;

async function hashContent(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function checkUrl(
  url: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const { data: snapshot } = await supabase
    .from("url_snapshots")
    .select("*")
    .eq("url", url)
    .maybeSingle();

  if (
    snapshot?.last_checked &&
    Date.now() - new Date(snapshot.last_checked).getTime() < MIN_RECHECK_MS
  ) {
    return;
  }

  let text: string;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      console.error(`check-jobs: ${url} returned ${response.status}`);
      return;
    }
    text = await response.text();
  } catch (err) {
    console.error(`check-jobs: failed to fetch ${url}`, err);
    return;
  }

  const newHash = await hashContent(text);
  const previousHash = snapshot?.content_hash ?? null;

  await supabase
    .from("url_snapshots")
    .upsert(
      { url, content_hash: newHash, last_checked: new Date().toISOString() },
      { onConflict: "url" }
    );

  if (previousHash !== null && previousHash !== newHash) {
    // notified_hash may be null (never marked as seen) — a plain `neq` filter
    // would exclude those rows since `null <> x` is never true in SQL.
    await supabase
      .from("user_watchlist")
      .update({ has_changes: true })
      .eq("url", url)
      .or(`notified_hash.is.null,notified_hash.neq.${newHash}`);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: rows } = await supabase.from("user_watchlist").select("url");
  const urls = Array.from(new Set((rows ?? []).map((r) => r.url)));

  let checked = 0;
  for (let i = 0; i < urls.length; i += MAX_CONCURRENCY) {
    const batch = urls.slice(i, i + MAX_CONCURRENCY);
    await Promise.all(
      batch.map(async (url) => {
        await checkUrl(url, supabase);
        checked += 1;
      })
    );
  }

  return NextResponse.json({ ok: true, checked });
}
