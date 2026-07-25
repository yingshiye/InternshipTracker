import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadLocalEnv } from "./env";

/**
 * Best-effort cleanup of the throwaway test user and its data. Deletion needs
 * the service-role key (admin API); if it isn't present in the environment we
 * skip deletion — the local DB is disposable and can be fully reset with
 * `npx supabase db reset`. Always removes the local credentials file.
 */
export default async function globalTeardown() {
  const authPath = join(process.cwd(), "e2e", ".auth-user.json");
  let userId: string | null = null;
  try {
    userId = JSON.parse(readFileSync(authPath, "utf8")).userId ?? null;
  } catch {
    return;
  }

  try {
    const env = loadLocalEnv();
    if (env.serviceRoleKey && userId) {
      // Remove the user's resume data first (FK: library blocks reference the user).
      for (const table of [
        "resume_entry_bullets",
        "resume_entries",
        "resume_sections",
        "resume_headers",
        "resume_library_bullets",
        "resume_library_blocks",
        "resumes",
      ]) {
        await fetch(`${env.url}/rest/v1/${table}?user_id=eq.${userId}`, {
          method: "DELETE",
          headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
        });
      }
      await fetch(`${env.url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}` },
      });
      console.log("e2e: deleted local test user and data");
    } else {
      console.log("e2e: no service-role key — skipping user deletion (run `supabase db reset` to fully clean).");
    }
  } finally {
    try {
      rmSync(authPath);
    } catch {
      /* ignore */
    }
  }
}
