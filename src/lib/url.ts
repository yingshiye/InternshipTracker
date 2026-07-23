const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

/**
 * Canonicalizes a user-entered URL so the same page always produces the
 * same string across every insert/lookup site (AddApplicationModal,
 * AddWatchlistModal, and the cron job's url_snapshots key).
 *
 * Throws on empty or malformed input — callers must surface this as a
 * validation error rather than writing an un-normalized value.
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }

  const candidate = SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a valid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must use http or https");
  }

  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
