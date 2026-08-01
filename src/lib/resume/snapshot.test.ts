import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSnapshot, draftToComparable, CURRENT_SNAPSHOT_SCHEMA_VERSION } from "./snapshot";

const minimal = {
  snapshot_schema_version: 1,
  resume: { name: "R", target_company: "Acme", target_role: "SWE", style_settings: {}, target_length: "one_page" },
  header: { full_name: "Ada Lovelace", email: "ada@example.com", custom_links: { links: [] } },
  sections: [
    {
      title: "Experience",
      layout_kind: "entry",
      sort_order: 1,
      entries: [
        {
          title: "Engineer",
          organization: "Acme",
          sort_order: 1,
          bullets: [
            { content: "Second", sort_order: 2 },
            { content: "First", sort_order: 1 },
          ],
        },
      ],
    },
  ],
  draft_revision: 7,
  version_number: 3,
  version_type: "manual",
  created_at: "2026-07-25T10:00:00Z",
};

test("parseSnapshot: reads a well-formed snapshot", () => {
  const res = parseSnapshot(minimal);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.schemaVersion, 1);
  assert.equal(res.snapshot.schemaVersionInferred, false);
  assert.equal(res.snapshot.header?.full_name, "Ada Lovelace");
  assert.equal(res.snapshot.draftRevision, 7);
  assert.equal(res.snapshot.versionNumber, 3);
  assert.equal(res.snapshot.versionType, "manual");
  assert.equal(res.snapshot.issues.length, 0);
});

test("parseSnapshot: orders sections, entries and bullets by sort_order", () => {
  const res = parseSnapshot(minimal);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(
    res.snapshot.sections[0].entries[0].bullets.map((b) => b.content),
    ["First", "Second"],
  );
});

test("parseSnapshot: a snapshot with no schema version is read as version 1", () => {
  const legacy = { ...minimal } as Record<string, unknown>;
  delete legacy.snapshot_schema_version;
  const res = parseSnapshot(legacy);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.schemaVersion, CURRENT_SNAPSHOT_SCHEMA_VERSION);
  assert.equal(res.snapshot.schemaVersionInferred, true);
  assert.equal(res.snapshot.issues.length, 0);
});

test("parseSnapshot: a newer schema version still renders, with a warning", () => {
  const res = parseSnapshot({ ...minimal, snapshot_schema_version: 99 });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.schemaVersion, 99);
  assert.ok(res.snapshot.issues.some((i) => i.includes("newer format")));
});

test("parseSnapshot: rejects a non-object", () => {
  assert.equal(parseSnapshot(null).ok, false);
  assert.equal(parseSnapshot("nope").ok, false);
  assert.equal(parseSnapshot([1, 2]).ok, false);
});

test("parseSnapshot: rejects a snapshot with no sections array", () => {
  const res = parseSnapshot({ ...minimal, sections: "oops" });
  assert.equal(res.ok, false);
});

test("parseSnapshot: skips malformed members instead of failing the whole document", () => {
  const res = parseSnapshot({
    ...minimal,
    sections: [
      minimal.sections[0],
      { title: "Broken", layout_kind: "not-a-layout", entries: [] },
      "also broken",
    ],
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  // The good section survives; the two bad ones are reported, not rendered.
  assert.equal(res.snapshot.sections.length, 1);
  assert.equal(res.snapshot.issues.length, 2);
});

test("parseSnapshot: a bullet with no text is skipped and reported", () => {
  const res = parseSnapshot({
    ...minimal,
    sections: [
      {
        title: "Experience",
        layout_kind: "entry",
        sort_order: 1,
        entries: [{ title: "E", sort_order: 1, bullets: [{ content: "ok", sort_order: 1 }, { sort_order: 2 }] }],
      },
    ],
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.sections[0].entries[0].bullets.length, 1);
  assert.ok(res.snapshot.issues.some((i) => i.includes("no text")));
});

test("parseSnapshot: never mutates the stored JSON it was given", () => {
  const input = JSON.parse(JSON.stringify(minimal));
  const before = JSON.stringify(input);
  parseSnapshot(input);
  assert.equal(JSON.stringify(input), before);
});

test("parseSnapshot: stored HTML is carried as plain text, not parsed", () => {
  const res = parseSnapshot({
    ...minimal,
    header: { full_name: "<script>alert(1)</script>", custom_links: { links: [] } },
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  // It stays an ordinary string; the viewer renders it as a text node.
  assert.equal(res.snapshot.header?.full_name, "<script>alert(1)</script>");
});

test("parseSnapshot: an out-of-range style setting falls back to the documented default", () => {
  const res = parseSnapshot({
    ...minimal,
    resume: { ...minimal.resume, style_settings: { body_font_size_pt: 99, line_spacing: "wobbly" } },
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.resume.style_settings.body_font_size_pt, 11);
  assert.equal(res.snapshot.resume.style_settings.line_spacing, "standard");
});

test("parseSnapshot: an unknown target_length falls back to one_page", () => {
  const res = parseSnapshot({ ...minimal, resume: { ...minimal.resume, target_length: "three_pages" } });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.snapshot.resume.target_length, "one_page");
});

test("parseSnapshot: education and skills data survive a round trip", () => {
  const res = parseSnapshot({
    ...minimal,
    sections: [
      {
        title: "Education",
        layout_kind: "education",
        sort_order: 1,
        entries: [
          {
            title: "State University",
            sort_order: 1,
            education_data: { degree: "BSc", honors: ["Dean's list", ""], nonsense: 1 },
            bullets: [],
          },
        ],
      },
      {
        title: "Skills",
        layout_kind: "skills",
        sort_order: 2,
        entries: [{ sort_order: 1, skills_data: { categories: [{ label: "Languages", items: ["Go", "TS"] }] }, bullets: [] }],
      },
    ],
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const edu = res.snapshot.sections[0].entries[0].education_data;
  assert.equal(edu?.degree, "BSc");
  assert.deepEqual(edu?.honors, ["Dean's list"]); // the blank entry is dropped
  assert.equal("nonsense" in (edu ?? {}), false); // unknown keys are not carried through
  assert.deepEqual(res.snapshot.sections[1].entries[0].skills_data?.categories[0].items, ["Go", "TS"]);
});

test("draftToComparable: projects a live draft into the same shape as a snapshot", () => {
  const parsed = draftToComparable({
    resume: {
      name: "R",
      target_company: "Acme",
      target_role: "SWE",
      style_settings: {},
      target_length: "two_pages",
    },
    header: {
      full_name: "Ada",
      email: null,
      phone: null,
      location: null,
      linkedin_url: null,
      github_url: null,
      portfolio_url: null,
      custom_links: { links: [{ label: "Site", url: "https://example.com/" }] },
    },
    sections: [
      { id: "s2", title: "Second", layout_kind: "entry", sort_order: 2 },
      { id: "s1", title: "First", layout_kind: "entry", sort_order: 1 },
    ],
    entries: [{ id: "e1", section_id: "s1", title: "T", subtitle: null, organization: null, location: null, start_date: null, end_date: null, education_data: null, skills_data: null, sort_order: 1 }],
    bullets: [
      { id: "b2", entry_id: "e1", content: "two", sort_order: 2 },
      { id: "b1", entry_id: "e1", content: "one", sort_order: 1 },
    ],
  });

  assert.deepEqual(parsed.sections.map((s) => s.title), ["First", "Second"]);
  assert.deepEqual(parsed.sections[0].entries[0].bullets.map((b) => b.content), ["one", "two"]);
  assert.equal(parsed.resume.target_length, "two_pages");
  assert.equal(parsed.header?.custom_links.links[0].label, "Site");
});
