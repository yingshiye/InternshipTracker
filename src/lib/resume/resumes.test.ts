import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createResume, deleteResume, duplicateResume, updateResumeHeader, updateResumeMetadata, updateResumeTargetLength } from "./resumes";
import { ValidationError } from "./validate";

function fakeRpc(expectedFn: string, expectedArgs: unknown, result: { data: unknown; error: unknown }) {
  return {
    rpc(fn: string, args: unknown) {
      assert.equal(fn, expectedFn);
      assert.deepEqual(args, expectedArgs);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient<Database>;
}

const neverCalled = { rpc() { throw new Error("should not be called"); } } as unknown as SupabaseClient<Database>;

test("createResume: trims the name and normalizes blank target fields to null", async () => {
  const supabase = fakeRpc(
    "create_resume",
    { p_name: "My Resume", p_target_company: null, p_target_role: null },
    { data: [{ resume_id: "r1", revision: 1 }], error: null },
  );
  const result = await createResume(supabase, { name: "  My Resume  ", targetCompany: "  ", targetRole: undefined });
  assert.deepEqual(result, { ok: true, data: [{ resume_id: "r1", revision: 1 }] });
});

test("updateResumeMetadata: passes expected_revision through and maps a stale revision to a typed conflict", async () => {
  const supabase = fakeRpc(
    "update_resume_metadata",
    { p_resume_id: "r1", p_expected_revision: 3, p_name: "New name", p_target_company: null, p_target_role: null },
    { data: null, error: { message: "revision_conflict" } },
  );
  const result = await updateResumeMetadata(supabase, "r1", 3, { name: "New name" });
  assert.deepEqual(result, { ok: false, reason: "revision_conflict", message: "revision_conflict" });
});

test("updateResumeTargetLength: rejects an invalid target_length before ever calling the RPC", async () => {
  await assert.rejects(() => updateResumeTargetLength(neverCalled, "r1", 1, "three_pages" as never), ValidationError);
});

test("deleteResume: passes resume id and expected revision through", async () => {
  const supabase = fakeRpc(
    "delete_resume",
    { p_resume_id: "r1", p_expected_revision: 5 },
    { data: [{ deleted: true }], error: null },
  );
  const result = await deleteResume(supabase, "r1", 5);
  assert.deepEqual(result, { ok: true, data: [{ deleted: true }] });
});

test("deleteResume: maps has_versions to a typed result rather than a raw Postgres error", async () => {
  const supabase = fakeRpc(
    "delete_resume",
    { p_resume_id: "r1", p_expected_revision: 5 },
    { data: null, error: { message: "has_versions" } },
  );
  const result = await deleteResume(supabase, "r1", 5);
  assert.deepEqual(result, { ok: false, reason: "has_versions", message: "has_versions" });
});

test("duplicateResume: sends p_new_name as null when no name is given", async () => {
  const supabase = fakeRpc("duplicate_resume", { p_source_resume_id: "r1", p_new_name: null }, { data: "r2", error: null });
  const result = await duplicateResume(supabase, "r1");
  assert.deepEqual(result, { ok: true, data: "r2" });
});

test("updateResumeHeader: validates custom_links and normalizes optional URL fields", async () => {
  const supabase = fakeRpc(
    "update_resume_header",
    {
      p_resume_id: "r1",
      p_expected_revision: 1,
      p_full_name: "Jane Doe",
      p_email: null,
      p_phone: null,
      p_location: null,
      p_linkedin_url: "https://linkedin.com/in/jane",
      p_github_url: null,
      p_portfolio_url: null,
      p_custom_links: { links: [{ label: "Blog", url: "https://jane.dev/blog" }] },
    },
    { data: 2, error: null },
  );
  const result = await updateResumeHeader(supabase, "r1", 1, {
    fullName: "Jane Doe",
    linkedinUrl: "linkedin.com/in/jane",
    customLinks: { links: [{ label: "Blog", url: "jane.dev/blog" }] },
  });
  assert.deepEqual(result, { ok: true, data: 2 });
});

test("updateResumeHeader: rejects a disallowed URL scheme before calling the RPC", async () => {
  await assert.rejects(
    () => updateResumeHeader(neverCalled, "r1", 1, { portfolioUrl: "javascript:alert(1)" }),
    ValidationError,
  );
});
