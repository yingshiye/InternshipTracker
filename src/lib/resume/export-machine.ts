/**
 * Export state machine.
 *
 * Pure reducer, deliberately separate from React so the ordering rules can be
 * unit-tested: an immutable `exported` version must be created *before*
 * `window.print()`, never after, and a second export attempt must not be able
 * to start while one is in flight.
 *
 * One thing this machine explicitly does not model: whether the user actually
 * saved the PDF. A page cannot observe the outcome of the browser's print
 * dialog, so `printing → completed` means "the dialog was opened", nothing
 * more, and the UI wording has to match that.
 */

export type ExportState =
  | "idle"
  | "saving"
  | "preflight"
  | "creating_version"
  | "preparing_print"
  | "printing"
  | "completed"
  | "failed"
  | "conflict";

export type ExportFailureReason =
  | "save_failed"
  | "blocking_issues"
  | "version_failed"
  | "fonts_timeout"
  | "prepare_timeout"
  | "print_unsupported"
  | "changed_during_preparation"
  | "unknown";

export type ExportContext = {
  state: ExportState;
  /** Set once a version has been minted, so a retry never mints a second one. */
  versionId: string | null;
  versionNumber: number | null;
  /** The draft revision the export is pinned to. */
  revision: number | null;
  reason: ExportFailureReason | null;
  message: string | null;
};

export type ExportEvent =
  | { type: "START" }
  | { type: "SAVE_OK" }
  | { type: "SAVE_FAILED"; message: string }
  | { type: "NO_UNSAVED_CHANGES" }
  | { type: "PREFLIGHT_CLEAR"; revision: number }
  | { type: "PREFLIGHT_BLOCKED"; message: string }
  | { type: "VERSION_CREATED"; versionId: string; versionNumber: number }
  | { type: "VERSION_FAILED"; message: string }
  | { type: "PREPARED" }
  | { type: "PREPARE_TIMEOUT"; reason: "fonts_timeout" | "prepare_timeout" }
  | { type: "PRINT_UNSUPPORTED" }
  | { type: "PRINT_OPENED" }
  | { type: "REVISION_CHANGED" }
  | { type: "CONFLICT" }
  | { type: "RESET" };

export const INITIAL_EXPORT_CONTEXT: ExportContext = {
  state: "idle",
  versionId: null,
  versionNumber: null,
  revision: null,
  reason: null,
  message: null,
};

/** States in which a new export must not be started. */
export function isExportInFlight(state: ExportState): boolean {
  return (
    state === "saving" ||
    state === "preflight" ||
    state === "creating_version" ||
    state === "preparing_print" ||
    state === "printing"
  );
}

function fail(
  ctx: ExportContext,
  reason: ExportFailureReason,
  message: string,
): ExportContext {
  return { ...ctx, state: "failed", reason, message };
}

export function exportReducer(ctx: ExportContext, event: ExportEvent): ExportContext {
  switch (event.type) {
    case "RESET":
      return INITIAL_EXPORT_CONTEXT;

    case "START":
      // Guard against double-submission: a click during any in-flight state is
      // ignored rather than restarting the flow and minting a second version.
      if (isExportInFlight(ctx.state)) return ctx;
      return { ...INITIAL_EXPORT_CONTEXT, state: "saving" };

    case "SAVE_OK":
    case "NO_UNSAVED_CHANGES":
      if (ctx.state !== "saving") return ctx;
      return { ...ctx, state: "preflight" };

    case "SAVE_FAILED":
      if (ctx.state !== "saving") return ctx;
      return fail(ctx, "save_failed", event.message);

    case "PREFLIGHT_CLEAR":
      if (ctx.state !== "preflight") return ctx;
      return { ...ctx, state: "creating_version", revision: event.revision };

    case "PREFLIGHT_BLOCKED":
      if (ctx.state !== "preflight") return ctx;
      return fail(ctx, "blocking_issues", event.message);

    case "VERSION_CREATED":
      if (ctx.state !== "creating_version") return ctx;
      return {
        ...ctx,
        state: "preparing_print",
        versionId: event.versionId,
        versionNumber: event.versionNumber,
      };

    case "VERSION_FAILED":
      if (ctx.state !== "creating_version") return ctx;
      return fail(ctx, "version_failed", event.message);

    case "PREPARED":
      if (ctx.state !== "preparing_print") return ctx;
      return { ...ctx, state: "printing" };

    case "PREPARE_TIMEOUT":
      if (ctx.state !== "preparing_print") return ctx;
      return fail(
        ctx,
        event.reason,
        event.reason === "fonts_timeout"
          ? "The resume font did not finish loading in time."
          : "The printable document did not finish preparing in time.",
      );

    case "PRINT_UNSUPPORTED":
      if (ctx.state !== "preparing_print" && ctx.state !== "printing") return ctx;
      return fail(ctx, "print_unsupported", "This browser cannot open a print dialog.");

    case "PRINT_OPENED":
      if (ctx.state !== "printing") return ctx;
      // "completed" means the dialog was opened and the version exists — not
      // that a file was written. Only the user knows that.
      return { ...ctx, state: "completed" };

    case "REVISION_CHANGED":
      // A change landing mid-flight would make the printed page and the minted
      // version disagree, so the run is abandoned rather than patched up.
      if (!isExportInFlight(ctx.state)) return ctx;
      return fail(
        ctx,
        "changed_during_preparation",
        "The resume changed while the export was being prepared.",
      );

    case "CONFLICT":
      if (!isExportInFlight(ctx.state)) return ctx;
      return {
        ...ctx,
        state: "conflict",
        reason: null,
        message: "This resume was changed somewhere else, so the export was stopped.",
      };

    default:
      return ctx;
  }
}

export const EXPORT_STATE_LABEL: Record<ExportState, string> = {
  idle: "Ready to export",
  saving: "Saving your changes…",
  preflight: "Running preflight…",
  creating_version: "Creating the exported version…",
  preparing_print: "Preparing the printable document…",
  printing: "Opening the print dialog…",
  completed: "Print dialog opened",
  failed: "Export stopped",
  conflict: "Resume changed elsewhere",
};
