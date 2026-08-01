import type { ParsedSnapshot, SnapshotEntry, SnapshotSection } from "./snapshot";

/**
 * Pure read-only comparison between two parsed snapshots (or between the live
 * draft, projected through `draftToComparable`, and a snapshot).
 *
 * The hard part is not diffing text — it is *not* reporting a reorder as a
 * delete plus an add. Sections and entries are therefore matched by identity
 * first (section title + layout for sections; a content key for entries) and
 * only then compared field by field; position is reported separately as a
 * `reordered` change. Nothing in this module touches the database or mutates
 * its inputs.
 */

export type ChangeKind = "added" | "removed" | "changed" | "reordered" | "unchanged";

export type FieldChange = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
};

export type BulletChange = {
  kind: ChangeKind;
  before: string | null;
  after: string | null;
  fromIndex: number | null;
  toIndex: number | null;
};

export type EntryDiff = {
  kind: ChangeKind;
  key: string;
  label: string;
  fromIndex: number | null;
  toIndex: number | null;
  fieldChanges: FieldChange[];
  bulletChanges: BulletChange[];
};

export type SectionDiff = {
  kind: ChangeKind;
  key: string;
  title: string;
  fromIndex: number | null;
  toIndex: number | null;
  titleChange: FieldChange | null;
  entries: EntryDiff[];
};

export type SnapshotDiff = {
  hasChanges: boolean;
  headerChanges: FieldChange[];
  metaChanges: FieldChange[];
  styleChanges: FieldChange[];
  sections: SectionDiff[];
};

const HEADER_FIELDS: { field: string; label: string }[] = [
  { field: "full_name", label: "Full name" },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "location", label: "Location" },
  { field: "linkedin_url", label: "LinkedIn" },
  { field: "github_url", label: "GitHub" },
  { field: "portfolio_url", label: "Portfolio" },
];

const ENTRY_FIELDS: { field: keyof SnapshotEntry; label: string }[] = [
  { field: "title", label: "Title" },
  { field: "subtitle", label: "Subtitle" },
  { field: "organization", label: "Organization" },
  { field: "location", label: "Location" },
  { field: "start_date", label: "Start date" },
  { field: "end_date", label: "End date" },
];

const STYLE_LABELS: Record<string, string> = {
  body_font_size_pt: "Body font size",
  name_font_size_pt: "Name font size",
  heading_font_size_pt: "Heading font size",
  margin_in: "Margin",
  line_spacing: "Line spacing",
  section_spacing: "Section spacing",
  bullet_spacing: "Bullet spacing",
  date_format: "Date format",
};

const TARGET_LENGTH_LABELS: Record<string, string> = {
  one_page: "One page",
  two_pages: "Two pages",
  no_limit: "No limit",
};

function textOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function pushIfChanged(
  out: FieldChange[],
  field: string,
  label: string,
  before: unknown,
  after: unknown,
): void {
  const b = textOf(before);
  const a = textOf(after);
  if (b !== a) out.push({ field, label, before: b, after: a });
}

/**
 * Snapshots deliberately carry no row ids, so "the same section/entry" has to
 * be inferred. Identity is a content key plus a `#n` suffix, so two items with
 * the same key (two "Projects" sections, two entries with the same title) pair
 * up one-for-one instead of collapsing into each other.
 */
function keysFor(bases: string[]): string[] {
  const seen = new Map<string, number>();
  return bases.map((base) => {
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base} #${n}`;
  });
}

function sectionKeys(sections: SnapshotSection[]): string[] {
  return keysFor(sections.map((s) => `${s.layout_kind} ${s.title}`));
}

function entryKeys(entries: SnapshotEntry[]): string[] {
  return keysFor(entries.map((e) => [e.title ?? "", e.organization ?? "", e.subtitle ?? ""].join(" ")));
}

/**
 * Pair up two lists in two passes.
 *
 * Pass 1 matches on the identity key, so anything untouched — whether or not
 * it moved — is recognised. Pass 2 pairs the leftovers positionally, which is
 * what turns "the organization was edited" into a *change* rather than a
 * removal plus an unrelated addition. `canPair` lets the caller refuse a
 * positional pairing that would be nonsense, such as matching an education
 * section to a skills section.
 *
 * Returns, for each index of `before`, the index in `after` it pairs with (or
 * null if it was removed), plus which `after` entries ended up used.
 */
