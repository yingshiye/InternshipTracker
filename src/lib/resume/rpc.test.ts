import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { callResumeRpc } from "./rpc";

function fakeSupabase(result: { data: unknown; error: unknown }, expectedFn?: string, expectedArgs?: unknown) {
  return {
    rpc(fn: string, args: unknown) {
      if (expectedFn) assert.equal(fn, expectedFn);
      if (expectedArgs) assert.deepEqual(args, expectedArgs);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient<Database>;
}

test("callResumeRpc: calls .rpc() with the exact function name and args given", async () => {
  const supabase = fakeSupabase(
    { data: 3, error: null },
    "update_resume_metadata",
    { p_resume_id: "r1", p_expected_revision: 2, p_name: "x", p_target_company: null, p_target_role: null },
  );
  const result = await callResumeRpc(supabase, "update_resume_metadata", {
    p_resume_id: "r1",
    p_expected_revision: 2,
    p_name: "x",
    p_target_company: null,
    p_target_role: null,
  });
  assert.deepEqual(result, { ok: true, data: 3 });
});

test("callResumeRpc: maps a revision_conflict exception to a typed result", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "revision_conflict" } });
  const result = await callResumeRpc(supabase, "update_resume_style", {
    p_resume_id: "r1",
    p_expected_revision: 1,
    p_style_settings: {},
  });
  assert.deepEqual(result, { ok: false, reason: "revision_conflict", message: "revision_conflict" });
});

test("callResumeRpc: maps resume_not_found", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "resume_not_found" } });
  const result = await callResumeRpc(supabase, "delete_resume", { p_resume_id: "r1", p_expected_revision: 1 });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, "resume_not_found");
});

test("callResumeRpc: maps has_versions", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "has_versions" } });
  const result = await callResumeRpc(supabase, "delete_resume", { p_resume_id: "r1", p_expected_revision: 1 });
  assert.equal(!result.ok && result.reason, "has_versions");
});

test("callResumeRpc: maps layout_kind_mismatch", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "layout_kind_mismatch" } });
  const result = await callResumeRpc(supabase, "move_entry", {
    p_resume_id: "r1",
    p_expected_revision: 1,
    p_entry_id: "e1",
    p_target_section_id: "s1",
  });
  assert.equal(!result.ok && result.reason, "layout_kind_mismatch");
});

test("callResumeRpc: maps invalid_reorder_set", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "invalid_reorder_set" } });
  const result = await callResumeRpc(supabase, "reorder_sections", {
    p_resume_id: "r1",
    p_expected_revision: 1,
    p_ordered_section_ids: [],
  });
  assert.equal(!result.ok && result.reason, "invalid_reorder_set");
});

test("callResumeRpc: an unrecognized error message maps to reason 'unknown' rather than being silently swallowed", async () => {
  const supabase = fakeSupabase({ data: null, error: { message: "relation resumes does not exist" } });
  const result = await callResumeRpc(supabase, "create_resume", { p_name: "x" });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.reason, "unknown");
  assert.equal(!result.ok && result.message, "relation resumes does not exist");
});
