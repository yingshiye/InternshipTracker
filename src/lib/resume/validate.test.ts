import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ValidationError,
  assertPlainText,
  normalizeOptionalText,
  normalizePlainText,
  validateCustomLinks,
  validateEducationData,
  validateHttpUrl,
  validateSkillsData,
} from "./validate";

// ─── assertPlainText / normalizePlainText ──────────────────────────────────

test("assertPlainText: accepts plain text", () => {
  assert.doesNotThrow(() => assertPlainText("Shipped a feature end to end"));
});

test("assertPlainText: rejects HTML tags", () => {
  assert.throws(() => assertPlainText("<b>bold</b>"), ValidationError);
  assert.throws(() => assertPlainText("has a <br/> in it"), ValidationError);
});

test("assertPlainText: rejects embedded newlines (manual paragraph breaks)", () => {
  assert.throws(() => assertPlainText("line one\nline two"), ValidationError);
  assert.throws(() => assertPlainText("line one\r\nline two"), ValidationError);
});

test("normalizePlainText: trims surrounding whitespace", () => {
  assert.equal(normalizePlainText("  hello  "), "hello");
});

test("normalizeOptionalText: empty/whitespace-only input becomes null", () => {
  assert.equal(normalizeOptionalText(""), null);
  assert.equal(normalizeOptionalText("   "), null);
  assert.equal(normalizeOptionalText(null), null);
  assert.equal(normalizeOptionalText(undefined), null);
});

test("normalizeOptionalText: non-empty input is trimmed and validated", () => {
  assert.equal(normalizeOptionalText("  Acme Corp  "), "Acme Corp");
  assert.throws(() => normalizeOptionalText("<script>"), ValidationError);
});

// ─── validateEducationData ──────────────────────────────────────────────────

test("validateEducationData: null/undefined normalizes to an empty object", () => {
  assert.deepEqual(validateEducationData(null), {});
  assert.deepEqual(validateEducationData(undefined), {});
});

test("validateEducationData: accepts a fully populated valid shape", () => {
  const result = validateEducationData({
    degree: "B.S. Computer Science",
    field_of_study: "Computer Science",
    minor: "Mathematics",
    gpa: "3.8/4.0",
    honors: ["Dean's List", "Cum Laude"],
    coursework: ["Algorithms", "Operating Systems"],
    details: ["Study abroad: Tokyo"],
  });
  assert.deepEqual(result, {
    degree: "B.S. Computer Science",
    field_of_study: "Computer Science",
    minor: "Mathematics",
    gpa: "3.8/4.0",
    honors: ["Dean's List", "Cum Laude"],
    coursework: ["Algorithms", "Operating Systems"],
    details: ["Study abroad: Tokyo"],
  });
});

test("validateEducationData: accepts free-form GPA formats", () => {
  for (const gpa of ["3.8", "3.8/4.0", "Major GPA: 3.9", "GPA: 3.85/4.00"]) {
    assert.equal(validateEducationData({ gpa }).gpa, gpa);
  }
});

test("validateEducationData: rejects unknown top-level properties", () => {
  assert.throws(() => validateEducationData({ unknown_field: "x" }), ValidationError);
});

test("validateEducationData: empty/whitespace scalar is dropped, not stored as \"\"", () => {
  assert.deepEqual(validateEducationData({ degree: "   " }), {});
});

test("validateEducationData: empty strings are normalized out of arrays, and an array left empty is omitted entirely", () => {
  assert.deepEqual(validateEducationData({ honors: ["", "  ", "Dean's List"] }), { honors: ["Dean's List"] });
  assert.deepEqual(validateEducationData({ honors: ["", "   "] }), {});
});

test("validateEducationData: rejects HTML and newlines in any field", () => {
  assert.throws(() => validateEducationData({ degree: "<b>BS</b>" }), ValidationError);
  assert.throws(() => validateEducationData({ coursework: ["line1\nline2"] }), ValidationError);
});

test("validateEducationData: rejects non-string array items", () => {
  assert.throws(() => validateEducationData({ honors: [1, 2] }), ValidationError);
});

// ─── validateSkillsData ──────────────────────────────────────────────────

test("validateSkillsData: null/undefined normalizes to empty categories", () => {
  assert.deepEqual(validateSkillsData(null), { categories: [] });
  assert.deepEqual(validateSkillsData(undefined), { categories: [] });
});

test("validateSkillsData: accepts a valid shape and preserves order", () => {
  const result = validateSkillsData({
    categories: [
      { label: "Languages", items: ["Python", "C++", "JavaScript"] },
      { label: "Tools", items: ["Git", "Docker"] },
    ],
  });
  assert.deepEqual(result, {
    categories: [
      { label: "Languages", items: ["Python", "C++", "JavaScript"] },
      { label: "Tools", items: ["Git", "Docker"] },
    ],
  });
});

test("validateSkillsData: rejects unknown top-level properties", () => {
  assert.throws(() => validateSkillsData({ categories: [], extra: true }), ValidationError);
});

test("validateSkillsData: rejects unknown per-category properties", () => {
  assert.throws(
    () => validateSkillsData({ categories: [{ label: "Languages", items: [], notes: "x" }] }),
    ValidationError,
  );
});

