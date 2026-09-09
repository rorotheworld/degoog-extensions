# Marginalia engine

Searches [Marginalia Search](https://search.marginalia.nu/), the independent web
index of small, non-commercial, human-made sites. Results appear in the **web** tab and
via the `!mg` bang shortcut.

Requires **Degoog 0.19.0** or newer.

## Setup

1. Install from the Store (this repo: `rorotheworld/degoog-extensions`) and enable the
   engine in Settings > Engines.
2. Toggle it off and on once if the engine does not appear in the web-tab merge.

| Setting | Type | Default | Notes |
| --- | --- | --- | --- |
| `count` | Text | `10` | Maximum results per search. Clamped to 1-50. |

## What you get

- Marginalia results merged into the **web** tab.
- The `!mg <query>` bang.

## Notes

**Uses the JSON API, not the search page.** The HTML search endpoints
(`search.marginalia.nu/search`) are JS-rendered and bot-gated with a rate-limit stall
("Wait For A Moment"). The engine hits `https://api.marginalia.nu/public/search/json`,
which returns clean JSON without JS or a key.

**Results are CC-BY-NC-SA 4.0.** The API response carries this license. Fine for
personal use; do not republish the results commercially.

**Rate limits are real.** The public endpoint throttles burst traffic (repeated rapid
requests time out). The engine goes through degoog's `context.fetch`, so the global
proxy and this engine's timeout/transport settings apply.

**Failures are quiet by design.** A non-OK status is surfaced via `context.sentinel`
as a structured engine failure; any other error logs a `[marginalia]` warning and
returns no results, so one flaky engine never takes down the merged web results.