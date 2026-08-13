# linkding

Shows bookmarks from your self-hosted
[linkding](https://github.com/sissbruecker/linkding) instance in a panel alongside your
Degoog search results.

Requires **Degoog 0.24.0** or newer.

## Setup

1. In linkding, go to **Settings → Integrations → REST API** and copy your API token.
2. In Degoog, go to **Settings → Plugins → linkding** and fill in the Connection fieldset.

### Connection

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| `url` | URL | — | Address **Degoog** uses to reach linkding, no trailing slash, pointing at the site root rather than `/bookmarks`. May be an internal address such as `http://linkding:9090`. |
| `publicUrl` | URL | *(empty)* | Only needed when `url` is not reachable from your browser. Used for the "View all" link. Empty reuses `url`. |
| `token` | Password | — | The REST API token from step 1. Stored server-side; never sent to the browser. |

> **If Degoog routes its traffic through a VPN or proxy**, a public linkding URL may fail with
> `CONNECT tunnel failed`, because the request leaves through an exit node that cannot see your
> instance. Point `url` at an address reachable from the Degoog container — the container name
> on a shared Docker network works well — and set `publicUrl` to the address you open in a
> browser. Unlike engines, plugins get no per-extension proxy override, so this split is the
> way around it.

### Panel

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| `panelEnabled` | Toggle | `true` | Show the panel at all. |
| `style` | Select | `inline` | `inline` blends with the native results; `card` is a compact bordered panel. |
| `detail` | Select | `snippet` | `title` is the link only, `snippet` adds the description, `full` adds the URL and tags. |
| `limit` | Range 1–20 | `5` | How many bookmarks the panel lists at most. |

Degoog renders a **Position** select of its own, so you can move the panel between
above-results, below-results, the knowledge panel, or either sidebar slot without editing
anything.

## What gets shown

Per bookmark, with your own words preferred over what linkding scraped from the page:

- **title** — `title`, else `website_title`, else the URL
- **snippet** — `description`, else `website_description`, else `notes` (capped at 280 chars)
- **url** and **tags** — only at `detail: full`, up to 6 tags

The panel renders nothing when no bookmarks match, so a search with no saved results looks
exactly like an ordinary search.

**View all** links to `<your-instance>/bookmarks?q=<query>`, which is your own bookmark list.
Note this is *not* linkding's `/?q=` — that route redirects to `/bookmarks/shared`, which
searches other people's shared bookmarks instead of yours.

## Notes

**No "linkding First".** This plugin never redirects your search. It renders a panel and
nothing else. If you want linkding as a primary result surface, install the companion
**linkding Engine**, which gives you a dedicated tab and the `!linkding` bang.

**Configured separately from the linkding engine.** Degoog keeps plugins and engines in
separate registries, so if you also run the engine, its URL and token are entered again under
Settings → Engines. Having one configured says nothing about the other.

**Each queries linkding once per search.** The panel and the engine issue their own requests;
there is no shared cache between the two registries. The plugin caches its own repeat queries
for 30 seconds where Degoog offers a cache, which covers pagination and back/forward, but it
cannot see the engine's traffic.

**Tab gating is Degoog's, not the plugin's.** As of Degoog 0.24.0 the `/api/slots` request
carries only the query, so an extension cannot tell which tab it is rendering for. Degoog
decides on the client which panels belong to the active tab. The plugin keeps a defensive
`context.tab` check for the day that changes; today it never fires.

**Bang queries are skipped.** A search like `!linkding rust` would otherwise make the panel
search your bookmarks for the literal string `!linkding rust`. Queries shorter than two
characters are skipped too.

**Requests honour your transport settings.** The panel prefers Degoog's injected `context.fetch`,
so the transport and proxy settings configured for this extension apply, falling back to global
`fetch` only if the host injects none.

**The panel bounds its own requests.** Plugins get no `timeoutMs` setting from Degoog, so the
panel aborts after 3 seconds and briefly caches the failure, rather than letting a hung linkding
stall every search.

**Errors are shown, not swallowed.** A bad token or an unreachable instance renders a short
message in the panel, because a silently empty panel is indistinguishable from "no bookmarks
matched".

**`linkding.js` is a duplicate.** It is byte-identical to
`engines/linkding-engine/linkding.js`. Degoog installs each extension folder independently
with no shared level between them, so the client cannot be factored out.