test("validateSkillsData: rejects missing or empty category label", () => {
  assert.throws(() => validateSkillsData({ categories: [{ items: ["Python"] }] }), ValidationError);
  assert.throws(() => validateSkillsData({ categories: [{ label: "  ", items: ["Python"] }] }), ValidationError);
});

test("validateSkillsData: rejects duplicate category labels", () => {
  assert.throws(
    () =>
      validateSkillsData({
        categories: [
          { label: "Languages", items: ["Python"] },
          { label: "Languages", items: ["Java"] },
        ],
      }),
    ValidationError,
  );
});

test("validateSkillsData: silently de-duplicates items within a category", () => {
  const result = validateSkillsData({ categories: [{ label: "Languages", items: ["Python", "Python", "Java"] }] });
  assert.deepEqual(result.categories[0].items, ["Python", "Java"]);
});

test("validateSkillsData: a category left with zero items after filtering is removed", () => {
  const result = validateSkillsData({
    categories: [
      { label: "Empty", items: ["", "   "] },
      { label: "Languages", items: ["Python"] },
    ],
  });
  assert.deepEqual(result.categories, [{ label: "Languages", items: ["Python"] }]);
});

test("validateSkillsData: rejects HTML/newlines in labels and items", () => {
  assert.throws(() => validateSkillsData({ categories: [{ label: "<b>x</b>", items: ["a"] }] }), ValidationError);
  assert.throws(() => validateSkillsData({ categories: [{ label: "x", items: ["a\nb"] }] }), ValidationError);
});

// ─── validateHttpUrl ─────────────────────────────────────────────────────

test("validateHttpUrl: infers https when no scheme is given, preserving path/query/fragment", () => {
  assert.equal(
    validateHttpUrl("example.com/path?tab=1#section"),
    "https://example.com/path?tab=1#section",
  );
});

test("validateHttpUrl: accepts an explicit https URL, preserving path", () => {
  assert.equal(validateHttpUrl("https://github.com/user/repo"), "https://github.com/user/repo");
});

test("validateHttpUrl: accepts an explicit http URL without forcing an upgrade", () => {
  assert.equal(validateHttpUrl("http://example.com/careers"), "http://example.com/careers");
});

test("validateHttpUrl: is accepted even when the URL parser normalizes the hostname", () => {
  const result = validateHttpUrl("https://Example.COM/path");
  assert.equal(result, "https://example.com/path");
});

test("validateHttpUrl: preserves query parameters", () => {
  assert.equal(validateHttpUrl("https://example.com/search?q=engineer&loc=ny"), "https://example.com/search?q=engineer&loc=ny");
});

test("validateHttpUrl: preserves a fragment (e.g. a portfolio anchor)", () => {
  assert.equal(validateHttpUrl("https://example.com/projects#robotics"), "https://example.com/projects#robotics");
});

test("validateHttpUrl: rejects javascript: scheme", () => {
  assert.throws(() => validateHttpUrl("javascript:alert(1)"), ValidationError);
});

test("validateHttpUrl: rejects data: scheme", () => {
  assert.throws(() => validateHttpUrl("data:text/plain,test"), ValidationError);
});

test("validateHttpUrl: rejects file: scheme (no // required to be detected)", () => {
  assert.throws(() => validateHttpUrl("file:/tmp/example"), ValidationError);
});

test("validateHttpUrl: rejects mailto: scheme", () => {
  assert.throws(() => validateHttpUrl("mailto:user@example.com"), ValidationError);
});

test("validateHttpUrl: rejects empty input", () => {
  assert.throws(() => validateHttpUrl(""), ValidationError);
  assert.throws(() => validateHttpUrl("   "), ValidationError);
});

test("validateHttpUrl: rejects malformed input", () => {
  assert.throws(() => validateHttpUrl("not a url at all!!"), ValidationError);
});

// ─── validateCustomLinks ─────────────────────────────────────────────────

test("validateCustomLinks: null/undefined normalizes to an empty links array", () => {
  assert.deepEqual(validateCustomLinks(null), { links: [] });
});

test("validateCustomLinks: accepts a valid shape, preserving order", () => {
  const result = validateCustomLinks({
    links: [
      { label: "Portfolio", url: "example.com/projects#robotics" },
      { label: "GitHub", url: "https://github.com/user" },
    ],
  });
  assert.deepEqual(result, {
    links: [
      { label: "Portfolio", url: "https://example.com/projects#robotics" },
      { label: "GitHub", url: "https://github.com/user" },
    ],
  });
});

test("validateCustomLinks: rejects unknown top-level and per-link properties", () => {
  assert.throws(() => validateCustomLinks({ links: [], extra: 1 }), ValidationError);
  assert.throws(() => validateCustomLinks({ links: [{ label: "x", url: "https://x.com", extra: 1 }] }), ValidationError);
});

test("validateCustomLinks: rejects an empty label or url", () => {
  assert.throws(() => validateCustomLinks({ links: [{ label: "", url: "https://x.com" }] }), ValidationError);
  assert.throws(() => validateCustomLinks({ links: [{ label: "x", url: "" }] }), ValidationError);
});

test("validateCustomLinks: rejects disallowed URL schemes", () => {
  assert.throws(() => validateCustomLinks({ links: [{ label: "x", url: "javascript:alert(1)" }] }), ValidationError);
});
