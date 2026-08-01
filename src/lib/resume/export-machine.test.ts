import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exportReducer,
  INITIAL_EXPORT_CONTEXT,
  isExportInFlight,
  type ExportContext,
  type ExportEvent,
} from "./export-machine";

function run(events: ExportEvent[], from: ExportContext = INITIAL_EXPORT_CONTEXT): ExportContext {
  return events.reduce(exportReducer, from);
}

const HAPPY: ExportEvent[] = [
  { type: "START" },
  { type: "SAVE_OK" },
  { type: "PREFLIGHT_CLEAR", revision: 12 },
  { type: "VERSION_CREATED", versionId: "v1", versionNumber: 3 },
  { type: "PREPARED" },
  { type: "PRINT_OPENED" },
];

test("the happy path ends in completed with the version recorded", () => {
  const ctx = run(HAPPY);
  assert.equal(ctx.state, "completed");
  assert.equal(ctx.versionId, "v1");
  assert.equal(ctx.versionNumber, 3);
  assert.equal(ctx.revision, 12);
});

test("the version is created before printing, never after", () => {
  // Reaching "printing" without a VERSION_CREATED is impossible: PREPARED is
  // only honoured from preparing_print, which only VERSION_CREATED can reach.
  const withoutVersion = run([
    { type: "START" },
    { type: "SAVE_OK" },
    { type: "PREFLIGHT_CLEAR", revision: 1 },
    { type: "PREPARED" },
    { type: "PRINT_OPENED" },
  ]);
  assert.equal(withoutVersion.state, "creating_version");
  assert.equal(withoutVersion.versionId, null);
});

test("a second START while in flight is ignored", () => {
  const inFlight = run([{ type: "START" }, { type: "SAVE_OK" }]);
  assert.equal(inFlight.state, "preflight");
  const again = exportReducer(inFlight, { type: "START" });
  assert.deepEqual(again, inFlight);
});

test("START after a completed run begins a fresh run with no carried-over version", () => {
  const done = run(HAPPY);
  const restarted = exportReducer(done, { type: "START" });
  assert.equal(restarted.state, "saving");
  assert.equal(restarted.versionId, null);
  assert.equal(restarted.versionNumber, null);
});

test("a save failure stops the run before any version is created", () => {
  const ctx = run([{ type: "START" }, { type: "SAVE_FAILED", message: "nope" }]);
  assert.equal(ctx.state, "failed");
  assert.equal(ctx.reason, "save_failed");
  assert.equal(ctx.versionId, null);
});

test("blocking preflight issues stop the run before any version is created", () => {
  const ctx = run([{ type: "START" }, { type: "SAVE_OK" }, { type: "PREFLIGHT_BLOCKED", message: "fix things" }]);
  assert.equal(ctx.state, "failed");
  assert.equal(ctx.reason, "blocking_issues");
  assert.equal(ctx.versionId, null);
});

test("a create_resume_version failure is reported and does not proceed to print", () => {
  const ctx = run([
    { type: "START" },
    { type: "SAVE_OK" },
    { type: "PREFLIGHT_CLEAR", revision: 4 },
    { type: "VERSION_FAILED", message: "db said no" },
  ]);
  assert.equal(ctx.state, "failed");
  assert.equal(ctx.reason, "version_failed");
  assert.equal(ctx.message, "db said no");
});

test("a font-readiness timeout fails the run", () => {
  const ctx = run([
    { type: "START" },
    { type: "SAVE_OK" },
    { type: "PREFLIGHT_CLEAR", revision: 1 },
    { type: "VERSION_CREATED", versionId: "v1", versionNumber: 1 },
    { type: "PREPARE_TIMEOUT", reason: "fonts_timeout" },
  ]);
  assert.equal(ctx.state, "failed");
  assert.equal(ctx.reason, "fonts_timeout");
});

test("a print-preparation timeout fails the run", () => {
  const ctx = run([
    { type: "START" },
    { type: "SAVE_OK" },
    { type: "PREFLIGHT_CLEAR", revision: 1 },
    { type: "VERSION_CREATED", versionId: "v1", versionNumber: 1 },
    { type: "PREPARE_TIMEOUT", reason: "prepare_timeout" },
  ]);
  assert.equal(ctx.reason, "prepare_timeout");
});

test("an unsupported print environment fails the run", () => {
  const ctx = run([
    { type: "START" },
    { type: "SAVE_OK" },
    { type: "PREFLIGHT_CLEAR", revision: 1 },
    { type: "VERSION_CREATED", versionId: "v1", versionNumber: 1 },
    { type: "PRINT_UNSUPPORTED" },
  ]);
  assert.equal(ctx.state, "failed");
  assert.equal(ctx.reason, "print_unsupported");
});

test("a revision change mid-run abandons the export", () => {
  const ctx = run([
    { type: "START" },
    { type: "SAVE_OK" },
    { type: "PREFLIGHT_CLEAR", revision: 1 },
    { type: "VERSION_CREATED", versionId: "v1", versionNumber: 1 },
    { type: "REVISION_CHANGED" },
  ]);
  assert.equal(ctx.state, "failed");
  assert.equal(ctx.reason, "changed_during_preparation");
});

test("a conflict mid-run moves to the conflict state, not to failed", () => {
  const ctx = run([{ type: "START" }, { type: "SAVE_OK" }, { type: "CONFLICT" }]);
  assert.equal(ctx.state, "conflict");
  assert.equal(ctx.reason, null);
});

test("a revision change while idle is ignored", () => {
  assert.deepEqual(exportReducer(INITIAL_EXPORT_CONTEXT, { type: "REVISION_CHANGED" }), INITIAL_EXPORT_CONTEXT);
});

test("events arriving out of order are ignored rather than skipping a step", () => {
  const afterStart = run([{ type: "START" }]);
  // A VERSION_CREATED cannot jump the queue from "saving".
  const jumped = exportReducer(afterStart, { type: "VERSION_CREATED", versionId: "v", versionNumber: 1 });
  assert.deepEqual(jumped, afterStart);
});

test("RESET returns to the initial context", () => {
  assert.deepEqual(exportReducer(run(HAPPY), { type: "RESET" }), INITIAL_EXPORT_CONTEXT);
});

test("isExportInFlight covers exactly the states that must block a second run", () => {
  assert.equal(isExportInFlight("idle"), false);
  assert.equal(isExportInFlight("completed"), false);
  assert.equal(isExportInFlight("failed"), false);
  assert.equal(isExportInFlight("conflict"), false);
  for (const s of ["saving", "preflight", "creating_version", "preparing_print", "printing"] as const) {
    assert.equal(isExportInFlight(s), true, s);
  }
});

test("NO_UNSAVED_CHANGES advances past saving just like SAVE_OK", () => {
  const ctx = run([{ type: "START" }, { type: "NO_UNSAVED_CHANGES" }]);
  assert.equal(ctx.state, "preflight");
});
