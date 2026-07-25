import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Loads the worktree `.env.local` and returns the local Supabase config. FAILS
 * CLOSED: if the Supabase URL is not a local host (127.0.0.1 / localhost),
 * this throws and aborts the whole Playwright run. The browser suite must
 * never run against a hosted Supabase project.
 */
export type LocalEnv = { url: string; anonKey: string; serviceRoleKey: string | null };

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  let raw = "";
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function loadLocalEnv(): LocalEnv {
  const fromFile = parseEnvFile(join(process.cwd(), ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fromFile.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fromFile.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fromFile.SUPABASE_SERVICE_ROLE_KEY || null;

  if (!url || !anonKey) {
    throw new Error("e2e: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (checked env and .env.local).");
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
    throw new Error(`e2e: refusing to run against a non-local Supabase URL: ${url}`);
  }
  return { url, anonKey, serviceRoleKey };
}
