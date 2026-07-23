import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { addBulletFromLibrary, copyBlockIntoSection, saveBulletAsLibraryBullet, updateEntry } from "./entries";

function fakeRpc(expectedFn: string, expectedArgs: unknown, result: { data: unknown; error: unknown }) {
  return {
    rpc(fn: string, args: unknown) {
      assert.equal(fn, expectedFn);
      assert.deepEqual(args, expectedArgs);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient<Database>;
}

test("copyBlockIntoSection: passes section, block, and selected bullet ids through", async () => {
  const supabase = fakeRpc(
    "copy_block_into_section",
    { p_resume_id: "r1", p_expected_revision: 1, p_section_id: "s1", p_block_id: "b1", p_bullet_ids: ["lb1", "lb2"] },
    { data: [{ entry_id: "e1", revision: 2 }], error: null },
  );
  const result = await copyBlockIntoSection(supabase, "r1", 1, "s1", "b1", ["lb1", "lb2"]);
  assert.deepEqual(result, { ok: true, data: [{ entry_id: "e1", revision: 2 }] });
});

test("updateEntry: validates education_data/skills_data and normalizes optional text before calling the RPC", async () => {
  const supabase = fakeRpc(
    "update_entry",
    {
      p_resume_id: "r1",
      p_expected_revision: 1,
      p_entry_id: "e1",
      p_title: "Software Engineer",
      p_subtitle: null,
      p_organization: null,
      p_location: null,
      p_start_date: null,
      p_end_date: null,
      p_education_data: {},
      p_skills_data: null,
    },
    { data: 2, error: null },
  );
  const result = await updateEntry(supabase, "r1", 1, "e1", { title: "  Software Engineer  ", educationData: {} });
  assert.deepEqual(result, { ok: true, data: 2 });
});

test("addBulletFromLibrary: passes entry id and library bullet id through", async () => {
  const supabase = fakeRpc(
    "add_bullet_from_library",
    { p_resume_id: "r1", p_expected_revision: 1, p_entry_id: "e1", p_library_bullet_id: "lb1" },
    { data: [{ bullet_id: "eb1", revision: 2 }], error: null },
  );
  const result = await addBulletFromLibrary(supabase, "r1", 1, "e1", "lb1");
  assert.deepEqual(result, { ok: true, data: [{ bullet_id: "eb1", revision: 2 }] });
});

test("addBulletFromLibrary: maps no_source_block to a typed result", async () => {
  const supabase = fakeRpc(
    "add_bullet_from_library",
    { p_resume_id: "r1", p_expected_revision: 1, p_entry_id: "e1", p_library_bullet_id: "lb1" },
    { data: null, error: { message: "no_source_block" } },
  );
  const result = await addBulletFromLibrary(supabase, "r1", 1, "e1", "lb1");
  assert.deepEqual(result, { ok: false, reason: "no_source_block", message: "no_source_block" });
});

test("saveBulletAsLibraryBullet: writes to the library via a direct insert, not an RPC — no resume_id or revision involved", async () => {
  let insertedRow: unknown;
  const supabase = {
    from(table: string) {
      assert.equal(table, "resume_library_bullets");
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return { limit: () => Promise.resolve({ data: [], error: null }) };
                },
              };
            },
          };
        },
        insert(row: unknown) {
          insertedRow = row;
          return {
            select() {
              return { single: () => Promise.resolve({ data: { id: "lb-new", ...(row as object) }, error: null }) };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;

  const result = await saveBulletAsLibraryBullet(supabase, "user-1", "block-1", "  A new reusable bullet  ");
  assert.deepEqual(insertedRow, {
    user_id: "user-1",
    block_id: "block-1",
    content: "A new reusable bullet",
    sort_order: 1,
  });
  assert.equal(result.id, "lb-new");
});
