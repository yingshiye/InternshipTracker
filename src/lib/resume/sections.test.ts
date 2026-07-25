import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createSection, deleteSection, reorderSections } from "./sections";
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

test("createSection: rejects an invalid layout_kind before calling the RPC", async () => {
  await assert.rejects(
    () => createSection(neverCalled, "r1", 1, { title: "Experience", layoutKind: "bogus" as never }),
    ValidationError,
  );
});

test("createSection: calls the RPC with the trimmed title and given layout_kind", async () => {
  const supabase = fakeRpc(
    "create_section",
    { p_resume_id: "r1", p_expected_revision: 1, p_title: "Experience", p_layout_kind: "entry" },
    { data: [{ section_id: "s1", revision: 2 }], error: null },
  );
  const result = await createSection(supabase, "r1", 1, { title: "  Experience  ", layoutKind: "entry" });
  assert.deepEqual(result, { ok: true, data: [{ section_id: "s1", revision: 2 }] });
});

test("deleteSection: maps section_not_empty to a typed result", async () => {
  const supabase = fakeRpc(
    "delete_section",
    { p_resume_id: "r1", p_expected_revision: 1, p_section_id: "s1" },
    { data: null, error: { message: "section_not_empty" } },
  );
  const result = await deleteSection(supabase, "r1", 1, "s1");
  assert.deepEqual(result, { ok: false, reason: "section_not_empty", message: "section_not_empty" });
});

test("reorderSections: passes the ordered id array straight through", async () => {
  const supabase = fakeRpc(
    "reorder_sections",
    { p_resume_id: "r1", p_expected_revision: 4, p_ordered_section_ids: ["s2", "s1"] },
    { data: 5, error: null },
  );
  const result = await reorderSections(supabase, "r1", 4, ["s2", "s1"]);
  assert.deepEqual(result, { ok: true, data: 5 });
});
