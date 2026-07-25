import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { addCustomEntry, addCustomBullet, moveEntryToPosition, applyLibraryUpdate, restoreEntry, restoreBullet } from "./entries";
import { restoreSection } from "./sections";

function fakeRpc(expectedFn: string, expectedArgs: unknown, result: { data: unknown; error: unknown }) {
  return {
    rpc(fn: string, args: unknown) {
      assert.equal(fn, expectedFn);
      assert.deepEqual(args, expectedArgs);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient<Database>;
}

test("addCustomEntry: normalizes text and sends null education/skills for a bare entry", async () => {
  const supabase = fakeRpc(
    "add_custom_entry",
    {
      p_resume_id: "r1", p_expected_revision: 2, p_section_id: "s1",
      p_title: "Engineer", p_subtitle: null, p_organization: null, p_location: null,
      p_start_date: null, p_end_date: null, p_education_data: null, p_skills_data: null,
    },
    { data: [{ entry_id: "e9", revision: 3 }], error: null },
  );
  const res = await addCustomEntry(supabase, "r1", 2, "s1", { title: "  Engineer  " });
  assert.deepEqual(res, { ok: true, data: [{ entry_id: "e9", revision: 3 }] });
});

test("addCustomBullet: normalizes content and passes it through", async () => {
  const supabase = fakeRpc(
    "add_custom_bullet",
    { p_resume_id: "r1", p_expected_revision: 4, p_entry_id: "e1", p_content: "A bullet" },
    { data: [{ bullet_id: "b9", revision: 5 }], error: null },
  );
  const res = await addCustomBullet(supabase, "r1", 4, "e1", "  A bullet  ");
  assert.deepEqual(res, { ok: true, data: [{ bullet_id: "b9", revision: 5 }] });
});

test("moveEntryToPosition: passes the complete target ordering through", async () => {
  const supabase = fakeRpc(
    "move_entry_to_position",
    { p_resume_id: "r1", p_expected_revision: 6, p_entry_id: "e1", p_target_section_id: "s2", p_ordered_entry_ids: ["e2", "e1"] },
    { data: [{ revision: 7, section_id: "s2", ordered_entry_ids: ["e2", "e1"] }], error: null },
  );
  const res = await moveEntryToPosition(supabase, "r1", 6, "e1", "s2", ["e2", "e1"]);
  assert.equal(res.ok, true);
});

test("applyLibraryUpdate: forwards the selection arrays and confirm flag", async () => {
  const supabase = fakeRpc(
    "apply_library_update",
    {
      p_resume_id: "r1", p_expected_revision: 8, p_entry_id: "e1",
      p_apply_fields: ["title"], p_update_bullet_ids: ["b1"], p_add_library_bullet_ids: ["lb1"],
      p_remove_bullet_ids: ["b2"], p_confirm_removals: true,
    },
    { data: [{ revision: 9, fields_applied: 1, bullets_updated: 1, bullets_added: 1, bullets_removed: 1 }], error: null },
  );
  const res = await applyLibraryUpdate(supabase, "r1", 8, "e1", {
    applyFields: ["title"], updateBulletIds: ["b1"], addLibraryBulletIds: ["lb1"], removeBulletIds: ["b2"], confirmRemovals: true,
  });
  assert.equal(res.ok, true);
});

test("applyLibraryUpdate: maps a stale-source error to a typed result", async () => {
  const supabase = fakeRpc(
    "apply_library_update",
    {
      p_resume_id: "r1", p_expected_revision: 8, p_entry_id: "e1",
      p_apply_fields: [], p_update_bullet_ids: [], p_add_library_bullet_ids: ["gone"],
      p_remove_bullet_ids: [], p_confirm_removals: false,
    },
    { data: null, error: { message: "invalid_selection" } },
  );
  const res = await applyLibraryUpdate(supabase, "r1", 8, "e1", {
    applyFields: [], updateBulletIds: [], addLibraryBulletIds: ["gone"], removeBulletIds: [], confirmRemovals: false,
  });
  assert.deepEqual(res, { ok: false, reason: "invalid_selection", message: "invalid_selection" });
});

test("restoreEntry: sends the section, position, fields, source block, and bullets snapshot", async () => {
  const supabase = fakeRpc(
    "restore_entry",
    {
      p_resume_id: "r1", p_expected_revision: 10, p_section_id: "s1", p_position: 2,
      p_title: "T", p_subtitle: null, p_organization: "O", p_location: null,
      p_start_date: "2025-06-01", p_end_date: null, p_education_data: null, p_skills_data: null,
      p_source_block_id: "blk1", p_bullets: [{ content: "one", source_bullet_id: "lb1" }],
    },
    { data: [{ entry_id: "e9", bullet_ids: ["b9"], revision: 11 }], error: null },
  );
  const res = await restoreEntry(supabase, "r1", 10, {
    sectionId: "s1", position: 2, title: "T", subtitle: null, organization: "O", location: null,
    startDate: "2025-06-01", endDate: null, educationData: null, skillsData: null,
    sourceBlockId: "blk1", bullets: [{ content: "one", source_bullet_id: "lb1" }],
  });
  assert.equal(res.ok, true);
});

test("restoreBullet: sends position, content, and source", async () => {
  const supabase = fakeRpc(
    "restore_bullet",
    { p_resume_id: "r1", p_expected_revision: 12, p_entry_id: "e1", p_position: 1, p_content: "text", p_source_bullet_id: null },
    { data: [{ bullet_id: "b9", revision: 13 }], error: null },
  );
  const res = await restoreBullet(supabase, "r1", 12, "e1", 1, "text", null);
  assert.equal(res.ok, true);
});

test("restoreSection: validates layout kind and sends position/title/kind", async () => {
  const supabase = fakeRpc(
    "restore_section",
    { p_resume_id: "r1", p_expected_revision: 14, p_position: 3, p_title: "Awards", p_layout_kind: "entry" },
    { data: [{ section_id: "s9", revision: 15 }], error: null },
  );
  const res = await restoreSection(supabase, "r1", 14, { position: 3, title: "Awards", layoutKind: "entry" });
  assert.equal(res.ok, true);
});
