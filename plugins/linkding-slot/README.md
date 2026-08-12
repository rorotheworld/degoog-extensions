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
| `url` | URL | — | Base URL of your linkding instance, no trailing slash. Point it at the site root, not at `/bookmarks`. |
| `token` | Password | — | The REST API token from step 1. Stored server-side; never sent to the browser. |

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

**Each queries linkding once.** On the "all" tab the panel and the engine issue their own
requests; there is no shared cache between the two registries. The panel suppresses itself on
the dedicated linkding tab, where the engine already owns the results.

**Bang queries are skipped.** A search like `!linkding rust` would otherwise make the panel
search your bookmarks for the literal string `!linkding rust`. Queries shorter than two
characters are skipped too.

**Requests honour your transport settings.** The panel uses Degoog's injected `context.fetch`,
so the transport and proxy settings configured for this extension apply. It never calls global
`fetch`.

**Errors are shown, not swallowed.** A bad token or an unreachable instance renders a short
message in the panel, because a silently empty panel is indistinguishable from "no bookmarks
matched".

**`linkding.js` is a duplicate.** It is byte-identical to
`engines/linkding-engine/linkding.js`. Degoog installs each extension folder independently
with no shared level between them, so the client cannot be factored out.
