/**
 * Real-database verification for Resume Builder Step 3:
 * restore_resume_from_version, the snapshot_schema_version stamp on
 * create_resume_version, and set_application_resume_version.
 *
 * Covers: success paths, stale revision, cross-user rejection, cross-resume
 * rejection, atomic rollback on a malformed snapshot, version preservation,
 * exactly-one revision increment, SECURITY DEFINER configuration
 * (search_path = '', prosecdef), explicit execute grants, anon rejection, and
 * the absence of speculative service_role grants.
 *
 * A NOTE ON `public.applications`: on a local Supabase CLI database that
 * table does not exist, because the legacy migration that creates it has a
 * filename the CLI does not recognise and silently skips. That file is
 * protected and is not renamed or edited. So that the association RPC is
 * genuinely exercised rather than merely skipped, this test provisions the
 * table itself when it is absent — as a *test fixture*, never as a migration,
 * so nothing here can reach a hosted project. When the table already exists
 * (a real project) the fixture is a no-op and the same assertions run against
 * the real schema.
 *
 * NOT part of `npm test` — requires a running local Supabase stack. Run:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<local anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role key, used ONLY to
 *     provision test users and the fixture table> \
 *   npx tsx supabase/tests/step3-database.test.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client as PgClient } from "pg";

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (!URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
// Fail closed: never run against a hosted project.
if (!/(127\.0\.0\.1|localhost)/.test(URL)) {
  console.error(`Refusing to run against non-local Supabase URL: ${URL}`);
  process.exit(1);
}
if (!/(127\.0\.0\.1|localhost)/.test(DB_URL)) {
  console.error(`Refusing to run against non-local database URL: ${DB_URL}`);
  process.exit(1);
}

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];
function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function makeUser(admin: SupabaseClient, email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${email}) failed: ${error.message}`);
  const client = createClient(URL!, ANON_KEY!);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${email}) failed: ${signInError.message}`);
  return { id: data.user!.id, client };
}

function expectErr(name: string, error: { message: string } | null, reason: string) {
  if (error && error.message.includes(reason)) record(name, true);
  else record(name, false, `expected '${reason}', got: ${error ? error.message : "no error"}`);
}

async function revisionOf(c: SupabaseClient, resumeId: string): Promise<number> {
  const { data } = await c.from("resumes").select("revision").eq("id", resumeId).single();
  return (data as { revision: number }).revision;
}

/** Build a small but complete resume: header + 3 sections + entries + bullets. */
async function buildResume(a: SupabaseClient, name: string) {
  const { data: r, error } = await a.rpc("create_resume", { p_name: name });
  if (error) throw new Error(`create_resume failed: ${error.message}`);
  const resumeId = r![0].resume_id as string;
  let rev = r![0].revision as number;

  const { data: h } = await a.rpc("update_resume_header", {
    p_resume_id: resumeId, p_expected_revision: rev,
    p_full_name: "Ada Lovelace", p_email: "ada@example.com", p_phone: "555-0100",
    p_location: "London", p_linkedin_url: null, p_github_url: null, p_portfolio_url: null,
    p_custom_links: { links: [{ label: "Notes", url: "https://example.com/notes?x=1#frag" }] },
  });
  rev = h as number;

  const { data: s1 } = await a.rpc("create_section", {
    p_resume_id: resumeId, p_expected_revision: rev, p_title: "Experience", p_layout_kind: "entry",
  });
  const sectionExp = s1![0].section_id as string;
  rev = s1![0].revision as number;

  const { data: s2 } = await a.rpc("create_section", {
    p_resume_id: resumeId, p_expected_revision: rev, p_title: "Education", p_layout_kind: "education",
  });
  const sectionEdu = s2![0].section_id as string;
  rev = s2![0].revision as number;

  const { data: s3 } = await a.rpc("create_section", {
    p_resume_id: resumeId, p_expected_revision: rev, p_title: "Skills", p_layout_kind: "skills",
  });
  const sectionSkills = s3![0].section_id as string;
  rev = s3![0].revision as number;

  const { data: e1 } = await a.rpc("add_custom_entry", {
    p_resume_id: resumeId, p_expected_revision: rev, p_section_id: sectionExp,
    p_title: "Engineer", p_subtitle: null, p_organization: "Acme", p_location: "Remote",
    p_start_date: "2025-06-01", p_end_date: null, p_education_data: null, p_skills_data: null,
  });
  const entryExp = e1![0].entry_id as string;
  rev = e1![0].revision as number;

  const { data: b1 } = await a.rpc("add_custom_bullet", {
    p_resume_id: resumeId, p_expected_revision: rev, p_entry_id: entryExp, p_content: "First bullet",
  });
  rev = b1![0].revision as number;
  const { data: b2 } = await a.rpc("add_custom_bullet", {
    p_resume_id: resumeId, p_expected_revision: rev, p_entry_id: entryExp, p_content: "Second bullet",
  });
  rev = b2![0].revision as number;

  const { data: e2 } = await a.rpc("add_custom_entry", {
    p_resume_id: resumeId, p_expected_revision: rev, p_section_id: sectionEdu,
    p_title: "State University", p_subtitle: null, p_organization: null, p_location: "Boston",
    p_start_date: "2022-09-01", p_end_date: "2026-05-01",
    p_education_data: { degree: "BSc", field_of_study: "CS", honors: ["Dean's list"] }, p_skills_data: null,
  });
  rev = e2![0].revision as number;

  const { data: e3 } = await a.rpc("add_custom_entry", {
    p_resume_id: resumeId, p_expected_revision: rev, p_section_id: sectionSkills,
    p_title: null, p_subtitle: null, p_organization: null, p_location: null,
    p_start_date: null, p_end_date: null, p_education_data: null,
    p_skills_data: { categories: [{ label: "Languages", items: ["TypeScript", "SQL"] }] },
  });
  rev = e3![0].revision as number;

  return { resumeId, rev, sectionExp, sectionEdu, sectionSkills, entryExp };
}