function matchTwoPass(
  beforeKeys: string[],
  afterKeys: string[],
  canPair: (beforeIndex: number, afterIndex: number) => boolean,
): { matched: (number | null)[]; afterUsed: boolean[] } {
  const matched: (number | null)[] = beforeKeys.map(() => null);
  const afterUsed = afterKeys.map(() => false);

  beforeKeys.forEach((key, i) => {
    const j = afterKeys.findIndex((other, k) => !afterUsed[k] && other === key);
    if (j !== -1) {
      afterUsed[j] = true;
      matched[i] = j;
    }
  });

  const leftoverBefore = beforeKeys.map((_, i) => i).filter((i) => matched[i] === null);
  const leftoverAfter = afterKeys.map((_, j) => j).filter((j) => !afterUsed[j]);
  for (const i of leftoverBefore) {
    const j = leftoverAfter.find((candidate) => !afterUsed[candidate] && canPair(i, candidate));
    if (j === undefined) continue;
    afterUsed[j] = true;
    matched[i] = j;
  }

  return { matched, afterUsed };
}

function entryLabel(entry: SnapshotEntry): string {
  return entry.title?.trim() || entry.organization?.trim() || entry.subtitle?.trim() || "Untitled entry";
}

/**
 * Bullets are matched positionally after removing the pairs that match
 * exactly, so a reordered-but-unchanged bullet is reported as `reordered`
 * rather than as a delete plus an add.
 */
function diffBullets(before: string[], after: string[]): BulletChange[] {
  const changes: BulletChange[] = [];
  const afterUsed = new Array<boolean>(after.length).fill(false);
  const beforeMatched = new Array<number | null>(before.length).fill(null);

  // Pass 1: exact content matches, earliest unused first.
  before.forEach((text, i) => {
    const j = after.findIndex((other, k) => !afterUsed[k] && other === text);
    if (j !== -1) {
      afterUsed[j] = true;
      beforeMatched[i] = j;
    }
  });

  // Pass 2: whatever is left pairs up in order and counts as an edit.
  const unmatchedBefore = before.map((_, i) => i).filter((i) => beforeMatched[i] === null);
  const unmatchedAfter = after.map((_, j) => j).filter((j) => !afterUsed[j]);
  const pairs = Math.min(unmatchedBefore.length, unmatchedAfter.length);
  for (let p = 0; p < pairs; p++) {
    beforeMatched[unmatchedBefore[p]] = unmatchedAfter[p];
    afterUsed[unmatchedAfter[p]] = true;
  }

  before.forEach((text, i) => {
    const j = beforeMatched[i];
    if (j === null) {
      changes.push({ kind: "removed", before: text, after: null, fromIndex: i, toIndex: null });
      return;
    }
    if (after[j] !== text) {
      changes.push({ kind: "changed", before: text, after: after[j], fromIndex: i, toIndex: j });
    } else if (i !== j) {
      changes.push({ kind: "reordered", before: text, after: text, fromIndex: i, toIndex: j });
    } else {
      changes.push({ kind: "unchanged", before: text, after: text, fromIndex: i, toIndex: j });
    }
  });

  after.forEach((text, j) => {
    if (!afterUsed[j]) {
      changes.push({ kind: "added", before: null, after: text, fromIndex: null, toIndex: j });
    }
  });

  return changes.sort((a, b) => (a.toIndex ?? a.fromIndex ?? 0) - (b.toIndex ?? b.fromIndex ?? 0));
}

function diffEntries(before: SnapshotEntry[], after: SnapshotEntry[]): EntryDiff[] {
  const beforeKeys = entryKeys(before);
  const afterKeys = entryKeys(after);
  // Any leftover pair may be an edit; there is no shape rule that makes two
  // entries incompatible the way a layout mismatch does for sections.
  const { matched, afterUsed } = matchTwoPass(beforeKeys, afterKeys, () => true);
  const diffs: EntryDiff[] = [];

  beforeKeys.forEach((key, i) => {
    const j = matched[i];
    if (j === null) {
      diffs.push({
        kind: "removed",
        key,
        label: entryLabel(before[i]),
        fromIndex: i,
        toIndex: null,
        fieldChanges: [],
        bulletChanges: [],
      });
      return;
    }

    const b = before[i];
    const a = after[j];
    const fieldChanges: FieldChange[] = [];
    for (const { field, label } of ENTRY_FIELDS) {
      pushIfChanged(fieldChanges, field, label, b[field], a[field]);
    }
    pushIfChanged(fieldChanges, "education_data", "Education details", b.education_data, a.education_data);
    pushIfChanged(fieldChanges, "skills_data", "Skills", b.skills_data, a.skills_data);

    const bulletChanges = diffBullets(
      b.bullets.map((x) => x.content),
      a.bullets.map((x) => x.content),
    );
    const bulletsDiffer = bulletChanges.some((c) => c.kind !== "unchanged");

    const kind: ChangeKind =
      fieldChanges.length > 0 || bulletsDiffer ? "changed" : i !== j ? "reordered" : "unchanged";

    diffs.push({ kind, key, label: entryLabel(a), fromIndex: i, toIndex: j, fieldChanges, bulletChanges });
  });

  afterKeys.forEach((key, j) => {
    if (afterUsed[j]) return;
    diffs.push({
      kind: "added",
      key,
      label: entryLabel(after[j]),
      fromIndex: null,
      toIndex: j,
      fieldChanges: [],
      bulletChanges: diffBullets([], after[j].bullets.map((x) => x.content)),
    });
  });

  return diffs.sort((x, y) => (x.toIndex ?? x.fromIndex ?? 0) - (y.toIndex ?? y.fromIndex ?? 0));
}

