import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExportFilename, sanitizeFilenameComponent, localDateStamp } from "./filename";

const DATE = new Date(2026, 6, 25); // 25 July 2026, local time

test("buildExportFilename: name, company, role and date", () => {
  assert.equal(
    buildExportFilename({ fullName: "Ada Lovelace", company: "Acme Corp", role: "Software Engineer", date: DATE }),
    "Ada_Lovelace_Acme_Corp_Software_Engineer_2026-07-25",
  );
});

test("buildExportFilename: empty components are dropped, not left as double underscores", () => {
  assert.equal(
    buildExportFilename({ fullName: "Ada Lovelace", company: null, role: "  ", date: DATE }),
    "Ada_Lovelace_2026-07-25",
  );
});

test("buildExportFilename: falls back when nothing usable survives", () => {
  assert.equal(buildExportFilename({ date: DATE }), "Resume_2026-07-25");
  assert.equal(buildExportFilename({ fullName: "///", company: "***", date: DATE }), "Resume_2026-07-25");
});

test("buildExportFilename: never contains a forbidden filename character", () => {
  const name = buildExportFilename({
    fullName: 'Ada <Lovelace>: "the/first"',
    company: "A|B?C*D\\E",
    date: DATE,
  });
  assert.equal(/[<>:"/\\|?*]/.test(name), false);
});

test("buildExportFilename: caps overall length but keeps the date intact", () => {
  const name = buildExportFilename({
    fullName: "A".repeat(80),
    company: "B".repeat(80),
    role: "C".repeat(80),
    date: DATE,
  });
  assert.ok(name.length <= 120, `length was ${name.length}`);
  assert.ok(name.endsWith("2026-07-25"));
});

test("buildExportFilename: contains no UUID", () => {
  const name = buildExportFilename({ fullName: "Ada", company: "Acme", role: "SWE", date: DATE });
  assert.equal(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(name), false);
});

test("sanitizeFilenameComponent: collapses whitespace and underscore runs", () => {
  assert.equal(sanitizeFilenameComponent("Acme   Corp"), "Acme_Corp");
  assert.equal(sanitizeFilenameComponent("Acme___Corp"), "Acme_Corp");
  assert.equal(sanitizeFilenameComponent("  Acme Corp  "), "Acme_Corp");
});

test("sanitizeFilenameComponent: strips control characters", () => {
  const withControl = `Ada${String.fromCharCode(9)}Lovelace${String.fromCharCode(0)}`;
  assert.equal(sanitizeFilenameComponent(withControl), "Ada_Lovelace");
});

test("sanitizeFilenameComponent: strips leading and trailing dots and underscores", () => {
  assert.equal(sanitizeFilenameComponent("..hidden.."), "hidden");
  assert.equal(sanitizeFilenameComponent("_lead_"), "lead");
});

test("sanitizeFilenameComponent: truncates a very long component", () => {
  assert.ok(sanitizeFilenameComponent("x".repeat(200)).length <= 40);
});

test("localDateStamp: uses the local calendar date, not UTC", () => {
  // 1 January at 00:30 local time is still 1 January locally, whatever the
  // offset does to the UTC date.
  assert.equal(localDateStamp(new Date(2026, 0, 1, 0, 30)), "2026-01-01");
  assert.equal(localDateStamp(new Date(2026, 11, 31, 23, 30)), "2026-12-31");
});
