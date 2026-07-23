import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeUrl } from "./url";

test("infers https when no scheme is given", () => {
  assert.equal(normalizeUrl("example.com/careers"), "https://example.com/careers");
});

test("lowercases the hostname but preserves path case", () => {
  assert.equal(
    normalizeUrl("https://Example.COM/Careers"),
    "https://example.com/Careers"
  );
});

test("upgrades http to https", () => {
  assert.equal(normalizeUrl("http://example.com/careers"), "https://example.com/careers");
});

test("trims surrounding whitespace", () => {
  assert.equal(
    normalizeUrl("  https://example.com/careers  "),
    "https://example.com/careers"
  );
});

test("removes the fragment", () => {
  assert.equal(
    normalizeUrl("https://example.com/careers#section"),
    "https://example.com/careers"
  );
});

test("removes a trailing slash from non-root paths", () => {
  assert.equal(
    normalizeUrl("https://example.com/careers/"),
    "https://example.com/careers"
  );
});

test("preserves the root path slash", () => {
  assert.equal(normalizeUrl("https://example.com"), "https://example.com/");
  assert.equal(normalizeUrl("https://example.com/"), "https://example.com/");
});

test("preserves query parameters", () => {
  assert.equal(
    normalizeUrl("https://example.com/careers?dept=eng"),
    "https://example.com/careers?dept=eng"
  );
});

test("rejects empty input", () => {
  assert.throws(() => normalizeUrl(""));
  assert.throws(() => normalizeUrl("   "));
});

test("rejects malformed input", () => {
  assert.throws(() => normalizeUrl("not a url at all!!"));
});

test("rejects non-http(s) schemes", () => {
  assert.throws(() => normalizeUrl("ftp://example.com/file"));
});
