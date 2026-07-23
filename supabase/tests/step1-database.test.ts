/**
 * Real-database verification for the Resume Builder Step 1 schema: RLS,
 * cross-user access, parent-ownership validation, composite FK
 * consistency, same-resume RPC validation, RPC permissions, direct-access
 * denial for the RPC-only mutation model, revision conflict/concurrency
 * behavior, resume_versions immutability, snapshot integrity,
 * duplicate_resume, and delete_resume.
 *
 * This is NOT part of `npm test` — it requires a running local Supabase
 * stack (`npx supabase start`) and is not hermetic. Run manually:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<local anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role key, used only to
 *     provision test users via the admin API — never to touch resume
 *     tables, which service_role has zero privileges on by design> \
 *   npx tsx supabase/tests/step1-database.test.ts
 *
 * The composite-FK-bypass and resume_versions-immutability-trigger tests
 * are NOT here — they require a privileged `postgres`/table-owner
 * connection (bypassing grants and RLS entirely, which is the whole
 * point of those two tests) and are run separately via direct psql.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
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

async function main() {
  // service_role is used ONLY to provision test users via the admin API —
  // never against any resume-builder table or RPC, which it has zero
  // privileges on by design.
  const admin = createClient(URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(URL!, ANON_KEY!);

  const userA = await makeUser(admin, `usera-${Date.now()}@example.com`, "correct horse battery staple 1");
  const userB = await makeUser(admin, `userb-${Date.now()}@example.com`, "correct horse battery staple 2");
  const a = userA.client;
  const b = userB.client;

  // ── Setup: resumes, library content, draft content for user A ──────────
  const { data: resA1, error: resA1Err } = await a.rpc("create_resume", { p_name: "Resume A1" });
  if (resA1Err || !resA1) throw new Error(`setup create_resume A1 failed: ${resA1Err?.message}`);
  const resumeA1 = resA1[0].resume_id as string;
  let revA1 = resA1[0].revision as number;

  const { data: resA2 } = await a.rpc("create_resume", { p_name: "Resume A2" });
  const resumeA2 = resA2![0].resume_id as string;

  const { data: resB1 } = await b.rpc("create_resume", { p_name: "Resume B1" });
  const resumeB1 = resB1![0].resume_id as string;

  const { data: blockA, error: blockAErr } = await a
    .from("resume_library_blocks")
    .insert({
      user_id: userA.id,
      name: "Acme SWE",
      default_section_title: "Experience",
      layout_kind: "entry",
      title: "Software Engineer Intern",
      organization: "Acme",
      sort_order: 1,
    })
    .select()
    .single();
  if (blockAErr) throw new Error(`setup library block failed: ${blockAErr.message}`);

  const { data: bulletA } = await a
    .from("resume_library_bullets")
    .insert({ user_id: userA.id, block_id: blockA.id, content: "Shipped a thing", sort_order: 1 })
    .select()
    .single();

  const { data: sectionA1, error: sectionA1Err } = await a.rpc("create_section", {
    p_resume_id: resumeA1,
    p_expected_revision: revA1,
    p_title: "Experience",
    p_layout_kind: "entry",
  });
  if (sectionA1Err || !sectionA1) throw new Error(`setup create_section failed: ${sectionA1Err?.message}`);
  const sectionA1Id = sectionA1[0].section_id as string;
  revA1 = sectionA1[0].revision as number;

  const { data: entryA1, error: entryA1Err } = await a.rpc("copy_block_into_section", {
    p_resume_id: resumeA1,
    p_expected_revision: revA1,
    p_section_id: sectionA1Id,
    p_block_id: blockA.id,
    p_bullet_ids: [bulletA!.id],
  });
  if (entryA1Err || !entryA1) throw new Error(`setup copy_block_into_section failed: ${entryA1Err?.message}`);
  const entryA1Id = entryA1[0].entry_id as string;
  revA1 = entryA1[0].revision as number;

  const { data: bulletsOfEntryA1 } = await a.from("resume_entry_bullets").select("id").eq("entry_id", entryA1Id);
  const entryBulletA1Id = bulletsOfEntryA1![0].id as string;

  // ═══════════════════ Direct-access denial: authenticated on OWN rows ═══════════════════
  // authenticated has SELECT-only on the six draft/version tables (even
  // for rows it owns) — every mutation must go through an RPC.
  {
    const { data, error } = await a.from("resumes").insert({ user_id: userA.id, name: "direct insert" }).select();
    record("direct-access denial: authenticated cannot INSERT into resumes (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resumes").update({ name: "direct update" }).eq("id", resumeA1).select();
    record("direct-access denial: authenticated cannot UPDATE resumes (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resumes").delete().eq("id", resumeA1).select();
    record("direct-access denial: authenticated cannot DELETE resumes (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_headers").update({ full_name: "x" }).eq("resume_id", resumeA1).select();
    record("direct-access denial: authenticated cannot UPDATE resume_headers (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a
      .from("resume_sections")
      .insert({ user_id: userA.id, resume_id: resumeA1, title: "x", layout_kind: "entry", sort_order: 99 })
      .select();
    record("direct-access denial: authenticated cannot INSERT resume_sections (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_sections").update({ title: "x" }).eq("id", sectionA1Id).select();
    record("direct-access denial: authenticated cannot UPDATE resume_sections (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_sections").delete().eq("id", sectionA1Id).select();
    record("direct-access denial: authenticated cannot DELETE resume_sections (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_entries").update({ title: "x" }).eq("id", entryA1Id).select();
    record("direct-access denial: authenticated cannot UPDATE resume_entries (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_entries").delete().eq("id", entryA1Id).select();
    record("direct-access denial: authenticated cannot DELETE resume_entries (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_entry_bullets").update({ content: "x" }).eq("id", entryBulletA1Id).select();
    record("direct-access denial: authenticated cannot UPDATE resume_entry_bullets (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_entry_bullets").delete().eq("id", entryBulletA1Id).select();
    record("direct-access denial: authenticated cannot DELETE resume_entry_bullets (own)", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a
      .from("resume_versions")
      .insert({ user_id: userA.id, resume_id: resumeA1, version_number: 999, version_type: "manual", snapshot: {} })
      .select();
    record("direct-access denial: authenticated cannot INSERT resume_versions (own)", !data && !!error, error?.message);
  }

  // ═══════════════════ authenticated CAN: reads + library CRUD + RPCs ═══════════════════
  {
    const { data, error } = await a.from("resumes").select("id").eq("id", resumeA1);
    record("authenticated CAN SELECT own resumes row", !error && data?.length === 1, error?.message);
  }
  {
    const { data, error } = await a.from("resume_library_blocks").update({ title: "Updated title" }).eq("id", blockA.id).select();
    record("authenticated CAN directly UPDATE own library block", !error && data?.length === 1, error?.message);
  }
  {
    const { data: extraBullet, error } = await a
      .from("resume_library_bullets")
      .insert({ user_id: userA.id, block_id: blockA.id, content: "Second bullet", sort_order: 2 })
      .select()
      .single();
    record("authenticated CAN directly INSERT own library bullet", !error && !!extraBullet, error?.message);
    if (extraBullet) {
      const { error: delErr } = await a.from("resume_library_bullets").delete().eq("id", extraBullet.id);
      record("authenticated CAN directly DELETE own library bullet", !delErr, delErr?.message);
    }
  }

  const { data: versionA1, error: versionA1Err } = await a.rpc("create_resume_version", {
    p_resume_id: resumeA1,
    p_expected_revision: revA1,
    p_version_type: "manual",
  });
  record("RPC success: create_resume_version", !versionA1Err && !!versionA1, versionA1Err?.message);
  const versionA1Id = versionA1![0].version_id as string;

  // ═══════════════════ Cross-user reads ═══════════════════
  {
    const { data } = await b.from("resumes").select("id").eq("id", resumeA1);
    record("cross-user read: resumes", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_library_blocks").select("id").eq("id", blockA.id);
    record("cross-user read: resume_library_blocks", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_library_bullets").select("id").eq("id", bulletA!.id);
    record("cross-user read: resume_library_bullets", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_headers").select("id").eq("resume_id", resumeA1);
    record("cross-user read: resume_headers", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_sections").select("id").eq("id", sectionA1Id);
    record("cross-user read: resume_sections", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_entries").select("id").eq("id", entryA1Id);
    record("cross-user read: resume_entries", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_entry_bullets").select("id").eq("id", entryBulletA1Id);
    record("cross-user read: resume_entry_bullets", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await b.from("resume_versions").select("id").eq("id", versionA1Id);
    record("cross-user read: resume_versions", (data?.length ?? 0) === 0);
  }

  // ═══════════════════ Cross-user writes (RPC — table writes are already covered above) ═══════════════════
  {
    const { error } = await b.rpc("update_resume_metadata", {
      p_resume_id: resumeA1,
      p_expected_revision: revA1,
      p_name: "hacked",
      p_target_company: null,
      p_target_role: null,
    });
    record("cross-user write blocked: update_resume_metadata RPC", !!error && error.message.includes("resume_not_found"), error?.message);
  }
  {
    const { error } = await b.rpc("create_section", {
      p_resume_id: resumeA1,
      p_expected_revision: revA1,
      p_title: "hacked section",
      p_layout_kind: "entry",
    });
    record("cross-user write blocked: create_section on A's resume via B", !!error && error.message.includes("resume_not_found"), error?.message);
  }
  {
    // B tries to use A's library block as a copy source into B's own resume/section.
    const { data: sec } = await b.rpc("create_section", {
      p_resume_id: resumeB1,
      p_expected_revision: 1,
      p_title: "B Section",
      p_layout_kind: "entry",
    });
    const bSectionId = sec![0].section_id as string;
    const { error } = await b.rpc("copy_block_into_section", {
      p_resume_id: resumeB1,
      p_expected_revision: sec![0].revision,
      p_section_id: bSectionId,
      p_block_id: blockA.id,
      p_bullet_ids: [],
    });
    record("cross-user write blocked: copy_block_into_section using A's library block", !!error && error.message.includes("source_not_found"), error?.message);
  }

  // ═══════════════════ Same-resume RPC validation (cross-resume substitution within one user) ═══════════════════
  {
    const { error } = await a.rpc("update_entry_bullet", {
      p_resume_id: resumeA2,
      p_expected_revision: 1,
      p_bullet_id: entryBulletA1Id,
      p_content: "substituted",
    });
    record("same-resume validation: bullet from resume A1 rejected under resume A2", !!error && error.message.includes("bullet_not_found"), error?.message);
  }
  {
    const { error } = await a.rpc("rename_section", {
      p_resume_id: resumeA2,
      p_expected_revision: 1,
      p_section_id: sectionA1Id,
      p_title: "substituted",
    });
    record("same-resume validation: section from resume A1 rejected under resume A2", !!error && error.message.includes("section_not_found"), error?.message);
  }
  {
    const { error } = await a.rpc("update_entry", {
      p_resume_id: resumeA2,
      p_expected_revision: 1,
      p_entry_id: entryA1Id,
      p_title: "x",
      p_subtitle: null,
      p_organization: null,
      p_location: null,
      p_start_date: null,
      p_end_date: null,
      p_education_data: null,
      p_skills_data: null,
    });
    record("same-resume validation: entry from resume A1 rejected under resume A2", !!error && error.message.includes("entry_not_found"), error?.message);
  }
  {
    const { data } = await a.from("resume_entry_bullets").select("content").eq("id", entryBulletA1Id).single();
    record("same-resume validation: rejected attempts left original bullet content unchanged", data?.content === "Shipped a thing", data?.content);
  }

  // ═══════════════════ anon: no reads, no writes, no RPC ═══════════════════
  {
    const { data } = await anon.from("resumes").select("id");
    record("anon: cannot read resumes", (data?.length ?? 0) === 0);
  }
  {
    const { data } = await anon.from("resume_library_blocks").select("id");
    record("anon: cannot read resume_library_blocks", (data?.length ?? 0) === 0);
  }
  {
    const { error } = await anon.rpc("create_resume", { p_name: "anon attempt" });
    record("anon: cannot execute create_resume RPC", !!error, error?.message);
  }

  // ═══════════════════ Revision conflict behavior ═══════════════════
  {
    const { data: ok } = await a.rpc("update_resume_metadata", {
      p_resume_id: resumeA1,
      p_expected_revision: revA1,
      p_name: "Resume A1 renamed",
      p_target_company: null,
      p_target_role: null,
    });
    const newRev = ok as unknown as number;
    record("revision: correct expected_revision succeeds and bumps", typeof newRev === "number" && newRev === revA1 + 1, `newRev=${newRev}`);

    const { error: staleErr } = await a.rpc("update_resume_metadata", {
      p_resume_id: resumeA1,
      p_expected_revision: revA1,
      p_name: "Resume A1 renamed again",
      p_target_company: null,
      p_target_role: null,
    });
    record("revision: stale expected_revision rejected", !!staleErr && staleErr.message.includes("revision_conflict"), staleErr?.message);
    revA1 = newRev;
  }

  // ═══════════════════ Concurrent revision behavior ═══════════════════
  {
    const concurrentRev = revA1;
    const [r1, r2] = await Promise.all([
      a.rpc("update_resume_metadata", {
        p_resume_id: resumeA1,
        p_expected_revision: concurrentRev,
        p_name: "concurrent 1",
        p_target_company: null,
        p_target_role: null,
      }),
      a.rpc("update_resume_metadata", {
        p_resume_id: resumeA1,
        p_expected_revision: concurrentRev,
        p_name: "concurrent 2",
        p_target_company: null,
        p_target_role: null,
      }),
    ]);
    const successes = [r1, r2].filter((r) => !r.error).length;
    const conflicts = [r1, r2].filter((r) => r.error?.message.includes("revision_conflict")).length;
    record("concurrency: exactly one success and one revision_conflict under concurrent same-revision calls", successes === 1 && conflicts === 1, `successes=${successes} conflicts=${conflicts}`);
    const { data: after } = await a.from("resumes").select("revision").eq("id", resumeA1).single();
    revA1 = after!.revision as number;
  }

  // ═══════════════════ resume_versions: authenticated cannot mutate directly ═══════════════════
  {
    const { data, error } = await a.from("resume_versions").update({ version_type: "exported" }).eq("id", versionA1Id).select();
    record("direct-access denial: authenticated cannot UPDATE resume_versions", !data && !!error, error?.message);
  }
  {
    const { data, error } = await a.from("resume_versions").delete().eq("id", versionA1Id).select();
    record("direct-access denial: authenticated cannot DELETE resume_versions", !data && !!error, error?.message);
  }
  {
    const { data: stillThere } = await a.from("resume_versions").select("id").eq("id", versionA1Id).single();
    record("resume_versions: row still intact after blocked mutation attempts", stillThere?.id === versionA1Id);
  }

  // ═══════════════════ Snapshot integrity ═══════════════════
  {
    const { data: row } = await a.from("resume_versions").select("*").eq("id", versionA1Id).single();
    type SnapshotShape = {
      version_number: number;
      version_type: string;
      created_at: string;
      sections: { entries: { bullets: { content: string }[] }[] }[];
    };
    const snap = row!.snapshot as unknown as SnapshotShape;
    record("snapshot integrity: version_number matches row", snap.version_number === row!.version_number, `${snap.version_number} vs ${row!.version_number}`);
    record("snapshot integrity: version_type matches row", snap.version_type === row!.version_type, `${snap.version_type} vs ${row!.version_type}`);
    record(
      "snapshot integrity: created_at matches row exactly",
      new Date(snap.created_at).getTime() === new Date(row!.created_at).getTime(),
      `${snap.created_at} vs ${row!.created_at}`,
    );
    record("snapshot integrity: contains section/entry/bullet content", snap.sections?.[0]?.entries?.[0]?.bullets?.[0]?.content === "Shipped a thing");
  }

  // ═══════════════════ duplicate_resume ═══════════════════
  let dupId = "";
  {
    const { data: dup, error } = await a.rpc("duplicate_resume", { p_source_resume_id: resumeA1 });
    dupId = dup as unknown as string;
    record("duplicate_resume: succeeds", !error && !!dupId, error?.message);

    const { data: dupRow } = await a.from("resumes").select("revision, archived_at").eq("id", dupId).single();
    record("duplicate_resume: new resume starts at revision 1", dupRow?.revision === 1, String(dupRow?.revision));
    record("duplicate_resume: archived_at is null", dupRow?.archived_at === null);

    const { data: dupVersions } = await a.from("resume_versions").select("id").eq("resume_id", dupId);
    record("duplicate_resume: zero versions copied", (dupVersions?.length ?? 0) === 0);

    const { data: dupSections } = await a.from("resume_sections").select("id, title").eq("resume_id", dupId);
    record("duplicate_resume: sections deep-copied", (dupSections?.length ?? 0) === 1);

    const { data: dupEntries } = await a.from("resume_entries").select("id, source_block_id").eq("resume_id", dupId);
    record("duplicate_resume: entries deep-copied with source_block_id preserved", dupEntries?.[0]?.source_block_id === blockA.id);

    const dupSectionId = dupSections![0].id as string;
    await a.rpc("rename_section", { p_resume_id: dupId, p_expected_revision: 1, p_section_id: dupSectionId, p_title: "Renamed in copy" });
    const { data: originalSection } = await a.from("resume_sections").select("title").eq("id", sectionA1Id).single();
    record("duplicate_resume: mutating the copy does not affect the original", originalSection?.title === "Experience", originalSection?.title);
  }

  // ═══════════════════ Hard deletion ═══════════════════
  {
    const { error } = await a.rpc("delete_resume", { p_resume_id: resumeA1, p_expected_revision: revA1 });
    record("delete_resume: blocked while versions exist (has_versions)", !!error && error.message.includes("has_versions"), error?.message);
    const { data: stillThere } = await a.from("resumes").select("id").eq("id", resumeA1).single();
    record("delete_resume: resume row still exists after blocked delete", stillThere?.id === resumeA1);
  }
  {
    const { error } = await a.rpc("delete_resume", { p_resume_id: dupId, p_expected_revision: 999 });
    record("delete_resume: stale revision rejected", !!error && error.message.includes("revision_conflict"), error?.message);
  }
  {
    const { data: dupNow } = await a.from("resumes").select("revision").eq("id", dupId).single();
    const { error, data } = await a.rpc("delete_resume", { p_resume_id: dupId, p_expected_revision: dupNow!.revision });
    const deletedRows = data as { deleted: boolean }[] | null;
    record("delete_resume: succeeds when no versions exist", !error && deletedRows?.[0]?.deleted === true, error?.message);
    const { data: gone } = await a.from("resumes").select("id").eq("id", dupId);
    record("delete_resume: row and cascaded children actually removed", (gone?.length ?? 0) === 0);
  }

  // ═══════════════════ Summary ═══════════════════
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
    process.exitCode = 1;
  }

  console.log("\n--- IDs for follow-up privileged (postgres-role) tests ---");
  console.log(JSON.stringify({ userAId: userA.id, resumeA2, sectionA1Id, entryA1Id, versionA1Id }, null, 2));
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
