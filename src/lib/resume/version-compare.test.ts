import { test } from "node:test";
import assert from "node:assert/strict";
import { compareSnapshots } from "./version-compare";
import { parseSnapshot, type ParsedSnapshot } from "./snapshot";

type SectionSpec = {
  title: string;
  layout?: "entry" | "education" | "skills";
  entries?: { title?: string; organization?: string; location?: string; bullets?: string[] }[];
};

function snap(
  sections: SectionSpec[],
  overrides: { header?: Record<string, unknown>; resume?: Record<string, unknown> } = {},
): ParsedSnapshot {
  const res = parseSnapshot({
    snapshot_schema_version: 1,
    resume: {
      name: "R",
      target_company: "Acme",
      target_role: "SWE",
      style_settings: {},
      target_length: "one_page",
      ...overrides.resume,
    },
    header: { full_name: "Ada", email: "ada@example.com", custom_links: { links: [] }, ...overrides.header },
    sections: sections.map((s, i) => ({
      title: s.title,
      layout_kind: s.layout ?? "entry",
      sort_order: i + 1,
      entries: (s.entries ?? []).map((e, j) => ({
        title: e.title ?? null,
        organization: e.organization ?? null,
        location: e.location ?? null,
        sort_order: j + 1,
        bullets: (e.bullets ?? []).map((c, k) => ({ content: c, sort_order: k + 1 })),
      })),
    })),
  });
  if (!res.ok) throw new Error("fixture did not parse");
  return res.snapshot;
}

test("identical snapshots report no changes", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "Engineer", bullets: ["Did a thing"] }] }]);
  const b = snap([{ title: "Experience", entries: [{ title: "Engineer", bullets: ["Did a thing"] }] }]);
  const diff = compareSnapshots(a, b);
  assert.equal(diff.hasChanges, false);
  assert.equal(diff.sections[0].kind, "unchanged");
});

test("a moved section is reordered, not removed and re-added", () => {
  const a = snap([{ title: "Experience" }, { title: "Education", layout: "education" }]);
  const b = snap([{ title: "Education", layout: "education" }, { title: "Experience" }]);
  const diff = compareSnapshots(a, b);
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.sections.filter((s) => s.kind === "removed").length, 0);
  assert.equal(diff.sections.filter((s) => s.kind === "added").length, 0);
  assert.equal(diff.sections.filter((s) => s.kind === "reordered").length, 2);
});

test("a moved entry is reordered, not removed and re-added", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "A" }, { title: "B" }] }]);
  const b = snap([{ title: "Experience", entries: [{ title: "B" }, { title: "A" }] }]);
  const entries = compareSnapshots(a, b).sections[0].entries;
  assert.equal(entries.filter((e) => e.kind === "removed").length, 0);
  assert.equal(entries.filter((e) => e.kind === "added").length, 0);
  assert.equal(entries.filter((e) => e.kind === "reordered").length, 2);
  const moved = entries.find((e) => e.label === "A")!;
  assert.equal(moved.fromIndex, 0);
  assert.equal(moved.toIndex, 1);
});

test("a moved bullet is reordered, not removed and re-added", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "A", bullets: ["one", "two"] }] }]);
  const b = snap([{ title: "Experience", entries: [{ title: "A", bullets: ["two", "one"] }] }]);
  const bullets = compareSnapshots(a, b).sections[0].entries[0].bulletChanges;
  assert.equal(bullets.filter((x) => x.kind === "removed").length, 0);
  assert.equal(bullets.filter((x) => x.kind === "added").length, 0);
  assert.equal(bullets.filter((x) => x.kind === "reordered").length, 2);
});

test("an added section is reported as added", () => {
  const a = snap([{ title: "Experience" }]);
  const b = snap([{ title: "Experience" }, { title: "Projects" }]);
  const diff = compareSnapshots(a, b);
  const added = diff.sections.find((s) => s.kind === "added");
  assert.equal(added?.title, "Projects");
});

test("a removed section is reported as removed", () => {
  const a = snap([{ title: "Experience" }, { title: "Projects" }]);
  const b = snap([{ title: "Experience" }]);
  const removed = compareSnapshots(a, b).sections.find((s) => s.kind === "removed");
  assert.equal(removed?.title, "Projects");
});

test("an edited entry field is reported as a change with before and after", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "Engineer", organization: "Acme" }] }]);
  const b = snap([{ title: "Experience", entries: [{ title: "Engineer", organization: "Globex" }] }]);
  const entry = compareSnapshots(a, b).sections[0].entries[0];
  assert.equal(entry.kind, "changed");
  const change = entry.fieldChanges.find((c) => c.field === "organization")!;
  assert.equal(change.before, "Acme");
  assert.equal(change.after, "Globex");
});

