# roro-degoog-extensions

Degoog extensions for a self-hosted homelab stack. Currently: a
[linkding](https://github.com/sissbruecker/linkding) bookmark integration, as a results
panel and as a search engine.

## Add this repo

Degoog → **Settings → Store → Add**, paste:

```
https://example.invalid/roro-degoog-extensions
```

<!-- TODO(remote): replace the URL above once the git remote is chosen (Section 4). -->

Then **Browse** the repo and install the extensions you want.

## Extensions

| Extension | Type | What it does | Minimum Degoog |
| --- | --- | --- | --- |
| [linkding](plugins/linkding-slot) | Plugin (slot) | Panel of matching bookmarks alongside normal search results | 0.24.0 |
| [linkding Engine](engines/linkding-engine) | Engine | Dedicated linkding results tab and the `!linkding` bang | 0.21.0 |

The two are independent. Install either alone, or both.

## Notes

**They are configured separately.** Degoog keeps plugins and engines in separate registries,
so the linkding base URL and API token are entered twice — once under Settings → Plugins,
once under Settings → Engines. There is no shared configuration between the two.

**They each query linkding once.** On the "all" tab the panel and the engine issue their own
requests; no cache is shared between the plugin and engine registries. The panel suppresses
itself on the dedicated linkding tab, where the engine already owns the results.

**Your API token never reaches the browser.** Both extensions run server-side
(`isClientExposed: false`).

**No "First mode".** Neither extension redirects your search. The panel renders alongside
results; the engine gives you a tab and a bang. That is deliberate.

**`plugins/linkding-slot/linkding.js` and `engines/linkding-engine/linkding.js` are
intentional byte-identical duplicates.** Degoog installs each extension folder independently
with no shared level between them, so the client cannot be factored out. Keep them in sync;
`git diff` across the two paths will show any drift.

## Licence

MIT. See [LICENSE](LICENSE).
