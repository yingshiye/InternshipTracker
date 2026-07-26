import { test } from "node:test";
import assert from "node:assert/strict";
import { runPreflight, hasBlockingIssues, countBySeverity, type PreflightInput } from "./preflight";
import { DEFAULT_STYLE_SETTINGS } from "./style";

function base(overrides: Partial<PreflightInput> = {}): PreflightInput {
  return {
    saveState: "saved",
    printSupported: true,
    header: {
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: null,
      linkedin_url: null,
      github_url: null,
      portfolio_url: null,
    },
    resume: { target_company: "Acme", target_role: "SWE", target_length: "one_page" },
    sections: [{ id: "s1", title: "Experience", layout_kind: "entry" }],
    entries: [
      {
        id: "e1",
        section_id: "s1",
        title: "Engineer",
        organization: "Acme",
        education_data: null,
        skills_data: null,
        source_block_id: null,
        sourceMissing: false,
        libraryUpdateAvailable: false,
      },
    ],
    bullets: [{ id: "b1", entry_id: "e1", content: "Did a thing" }],
    style: DEFAULT_STYLE_SETTINGS,
    measurements: { pageCount: 1, renderFailed: false, bulletLineCounts: {} },
    ...overrides,
  };
}

const ids = (input: PreflightInput) => new Set(runPreflight(input).map((i) => i.id));

test("a complete, saved resume has no blocking issues", () => {
  const issues = runPreflight(base());
  assert.equal(hasBlockingIssues(issues), false);
});

test("unsaved changes block the export", () => {
  const issues = runPreflight(base({ saveState: "unsaved" }));
  assert.equal(hasBlockingIssues(issues), true);
  assert.ok(issues.some((i) => i.id === "unsaved_changes" && i.severity === "blocking"));
});

test("a save failure blocks the export", () => {
  assert.ok(ids(base({ saveState: "failed" })).has("save_failed"));
  assert.equal(hasBlockingIssues(runPreflight(base({ saveState: "failed" }))), true);
});

test("a revision conflict blocks the export", () => {
  const issues = runPreflight(base({ saveState: "conflict" }));
  assert.ok(issues.some((i) => i.id === "conflict" && i.severity === "blocking"));
  // Only the conflict is reported, not also "unsaved" — one cause, one message.
  assert.equal(issues.filter((i) => i.id === "unsaved_changes").length, 0);
});

test("an environment without window.print blocks the export", () => {
  assert.ok(ids(base({ printSupported: false })).has("print_unsupported"));
});

test("a missing full name blocks the export", () => {
  const issues = runPreflight(base({ header: { ...base().header!, full_name: "  " } }));
  assert.ok(issues.some((i) => i.id === "missing_full_name" && i.severity === "blocking"));
});

test("no contact method at all blocks the export", () => {
  const issues = runPreflight(
    base({
      header: {
        full_name: "Ada",
        email: null,
        phone: null,
        linkedin_url: null,
        github_url: null,
        portfolio_url: null,
      },
    }),
  );
  assert.ok(issues.some((i) => i.id === "missing_contact" && i.severity === "blocking"));
});

test("any single contact method satisfies the contact requirement", () => {
  for (const field of ["email", "phone", "linkedin_url", "github_url", "portfolio_url"] as const) {
    const header = {
      full_name: "Ada",
      email: null,
      phone: null,
      linkedin_url: null,
      github_url: null,
      portfolio_url: null,
      [field]: "value",
    };
    assert.equal(ids(base({ header })).has("missing_contact"), false, field);
  }
});

test("an empty resume blocks the export", () => {
  assert.ok(ids(base({ sections: [], entries: [] })).has("empty_resume"));
  assert.ok(ids(base({ entries: [] })).has("empty_resume"));
});

test("a failed preview render blocks the export", () => {
  assert.ok(ids(base({ measurements: { pageCount: 1, renderFailed: true, bulletLineCounts: {} } })).has("render_failed"));
});

test("an empty section is a warning, not blocking", () => {
  const issues = runPreflight(
    base({ sections: [...base().sections, { id: "s2", title: "Projects", layout_kind: "entry" }] }),
  );
  const issue = issues.find((i) => i.id === "empty_section:s2")!;
  assert.equal(issue.severity, "warning");
  assert.equal(hasBlockingIssues(issues), false);
});

test("a duplicate-looking section title is a warning", () => {
  const issues = runPreflight(
    base({
      sections: [
        { id: "s1", title: "Experience", layout_kind: "entry" },
        { id: "s2", title: "  experience  ", layout_kind: "entry" },
      ],
    }),
  );
  assert.ok(issues.some((i) => i.id === "duplicate_section_title:s2" && i.severity === "warning"));
});

