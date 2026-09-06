// linkding Engine for Degoog
//
// Searches your self-hosted linkding bookmarks. Results appear in a dedicated
// "linkding" tab and via the !linkding bang shortcut, with an optional shorter
// !ld alias selectable in Settings > Engines > linkding ("Bang shortcut").
//
// NOTE: this engine is configured in Settings > Engines > linkding. Degoog keeps
//       engines and plugins in separate registries, so the URL and API token here
//       are NOT shared with the linkding plugin (the bookmarks panel). Having one
//       configured says nothing about the other.
//
// API:  GET /api/bookmarks/?q=<query>&limit=<n>&offset=<n>
// Auth: Authorization: Token <api-token>
//       Generate a token in linkding under Settings > Integrations > REST API.

import {
  normalizeBaseUrl,
  searchBookmarks,
  titleOf,
  snippetOf,
  urlOf,
} from "./linkding.js";

// Declared once at import time — Degoog snapshots this value and does not
// re-read it. To change which tabs this engine feeds, use the engine's native
// type override in Settings > Engines rather than editing this line.
export const type = ["web", "linkding"];

// ── State ─────────────────────────────────────────────────────────────────────
// Degoog calls configure() with the saved settings, then executeSearch() per
// search, so the configuration lives at module scope between the two.

let _url = "";
let _token = "";
let _limit = 20;
let _bang = "linkding";

function _isConfigured() {
  return Boolean(_url && _token);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export default class LinkdingEngine {
  isClientExposed = false;
  name = "linkding";

  // A getter rather than a plain field: Degoog reads engine.bangShortcut on
  // every query (via getEngineShortcuts -> getSearchEngineMap), so returning
  // the configured value makes the !ld toggle take effect without a reload.
  get bangShortcut() {
    return _bang;
  }

  settingsSchema = [
    {
      key: "bang",
      label: "Bang shortcut",
      type: "select",
      options: ["linkding", "ld"],
      optionLabels: ["!linkding", "!ld"],
      default: "linkding",
      description: "Which bang fires this engine. Only one is active at a time.",
    },
    {
      key: "url",
      label: "linkding Instance URL",
      type: "url",
      required: true,
      placeholder: "https://linkding.example.com",
      description: "Base URL of your linkding instance (no trailing slash).",
    },
    {
      key: "token",
      label: "API Token",
      type: "password",
      required: true,
      placeholder: "your-api-token",
      description:
        "Your linkding REST API token — find it in linkding under " +
        "Settings > Integrations > REST API.",
      secret: true,
    },
    {
      key: "limit",
      label: "Results per search",
      type: "text",
      default: "20",
      placeholder: "20",
      description: "Maximum number of bookmarks returned per search (1-50).",
    },
  ];

  configure(settings) {
    // Every value arrives as a string, whatever the declared setting type, so
    // anything non-string has to be coerced explicitly here.
    _url = normalizeBaseUrl(settings?.url);
    _token = settings?.token || "";

    const parsed = parseInt(settings?.limit ?? "20", 10);
    _limit = Math.max(1, Math.min(50, Number.isNaN(parsed) ? 20 : parsed));

    // Bang select: "linkding" (default) or the short "ld" alias. Unknown
    // values fall back to the default so a future option removal can't brick
    // the bang lookup.
    _bang = settings?.bang === "ld" ? "ld" : "linkding";
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    // An empty tab is indistinguishable from a tab that never ran, so say why.
    // Returning [] rather than throwing keeps one unconfigured engine from
    // breaking the merged results every other engine contributed to.
    if (!_isConfigured()) {
      console.warn(
        "[linkding-engine] no instance URL or API token set, returning no " +
          "results. Configure it in Settings > Engines > linkding.",
      );
      return [];
    }

    // Always prefer degoog's injected fetch: it honours this engine's
    // outgoingTransport, timeoutMs and proxy settings. A bare global fetch()
    // silently bypasses all of them.
    const doFetch = context?.fetch ?? fetch;

    // linkding paginates by row offset, while degoog counts pages from 1.
    const offset = Math.max(0, ((Number(page) || 1) - 1) * _limit);

    try {
      const { results } = await searchBookmarks({
        baseUrl: _url,
        token: _token,
        query,
        limit: _limit,
        offset,
        doFetch,
        // Hand degoog the raw response before the body is read, so its health
        // and rate-limit tracking sees this engine like every built-in one.
        onResponse: (response) => context?.sentinel?.(response, this.name),
      });

      return results
        .map((bookmark) => ({
          title: titleOf(bookmark),
          url: urlOf(bookmark),
          snippet: snippetOf(bookmark),
          source: this.name,
        }))
        // urlOf() returns "" for anything that is not http(s), so this also
        // drops bookmarks carrying a javascript: or data: URL. titleOf() always
        // returns a non-empty string, so only the url check ever fires.
        .filter((result) => result.url);
    } catch (err) {
      // String(err?.message ?? err) rather than err.message: if something threw
      // a non-object, reading .message would itself throw from inside the catch
      // and escape executeSearch, taking down the merged results that every
      // other engine contributed to.
      console.warn(
        `[linkding-engine] search against ${_url} failed: ${String(err?.message ?? err)}`,
      );
      return [];
    }
  }
}
