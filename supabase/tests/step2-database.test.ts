/**
 * Real-database verification for the Resume Builder Step 2 editor RPCs:
 * add_custom_entry, add_custom_bullet, apply_library_update,
 * move_entry_to_position, save_bullet_as_library_bullet, restore_entry,
 * restore_bullet, restore_section.
 *
 * Covers, per RPC where applicable: success, exact +1 revision increment,
 * revision conflict, cross-user rejection, cross-resume substitution,
 * parent/same-resume consistency, invalid layout, invalid ordering,
 * source deletion/staleness, atomic rollback, and RPC execute privileges
 * (anon denied).
 *
 * NOT part of `npm test` — requires a running local Supabase stack. Run:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<local anon key> \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role key, used ONLY to
 *     provision test users via the admin API> \
 *   npx tsx supabase/tests/step2-database.test.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
// Fail closed: never run against a hosted project.
if (!/(127\.0\.0\.1|localhost)/.test(URL)) {
  console.error(`Refusing to run against non-local Supabase URL: ${URL}`);
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

/** Assert an RPC call errored with a message containing `reason`. */
function expectErr(name: string, error: { message: string } | null, reason: string) {
  if (error && error.message.includes(reason)) record(name, true);
  else record(name, false, `expected '${reason}', got: ${error ? error.message : "no error"}`);
}

async function revisionOf(c: SupabaseClient, resumeId: string): Promise<number> {
  const { data } = await c.from("resumes").select("revision").eq("id", resumeId).single();
  return (data as { revision: number }).revision;
}

