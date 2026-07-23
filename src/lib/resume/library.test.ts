import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { createLibraryBlock, reorderLibraryBullets } from "./library";
import { ValidationError } from "./validate";

test("createLibraryBlock: only validates education_data when layout_kind is 'education'", async () => {
  let insertedRow: Record<string, unknown> = {};
  const supabase = {
    from() {
      return {
        insert(row: Record<string, unknown>) {
          insertedRow = row;
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "b1", ...row }, error: null }) }) };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;

  await createLibraryBlock(supabase, "user-1", {
    name: "Google SWE",
    defaultSectionTitle: "Experience",
    layoutKind: "entry",
    title: "Software Engineer",
    // Not a valid skills_data shape — must be ignored since layoutKind is "entry".
    skillsData: { not: "valid" },
  });

  assert.equal(insertedRow.layout_kind, "entry");
  assert.equal(insertedRow.skills_data, null);
  assert.equal(insertedRow.education_data, null);
});

test("createLibraryBlock: validates skills_data when layout_kind is 'skills'", async () => {
  const supabase = {
    from() {
      return {
        insert() {
          return { select: () => ({ single: () => Promise.resolve({ data: {}, error: null }) }) };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;

  await assert.rejects(
    () =>
      createLibraryBlock(supabase, "user-1", {
        name: "Skills block",
        defaultSectionTitle: "Skills",
        layoutKind: "skills",
        skillsData: { categories: [{ label: "", items: ["Python"] }] },
      }),
    ValidationError,
  );
});

test("reorderLibraryBullets: renumbers sort_order to match the given order, scoped to the block", async () => {
  const calls: { id: string; sortOrder: number; blockId: string }[] = [];
  const supabase = {
    from() {
      return {
        update(patch: { sort_order: number }) {
          let id = "";
          let blockId = "";
          const builder = {
            eq(col: string, value: string) {
              if (col === "id") id = value;
              if (col === "block_id") blockId = value;
              return builder;
            },
            then(resolve: (r: { data: null; error: null }) => void) {
              calls.push({ id, sortOrder: patch.sort_order, blockId });
              resolve({ data: null, error: null });
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient<Database>;

  await reorderLibraryBullets(supabase, "block-1", ["b3", "b1", "b2"]);

  assert.deepEqual(calls, [
    { id: "b3", sortOrder: 1, blockId: "block-1" },
    { id: "b1", sortOrder: 2, blockId: "block-1" },
    { id: "b2", sortOrder: 3, blockId: "block-1" },
  ]);
});
