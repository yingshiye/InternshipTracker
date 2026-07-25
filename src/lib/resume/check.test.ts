import { test } from "node:test";
import assert from "node:assert/strict";
import { runResumeCheck, type ResumeCheckInput, type CheckMeasurements } from "./check";
import { DEFAULT_STYLE_SETTINGS } from "./style";

const okMeasurements: CheckMeasurements = {
  pageCount: 1,
  overflowPx: 0,
  nearOverflowRatio: 0.4,
  unusedRatio: 0.1,
  renderFailed: false,
  clippedBulletIds: [],
  bulletLineCounts: {},
};

function base(overrides: Partial<ResumeCheckInput> = {}): ResumeCheckInput {
  return {
    header: { full_name: "Ada Lovelace", email: "ada@example.com", linkedin_url: null, github_url: null, portfolio_url: null },
    sections: [{ id: "sec1", title: "Experience", layout_kind: "entry" }],
    entries: [{ id: "e1", section_id: "sec1", title: "Engineer", organization: "Acme", start_date: "2025-01-01", end_date: null, education_data: null, skills_data: null }],
    bullets: [{ id: "b1", entry_id: "e1", content: "Built a scalable system for millions of users" }],
    style: DEFAULT_STYLE_SETTINGS,
    targetLength: "one_page",
    measurements: okMeasurements,
    ...overrides,
  };
}

const ids = (input: ResumeCheckInput) => new Set(runResumeCheck(input).map((f) => f.ruleId));

test("a clean resume produces no findings", () => {
  assert.equal(runResumeCheck(base()).length, 0);
});

test("ERROR: exceeds target length when pageCount > limit", () => {
  const f = ids(base({ measurements: { ...okMeasurements, pageCount: 2 } }));
  assert.ok(f.has("exceeds_target_length"));
});

test("ERROR: missing name and email", () => {
  const f = ids(base({ header: { full_name: "", email: "", linkedin_url: null, github_url: null, portfolio_url: null } }));
  assert.ok(f.has("missing_contact_name"));
  assert.ok(f.has("missing_contact_email"));
});

test("ERROR: missing required entry fields", () => {
  const f = ids(base({ entries: [{ id: "e1", section_id: "sec1", title: "", organization: "", start_date: null, end_date: null, education_data: null, skills_data: null }] }));
  assert.ok(f.has("missing_entry_fields"));
});

test("ERROR: printable overflow and render failure", () => {
  assert.ok(ids(base({ measurements: { ...okMeasurements, overflowPx: 40 } })).has("printable_overflow"));
  assert.ok(ids(base({ measurements: { ...okMeasurements, renderFailed: true } })).has("preview_render_failed"));
});

test("WARNING: small body font and small margins", () => {
  const f = ids(base({ style: { ...DEFAULT_STYLE_SETTINGS, body_font_size_pt: 9.5, margin_in: 0.4 } }));
  assert.ok(f.has("small_body_font"));
  assert.ok(f.has("small_margins"));
});

test("WARNING: entry without bullets and empty section", () => {
  const f = ids(base({
    sections: [{ id: "sec1", title: "Experience", layout_kind: "entry" }, { id: "sec2", title: "Projects", layout_kind: "entry" }],
    bullets: [],
  }));
  assert.ok(f.has("entry_without_bullets"));
  assert.ok(f.has("empty_section"));
});

test("WARNING: long bullet (> 3 rendered lines)", () => {
  const f = ids(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 4 } } }));
  assert.ok(f.has("long_bullet"));
});

test("WARNING: inconsistent dates (end without start)", () => {
  const f = ids(base({ entries: [{ id: "e1", section_id: "sec1", title: "X", organization: "Y", start_date: null, end_date: "2025-06-01", education_data: null, skills_data: null }] }));
  assert.ok(f.has("inconsistent_dates"));
});

test("WARNING: invalid URL in header", () => {
  const f = ids(base({ header: { full_name: "A", email: "a@b.com", linkedin_url: "not a url", github_url: null, portfolio_url: null } }));
  assert.ok([...f].some((r) => r.startsWith("invalid_url")));
});

test("SUGGESTION: repeated action verbs", () => {
  const bullets = ["Led A", "Led B", "Led C"].map((c, i) => ({ id: `b${i}`, entry_id: "e1", content: c }));
  const f = ids(base({ bullets, measurements: { ...okMeasurements } }));
  assert.ok([...f].some((r) => r.startsWith("repeated_verb")));
});

test("SUGGESTION: highly similar bullets", () => {
  const bullets = [
    { id: "b1", entry_id: "e1", content: "Improved system performance by optimizing database queries" },
    { id: "b2", entry_id: "e1", content: "Improved system performance by optimizing database queries significantly" },
  ];
  const f = ids(base({ bullets }));
  assert.ok([...f].some((r) => r.startsWith("similar_bullets")));
});

test("SUGGESTION: excess unused space", () => {
  const f = ids(base({ measurements: { ...okMeasurements, unusedRatio: 0.6 } }));
  assert.ok(f.has("excess_unused_space"));
});

test("fingerprint changes when the problem changes (long bullet line count)", () => {
  const four = runResumeCheck(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 4 } } })).find((f) => f.ruleId === "long_bullet")!;
  const five = runResumeCheck(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 5 } } })).find((f) => f.ruleId === "long_bullet")!;
  assert.notEqual(four.fingerprint, five.fingerprint);
});

test("fingerprint is stable when the problem is unchanged", () => {
  const a = runResumeCheck(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 4 } } })).find((f) => f.ruleId === "long_bullet")!;
  const b = runResumeCheck(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 4 } } })).find((f) => f.ruleId === "long_bullet")!;
  assert.equal(a.fingerprint, b.fingerprint);
});

test("a resolved finding disappears from the result set", () => {
  const withProblem = ids(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 4 } } }));
  assert.ok(withProblem.has("long_bullet"));
  const resolved = ids(base({ measurements: { ...okMeasurements, bulletLineCounts: { b1: 2 } } }));
  assert.ok(!resolved.has("long_bullet"));
});
