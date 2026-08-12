// Shared linkding API client.
//
// IMPORTANT: this file is duplicated byte-for-byte at
//   plugins/linkding-slot/linkding.js
// Degoog installs every extension folder independently, with no shared level
// between them, so this code cannot be factored out into one place. If you edit
// one copy, edit the other. `git diff` across the two paths will show any drift.

/**
 * Strip whitespace and any trailing slash from a base URL, so that callers can
 * safely append paths beginning with "/".
 */
export function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

/**
 * Turn a failed HTTP response into a message a person can act on. A bare
 * "HTTP 401" tells the reader nothing about which of the two settings is wrong.
 */
async function errorFor(response) {
  const status = response.status;
  if (status === 401 || status === 403) {
    return `linkding rejected the API token (HTTP ${status}). Check the token in Settings.`;
  }
  if (status === 404) {
    return `linkding returned HTTP 404. Check the base URL — it should point at the site root, not at /bookmarks.`;
  }

  // For anything else, the response body usually explains more than the status.
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 200);
  } catch {
    // Body already consumed or not readable; the status alone will have to do.
  }
  return `linkding returned HTTP ${status}${detail ? `: ${detail}` : "."}`;
}

/**
 * Search bookmarks.
 *
 * @param {object}   opts
 * @param {string}   opts.baseUrl     linkding root, e.g. https://ld.example.com
 * @param {string}   opts.token       linkding REST API token
 * @param {string}   opts.query       search text
 * @param {number}   opts.limit       max results to return
 * @param {number}   [opts.offset]    results to skip, for pagination
 * @param {Function} opts.doFetch     fetch implementation — pass degoog's
 *                                    `context.fetch` so the request goes through
 *                                    degoog's transport and proxy layer
 * @param {Function} [opts.onResponse] called with the raw Response *before* its
 *                                    body is read. Engines use this to hand the
 *                                    un-consumed Response to `context.sentinel`.
 * @returns {Promise<{results: object[], count: number}>}
 * @throws {Error} with a human-readable message on any non-2xx response
 */
export async function searchBookmarks({
  baseUrl,
  token,
  query,
  limit,
  offset = 0,
  doFetch,
  onResponse,
}) {
  const root = normalizeBaseUrl(baseUrl);

  // URLSearchParams handles the escaping, so a query containing "&" or "#"
  // cannot break out and inject extra parameters.
  const params = new URLSearchParams({
    q: String(query ?? ""),
    limit: String(limit),
  });
  if (offset > 0) params.set("offset", String(offset));

  const response = await doFetch(`${root}/api/bookmarks/?${params}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Token ${token}`,
    },
  });

  // Must run before the body is read: degoog's sentinel inspects the raw
  // response, and reading it here first would consume the stream.
  onResponse?.(response);

  if (!response.ok) {
    throw new Error(await errorFor(response));
  }

  const body = await response.json();
  return {
    results: Array.isArray(body?.results) ? body.results : [],
    count: Number(body?.count) || 0,
  };
}

/**
 * Escape text for safe interpolation into HTML.
 *
 * This is a plain string replacement rather than the usual
 * `document.createElement` trick, because extensions run server-side inside
 * degoog where there is no DOM at all.
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Field mappers ────────────────────────────────────────────────────────────
// A linkding bookmark carries both what you typed and what linkding scraped
// from the page. The user's own words win; the scraped values are the fallback.

/** Bookmark title, falling back to the scraped page title, then the URL. */
export function titleOf(bookmark) {
  return (
    bookmark?.title ||
    bookmark?.website_title ||
    bookmark?.url ||
    "Untitled"
  );
}

/** Description for display, capped so one long note cannot dominate a panel. */
export function snippetOf(bookmark, maxLength = 300) {
  const text =
    bookmark?.description ||
    bookmark?.website_description ||
    bookmark?.notes ||
    "";
  return String(text).slice(0, maxLength);
}

/** Tag names, always an array. */
export function tagsOf(bookmark) {
  return Array.isArray(bookmark?.tag_names) ? bookmark.tag_names : [];
}

/** The bookmarked URL. */
export function urlOf(bookmark) {
  return bookmark?.url || "";
}