export function compareSnapshots(before: ParsedSnapshot, after: ParsedSnapshot): SnapshotDiff {
  const headerChanges: FieldChange[] = [];
  for (const { field, label } of HEADER_FIELDS) {
    pushIfChanged(
      headerChanges,
      field,
      label,
      before.header?.[field as keyof typeof before.header] ?? null,
      after.header?.[field as keyof typeof after.header] ?? null,
    );
  }
  pushIfChanged(
    headerChanges,
    "custom_links",
    "Custom links",
    (before.header?.custom_links.links ?? []).map((l) => `${l.label}: ${l.url}`).join(" | ") || null,
    (after.header?.custom_links.links ?? []).map((l) => `${l.label}: ${l.url}`).join(" | ") || null,
  );

  const metaChanges: FieldChange[] = [];
  pushIfChanged(metaChanges, "target_company", "Target company", before.resume.target_company, after.resume.target_company);
  pushIfChanged(metaChanges, "target_role", "Target role", before.resume.target_role, after.resume.target_role);
  pushIfChanged(
    metaChanges,
    "target_length",
    "Target length",
    TARGET_LENGTH_LABELS[before.resume.target_length] ?? before.resume.target_length,
    TARGET_LENGTH_LABELS[after.resume.target_length] ?? after.resume.target_length,
  );

  const styleChanges: FieldChange[] = [];
  for (const key of Object.keys(STYLE_LABELS)) {
    pushIfChanged(
      styleChanges,
      key,
      STYLE_LABELS[key],
      before.resume.style_settings[key as keyof typeof before.resume.style_settings],
      after.resume.style_settings[key as keyof typeof after.resume.style_settings],
    );
  }

  const beforeKeys = sectionKeys(before.sections);
  const afterKeys = sectionKeys(after.sections);
  // A positional pairing only makes sense between sections of the same layout:
  // an "Education" section becoming a "Skills" section is two separate events,
  // not one rename.
  const { matched, afterUsed } = matchTwoPass(
    beforeKeys,
    afterKeys,
    (i, j) => before.sections[i].layout_kind === after.sections[j].layout_kind,
  );
  const sections: SectionDiff[] = [];

  beforeKeys.forEach((key, i) => {
    const j = matched[i];
    if (j === null) {
      sections.push({
        kind: "removed",
        key,
        title: before.sections[i].title,
        fromIndex: i,
        toIndex: null,
        titleChange: null,
        entries: before.sections[i].entries.map((e, k) => ({
          kind: "removed" as ChangeKind,
          key: `${key}:${k}`,
          label: entryLabel(e),
          fromIndex: k,
          toIndex: null,
          fieldChanges: [],
          bulletChanges: [],
        })),
      });
      return;
    }

    const entries = diffEntries(before.sections[i].entries, after.sections[j].entries);
    const entriesDiffer = entries.some((e) => e.kind !== "unchanged");
    // A rename is reported as a title change on the same section, not as a
    // removal plus an addition.
    const titleChange: FieldChange | null =
      before.sections[i].title !== after.sections[j].title
        ? {
            field: "title",
            label: "Section title",
            before: before.sections[i].title,
            after: after.sections[j].title,
          }
        : null;

    sections.push({
      kind: entriesDiffer || titleChange ? "changed" : i !== j ? "reordered" : "unchanged",
      key,
      title: after.sections[j].title,
      fromIndex: i,
      toIndex: j,
      titleChange,
      entries,
    });
  });

  afterKeys.forEach((key, j) => {
    if (afterUsed[j]) return;
    sections.push({
      kind: "added",
      key,
      title: after.sections[j].title,
      fromIndex: null,
      toIndex: j,
      titleChange: null,
      entries: diffEntries([], after.sections[j].entries),
    });
  });

  sections.sort((a, b) => (a.toIndex ?? a.fromIndex ?? 0) - (b.toIndex ?? b.fromIndex ?? 0));

  const hasChanges =
    headerChanges.length > 0 ||
    metaChanges.length > 0 ||
    styleChanges.length > 0 ||
    sections.some((s) => s.kind !== "unchanged");

  return { hasChanges, headerChanges, metaChanges, styleChanges, sections };
}
