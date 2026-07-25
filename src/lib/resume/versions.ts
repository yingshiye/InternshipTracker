import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { callResumeRpc, type RpcResult } from "./rpc";
import type { ResumeVersion, VersionType } from "./types";
import { VERSION_TYPES } from "./types";
import { ValidationError } from "./validate";

/**
 * Auto-save must never call this — only an explicit user action (a manual
 * checkpoint, an export, a submission) should. Nothing in Step 1's
 * data-access layer calls it automatically. No UI exposes it yet either
 * (Step 1 scope is the tested foundation only; the checkpoint/version-
 * history UI is Step 3).
 */
export async function createResumeVersion(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  versionType: VersionType,
): Promise<RpcResult<{ version_id: string; version_number: number; created_at: string }[]>> {
  if (!VERSION_TYPES.includes(versionType)) throw new ValidationError("Invalid version_type");
  return callResumeRpc(supabase, "create_resume_version", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_version_type: versionType,
  });
}

export async function listVersions(
  supabase: SupabaseClient<Database>,
  resumeId: string,
): Promise<ResumeVersion[]> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("resume_id", resumeId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
