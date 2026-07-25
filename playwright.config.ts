import { defineConfig, devices } from "@playwright/test";

/**
 * Step 2 browser suite — Chromium only, local-only.
 *
 * Requires a running local Supabase stack (`npx supabase start`) and a
 * worktree `.env.local` pointing at it. `global-setup.ts` fails the whole run
 * closed if NEXT_PUBLIC_SUPABASE_URL is not a local host, so these tests can
 * never touch a hosted Supabase project. The dev server is started
 * automatically via `webServer` below.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
