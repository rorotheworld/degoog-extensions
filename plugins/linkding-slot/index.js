// linkding for Degoog
//
// Renders an "In your bookmarks" panel next to the search results, listing
// bookmarks from your self-hosted linkding instance that match the query.
//
// There is deliberately no "linkding First" interceptor: this plugin never
// redirects your search. It shows a panel, nothing more. The companion
// linkding engine provides a dedicated tab and the !linkding bang.
//
// NOTE: this plugin is configured in Settings > Plugins > linkding. Degoog keeps
//       plugins and engines in separate registries, so the URL and API token here
//       are NOT shared with the linkding engine, and each issues its own request.
//
// linkding REST API: GET /api/bookmarks/?q=<query>&limit=<n>
// Auth:              Authorization: Token <api-token>
// linkding web UI:   /bookmarks?q=<query>   (used for the "View all" link)
//
// isClientExposed: false, so every request goes through the Degoog server and
// the API token never reaches the browser.

import {
  escapeHtml,
  normalizeBaseUrl,
  searchBookmarks,
  snippetOf,
  tagsOf,
  titleOf,
  urlOf,
} from "./linkding.js";

// ── Plugin manifest ───────────────────────────────────────────────────────────
// Pins the settings key for this extension. Requires Degoog >= 0.24.0.

export const plugin = {
  id: "linkding-slot",
  name: "linkding",
  description:
    "Surfaces bookmarks from your self-hosted linkding instance inside Degoog.",
};

// ── State ─────────────────────────────────────────────────────────────────────

const cfg = {
  url: "",
  publicUrl: "",
  token: "",
  panelEnabled: true,
  limit: 5,
  style: "inline",
  detail: "snippet",
};

// The address the server fetches from and the address the browser can open are
// not always the same. If linkding is only reachable from Degoog over an
// internal Docker network, `url` is that internal address and `publicUrl` is
// the one a person can actually click. Falls back to `url` when unset.
const _linkUrl = () => cfg.publicUrl || cfg.url;

// Set in init() from the host context. Used only to de-duplicate this plugin's
// own repeat queries (pagination, back/forward). It cannot see the engine's
// traffic: Degoog gives engines no cache factory at all.
let _cache = null;
let _ctxFetch = null;

const CACHE_TTL_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

const _isConfigured = () => Boolean(cfg.url && cfg.token);

// Degoog stores toggles as the string "false", and Boolean("false") is true.
const _bool = (v) =>
  v === true || v === "true"
    ? true
    : v === false || v === "false"
      ? false
      : Boolean(v);

const _clamp = (v, min, max, fallback) =>
  Math.max(min, Math.min(max, parseInt(v, 10) || fallback));

// Degoog exposes a cache under two different names depending on version, and
// may expose neither. Probe for both, then fall back to running uncached.
function _makeCache(ctx, namespace, ttlMs) {
  if (typeof ctx?.useCache === "function") return ctx.useCache(namespace, ttlMs);
  if (typeof ctx?.createCache === "function") return ctx.createCache(ttlMs);
  return null;
}

async function _cacheGet(key) {
  try {
    return _cache ? await _cache.get(key) : null;
  } catch {
    // A broken cache must never take the panel down with it.
    return null;
  }
}

async function _cacheSet(key, value) {
  try {
    if (_cache) await _cache.set(key, value, CACHE_TTL_MS);
  } catch {
    // Same: caching is an optimisation, not a requirement.
  }
}

// ── Bookmark rendering ────────────────────────────────────────────────────────

function _renderTags(tags) {
  if (!tags?.length) return "";
  const items = tags
    .slice(0, 6)
    .map((t) => `<span class="ld-tag">#${escapeHtml(t)}</span>`)
    .join("");
  return `<div class="ld-tags">${items}</div>`;
}

function _renderResult(bookmark) {
  const url = urlOf(bookmark);
  const title = titleOf(bookmark);
  const snippet = cfg.detail !== "title" ? snippetOf(bookmark, 280) : "";
  const tags = cfg.detail === "full" ? _renderTags(tagsOf(bookmark)) : "";

  // Everything interpolated below is escaped, including the href: a bookmark
  // title or URL is user-supplied data that reaches this panel unfiltered.
  const titleEl = url
    ? `<a class="ld-result-title" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`
    : `<span class="ld-result-title">${escapeHtml(title)}</span>`;

  return `
    <div class="ld-result">
      ${titleEl}
      ${url && cfg.detail === "full" ? `<div class="ld-result-url">${escapeHtml(url)}</div>` : ""}
      ${snippet ? `<div class="ld-result-snippet">${escapeHtml(snippet)}</div>` : ""}
      ${tags}
    </div>`;
}

// ── Slot ──────────────────────────────────────────────────────────────────────

