import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { restoreResumeFromVersion, createResumeVersion } from "./versions";
import { setApplicationResumeVersion, findTargetMismatches } from "./applications";
import { describeRpcError } from "./rpc";

function fakeRpc(expectedFn: string, expectedArgs: unknown, result: { data: unknown; error: unknown }) {
  return {
    rpc(fn: string, args: unknown) {
      assert.equal(fn, expectedFn);
      assert.deepEqual(args, expectedArgs);
      return Promise.resolve(result);
    },
  } as unknown as SupabaseClient<Database>;
}

// ── Restore ──────────────────────────────────────────────────────────────────

test("restoreResumeFromVersion: sends ids and the expected revision, nothing else", async () => {
  const supabase = fakeRpc(
    "restore_resume_from_version",
    { p_resume_id: "r1", p_expected_revision: 9, p_version_id: "v1" },
    { data: 10, error: null },
  );
  const res = await restoreResumeFromVersion(supabase, "r1", 9, "v1");
  assert.deepEqual(res, { ok: true, data: 10 });
});

test("restoreResumeFromVersion: returns the new revision for the caller to adopt", async () => {
  const supabase = fakeRpc(
    "restore_resume_from_version",
    { p_resume_id: "r1", p_expected_revision: 2, p_version_id: "v9" },
    { data: 3, error: null },
  );
  const res = await restoreResumeFromVersion(supabase, "r1", 2, "v9");
  assert.equal(res.ok && res.data, 3);
});

test("restoreResumeFromVersion: maps a stale revision to revision_conflict", async () => {
  const supabase = fakeRpc(
    "restore_resume_from_version",
    { p_resume_id: "r1", p_expected_revision: 1, p_version_id: "v1" },
    { data: null, error: { message: 'P0001: revision_conflict' } },
  );
  const res = await restoreResumeFromVersion(supabase, "r1", 1, "v1");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "revision_conflict");
});

test("restoreResumeFromVersion: maps a cross-resume version to version_resume_mismatch", async () => {
  const supabase = fakeRpc(
    "restore_resume_from_version",
    { p_resume_id: "r1", p_expected_revision: 1, p_version_id: "v1" },
    { data: null, error: { message: "version_resume_mismatch" } },
  );
  const res = await restoreResumeFromVersion(supabase, "r1", 1, "v1");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "version_resume_mismatch");
});

test("restoreResumeFromVersion: maps a missing/foreign version to version_not_found", async () => {
  const supabase = fakeRpc(
    "restore_resume_from_version",
    { p_resume_id: "r1", p_expected_revision: 1, p_version_id: "v1" },
    { data: null, error: { message: "version_not_found" } },
  );
  const res = await restoreResumeFromVersion(supabase, "r1", 1, "v1");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "version_not_found");
});

// ── Versions ─────────────────────────────────────────────────────────────────

test("createResumeVersion: passes only resume id, revision and type — never a snapshot", async () => {
  const supabase = fakeRpc(
    "create_resume_version",
    { p_resume_id: "r1", p_expected_revision: 5, p_version_type: "exported" },
    { data: [{ version_id: "v1", version_number: 2, created_at: "2026-07-25T00:00:00Z" }], error: null },
  );
  const res = await createResumeVersion(supabase, "r1", 5, "exported");
  assert.equal(res.ok, true);
});

test("createResumeVersion: rejects an unknown version type before hitting the network", async () => {
  const supabase = {
    rpc() {
      throw new Error("must not be called");
    },
  } as unknown as SupabaseClient<Database>;
  await assert.rejects(
    // @ts-expect-error deliberately invalid at the type level too
    () => createResumeVersion(supabase, "r1", 1, "bogus"),
    /Invalid version_type/,
  );
});

// ── Application association ──────────────────────────────────────────────────

test("setApplicationResumeVersion: sends both ids and defaults confirmReplace to false", async () => {
  const supabase = fakeRpc(
    "set_application_resume_version",
    { p_application_id: "a1", p_resume_version_id: "v1", p_confirm_replace: false },
    { data: true, error: null },
  );
  const res = await setApplicationResumeVersion(supabase, "a1", "v1");
  assert.deepEqual(res, { ok: true, data: true });
});

test("setApplicationResumeVersion: forwards an explicit replacement confirmation", async () => {
  const supabase = fakeRpc(
    "set_application_resume_version",
    { p_application_id: "a1", p_resume_version_id: "v2", p_confirm_replace: true },
    { data: true, error: null },
  );
  await setApplicationResumeVersion(supabase, "a1", "v2", true);
});

test("setApplicationResumeVersion: clearing the link sends an explicit null", async () => {
  const supabase = fakeRpc(
    "set_application_resume_version",
    { p_application_id: "a1", p_resume_version_id: null, p_confirm_replace: true },
    { data: true, error: null },
  );
  await setApplicationResumeVersion(supabase, "a1", null, true);
});

test("setApplicationResumeVersion: maps an unconfirmed replacement to its own reason", async () => {
  const supabase = fakeRpc(
    "set_application_resume_version",
    { p_application_id: "a1", p_resume_version_id: "v1", p_confirm_replace: false },
    { data: null, error: { message: "replacement_not_confirmed" } },
  );
  const res = await setApplicationResumeVersion(supabase, "a1", "v1");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "replacement_not_confirmed");
});