async function main() {
  const admin = createClient(URL!, SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const anon = createClient(URL!, ANON_KEY!);
  const stamp = Date.now();
  const userA = await makeUser(admin, `s2a-${stamp}@example.com`, "correct horse battery staple 1");
  const userB = await makeUser(admin, `s2b-${stamp}@example.com`, "correct horse battery staple 2");
  const a = userA.client;
  const b = userB.client;

  // ── Setup A: resume + entry section + education section + library block ──
  const { data: rA } = await a.rpc("create_resume", { p_name: "S2 Resume A" });
  const resumeA = rA![0].resume_id as string;
  let revA = rA![0].revision as number;

  const { data: secExp } = await a.rpc("create_section", {
    p_resume_id: resumeA, p_expected_revision: revA, p_title: "Experience", p_layout_kind: "entry",
  });
  const sectionExp = secExp![0].section_id as string;
  revA = secExp![0].revision as number;

  const { data: secEdu } = await a.rpc("create_section", {
    p_resume_id: resumeA, p_expected_revision: revA, p_title: "Education", p_layout_kind: "education",
  });
  const sectionEdu = secEdu![0].section_id as string;
  revA = secEdu![0].revision as number;

  const { data: secExp2 } = await a.rpc("create_section", {
    p_resume_id: resumeA, p_expected_revision: revA, p_title: "Projects", p_layout_kind: "entry",
  });
  const sectionExp2 = secExp2![0].section_id as string;
  revA = secExp2![0].revision as number;

  const { data: blockA } = await a.from("resume_library_blocks").insert({
    user_id: userA.id, name: "Acme SWE", default_section_title: "Experience",
    layout_kind: "entry", title: "SWE Intern", organization: "Acme", sort_order: 1,
  }).select().single();
  const { data: libBullet1 } = await a.from("resume_library_bullets").insert({
    user_id: userA.id, block_id: blockA!.id, content: "Original bullet one", sort_order: 1,
  }).select().single();
  const { data: libBullet2 } = await a.from("resume_library_bullets").insert({
    user_id: userA.id, block_id: blockA!.id, content: "Original bullet two", sort_order: 2,
  }).select().single();

  // ── add_custom_entry ────────────────────────────────────────────────────
  {
    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("add_custom_entry", {
      p_resume_id: resumeA, p_expected_revision: revA, p_section_id: sectionExp,
      p_title: "Custom Co", p_subtitle: null, p_organization: "Custom Org", p_location: null,
      p_start_date: "2025-06-01", p_end_date: null, p_education_data: null, p_skills_data: null,
    });
    record("add_custom_entry: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("add_custom_entry: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    const customEntryId = data![0].entry_id as string;
    const { data: row } = await a.from("resume_entries").select("source_block_id,section_id").eq("id", customEntryId).single();
    record("add_custom_entry: source_block_id null", (row as { source_block_id: string | null }).source_block_id === null);

    // invalid layout: education_data into an 'entry' section
    const { error: eLayout } = await a.rpc("add_custom_entry", {
      p_resume_id: resumeA, p_expected_revision: revA, p_section_id: sectionExp,
      p_title: null, p_subtitle: null, p_organization: null, p_location: null,
      p_start_date: null, p_end_date: null, p_education_data: { school: "X" }, p_skills_data: null,
    });
    expectErr("add_custom_entry: invalid layout rejected", eLayout, "layout_kind_mismatch");

    // revision conflict
    const { error: eRev } = await a.rpc("add_custom_entry", {
      p_resume_id: resumeA, p_expected_revision: revA - 1, p_section_id: sectionExp,
      p_title: "x", p_subtitle: null, p_organization: null, p_location: null,
      p_start_date: null, p_end_date: null, p_education_data: null, p_skills_data: null,
    });
    expectErr("add_custom_entry: revision conflict", eRev, "revision_conflict");

    // cross-user: B cannot add into A's section
    const { error: eXUser } = await b.rpc("add_custom_entry", {
      p_resume_id: resumeA, p_expected_revision: revA, p_section_id: sectionExp,
      p_title: "x", p_subtitle: null, p_organization: null, p_location: null,
      p_start_date: null, p_end_date: null, p_education_data: null, p_skills_data: null,
    });
    expectErr("add_custom_entry: cross-user rejected", eXUser, "resume_not_found");
  }

  // ── add_custom_bullet ───────────────────────────────────────────────────
  // First create an entry from library to attach bullets to.
  const { data: copiedEntry } = await a.rpc("copy_block_into_section", {
    p_resume_id: resumeA, p_expected_revision: revA, p_section_id: sectionExp,
    p_block_id: blockA!.id, p_bullet_ids: [libBullet1!.id, libBullet2!.id],
  });
  const entryId = copiedEntry![0].entry_id as string;
  revA = copiedEntry![0].revision as number;
  {
    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("add_custom_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId, p_content: "A custom bullet",
    });
    record("add_custom_bullet: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("add_custom_bullet: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    const { data: brow } = await a.from("resume_entry_bullets").select("source_bullet_id").eq("id", data![0].bullet_id).single();
    record("add_custom_bullet: source_bullet_id null", (brow as { source_bullet_id: string | null }).source_bullet_id === null);

    // cross-resume substitution: B's resume with A's entry
    const { data: rB } = await b.rpc("create_resume", { p_name: "S2 Resume B" });
    const resumeB = rB![0].resume_id as string;
    const revB = rB![0].revision as number;
    const { error: eSub } = await b.rpc("add_custom_bullet", {
      p_resume_id: resumeB, p_expected_revision: revB, p_entry_id: entryId, p_content: "x",
    });
    expectErr("add_custom_bullet: cross-resume substitution rejected", eSub, "entry_not_found");

    // anon privilege denial
    const { error: eAnon } = await anon.rpc("add_custom_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId, p_content: "x",
    });
    record("add_custom_bullet: anon denied", !!eAnon, eAnon?.message);
  }

  // ── move_entry_to_position ──────────────────────────────────────────────
  {
    // Two entries in sectionExp: customEntry + copiedEntry. Get current order.
    const { data: ents } = await a.from("resume_entries").select("id,sort_order")
      .eq("section_id", sectionExp).order("sort_order");
    const ids = (ents as { id: string }[]).map((e) => e.id);
    const before = await revisionOf(a, resumeA);
    // reverse order within section
    const reversed = [...ids].reverse();
    const { data, error } = await a.rpc("move_entry_to_position", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: ids[0],
      p_target_section_id: sectionExp, p_ordered_entry_ids: reversed,
    });
    record("move_entry_to_position: within-section success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("move_entry_to_position: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;

    // invalid ordering set (missing an id)
    const { error: eSet } = await a.rpc("move_entry_to_position", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: ids[0],
      p_target_section_id: sectionExp, p_ordered_entry_ids: [ids[0]],
    });
    expectErr("move_entry_to_position: invalid reorder set rejected", eSet, "invalid_reorder_set");

    // cross-section into incompatible layout (entry -> education section)
    const { error: eLayout } = await a.rpc("move_entry_to_position", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: ids[0],
      p_target_section_id: sectionEdu, p_ordered_entry_ids: [ids[0]],
    });
    expectErr("move_entry_to_position: incompatible layout rejected", eLayout, "layout_kind_mismatch");

    // cross-section compatible move (entry -> Projects section)
    const before2 = await revisionOf(a, resumeA);
    const { data: mv2, error: eMv2 } = await a.rpc("move_entry_to_position", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: ids[0],
      p_target_section_id: sectionExp2, p_ordered_entry_ids: [ids[0]],
    });
    record("move_entry_to_position: cross-section compatible success", !eMv2 && !!mv2, eMv2?.message);
    revA = mv2![0].revision as number;
    // moved entry now belongs to sectionExp2, and source renumbered contiguously
    const { data: movedRow } = await a.from("resume_entries").select("section_id,sort_order").eq("id", ids[0]).single();
    record("move_entry_to_position: entry now in target section",
      (movedRow as { section_id: string }).section_id === sectionExp2);
    const { data: srcRows } = await a.from("resume_entries").select("sort_order").eq("section_id", sectionExp).order("sort_order");
    const orders = (srcRows as { sort_order: number }[]).map((r) => r.sort_order);
    record("move_entry_to_position: source renumbered contiguous",
      orders.every((o, i) => o === i + 1), JSON.stringify(orders));
    void before2;
  }

  // ── apply_library_update ────────────────────────────────────────────────
  {
    // Diverge the library from the copied entry: change block title, edit lib bullet 1, delete lib bullet 2, add lib bullet 3.
    await a.from("resume_library_blocks").update({ title: "Senior SWE Intern" }).eq("id", blockA!.id);
    await a.from("resume_library_bullets").update({ content: "Updated bullet one" }).eq("id", libBullet1!.id);
    const { data: libBullet3 } = await a.from("resume_library_bullets").insert({
      user_id: userA.id, block_id: blockA!.id, content: "Brand new library bullet", sort_order: 3,
    }).select().single();

    // Current entry bullets (the two copied from library).
    const { data: eb } = await a.from("resume_entry_bullets").select("id,source_bullet_id,content")
      .eq("entry_id", entryId).not("source_bullet_id", "is", null);
    const changedBullet = (eb as { id: string; source_bullet_id: string }[])
      .find((x) => x.source_bullet_id === libBullet1!.id)!;

    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("apply_library_update", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId,
      p_apply_fields: ["title"], p_update_bullet_ids: [changedBullet.id],
      p_add_library_bullet_ids: [libBullet3!.id], p_remove_bullet_ids: [], p_confirm_removals: false,
    });
    record("apply_library_update: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("apply_library_update: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    record("apply_library_update: counts", data![0].fields_applied === 1 && data![0].bullets_updated === 1
      && data![0].bullets_added === 1 && data![0].bullets_removed === 0, JSON.stringify(data![0]));
    const { data: entryAfter } = await a.from("resume_entries").select("title,source_block_updated_at").eq("id", entryId).single();
    record("apply_library_update: field applied", (entryAfter as { title: string }).title === "Senior SWE Intern");
    record("apply_library_update: source_block_updated_at re-stamped",
      (entryAfter as { source_block_updated_at: string | null }).source_block_updated_at !== null);
    const { data: updatedBullet } = await a.from("resume_entry_bullets").select("content").eq("id", changedBullet.id).single();
    record("apply_library_update: bullet content synced",
      (updatedBullet as { content: string }).content === "Updated bullet one");

    // removal without confirmation rejected
    const { data: anyBullet } = await a.from("resume_entry_bullets").select("id").eq("entry_id", entryId).limit(1).single();
    const { error: eConfirm } = await a.rpc("apply_library_update", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId,
      p_apply_fields: [], p_update_bullet_ids: [], p_add_library_bullet_ids: [],
      p_remove_bullet_ids: [(anyBullet as { id: string }).id], p_confirm_removals: false,
    });
    expectErr("apply_library_update: removal not confirmed", eConfirm, "removal_not_confirmed");

    // invalid field selection
    const { error: eField } = await a.rpc("apply_library_update", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId,
      p_apply_fields: ["not_a_field"], p_update_bullet_ids: [], p_add_library_bullet_ids: [],
      p_remove_bullet_ids: [], p_confirm_removals: false,
    });
    expectErr("apply_library_update: invalid field selection", eField, "invalid_field_selection");

    // stale add (delete lib bullet 2 then try to add it) → rejected, atomic rollback
    await a.from("resume_library_bullets").delete().eq("id", libBullet2!.id);
    const revBeforeStale = await revisionOf(a, resumeA);
    const { error: eStale } = await a.rpc("apply_library_update", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId,
      p_apply_fields: [], p_update_bullet_ids: [], p_add_library_bullet_ids: [libBullet2!.id],
      p_remove_bullet_ids: [], p_confirm_removals: false,
    });
    expectErr("apply_library_update: stale add rejected", eStale, "invalid_selection");
    const revAfterStale = await revisionOf(a, resumeA);
    record("apply_library_update: atomic rollback (no revision change)", revAfterStale === revBeforeStale, `${revBeforeStale}->${revAfterStale}`);
  }

  // ── save_bullet_as_library_bullet ───────────────────────────────────────
  {
    // Add a custom (unsourced) bullet, edit-free, then save it to the library block.
    const { data: cb } = await a.rpc("add_custom_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId, p_content: "Worth reusing",
    });
    revA = cb![0].revision as number;
    const customBulletId = cb![0].bullet_id as string;

    const libCountBefore = (await a.from("resume_library_bullets").select("id").eq("block_id", blockA!.id)).data!.length;
    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("save_bullet_as_library_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_bullet_id: customBulletId, p_block_id: blockA!.id,
    });
    record("save_bullet_as_library_bullet: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("save_bullet_as_library_bullet: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    const newLibId = data![0].library_bullet_id as string;
    const { data: relinked } = await a.from("resume_entry_bullets").select("source_bullet_id,content").eq("id", customBulletId).single();
    record("save_bullet_as_library_bullet: resume bullet re-linked",
      (relinked as { source_bullet_id: string }).source_bullet_id === newLibId);
    record("save_bullet_as_library_bullet: resume text unchanged",
      (relinked as { content: string }).content === "Worth reusing");
    const libCountAfter = (await a.from("resume_library_bullets").select("id").eq("block_id", blockA!.id)).data!.length;
    record("save_bullet_as_library_bullet: exactly one library bullet added", libCountAfter === libCountBefore + 1);

    // cross-user destination block rejected
    const { data: blockB } = await b.from("resume_library_blocks").insert({
      user_id: userB.id, name: "B block", default_section_title: "Experience", layout_kind: "entry", sort_order: 1,
    }).select().single();
    const { error: eBlock } = await a.rpc("save_bullet_as_library_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_bullet_id: customBulletId, p_block_id: blockB!.id,
    });
    expectErr("save_bullet_as_library_bullet: cross-user block rejected", eBlock, "block_not_found");
  }

  // ── restore_bullet ──────────────────────────────────────────────────────
  {
    // Delete a bullet, then restore it at position 1.
    const { data: bullets } = await a.from("resume_entry_bullets").select("id,content,source_bullet_id,sort_order")
      .eq("entry_id", entryId).order("sort_order");
    const target = (bullets as { id: string; content: string; source_bullet_id: string | null }[])[0];
    const { data: rm } = await a.rpc("remove_entry_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_bullet_id: target.id,
    });
    revA = rm as number;

    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("restore_bullet", {
      p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId, p_position: 1,
      p_content: target.content, p_source_bullet_id: target.source_bullet_id,
    });
    record("restore_bullet: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("restore_bullet: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    const { data: restored } = await a.from("resume_entry_bullets").select("content,sort_order").eq("id", data![0].bullet_id).single();
    record("restore_bullet: content + position", (restored as { content: string; sort_order: number }).content === target.content
      && (restored as { sort_order: number }).sort_order === 1);
  }

  // ── restore_entry ───────────────────────────────────────────────────────
  {
    // Capture the copied entry + its bullets, delete it, then restore.
    const { data: entryRow } = await a.from("resume_entries").select("*").eq("id", entryId).single();
    const e = entryRow as Record<string, unknown>;
    const { data: bulletRows } = await a.from("resume_entry_bullets").select("content,source_bullet_id,sort_order")
      .eq("entry_id", entryId).order("sort_order");
    const bulletsSnapshot = (bulletRows as { content: string; source_bullet_id: string | null }[])
      .map((x) => ({ content: x.content, source_bullet_id: x.source_bullet_id }));

    const { data: rm } = await a.rpc("remove_entry", { p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: entryId });
    revA = rm as number;

    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("restore_entry", {
      p_resume_id: resumeA, p_expected_revision: revA, p_section_id: e.section_id, p_position: 1,
      p_title: e.title, p_subtitle: e.subtitle, p_organization: e.organization, p_location: e.location,
      p_start_date: e.start_date, p_end_date: e.end_date, p_education_data: e.education_data, p_skills_data: e.skills_data,
      p_source_block_id: e.source_block_id, p_bullets: bulletsSnapshot,
    });
    record("restore_entry: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("restore_entry: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    const newEntryId = data![0].entry_id as string;
    const { data: restoredBullets } = await a.from("resume_entry_bullets").select("id").eq("entry_id", newEntryId);
    record("restore_entry: bullets restored", (restoredBullets as unknown[]).length === bulletsSnapshot.length,
      `${(restoredBullets as unknown[]).length} vs ${bulletsSnapshot.length}`);
    record("restore_entry: returned bullet_ids match count",
      (data![0].bullet_ids as string[]).length === bulletsSnapshot.length);

    // staleness: restore with a source_block_id that no longer exists → nulled, not rejected
    await a.from("resume_library_blocks").delete().eq("id", blockA!.id);
    const { data: rm2 } = await a.rpc("remove_entry", { p_resume_id: resumeA, p_expected_revision: revA, p_entry_id: newEntryId });
    revA = rm2 as number;
    const { data: restore2, error: eRestore2 } = await a.rpc("restore_entry", {
      p_resume_id: resumeA, p_expected_revision: revA, p_section_id: e.section_id, p_position: 1,
      p_title: e.title, p_subtitle: null, p_organization: e.organization, p_location: null,
      p_start_date: e.start_date, p_end_date: null, p_education_data: null, p_skills_data: null,
      p_source_block_id: blockA!.id, p_bullets: bulletsSnapshot,
    });
    record("restore_entry: stale source tolerated", !eRestore2 && !!restore2, eRestore2?.message);
    revA = restore2![0].revision as number;
    const { data: rEntry } = await a.from("resume_entries").select("source_block_id").eq("id", restore2![0].entry_id).single();
    record("restore_entry: stale source nulled", (rEntry as { source_block_id: string | null }).source_block_id === null);

    // restore_entry into a nonexistent section → rejected
    const { error: eSec } = await a.rpc("restore_entry", {
      p_resume_id: resumeA, p_expected_revision: revA, p_section_id: "00000000-0000-0000-0000-000000000000", p_position: 1,
      p_title: "x", p_subtitle: null, p_organization: null, p_location: null,
      p_start_date: null, p_end_date: null, p_education_data: null, p_skills_data: null,
      p_source_block_id: null, p_bullets: [],
    });
    expectErr("restore_entry: missing section rejected", eSec, "section_not_found");
  }

  // ── restore_section ─────────────────────────────────────────────────────
  {
    // Delete the (empty) Projects section, then restore it at its position.
    const { data: emptySec } = await a.rpc("create_section", {
      p_resume_id: resumeA, p_expected_revision: revA, p_title: "Awards", p_layout_kind: "entry",
    });
    revA = emptySec![0].revision as number;
    const awardsId = emptySec![0].section_id as string;
    const { data: secRow } = await a.from("resume_sections").select("sort_order").eq("id", awardsId).single();
    const pos = (secRow as { sort_order: number }).sort_order;
    const { data: del } = await a.rpc("delete_section", { p_resume_id: resumeA, p_expected_revision: revA, p_section_id: awardsId });
    revA = del as number;

    const before = await revisionOf(a, resumeA);
    const { data, error } = await a.rpc("restore_section", {
      p_resume_id: resumeA, p_expected_revision: revA, p_position: pos, p_title: "Awards", p_layout_kind: "entry",
    });
    record("restore_section: success", !error && !!data, error?.message);
    const after = await revisionOf(a, resumeA);
    record("restore_section: revision +1", after === before + 1, `${before}->${after}`);
    revA = data![0].revision as number;
    const { data: newSec } = await a.from("resume_sections").select("title,layout_kind,sort_order").eq("id", data![0].section_id).single();
    record("restore_section: title/layout/position", (newSec as { title: string; layout_kind: string; sort_order: number }).title === "Awards"
      && (newSec as { layout_kind: string }).layout_kind === "entry"
      && (newSec as { sort_order: number }).sort_order === pos);

    // anon denied
    const { error: eAnon } = await anon.rpc("restore_section", {
      p_resume_id: resumeA, p_expected_revision: revA, p_position: 1, p_title: "x", p_layout_kind: "entry",
    });
    record("restore_section: anon denied", !!eAnon, eAnon?.message);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────
  await admin.from("resume_entry_bullets").delete().eq("user_id", userA.id);
  await admin.from("resume_entries").delete().eq("user_id", userA.id);
  await admin.from("resume_sections").delete().eq("user_id", userA.id);
  await admin.from("resume_headers").delete().eq("user_id", userA.id);
  await admin.from("resume_library_bullets").delete().eq("user_id", userA.id);
  await admin.from("resume_library_bullets").delete().eq("user_id", userB.id);
  await admin.from("resume_library_blocks").delete().eq("user_id", userA.id);
  await admin.from("resume_library_blocks").delete().eq("user_id", userB.id);
  await admin.from("resumes").delete().eq("user_id", userA.id);
  await admin.from("resumes").delete().eq("user_id", userB.id);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);

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
