import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { callResumeRpc, type RpcResult } from "./rpc";
import type { ResumeVersion, VersionType } from "./types";
import { VERSION_TYPES } from "./types";
import { ValidationError } from "./validate";

/**
 * Auto-save must never call this — only an explicit user action (a manual
 * checkpoint, an export, a submission) should. Nothing in the data-access
 * layer calls it automatically, and the editor controller's debounced
 * autosave path has no route to it.
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

/**
 * Version rows without the `snapshot` column. The list view only needs
 * metadata, and the snapshot is by far the largest thing in the table —
 * fetching every one of them to render a list is a lot of bytes for nothing.
 * Snapshots are loaded one at a time, on demand, by `getVersion`.
 */
export type VersionSummary = Pick<
  ResumeVersion,
  "id" | "resume_id" | "version_number" | "version_type" | "created_at"
>;

export async function listVersionSummaries(
  supabase: SupabaseClient<Database>,
  resumeId: string,
): Promise<VersionSummary[]> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("id, resume_id, version_number, version_type, created_at")
    .eq("resume_id", resumeId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VersionSummary[];
}

export async function getVersion(
  supabase: SupabaseClient<Database>,
  versionId: string,
): Promise<ResumeVersion | null> {
  const { data, error } = await supabase
    .from("resume_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Restore the draft from one of its own versions, in a single atomic database
 * operation — not a replay of many client RPC calls.
 *
 * The client sends only ids plus the expected revision; the snapshot is read
 * server-side from the immutable row, so this path cannot be used to inject
 * arbitrary content. Returns the new draft revision. Every version survives,
 * including the one restored from.
 */
export async function restoreResumeFromVersion(
  supabase: SupabaseClient<Database>,
  resumeId: string,
  expectedRevision: number,
  versionId: string,
): Promise<RpcResult<number>> {
  return callResumeRpc(supabase, "restore_resume_from_version", {
    p_resume_id: resumeId,
    p_expected_revision: expectedRevision,
    p_version_id: versionId,
  });
}
