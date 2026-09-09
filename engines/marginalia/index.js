// Marginalia engine for Degoog
//
// Searches the Marginalia Search independent web index (small-web, non-commercial
// sites). Results appear in the web tab and via the !mg bang shortcut.
//
// API: GET https://api.marginalia.nu/public/search/json?query=<q>&count=<n>
// Auth: none for the public endpoint. The root search pages are bot-gated and
//       JS-rendered; this API is the sanctioned automation path.
// License: results are CC-BY-NC-SA 4.0 (fine for personal use).

export const type = "web";

let _count = 10;

export default class MarginaliaEngine {
  isClientExposed = false;
  name = "Marginalia";
  bangShortcut = "mg";

  settingsSchema = [
    {
      key: "count",
      label: "Results per search",
      type: "text",
      default: "10",
      placeholder: "10",
      description: "Maximum number of results returned per search (1-50).",
    },
  ];

  configure(settings) {
    const parsed = parseInt(settings?.count ?? "10", 10);
    _count = Math.max(1, Math.min(50, Number.isNaN(parsed) ? 10 : parsed));
  }

  async executeSearch(query, page = 1, _timeFilter, context) {
    const doFetch = context?.fetch ?? fetch;

    const params = new URLSearchParams({ query, count: String(_count) });
    if (page > 1) params.set("pageno", String(page));

    try {
      const response = await doFetch(
        `https://api.marginalia.nu/public/search/json?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );

      // Let degoog surface 403/429/5xx as real engine failures instead of a
      // silent 0-results search.
      context?.sentinel?.(response, this.name);

      if (!response.ok) return [];

      const data = await response.json();
      if (!Array.isArray(data?.results)) return [];

      return data.results
        .map((item) => ({
          title: item?.title || "",
          url: item?.url || "",
          snippet: item?.description || "",
          source: this.name,
        }))
        .filter((result) => result.url && result.title);
    } catch (err) {
      if (err?.name === "SentinelBreach") throw err;
      console.warn(
        `[marginalia] search failed: ${String(err?.message ?? err)}`,
      );
      return [];
    }
  }
}