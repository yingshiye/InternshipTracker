import { test } from "node:test";
import assert from "node:assert/strict";
import { fnv1a } from "./fingerprint";

test("fnv1a is deterministic and stable across calls", () => {
  assert.equal(fnv1a("hello"), fnv1a("hello"));
});

test("fnv1a returns an 8-char hex string", () => {
  assert.match(fnv1a("anything"), /^[0-9a-f]{8}$/);
  assert.match(fnv1a(""), /^[0-9a-f]{8}$/);
});

test("different inputs produce different hashes (basic collision sanity)", () => {
  assert.notEqual(fnv1a("bullet one"), fnv1a("bullet two"));
  assert.notEqual(fnv1a("a:b:error:x"), fnv1a("a:b:warning:x"));
});