test("an entry with no title is a warning", () => {
  const issues = runPreflight(base({ entries: [{ ...base().entries[0], title: null }] }));
  assert.ok(issues.some((i) => i.id === "empty_entry_title:e1" && i.severity === "warning"));
});

test("missing education institution and degree are warnings", () => {
  const issues = runPreflight(
    base({
      sections: [{ id: "s1", title: "Education", layout_kind: "education" }],
      entries: [{ ...base().entries[0], title: null, education_data: {} }],
    }),
  );
  assert.ok(issues.some((i) => i.id === "missing_education_institution:e1"));
  assert.ok(issues.some((i) => i.id === "missing_education_degree:e1"));
  assert.equal(hasBlockingIssues(issues), false);
});

test("an empty skills category is a warning", () => {
  const issues = runPreflight(
    base({
      sections: [{ id: "s1", title: "Skills", layout_kind: "skills" }],
      entries: [
        {
          ...base().entries[0],
          skills_data: { categories: [{ label: "Languages", items: [] }] },
        },
      ],
    }),
  );
  assert.ok(issues.some((i) => i.id === "empty_skills_category:e1:0" && i.severity === "warning"));
});

test("a skills section with no categories at all is a warning", () => {
  const issues = runPreflight(
    base({
      sections: [{ id: "s1", title: "Skills", layout_kind: "skills" }],
      entries: [{ ...base().entries[0], skills_data: { categories: [] } }],
    }),
  );
  assert.ok(issues.some((i) => i.id === "empty_skills:e1"));
});

test("a very long bullet is a warning", () => {
  const issues = runPreflight(
    base({ measurements: { pageCount: 1, renderFailed: false, bulletLineCounts: { b1: 5 } } }),
  );
  assert.ok(issues.some((i) => i.id === "long_bullet:b1" && i.severity === "warning"));
});

test("a bullet at exactly the line limit is not a warning", () => {
  const issues = runPreflight(
    base({ measurements: { pageCount: 1, renderFailed: false, bulletLineCounts: { b1: 3 } } }),
  );
  assert.equal(issues.some((i) => i.id === "long_bullet:b1"), false);
});

test("exceeding the target page count is a warning, not blocking", () => {
  const issues = runPreflight(
    base({ measurements: { pageCount: 2, renderFailed: false, bulletLineCounts: {} } }),
  );
  assert.ok(issues.some((i) => i.id === "target_length_exceeded" && i.severity === "warning"));
  assert.equal(hasBlockingIssues(issues), false);
});

test("no_limit never reports a page-count warning", () => {
  const issues = runPreflight(
    base({
      resume: { ...base().resume, target_length: "no_limit" },
      measurements: { pageCount: 5, renderFailed: false, bulletLineCounts: {} },
    }),
  );
  assert.equal(issues.some((i) => i.id === "target_length_exceeded"), false);
  // The page count is still reported, just informationally.
  assert.ok(issues.some((i) => i.id === "page_count" && i.severity === "info"));
});

test("an orphaned library reference is a warning", () => {
  const issues = runPreflight(
    base({ entries: [{ ...base().entries[0], source_block_id: "blk", sourceMissing: true }] }),
  );
  assert.ok(issues.some((i) => i.id === "orphaned_source:e1" && i.severity === "warning"));
});

test("an unapplied library update is a warning", () => {
  const issues = runPreflight(
    base({ entries: [{ ...base().entries[0], source_block_id: "blk", libraryUpdateAvailable: true }] }),
  );
  assert.ok(issues.some((i) => i.id === "library_update:e1" && i.severity === "warning"));
});

test("a missing target company or role is a warning, not blocking", () => {
  const issues = runPreflight(base({ resume: { target_company: null, target_role: null, target_length: "one_page" } }));
  assert.ok(issues.some((i) => i.id === "missing_target_company" && i.severity === "warning"));
  assert.ok(issues.some((i) => i.id === "missing_target_role" && i.severity === "warning"));
  assert.equal(hasBlockingIssues(issues), false);
});

test("ordinary style preferences never block the export", () => {
  const issues = runPreflight(
    base({ style: { ...DEFAULT_STYLE_SETTINGS, body_font_size_pt: 9.5, margin_in: 0.4, line_spacing: "compact" } }),
  );
  assert.equal(hasBlockingIssues(issues), false);
});

test("countBySeverity totals match the issue list", () => {
  const issues = runPreflight(base({ saveState: "unsaved" }));
  const counts = countBySeverity(issues);
  assert.equal(counts.blocking + counts.warning + counts.info, issues.length);
  assert.ok(counts.blocking >= 1);
});

test("preflight is pure — the same input always yields the same output", () => {
  const input = base();
  assert.deepEqual(runPreflight(input), runPreflight(input));
});