/**
 * Delete a version row. `resume_versions` has a trigger that blocks UPDATE and
 * DELETE for every role including the table owner — that is the point of it —
 * so the only way to clean up test rows is to switch the trigger off, delete,
 * and switch it straight back on. Local test database only; the final check in
 * this file asserts the trigger is enabled again afterwards.
 */
async function deleteVersionRows(pg: PgClient, sql: string, params: unknown[]) {
  await pg.query("alter table public.resume_versions disable trigger resume_versions_immutable");
  try {
    await pg.query(sql, params);
  } finally {
    await pg.query("alter table public.resume_versions enable trigger resume_versions_immutable");
  }
}

async function main() {
  const admin = createClient(URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(URL!, ANON_KEY!);
  const pg = new PgClient({ connectionString: DB_URL });
  await pg.connect();

  const stamp = Date.now();
  const userA = await makeUser(admin, `s3a-${stamp}@example.com`, "correct horse battery staple 1");
  const userB = await makeUser(admin, `s3b-${stamp}@example.com`, "correct horse battery staple 2");
  const a = userA.client;
  const b = userB.client;

  // ═══ 1. create_resume_version stamps snapshot_schema_version ═════════════
  const A = await buildResume(a, "S3 Resume A");
  let revA = A.rev;

  const { data: v1, error: v1Err } = await a.rpc("create_resume_version", {
    p_resume_id: A.resumeId, p_expected_revision: revA, p_version_type: "manual",
  });
  record("create_resume_version: succeeds", !v1Err && !!v1?.[0]?.version_id, v1Err?.message);
  const version1Id = v1![0].version_id as string;
  const revisionAtV1 = revA;

  const { data: v1row } = await a.from("resume_versions").select("snapshot").eq("id", version1Id).single();
  const snap1 = (v1row as { snapshot: Record<string, unknown> }).snapshot;
  record("create_resume_version: snapshot carries snapshot_schema_version = 1", snap1.snapshot_schema_version === 1,
    `got ${JSON.stringify(snap1.snapshot_schema_version)}`);
  record("create_resume_version: snapshot records the draft revision", snap1.draft_revision === revisionAtV1);
  record("create_resume_version: does not bump the draft revision", (await revisionOf(a, A.resumeId)) === revA);
  record("create_resume_version: snapshot has 3 sections", Array.isArray(snap1.sections) && (snap1.sections as unknown[]).length === 3);
  {
    const header = snap1.header as Record<string, unknown>;
    record("create_resume_version: snapshot preserves header custom links",
      JSON.stringify(header.custom_links).includes("example.com/notes?x=1#frag"));
  }

  // ═══ 2. restore_resume_from_version ═════════════════════════════════════
  // Mutate the draft away from version 1, then restore it back.
  const { data: renamed } = await a.rpc("rename_section", {
    p_resume_id: A.resumeId, p_expected_revision: revA, p_section_id: A.sectionExp, p_title: "Work History",
  });
  revA = renamed as number;
  const { data: bulletAdded } = await a.rpc("add_custom_bullet", {
    p_resume_id: A.resumeId, p_expected_revision: revA, p_entry_id: A.entryExp, p_content: "Third bullet",
  });
  revA = bulletAdded![0].revision as number;
  const { data: hdr } = await a.rpc("update_resume_header", {
    p_resume_id: A.resumeId, p_expected_revision: revA,
    p_full_name: "Someone Else", p_email: null, p_phone: null, p_location: null,
    p_linkedin_url: null, p_github_url: null, p_portfolio_url: null, p_custom_links: { links: [] },
  });
  revA = hdr as number;

  // Stale revision is rejected.
  {
    const { error } = await a.rpc("restore_resume_from_version", {
      p_resume_id: A.resumeId, p_expected_revision: revA - 1, p_version_id: version1Id,
    });
    expectErr("restore: stale revision rejected", error, "revision_conflict");
  }

  // Cross-user rejection: B cannot restore A's resume, and cannot use A's version.
  {
    const { error } = await b.rpc("restore_resume_from_version", {
      p_resume_id: A.resumeId, p_expected_revision: revA, p_version_id: version1Id,
    });
    expectErr("restore: cross-user resume rejected", error, "resume_not_found");
  }
  const B = await buildResume(b, "S3 Resume B");
  {
    const { error } = await b.rpc("restore_resume_from_version", {
      p_resume_id: B.resumeId, p_expected_revision: B.rev, p_version_id: version1Id,
    });
    // A's version is invisible to B, so it reads as missing rather than leaking.
    expectErr("restore: cross-user version rejected", error, "version_not_found");
  }

  // Cross-resume rejection: A's own second resume cannot be restored from
  // resume A's version.
  const A2 = await buildResume(a, "S3 Resume A2");
  {
    const { error } = await a.rpc("restore_resume_from_version", {
      p_resume_id: A2.resumeId, p_expected_revision: A2.rev, p_version_id: version1Id,
    });
    expectErr("restore: cross-resume version rejected", error, "version_resume_mismatch");
  }

  // anon rejection.
  {
    const { error } = await anon.rpc("restore_resume_from_version", {
      p_resume_id: A.resumeId, p_expected_revision: revA, p_version_id: version1Id,
    });
    record("restore: anon denied", !!error, error?.message);
  }

  // Success path.
  const beforeRestoreRev = revA;
  const { data: newRev, error: restoreErr } = await a.rpc("restore_resume_from_version", {
    p_resume_id: A.resumeId, p_expected_revision: revA, p_version_id: version1Id,
  });
  record("restore: succeeds", !restoreErr && typeof newRev === "number", restoreErr?.message);
  revA = newRev as number;
  record("restore: increments the revision exactly once", revA === beforeRestoreRev + 1,
    `${beforeRestoreRev} -> ${revA}`);

  {
    const { data: sections } = await a.from("resume_sections").select("title,layout_kind,sort_order")
      .eq("resume_id", A.resumeId).order("sort_order");
    const titles = (sections as { title: string }[]).map((s) => s.title);
    record("restore: section titles come from the snapshot", JSON.stringify(titles) === JSON.stringify(["Experience", "Education", "Skills"]),
      JSON.stringify(titles));
  }
  {
    const { data: header } = await a.from("resume_headers").select("full_name,email,custom_links")
      .eq("resume_id", A.resumeId).single();
    const h = header as { full_name: string; email: string; custom_links: { links: { url: string }[] } };
    record("restore: header restored from the snapshot", h.full_name === "Ada Lovelace" && h.email === "ada@example.com",
      `${h.full_name} / ${h.email}`);
    record("restore: custom links restored with path, query and fragment intact",
      h.custom_links.links[0]?.url === "https://example.com/notes?x=1#frag", JSON.stringify(h.custom_links));
  }
  {
    const { data: bullets } = await a.from("resume_entry_bullets").select("content").eq("resume_id", A.resumeId).order("sort_order");
    const contents = (bullets as { content: string }[]).map((x) => x.content);
    record("restore: the post-version bullet is gone", !contents.includes("Third bullet"), JSON.stringify(contents));
    record("restore: snapshot bullets are back in order",
      JSON.stringify(contents) === JSON.stringify(["First bullet", "Second bullet"]), JSON.stringify(contents));
  }
  {
    const { data: entries } = await a.from("resume_entries")
      .select("title,education_data,skills_data,source_block_id").eq("resume_id", A.resumeId);
    const rows = entries as { title: string | null; education_data: unknown; skills_data: unknown }[];
    const edu = rows.find((r) => r.title === "State University");
    record("restore: education_data restored", JSON.stringify(edu?.education_data).includes("Dean's list"));
    const skills = rows.find((r) => r.skills_data !== null);
    record("restore: skills_data restored", JSON.stringify(skills?.skills_data).includes("TypeScript"));
  }
  {
    const { data: versions } = await a.from("resume_versions").select("id").eq("resume_id", A.resumeId);
    record("restore: every version is preserved", (versions as unknown[]).length === 1);
  }

  // Atomic rollback: a malformed snapshot must leave the draft untouched.
  {
    // A version row cannot be created with a bad snapshot through the RPC and
    // is immutable afterwards, so the corrupt row is planted directly, as the
    // table owner, purely to exercise the validation path.
    const corruptId = (await pg.query<{ id: string }>(
      `insert into public.resume_versions (user_id, resume_id, version_number, version_type, snapshot)
       values ($1, $2, 999, 'manual', $3::jsonb) returning id`,
      [userA.id, A.resumeId, JSON.stringify({ sections: [{ title: "Bad", layout_kind: "not-a-layout" }] })],
    )).rows[0].id;

    const revBefore = await revisionOf(a, A.resumeId);
    const { data: sectionsBefore } = await a.from("resume_sections").select("id").eq("resume_id", A.resumeId);
    const { error } = await a.rpc("restore_resume_from_version", {
      p_resume_id: A.resumeId, p_expected_revision: revBefore, p_version_id: corruptId,
    });
    expectErr("restore: malformed snapshot rejected", error, "invalid_snapshot");

    const { data: sectionsAfter } = await a.from("resume_sections").select("id").eq("resume_id", A.resumeId);
    record("restore: failed restore rolls back — sections untouched",
      (sectionsBefore as unknown[]).length === (sectionsAfter as unknown[]).length && (sectionsAfter as unknown[]).length === 3,
      `${(sectionsBefore as unknown[]).length} -> ${(sectionsAfter as unknown[]).length}`);
    record("restore: failed restore rolls back — revision unchanged", (await revisionOf(a, A.resumeId)) === revBefore);

    await deleteVersionRows(pg, "delete from public.resume_versions where id = $1", [corruptId]);
    revA = await revisionOf(a, A.resumeId);
  }

  // A snapshot with no schema version (a pre-Step-3 record) still restores.
  {
    const legacy = JSON.parse(JSON.stringify(snap1));
    delete legacy.snapshot_schema_version;
    const legacyId = (await pg.query<{ id: string }>(
      `insert into public.resume_versions (user_id, resume_id, version_number, version_type, snapshot)
       values ($1, $2, 998, 'manual', $3::jsonb) returning id`,
      [userA.id, A.resumeId, JSON.stringify(legacy)],
    )).rows[0].id;

    const { error } = await a.rpc("restore_resume_from_version", {
      p_resume_id: A.resumeId, p_expected_revision: revA, p_version_id: legacyId,
    });
    record("restore: a snapshot with no schema version still restores", !error, error?.message);
    await deleteVersionRows(pg, "delete from public.resume_versions where id = $1", [legacyId]);
    revA = await revisionOf(a, A.resumeId);
  }

  // ═══ 3. Immutability still holds ════════════════════════════════════════
  {
    const { error } = await pg
      .query("update public.resume_versions set version_type = 'exported' where id = $1", [version1Id])
      .then(() => ({ error: null }))
      .catch((e: Error) => ({ error: e }));
    record("resume_versions: UPDATE still blocked even for the table owner", !!error, error?.message);
  }

  // ═══ 4. Application association ═════════════════════════════════════════
  const hadApplications = (await pg.query(`select to_regclass('public.applications') is not null as present`)).rows[0].present;
  if (!hadApplications) {
    console.log("\n(applications table absent — provisioning a local test fixture; this is not a migration)\n");
    await pg.query(`
      create table public.applications (
        id uuid primary key default gen_random_uuid(),
        user_id uuid references auth.users(id) not null,
        company text not null,
        role text not null,
        status text not null default 'applied'
          check (status in ('wishlist','applied','oa','interview','offer','rejected')),
        location text, job_url text, notes text, applied_date date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      alter table public.applications enable row level security;
      create policy "applications_select" on public.applications for select using (auth.uid() = user_id);
      create policy "applications_insert" on public.applications for insert with check (auth.uid() = user_id);
      create policy "applications_update" on public.applications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "applications_delete" on public.applications for delete using (auth.uid() = user_id);
      grant select, insert, update, delete on table public.applications to authenticated;
    `);
    // Apply exactly the DDL the migration's guarded block would have applied.
    await pg.query(`
      alter table public.applications add column submitted_resume_version_id uuid;
      alter table public.applications
        add constraint applications_submitted_resume_version_fkey
        foreign key (user_id, submitted_resume_version_id)
        references public.resume_versions (user_id, id) on delete restrict;
      create index idx_applications_submitted_resume_version on public.applications (submitted_resume_version_id);
      create trigger applications_guard_resume_version
        before insert or update on public.applications
        for each row execute procedure public.guard_application_resume_version();
    `);
    // PostgREST caches the schema; a table created after it started is
    // invisible over the REST API until the cache is reloaded.
    await pg.query("notify pgrst, 'reload schema'");
    await new Promise((r) => setTimeout(r, 1500));
  }

  const appA = (await pg.query<{ id: string }>(
    `insert into public.applications (user_id, company, role) values ($1, 'Acme', 'SWE Intern') returning id`,
    [userA.id],
  )).rows[0].id;
  const appB = (await pg.query<{ id: string }>(
    `insert into public.applications (user_id, company, role) values ($1, 'Globex', 'PM Intern') returning id`,
    [userB.id],
  )).rows[0].id;

  // A `manual` version cannot be attached — only `submitted`.
  {
    const { error } = await a.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: version1Id, p_confirm_replace: false,
    });
    expectErr("association: a manual version is refused", error, "invalid_version_type");
  }

  const { data: subV } = await a.rpc("create_resume_version", {
    p_resume_id: A.resumeId, p_expected_revision: revA, p_version_type: "submitted",
  });
  const submittedId = subV![0].version_id as string;

  // Success.
  {
    const { data, error } = await a.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: submittedId, p_confirm_replace: false,
    });
    record("association: attaching a submitted version succeeds", !error && data === true, error?.message);
    const linked = (await pg.query("select submitted_resume_version_id from public.applications where id = $1", [appA])).rows[0];
    record("association: the column now points at that version", linked.submitted_resume_version_id === submittedId);
  }

  // Replacing without confirmation is refused.
  const { data: subV2 } = await a.rpc("create_resume_version", {
    p_resume_id: A.resumeId, p_expected_revision: revA, p_version_type: "submitted",
  });
  const submitted2Id = subV2![0].version_id as string;
  {
    const { error } = await a.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: submitted2Id, p_confirm_replace: false,
    });
    expectErr("association: replacement without confirmation refused", error, "replacement_not_confirmed");
    const linked = (await pg.query("select submitted_resume_version_id from public.applications where id = $1", [appA])).rows[0];
    record("association: the refused replacement changed nothing", linked.submitted_resume_version_id === submittedId);
  }
  {
    const { error } = await a.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: submitted2Id, p_confirm_replace: true,
    });
    record("association: confirmed replacement succeeds", !error, error?.message);
  }

  // Cross-user: B cannot attach to A's application, nor attach A's version.
  {
    const { error } = await b.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: submittedId, p_confirm_replace: true,
    });
    expectErr("association: cross-user application rejected", error, "application_not_found");
  }
  {
    const { error } = await b.rpc("set_application_resume_version", {
      p_application_id: appB, p_resume_version_id: submittedId, p_confirm_replace: false,
    });
    expectErr("association: cross-user version rejected", error, "version_not_found");
  }

  // The guard trigger blocks a direct write that bypasses the RPC.
  {
    const { error } = await a
      .from("applications")
      // The generated types omit this column precisely so this cannot compile
      // in application code; the cast is the test deliberately trying anyway.
      .update({ submitted_resume_version_id: submittedId } as never)
      .eq("id", appA);
    expectErr("association: direct client write blocked by the guard trigger", error, "direct_version_association_not_allowed");
  }

  // Clearing the link works.
  {
    const { error } = await a.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: null, p_confirm_replace: true,
    });
    record("association: the link can be cleared", !error, error?.message);
    const linked = (await pg.query("select submitted_resume_version_id from public.applications where id = $1", [appA])).rows[0];
    record("association: the column is null after clearing", linked.submitted_resume_version_id === null);
  }

  // anon rejection.
  {
    const { error } = await anon.rpc("set_application_resume_version", {
      p_application_id: appA, p_resume_version_id: submittedId, p_confirm_replace: false,
    });
    record("association: anon denied", !!error, error?.message);
  }

  // The guard trigger stops a direct write even for the table owner.
  {
    const failed = await pg
      .query(`update public.applications set submitted_resume_version_id = $1 where id = $2`, [submittedId, appB])
      .then(() => null)
      .catch((e: Error) => e);
    record("association: guard trigger blocks a direct write even as table owner",
      failed?.message.includes("direct_version_association_not_allowed") === true, failed?.message);
  }

  // …and underneath the trigger, the composite foreign key makes same-user
  // ownership a database fact rather than an application promise. Setting the
  // session flag inside a transaction bypasses the trigger, leaving only the
  // FK to reject the cross-user link. The transaction is rolled back either
  // way, so the bypass cannot outlive this check.
  {
    await pg.query("begin");
    const failed = await pg
      .query("select set_config('app.resume_version_assoc', 'on', true)")
      .then(() =>
        pg.query(`update public.applications set submitted_resume_version_id = $1 where id = $2`, [submittedId, appB]),
      )
      .then(() => null)
      .catch((e: Error) => e);
    await pg.query("rollback");
    record("association: composite FK rejects a cross-user link even with the trigger bypassed",
      failed?.message.includes("applications_submitted_resume_version_fkey") === true, failed?.message);
  }

  // ═══ 5. Function configuration and grants ═══════════════════════════════
  for (const fn of ["restore_resume_from_version", "set_application_resume_version", "create_resume_version"]) {
    const row = (await pg.query<{
      prosecdef: boolean;
      proconfig: string[] | null;
      acl: string | null;
    }>(
      `select p.prosecdef, p.proconfig, array_to_string(p.proacl, ',') as acl
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = $1`,
      [fn],
    )).rows[0];

    record(`${fn}: SECURITY DEFINER`, row?.prosecdef === true);
    // Postgres stores the setting as `search_path=""` (a quoted empty string),
    // so both spellings count as "empty".
    record(`${fn}: search_path = ''`, (row?.proconfig ?? []).some((c) => /^search_path=(""|)$/.test(c)),
      JSON.stringify(row?.proconfig));

    const acl = row?.acl ?? "";
    record(`${fn}: execute granted to authenticated`, /authenticated=X/.test(acl), acl);
    record(`${fn}: no execute for anon`, !/(^|,)anon=X/.test(acl), acl);
    record(`${fn}: no execute for service_role`, !/(^|,)service_role=X/.test(acl), acl);
    record(`${fn}: no execute for PUBLIC`, !/(^|,)=X/.test(acl), acl);
  }

  {
    const row = (await pg.query<{ prosecdef: boolean; proconfig: string[] | null; acl: string | null }>(
      `select p.prosecdef, p.proconfig, array_to_string(p.proacl, ',') as acl
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'guard_application_resume_version'`,
    )).rows[0];
    record("guard_application_resume_version: SECURITY INVOKER (a trigger, not an RPC)", row?.prosecdef === false);
    record("guard_application_resume_version: search_path = ''",
      (row?.proconfig ?? []).some((c) => /^search_path=(""|)$/.test(c)), JSON.stringify(row?.proconfig));
    const acl = row?.acl ?? "";
    record("guard_application_resume_version: not executable by any client role",
      !/authenticated=X/.test(acl) && !/anon=X/.test(acl) && !/service_role=X/.test(acl), acl);
  }

  // Step 3 must not have widened any table privilege.
  {
    const rows = (await pg.query<{ relname: string; grantee: string; privilege_type: string }>(
      `select c.relname, g.grantee, g.privilege_type
         from information_schema.role_table_grants g
         join pg_class c on c.relname = g.table_name
        where g.table_schema = 'public'
          and g.table_name in ('resumes','resume_headers','resume_sections','resume_entries','resume_entry_bullets','resume_versions')
          and g.grantee in ('authenticated','anon','service_role')`,
    )).rows;
    const bad = rows.filter((r) => r.privilege_type !== "SELECT");
    record("protected tables: authenticated/anon/service_role still hold SELECT only", bad.length === 0,
      JSON.stringify(bad));
    const anonRows = rows.filter((r) => r.grantee === "anon");
    record("protected tables: anon holds nothing", anonRows.length === 0, JSON.stringify(anonRows));
  }

  // ═══ Cleanup ════════════════════════════════════════════════════════════
  await pg.query("delete from public.applications where user_id = any($1::uuid[])", [[userA.id, userB.id]]);
  if (!hadApplications) {
    // The fixture table is ours; remove it so the database is left as found.
    await pg.query("drop table public.applications");
  }
  await deleteVersionRows(pg, "delete from public.resume_versions where user_id = any($1::uuid[])", [[userA.id, userB.id]]);
  {
    const enabled = (await pg.query<{ tgenabled: string }>(
      `select tgenabled from pg_trigger where tgname = 'resume_versions_immutable'`,
    )).rows[0];
    record("resume_versions: the immutability trigger is enabled again after cleanup", enabled?.tgenabled === "O",
      enabled?.tgenabled);
  }
  await admin.from("resume_entry_bullets").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("resume_entries").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("resume_sections").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("resume_headers").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("resumes").delete().in("user_id", [userA.id, userB.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await pg.end();

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${passed}/${results.length} checks passed.`);
  if (failed.length) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
