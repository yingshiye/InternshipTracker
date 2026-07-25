import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type RpcErrorReason =
  | "not_authenticated"
  | "resume_not_found"
  | "section_not_found"
  | "entry_not_found"
  | "bullet_not_found"
  | "header_not_found"
  | "has_versions"
  | "revision_conflict"
  | "layout_kind_mismatch"
  | "source_not_found"
  | "source_bullet_not_found"
  | "no_source_block"
  | "section_not_empty"
  | "invalid_reorder_set"
  | "invalid_field_selection"
  | "invalid_selection"
  | "conflicting_selection"
  | "removal_not_confirmed"
  | "block_not_found"
  | "invalid_snapshot"
  | "unknown";

export type RpcResult<T> = { ok: true; data: T } | { ok: false; reason: RpcErrorReason; message: string };

// Message text is matched by substring since PostgREST may prefix/suffix the
// raw `raise exception` text. Order matters: any reason that is a substring
// of another must be listed AFTER the longer one, or the longer error would
// be mis-mapped (e.g. "source_bullet_not_found" contains "bullet_not_found",
// and "source_not_found" — so both source_* variants precede the shorter
// ones here).
const KNOWN_REASONS: RpcErrorReason[] = [
  "not_authenticated",
  "resume_not_found",
  "section_not_found",
  "entry_not_found",
  "source_bullet_not_found",
  "bullet_not_found",
  "block_not_found",
  "header_not_found",
  "has_versions",
  "revision_conflict",
  "layout_kind_mismatch",
  "source_not_found",
  "no_source_block",
  "section_not_empty",
  "invalid_reorder_set",
  "invalid_field_selection",
  "conflicting_selection",
  "invalid_selection",
  "removal_not_confirmed",
  "invalid_snapshot",
];

/**
 * Shared wrapper for every resume-builder RPC call. Maps the fixed
 * vocabulary of exceptions raised by the SECURITY DEFINER functions into a
 * typed discriminated result, so callers never have to pattern-match raw
 * Postgres error text themselves and a genuinely unexpected error is never
 * silently swallowed (it surfaces as reason: "unknown").
 */
export async function callResumeRpc<Name extends keyof Database["public"]["Functions"]>(
  supabase: SupabaseClient<Database>,
  fn: Name,
  args: Database["public"]["Functions"][Name]["Args"],
): Promise<RpcResult<Database["public"]["Functions"][Name]["Returns"]>> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) {
    const reason = KNOWN_REASONS.find((r) => error.message.includes(r)) ?? "unknown";
    return { ok: false, reason, message: error.message };
  }
  return { ok: true, data: data as Database["public"]["Functions"][Name]["Returns"] };
}
