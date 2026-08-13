# linkding Engine

Searches your self-hosted [linkding](https://github.com/sissbruecker/linkding) bookmarks
from Degoog. Results appear in a dedicated **linkding** tab and via the `!linkding` bang
shortcut.

Requires **Degoog 0.21.0** or newer.

## Setup

1. In linkding, go to **Settings → Integrations → REST API** and copy your API token.
2. In Degoog, go to **Settings → Engines → linkding** and fill in:

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| `url` | URL | — | Address Degoog uses to reach linkding, no trailing slash, pointing at the site root rather than `/bookmarks`. May be an internal address such as `http://linkding:9090`. |
| `token` | Password | — | The REST API token from step 1. Stored server-side; never sent to the browser. |
| `limit` | Text | `20` | Maximum bookmarks returned per search. Clamped to 1–50. |

3. Toggle the engine on. **Toggle it off and on once** if the linkding tab does not appear —
   Degoog only writes a third-party engine into `default-engines.json` the first time it is
   toggled in the UI, and the tab list reads from that file.
4. Leave **Search type override** empty. Setting it to `web` suppresses the dedicated linkding
   tab, because the override replaces the engine's declared `["web", "linkding"]` types rather
   than adding to them.

> **If Degoog routes its traffic through a VPN or proxy**, a public linkding URL may fail with
> `CONNECT tunnel failed`: the request leaves through an exit node that cannot reach your
> instance. Either point `url` at an address reachable from the Degoog container (its container
> name on a shared Docker network), or enable this engine's **Proxy override** to bypass the
> global proxy. The first is the more robust of the two.

## What you get

- A **linkding** tab in the results.
- The `!linkding <query>` bang.
- Bookmarks merged into the **web** tab alongside your other engines.

Which tabs the engine feeds is set from Degoog's own engine type override in
**Settings → Engines**, not by editing the source.

Each result maps a bookmark like this, with your own words preferred over what linkding
scraped from the page:

- **title** — `title`, else `website_title`, else the URL
- **snippet** — `description`, else `website_description`, else `notes` (capped at 300 chars)
- **url** — the bookmarked URL

Results missing a title or a URL are dropped.

## Notes

**Configured separately from the linkding plugin.** Degoog keeps engines and plugins in
separate registries, so if you also run the linkding bookmarks panel, its URL and token are
entered again under Settings → Plugins. Having one configured says nothing about the other.

**Requests honour your transport settings.** The engine uses Degoog's injected `context.fetch`,
so `outgoingTransport`, `timeoutMs`, and the proxy settings configured for this engine all
apply. It never calls global `fetch`.

**Failures are quiet by design.** An unreachable instance, a bad token, or a missing
configuration logs a `[linkding-engine]` warning and returns no results, rather than throwing
and disturbing the merged results other engines contributed.

**`linkding.js` is a duplicate.** It is byte-identical to
`plugins/linkding-slot/linkding.js`. Degoog installs each extension folder independently
with no shared level between them, so the client cannot be factored out.
