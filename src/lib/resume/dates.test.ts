import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseYearMonth,
  toStoredDate,
  toMonthInputValue,
  fromMonthInputValue,
  formatMonth,
  formatDateRange,
} from "./dates";

test("formatMonth: 2025-06-01 → '06 2025' (MM YYYY, zero-padded, no month name)", () => {
  assert.equal(formatMonth("2025-06-01", "MM YYYY"), "06 2025");
});

test("formatMonth: 2025-01-01 → '01 2025'", () => {
  assert.equal(formatMonth("2025-01-01", "MM YYYY"), "01 2025");
});

test("formatMonth: MMMM YYYY uses full English month names", () => {
  assert.equal(formatMonth("2023-09-01", "MMMM YYYY"), "September 2023");
  assert.equal(formatDateRange("2023-09-01", "2027-06-01", "MMMM YYYY"), "September 2023 – June 2027");
});

test("formatMonth: MM/YYYY → '06/2025'", () => {
  assert.equal(formatMonth("2025-06-01", "MM/YYYY"), "06/2025");
});

test("formatMonth: YYYY → '2025'", () => {
  assert.equal(formatMonth("2025-06-01", "YYYY"), "2025");
});

test("formatMonth: empty/null → ''", () => {
  assert.equal(formatMonth(null, "MM YYYY"), "");
  assert.equal(formatMonth("", "MM YYYY"), "");
  assert.equal(formatMonth(undefined, "MM YYYY"), "");
});

test("formatDateRange: range renders both months with an en dash", () => {
  assert.equal(formatDateRange("2025-06-01", "2026-08-01", "MM YYYY"), "06 2025 – 08 2026");
});

test("formatDateRange: null end date with a start → 'Present'", () => {
  assert.equal(formatDateRange("2025-06-01", null, "MM YYYY"), "06 2025 – Present");
});

test("formatDateRange: start only, no end, empty string end → Present", () => {
  assert.equal(formatDateRange("2025-06-01", "", "MM YYYY"), "06 2025 – Present");
});

test("formatDateRange: no start keeps the whole range blank", () => {
  assert.equal(formatDateRange(null, null, "MMMM YYYY"), "");
  assert.equal(formatDateRange(null, "2027-06-01", "MMMM YYYY"), "");
});

test("no output ever contains an English month name or abbreviation", () => {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "January", "June"];
  for (const fmt of ["MM YYYY", "MM/YYYY", "YYYY"] as const) {
    for (const m of ["2025-01-01", "2025-06-01", "2025-12-01"]) {
      const out = formatMonth(m, fmt);
      for (const name of monthNames) assert.ok(!out.includes(name), `${out} contains ${name}`);
    }
  }
  const range = formatDateRange("2025-06-01", null, "MM YYYY");
  for (const name of monthNames) assert.ok(!range.includes(name));
});

test("parsing is timezone-safe: a date-only value never shifts month", () => {
  // Simulate a timezone that would roll 2025-06-01T00:00 back to May 31 in
  // local time if parsed via `new Date(...)`. We parse components directly,
  // so the month is always 06 regardless of process timezone.
  const prevTZ = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.deepEqual(parseYearMonth("2025-06-01"), { year: 2025, month: 6 });
    assert.equal(formatMonth("2025-06-01", "MM YYYY"), "06 2025");
    assert.equal(toMonthInputValue("2025-06-01"), "2025-06");
  } finally {
    process.env.TZ = prevTZ;
  }
});

test("toStoredDate persists the selected month as YYYY-MM-01", () => {
  assert.equal(toStoredDate({ year: 2025, month: 6 }), "2025-06-01");
  assert.equal(toStoredDate({ year: 2025, month: 1 }), "2025-01-01");
  assert.equal(toStoredDate(null), null);
});

test("month-input round trip: YYYY-MM ↔ stored YYYY-MM-01", () => {
  assert.equal(toMonthInputValue("2025-06-01"), "2025-06");
  assert.equal(fromMonthInputValue("2025-06"), "2025-06-01");
  assert.equal(fromMonthInputValue(""), null);
});

test("parseYearMonth rejects malformed input and out-of-range months", () => {
  assert.equal(parseYearMonth("not-a-date"), null);
  assert.equal(parseYearMonth("2025-13-01"), null);
  assert.equal(parseYearMonth("2025-00-01"), null);
});
