import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "./env";

/**
 * Provisions a throwaway local test user via the Supabase signup endpoint
 * (local stack auto-confirms email when confirmations are disabled). Writes
 * the credentials to e2e/.auth-user.json (gitignored) for the specs and
 * teardown. Fails closed on a non-local Supabase URL.
 */
export default async function globalSetup() {
  const env = loadLocalEnv();
  const email = `e2e-${Date.now()}@example.com`;
  const password = "e2e-Password-123!";

  const res = await fetch(`${env.url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: env.anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`e2e: signup failed (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { user?: { id?: string } };
  const userId = body.user?.id ?? null;

  writeFileSync(join(process.cwd(), "e2e", ".auth-user.json"), JSON.stringify({ email, password, userId }, null, 2));
  console.log(`e2e: created local test user ${email}`);
}