export const slot = {
  name: "linkding",
  description:
    "Shows bookmarks from your linkding instance alongside search results.",
  isClientExposed: false,
  position: "above-results",
  // Degoog renders the "Position" select from this list on its own.
  slotPositions: [
    "above-results",
    "full-width-above-results",
    "below-results",
    "knowledge-panel",
    "above-sidebar",
    "below-sidebar",
  ],

  settingsSchema: [
    {
      key: "url",
      label: "linkding instance URL",
      type: "url",
      required: true,
      fieldset: "Connection",
      placeholder: "https://linkding.example.com",
      description:
        "Base URL Degoog uses to reach linkding, with no trailing slash. Point " +
        "it at the site root, not at /bookmarks. This may be an internal " +
        "address such as http://linkding:9090 if that is how the Degoog " +
        "container reaches it.",
    },
    {
      key: "publicUrl",
      label: "Public URL (optional)",
      type: "url",
      required: false,
      fieldset: "Connection",
      placeholder: "https://linkding.example.com",
      description:
        "Only needed if the URL above is not reachable from your browser. Used " +
        'for the "View all" link. Leave empty to reuse the URL above.',
    },
    {
      key: "token",
      label: "API token",
      type: "password",
      required: true,
      secret: true,
      fieldset: "Connection",
      placeholder: "your-api-token",
      description:
        "Find it in linkding under Settings > Integrations > REST API.",
    },

    {
      key: "panelEnabled",
      label: 'Show the "In your bookmarks" panel',
      type: "toggle",
      default: true,
      fieldset: "Panel",
      description: "Display matching bookmarks next to the Degoog results.",
    },
    {
      key: "style",
      label: "Display style",
      type: "select",
      options: ["inline", "card"],
      default: "inline",
      fieldset: "Panel",
      description:
        "inline blends with the native results, card is a compact bordered panel.",
    },
    {
      key: "detail",
      label: "Detail level",
      type: "select",
      options: ["title", "snippet", "full"],
      default: "snippet",
      fieldset: "Panel",
      description:
        "title is the link only, snippet adds the description, full adds the URL and tags.",
    },
    {
      key: "limit",
      label: "Results in the panel",
      type: "range",
      min: "1",
      max: "20",
      step: "1",
      default: "5",
      fieldset: "Panel",
      description: "How many bookmarks the panel lists at most.",
    },
  ],

  configure(settings) {
    // Every value arrives as a string whatever its declared type, so anything
    // non-string has to be coerced explicitly.
    cfg.url = normalizeBaseUrl(settings?.url);
    cfg.publicUrl = normalizeBaseUrl(settings?.publicUrl);
    cfg.token = settings?.token || "";
    cfg.panelEnabled =
      settings?.panelEnabled === undefined
        ? true
        : _bool(settings.panelEnabled);
    cfg.style = settings?.style === "card" ? "card" : "inline";
    cfg.detail = ["title", "snippet", "full"].includes(settings?.detail)
      ? settings.detail
      : "snippet";
    cfg.limit = _clamp(settings?.limit, 1, 20, 5);
  },

  init(ctx) {
    if (typeof ctx?.fetch === "function") {
      _ctxFetch = (...args) => ctx.fetch(...args);
    }
    _cache = _makeCache(ctx, "ext:linkding-slot:responses", CACHE_TTL_MS);
  },

  trigger(query) {
    const q = String(query || "").trim();

    // Bang pages such as ?q=!linkding+rust would otherwise search linkding for
    // the literal "!linkding rust" string.
    if (/^!/.test(q)) return false;

    // A one-character query matches almost everything and tells you nothing.
    if (q.length < 2) return false;

    return _isConfigured() && cfg.panelEnabled;
  },

  async execute(query, context) {
    // On the dedicated linkding tab the engine already owns the results, so a
    // panel repeating them would be noise.
    //
    // As of Degoog 0.24.0 this never fires: the /api/slots request body is only
    // {query, results?}, so `context.tab` is undefined and the guard falls
    // through. Degoog gates slots by tab on the client instead, discarding
    // panels that do not belong to the active tab. The guard is kept because it
    // is free, it is what the official weather-slot does, and it becomes
    // correct the moment Degoog starts passing a tab.
    if (context?.tab && context.tab !== "all") return { html: "" };

    const q = String(query || "").trim();
    const cacheKey = `${q}::${cfg.limit}`;

    let bookmarks = await _cacheGet(cacheKey);

    if (!bookmarks) {
      try {
        // Prefer Degoog's injected fetch so the request honours this
        // extension's transport and proxy settings. Never call global fetch.
        const doFetch = context?.fetch ?? _ctxFetch ?? fetch;
        const { results } = await searchBookmarks({
          baseUrl: cfg.url,
          token: cfg.token,
          query: q,
          limit: cfg.limit,
          doFetch,
        });
        bookmarks = results;
        await _cacheSet(cacheKey, bookmarks);
      } catch (err) {
        // Shown rather than swallowed: a wrong token should be visible, not a
        // silently empty panel that looks like "no bookmarks matched".
        return {
          html: `<div class="ld-slot ld-error">${escapeHtml(err.message)}</div>`,
        };
      }
    }

    const displayed = bookmarks.slice(0, cfg.limit);
    if (!displayed.length) return { html: "" };

    // Browser-facing, so it must use the public address, not the one the
    // server fetched from.
    const viewAll = `${_linkUrl()}/bookmarks?q=${encodeURIComponent(q)}`;
    const items = displayed.map(_renderResult).join("");
    const viewAllLink = `<a class="ld-slot-viewall" href="${escapeHtml(viewAll)}" target="_blank" rel="noopener">View all &rarr;</a>`;

    if (cfg.style === "card") {
      return {
        html: `
        <div class="ld-slot ld-card ld-detail-${cfg.detail}">
          <div class="ld-slot-header">
            <span class="ld-dot" aria-hidden="true">&bull;</span>
            <span class="ld-slot-label">linkding</span>
            ${viewAllLink}
          </div>
          <div class="ld-results">${items}</div>
        </div>`,
      };
    }

    return {
      html: `
      <div class="ld-slot ld-inline ld-detail-${cfg.detail}">
        <div class="ld-results">${items}</div>
        <div class="ld-footer">
          <span class="ld-dot" aria-hidden="true">&bull;</span>
          <span class="ld-footer-label">linkding</span>
          ${viewAllLink}
        </div>
      </div>`,
    };
  },
};

export default { slot };
