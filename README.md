# linkding-degoog-compat

⚠️ These were 100% coded by Opus 5, but from all my testing they work and are safe. Install at your own discretion. ⚠️

[linkding](https://github.com/sissbruecker/linkding) bookmark integrations, as a plugin  + search engine.

## Extensions

| Extension | Type | What it does | Minimum Degoog |
| --- | --- | --- | --- |
| [linkding](plugins/linkding-slot) | Plugin (slot) | Panel of matching bookmarks alongside normal search results | 0.24.0 |
| [linkding Engine](engines/linkding-engine) | Engine | Dedicated linkding results tab and the `!linkding` bang | 0.21.0 |

The two are independent. Install either alone or both.

## Notes

**They are configured separately.** Degoog keeps plugins and engines in separate registries,
so the linkding base URL and API token are entered twice - once under Settings → Plugins,
once under Settings → Engines. There is no shared configuration between the two.

**They each query linkding once per search.** The panel and the engine issue their own
requests; no cache is shared between the plugin and engine registries. Degoog decides on the
client which tab a panel belongs to - extensions are not told.

**If Degoog routes its traffic through a VPN or proxy**, point the extensions at an address
the Degoog container can reach directly (its container name on a shared Docker network) rather
than a public hostname, which would be sent out through the exit node and fail with
`CONNECT tunnel failed`. The plugin then takes a separate `publicUrl` for its browser-facing
links.

## Credit

The architecture here comes from [ced_degoog_plugins](https://github.com/cedhuf/ced_degoog_plugins) by Cedhuf, whose Karakeep
plugin and engine are the closest analogue to this problem - a self-hosted bookmark manager
surfaced inside Degoog as both a results panel and a search engine. The slot/engine split, the
settings schema shape, the string-coercion helpers and the panel stylesheet are all adapted
from that work. If you run Karakeep or Hister, use their extensions.

Differences from that template:

- **No "First mode" interceptor.** These extensions never redirect a search. The panel renders
  alongside your results; the engine gives you a tab and a bang, and nothing hijacks where you
  land.
- **A separate `publicUrl` setting**, for deployments where Degoog and your browser reach
  linkding at different addresses — e.g. Degoog fetching over an internal Docker network while
  you open the public hostname.
- **A URL scheme allowlist.** Escaping an `href` stops attribute breakout but leaves the scheme
  intact, so a bookmark saved with a `javascript:` URL would otherwise render as a clickable
  link running in Degoog's own origin. Non-`http(s)` URLs are dropped.
- **A request deadline on the panel.** Plugins get no `timeoutMs` setting from Degoog, so the
  panel aborts after 3s and briefly caches the failure rather than letting a hung linkding
  stall every search.

## Licence

MIT. See [LICENSE](LICENSE), which carries Cedhuf's copyright notice alongside ours as the
MIT terms of the original require.
