import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";
import { callResumeRpc, type RpcResult } from "./rpc";

/**
 * Associating an immutable `submitted` version with an application.
 *
 * There is deliberately no direct-write helper here. `applications` allows
 * ordinary client CRUD for its own columns, but `submitted_resume_version_id`
 * is guarded by a database trigger that rejects any write not made inside
 * `set_application_resume_version`, and the generated `Update` type for the
 * table does not include the column — so a direct write fails to compile
 * *and* fails at the database.
 */

export type ApplicationSummary = Pick<
  Tables<"applications">,
  "id" | "company" | "role" | "status" | "applied_date" | "submitted_resume_version_id"
>;

/**
 * Summary columns only. An application row carries notes and other free text
 * that a resume picker has no use for, and the picker may list many of them.
 */
export async function listApplicationSummaries(
  supabase: SupabaseClient<Database>,
): Promise<ApplicationSummary[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, status, applied_date, submitted_resume_version_id")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApplicationSummary[];
}

/**
 * Link a submitted version to an application, or clear the link by passing
 * null. `confirmReplace` must be true to overwrite an existing, different
 * association — otherwise the RPC raises `replacement_not_confirmed` and
 * nothing changes, so a replacement can never happen silently.
 */
export async function setApplicationResumeVersion(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  resumeVersionId: string | null,
  confirmReplace = false,
): Promise<RpcResult<boolean>> {
  return callResumeRpc(supabase, "set_application_resume_version", {
    p_application_id: applicationId,
    p_resume_version_id: resumeVersionId,
    p_confirm_replace: confirmReplace,
  });
}

export type TargetMismatch = {
  field: "company" | "role";
  applicationValue: string;
  resumeValue: string | null;
};

/**
 * Compare an application's company/role against the resume's target metadata.
 *
 * Pure and read-only: it reports the difference and nothing else. Neither side
 * is ever rewritten to match the other — which of the two is wrong is the
 * user's call, not a thing to guess.
 *
 * Comparison is case-insensitive and whitespace-normalized, so "acme  corp"
 * and "Acme Corp" do not register as a mismatch. A resume with no target set
 * is reported as a mismatch so the user is prompted to fill it in.
 */
export function findTargetMismatches(
  application: { company: string; role: string },
  resume: { target_company: string | null; target_role: string | null },
): TargetMismatch[] {
  const norm = (v: string | null | undefined) => (v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  const out: TargetMismatch[] = [];

  if (norm(application.company) !== norm(resume.target_company)) {
    out.push({
      field: "company",
      applicationValue: application.company,
      resumeValue: resume.target_company?.trim() ? resume.target_company : null,
    });
  }
  if (norm(application.role) !== norm(resume.target_role)) {
    out.push({
      field: "role",
      applicationValue: application.role,
      resumeValue: resume.target_role?.trim() ? resume.target_role : null,
    });
  }
  return out;
}