test("an edited bullet is a change, not a delete plus an add", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "A", bullets: ["Built the thing"] }] }]);
  const b = snap([{ title: "Experience", entries: [{ title: "A", bullets: ["Built the better thing"] }] }]);
  const bullets = compareSnapshots(a, b).sections[0].entries[0].bulletChanges;
  assert.equal(bullets.length, 1);
  assert.equal(bullets[0].kind, "changed");
  assert.equal(bullets[0].before, "Built the thing");
  assert.equal(bullets[0].after, "Built the better thing");
});

test("header changes are reported field by field", () => {
  const a = snap([{ title: "Experience" }], { header: { email: "old@example.com" } });
  const b = snap([{ title: "Experience" }], { header: { email: "new@example.com" } });
  const diff = compareSnapshots(a, b);
  const change = diff.headerChanges.find((c) => c.field === "email")!;
  assert.equal(change.before, "old@example.com");
  assert.equal(change.after, "new@example.com");
});

test("custom links are compared as an ordered list", () => {
  const a = snap([{ title: "X" }], { header: { custom_links: { links: [{ label: "A", url: "https://a.example/" }] } } });
  const b = snap([{ title: "X" }], {
    header: {
      custom_links: {
        links: [
          { label: "A", url: "https://a.example/" },
          { label: "B", url: "https://b.example/" },
        ],
      },
    },
  });
  assert.ok(compareSnapshots(a, b).headerChanges.some((c) => c.field === "custom_links"));
});

test("style and target-length changes are reported separately from content", () => {
  const a = snap([{ title: "X" }], { resume: { style_settings: { body_font_size_pt: 11 }, target_length: "one_page" } });
  const b = snap([{ title: "X" }], { resume: { style_settings: { body_font_size_pt: 10 }, target_length: "two_pages" } });
  const diff = compareSnapshots(a, b);
  assert.ok(diff.styleChanges.some((c) => c.field === "body_font_size_pt"));
  assert.ok(diff.metaChanges.some((c) => c.field === "target_length"));
  assert.equal(diff.sections.every((s) => s.kind === "unchanged"), true);
});

test("target company and role changes are reported", () => {
  const a = snap([{ title: "X" }], { resume: { target_company: "Acme", target_role: "SWE" } });
  const b = snap([{ title: "X" }], { resume: { target_company: "Globex", target_role: "SWE" } });
  const diff = compareSnapshots(a, b);
  const change = diff.metaChanges.find((c) => c.field === "target_company")!;
  assert.equal(change.before, "Acme");
  assert.equal(change.after, "Globex");
});

test("two sections with the same title are matched pairwise, not collapsed", () => {
  const a = snap([{ title: "Projects", entries: [{ title: "One" }] }, { title: "Projects", entries: [{ title: "Two" }] }]);
  const b = snap([{ title: "Projects", entries: [{ title: "One" }] }, { title: "Projects", entries: [{ title: "Two" }] }]);
  assert.equal(compareSnapshots(a, b).hasChanges, false);
});

test("comparison does not mutate either input", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "A", bullets: ["one"] }] }]);
  const b = snap([{ title: "Experience", entries: [{ title: "B", bullets: ["two"] }] }]);
  const beforeA = JSON.stringify(a);
  const beforeB = JSON.stringify(b);
  compareSnapshots(a, b);
  assert.equal(JSON.stringify(a), beforeA);
  assert.equal(JSON.stringify(b), beforeB);
});

test("a renamed section is a title change, not a removal plus an addition", () => {
  const a = snap([{ title: "Experience", entries: [{ title: "Engineer" }] }]);
  const b = snap([{ title: "Work Experience", entries: [{ title: "Engineer" }] }]);
  const diff = compareSnapshots(a, b);
  assert.equal(diff.sections.length, 1);
  assert.equal(diff.sections[0].kind, "changed");
  assert.equal(diff.sections[0].titleChange?.before, "Experience");
  assert.equal(diff.sections[0].titleChange?.after, "Work Experience");
});

test("a section whose layout changed is a removal plus an addition, not a rename", () => {
  const a = snap([{ title: "Education", layout: "education" }]);
  const b = snap([{ title: "Education", layout: "skills" }]);
  const diff = compareSnapshots(a, b);
  assert.equal(diff.sections.filter((s) => s.kind === "removed").length, 1);
  assert.equal(diff.sections.filter((s) => s.kind === "added").length, 1);
});

test("an entry renamed and moved at once is still one changed entry", () => {
  const a = snap([{ title: "X", entries: [{ title: "Alpha" }, { title: "Beta" }] }]);
  const b = snap([{ title: "X", entries: [{ title: "Beta" }, { title: "Alpha Prime" }] }]);
  const entries = compareSnapshots(a, b).sections[0].entries;
  assert.equal(entries.filter((e) => e.kind === "removed").length, 0);
  assert.equal(entries.filter((e) => e.kind === "added").length, 0);
  const renamed = entries.find((e) => e.kind === "changed")!;
  assert.equal(renamed.fieldChanges.find((c) => c.field === "title")?.after, "Alpha Prime");
});