test("setApplicationResumeVersion: maps a non-submitted version type", async () => {
  const supabase = fakeRpc(
    "set_application_resume_version",
    { p_application_id: "a1", p_resume_version_id: "v1", p_confirm_replace: false },
    { data: null, error: { message: "invalid_version_type" } },
  );
  const res = await setApplicationResumeVersion(supabase, "a1", "v1");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "invalid_version_type");
});

test("setApplicationResumeVersion: maps a foreign application to application_not_found", async () => {
  const supabase = fakeRpc(
    "set_application_resume_version",
    { p_application_id: "a1", p_resume_version_id: "v1", p_confirm_replace: false },
    { data: null, error: { message: "application_not_found" } },
  );
  const res = await setApplicationResumeVersion(supabase, "a1", "v1");
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.reason, "application_not_found");
});

// ── Error messages ───────────────────────────────────────────────────────────

test("describeRpcError never returns raw database text", () => {
  for (const reason of [
    "revision_conflict",
    "version_not_found",
    "version_resume_mismatch",
    "application_not_found",
    "invalid_version_type",
    "replacement_not_confirmed",
    "direct_version_association_not_allowed",
    "unknown",
  ] as const) {
    const message = describeRpcError(reason);
    assert.ok(message.length > 0);
    // No snake_case identifier, no Postgres error code prefix.
    assert.equal(/_[a-z]/.test(message), false, `${reason} leaked an identifier: ${message}`);
    assert.equal(/P0\d{3}|SQLSTATE/.test(message), false, reason);
  }
});

// ── Mutation-path audit ──────────────────────────────────────────────────────

test("no module writes to a protected resume table directly", () => {
  const dir = path.join(process.cwd(), "src");
  const protectedTables = [
    "resumes",
    "resume_headers",
    "resume_sections",
    "resume_entries",
    "resume_entry_bullets",
    "resume_versions",
  ];
  const offenders: string[] = [];

  const walk = (p: string) => {
    for (const name of fs.readdirSync(p)) {
      const full = path.join(p, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const table of protectedTables) {
        // `.from("<table>")` followed by a write call, allowing for chained
        // whitespace/newlines between them.
        const re = new RegExp(`from\\(\\s*["'\`]${table}["'\`]\\s*\\)[\\s\\S]{0,80}?\\.(insert|update|upsert|delete)\\(`);
        if (re.test(text)) offenders.push(`${path.relative(process.cwd(), full)} → ${table}`);
      }
    }
  };
  walk(dir);

  assert.deepEqual(offenders, [], `direct writes found: ${offenders.join(", ")}`);
});

test("no module writes applications.submitted_resume_version_id directly", () => {
  const dir = path.join(process.cwd(), "src");
  const offenders: string[] = [];
  const walk = (p: string) => {
    for (const name of fs.readdirSync(p)) {
      const full = path.join(p, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(name)) continue;
      // The types file declares the column; the RPC wrapper names it in a
      // comment. Only an actual assignment inside an update payload counts.
      const text = fs.readFileSync(full, "utf8");
      if (/\.(update|upsert|insert)\(\s*\{[\s\S]{0,400}?submitted_resume_version_id\s*:/.test(text)) {
        offenders.push(path.relative(process.cwd(), full));
      }
    }
  };
  walk(dir);
  assert.deepEqual(offenders, []);
});

// ── Application / resume mismatch ────────────────────────────────────────────

test("findTargetMismatches: exact match reports nothing", () => {
  assert.deepEqual(
    findTargetMismatches(
      { company: "Acme Corp", role: "Software Engineer" },
      { target_company: "Acme Corp", target_role: "Software Engineer" },
    ),
    [],
  );
});

test("findTargetMismatches: case and spacing differences are not mismatches", () => {
  assert.deepEqual(
    findTargetMismatches(
      { company: "acme   corp", role: "SOFTWARE engineer" },
      { target_company: "Acme Corp", target_role: "Software Engineer" },
    ),
    [],
  );
});

test("findTargetMismatches: a different company is reported with both values", () => {
  const out = findTargetMismatches(
    { company: "Globex", role: "SWE" },
    { target_company: "Acme", target_role: "SWE" },
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].field, "company");
  assert.equal(out[0].applicationValue, "Globex");
  assert.equal(out[0].resumeValue, "Acme");
});

test("findTargetMismatches: an unset resume target is reported as a mismatch with null", () => {
  const out = findTargetMismatches(
    { company: "Acme", role: "SWE" },
    { target_company: null, target_role: "   " },
  );
  assert.equal(out.length, 2);
  assert.equal(out[0].resumeValue, null);
  assert.equal(out[1].resumeValue, null);
});

test("findTargetMismatches: never mutates or returns either input object", () => {
  const app = { company: "Acme", role: "SWE" };
  const resume = { target_company: "Globex", target_role: "PM" };
  const before = JSON.stringify({ app, resume });
  findTargetMismatches(app, resume);
  assert.equal(JSON.stringify({ app, resume }), before);
});
