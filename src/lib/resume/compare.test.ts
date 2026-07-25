import { test } from "node:test";
import assert from "node:assert/strict";
import { diffEntryAgainstLibrary } from "./compare";

const baseEntry = {
  title: "Software Engineer Intern",
  subtitle: null,
  organization: "Acme",
  location: "Remote",
  start_date: "2025-06-01",
  end_date: "2025-08-31",
  education_data: null,
  skills_data: null,
};

const baseBlock = { ...baseEntry };

test("diffEntryAgainstLibrary: no differences when entry matches its source block exactly", () => {
  const result = diffEntryAgainstLibrary(baseEntry, [], baseBlock, []);
  assert.equal(result.blockChanged, false);
  assert.deepEqual(result.blockFieldDiffs, []);
});

test("diffEntryAgainstLibrary: detects a changed scalar field", () => {
  const result = diffEntryAgainstLibrary(baseEntry, [], { ...baseBlock, title: "Senior SWE Intern" }, []);
  assert.equal(result.blockChanged, true);
  assert.deepEqual(result.blockFieldDiffs, [
    { field: "title", entryValue: "Software Engineer Intern", blockValue: "Senior SWE Intern" },
  ]);
});

test("diffEntryAgainstLibrary: detects a changed education_data/skills_data field via deep comparison", () => {
  const result = diffEntryAgainstLibrary(
    { ...baseEntry, skills_data: { categories: [{ label: "Languages", items: ["Python"] }] } },
    [],
    { ...baseBlock, skills_data: { categories: [{ label: "Languages", items: ["Python", "Java"] }] } },
    [],
  );
  assert.equal(result.blockChanged, true);
  assert.equal(result.blockFieldDiffs.some((d) => d.field === "skills_data"), true);
});

test("diffEntryAgainstLibrary: a library bullet not yet copied shows up in bulletsAdded", () => {
  const result = diffEntryAgainstLibrary(baseEntry, [], baseBlock, [
    { id: "lb1", content: "New library bullet" },
  ]);
  assert.deepEqual(result.bulletsAdded, [{ id: "lb1", content: "New library bullet" }]);
});

test("diffEntryAgainstLibrary: a copied bullet whose source no longer exists shows up in bulletsRemoved", () => {
  const result = diffEntryAgainstLibrary(
    baseEntry,
    [{ id: "eb1", content: "Old bullet", source_bullet_id: "lb-deleted" }],
    baseBlock,
    [],
  );
  assert.deepEqual(result.bulletsRemoved, [{ entryBulletId: "eb1", content: "Old bullet" }]);
});

test("diffEntryAgainstLibrary: a copied bullet whose library content changed shows up in bulletsChanged", () => {
  const result = diffEntryAgainstLibrary(
    baseEntry,
    [{ id: "eb1", content: "Shipped a thing", source_bullet_id: "lb1" }],
    baseBlock,
    [{ id: "lb1", content: "Shipped a thing end to end" }],
  );
  assert.deepEqual(result.bulletsChanged, [
    { entryBulletId: "eb1", entryContent: "Shipped a thing", libraryContent: "Shipped a thing end to end" },
  ]);
});

test("diffEntryAgainstLibrary: an unchanged copied bullet does not appear in bulletsChanged", () => {
  const result = diffEntryAgainstLibrary(
    baseEntry,
    [{ id: "eb1", content: "Shipped a thing", source_bullet_id: "lb1" }],
    baseBlock,
    [{ id: "lb1", content: "Shipped a thing" }],
  );
  assert.deepEqual(result.bulletsChanged, []);
});

test("diffEntryAgainstLibrary: a bullet with no source_bullet_id (hand-edited, unlinked) is ignored in bulletsRemoved/bulletsChanged", () => {
  const result = diffEntryAgainstLibrary(
    baseEntry,
    [{ id: "eb1", content: "Hand-written bullet", source_bullet_id: null }],
    baseBlock,
    [],
  );
  assert.deepEqual(result.bulletsRemoved, []);
  assert.deepEqual(result.bulletsChanged, []);
});
