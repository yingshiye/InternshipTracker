import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Resume, ResumeHeader, ResumeSection, ResumeEntry, ResumeEntryBullet } from "./types";

/**
 * The full editable draft graph for one resume: the resumes row, its header,
 * and its sections → entries → bullets (each ordered by sort_order). All reads
 * only — mutations go through the RPC wrappers. RLS scopes every table to the
 * owner, so no explicit user filter is needed here.
 */
export type ResumeDraft = {
  resume: Resume;
  header: ResumeHeader | null;
  sections: ResumeSection[];
  entries: ResumeEntry[];
  bullets: ResumeEntryBullet[];
};

export async function loadResumeDraft(
  supabase: SupabaseClient<Database>,
  resumeId: string,
): Promise<ResumeDraft | null> {
  const { data: resume, error: resumeErr } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .maybeSingle();
  if (resumeErr) throw resumeErr;
  if (!resume) return null;

  const [{ data: header, error: hErr }, { data: sections, error: sErr }, { data: entries, error: eErr }, { data: bullets, error: bErr }] =
    await Promise.all([
      supabase.from("resume_headers").select("*").eq("resume_id", resumeId).maybeSingle(),
      supabase.from("resume_sections").select("*").eq("resume_id", resumeId).order("sort_order", { ascending: true }),
      supabase.from("resume_entries").select("*").eq("resume_id", resumeId).order("sort_order", { ascending: true }),
      supabase.from("resume_entry_bullets").select("*").eq("resume_id", resumeId).order("sort_order", { ascending: true }),
    ]);
  if (hErr) throw hErr;
  if (sErr) throw sErr;
  if (eErr) throw eErr;
  if (bErr) throw bErr;

  return {
    resume,
    header: header ?? null,
    sections: sections ?? [],
    entries: entries ?? [],
    bullets: bullets ?? [],
  };
}
