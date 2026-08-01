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
  // Step 3
  | "version_not_found"
  | "version_resume_mismatch"
  | "application_not_found"
  | "invalid_version_type"
  | "replacement_not_confirmed"
  | "direct_version_association_not_allowed"
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
  // Step 3. "version_resume_mismatch" precedes nothing it could shadow, but
  // "replacement_not_confirmed" must stay after "removal_not_confirmed" is
  // irrelevant — they share no substring; the ordering rule only binds pairs
  // where one reason literally contains another.
  "version_resume_mismatch",
  "version_not_found",
  "application_not_found",
  "invalid_version_type",
  "replacement_not_confirmed",
  "direct_version_association_not_allowed",
];

/**
 * User-facing text for a failure reason.
 *
 * Every message the editor shows goes through here so a raw Postgres or
 * PostgREST string can never reach the screen: `RpcResult.message` carries the
 * original for logs and debugging, but the UI reads this instead.
 */
const REASON_MESSAGES: Record<RpcErrorReason, string> = {
  not_authenticated: "You are signed out. Sign in again to continue.",
  resume_not_found: "This resume could not be found.",
  section_not_found: "That section no longer exists.",
  entry_not_found: "That entry no longer exists.",
  bullet_not_found: "That bullet no longer exists.",
  header_not_found: "This resume's header could not be found.",
  has_versions: "This resume has saved versions, so it can be archived but not deleted.",
  revision_conflict: "This resume was changed somewhere else.",
  layout_kind_mismatch: "That block does not fit this section's layout.",
  source_not_found: "The original library block could not be found.",
  source_bullet_not_found: "That library bullet could not be found.",
  no_source_block: "This entry is not linked to a library block.",
  section_not_empty: "Remove the entries in this section before deleting it.",
  invalid_reorder_set: "The new order did not match the current items. Reload and try again.",
  invalid_field_selection: "One of the selected fields is not a field that can be updated.",
  invalid_selection: "Part of that selection is no longer valid. Reload and try again.",
  conflicting_selection: "That selection conflicts with itself.",
  removal_not_confirmed: "Confirm the removals before applying this update.",
  block_not_found: "That library block could not be found.",
  invalid_snapshot: "This version's stored data could not be read.",
  version_not_found: "That version could not be found.",
  version_resume_mismatch: "That version belongs to a different resume.",
  application_not_found: "That application could not be found.",
  invalid_version_type: "Only a submitted version can be attached to an application.",
  replacement_not_confirmed: "This application already has a resume version attached.",
  direct_version_association_not_allowed:
    "A resume version can only be attached through the submit flow.",
  unknown: "Something went wrong. Please try again.",
};

export function describeRpcError(reason: RpcErrorReason): string {
  return REASON_MESSAGES[reason] ?? REASON_MESSAGES.unknown;
}

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
