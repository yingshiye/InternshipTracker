import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../../types/supabase";
import { isAuthorized, runCheckJobs } from "./logic";

// Minimal stand-in for the one query shape runCheckJobs issues before
// fanning out per-URL (that fan-out is exercised by the live curl checks
// documented in the PR, not here — this covers the route's top-level
// auth/error contract).
function fakeSupabase(result: { data: unknown; error: unknown }) {
  return {
    from(table: string) {
      assert.equal(table, "user_watchlist");
      return {
        select(_cols: string) {
          return Promise.resolve(result);
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

test("isAuthorized: missing header is rejected", () => {
  assert.equal(isAuthorized(null, "test-secret"), false);
});

test("isAuthorized: wrong secret is rejected", () => {
  assert.equal(isAuthorized("Bearer wrong", "test-secret"), false);
});

test("isAuthorized: correct secret is accepted", () => {
  assert.equal(isAuthorized("Bearer test-secret", "test-secret"), true);
});

test("isAuthorized: unset CRON_SECRET rejects everything, even a literal 'Bearer undefined' header", () => {
  assert.equal(isAuthorized("Bearer undefined", undefined), false);
  assert.equal(isAuthorized(null, undefined), false);
});

test("runCheckJobs: a failed watchlist query returns 500 without leaking internal error details", async () => {
  const supabase = fakeSupabase({
    data: null,
    error: { message: "relation user_watchlist does not exist", code: "42P01" },
  });

  const { status, body } = await runCheckJobs(supabase);

  assert.equal(status, 500);
  assert.equal(body.ok, false);
  assert.equal(JSON.stringify(body).includes("relation"), false);
  assert.equal(JSON.stringify(body).includes("42P01"), false);
});

test("runCheckJobs: an empty watchlist is a successful run with checked: 0", async () => {
  const supabase = fakeSupabase({ data: [], error: null });

  const { status, body } = await runCheckJobs(supabase);

  assert.equal(status, 200);
  assert.deepEqual(body, { ok: true, checked: 0 });
});
