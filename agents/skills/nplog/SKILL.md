---
name: nplog
description: >-
  Read NotePlan's plugin log to debug a plugin. Use when investigating why a
  NotePlan plugin misbehaved, after triggering a plugin command or x-callback
  URL, when the user says a plugin "isn't working"/"threw an error"/"did
  nothing", or when you need to see what a plugin logged. Wraps
  `scripts/nplog/nplog --json`, which parses the log into structured records --
  do NOT grep the raw log file, it has three traps that silently return zero
  results.
---

# Reading the NotePlan plugin log

`scripts/nplog/nplog` parses NotePlan's log into structured records.
Run as `node scripts/nplog/nplog` from the repo root, or `nplog` after
`./scripts/nplog/install.sh`.

**Always use `--json` for programmatic reading.** The default mode is a
full-screen interactive viewer and will hang a non-TTY caller.

## Core loop: "what happened when I did X?"

```bash
CURSOR=$(node scripts/nplog/nplog --mark)
open "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Show%20Dashboard"
node scripts/nplog/nplog --since "$CURSOR" --follow --wait-idle 5 --json
```

An x-callback returns immediately while the plugin keeps running. A Dashboard
refresh can take 2-30 seconds. Do not guess a duration:

- `--follow` streams entries as they arrive
- `--wait-idle 5` stops after five seconds of silence (a live run writes within that window)
- `--timeout` (default 90s) is the hard cap; do not set it below ~30s

**The log flushes in batches** (measured: quiet for 24s, then 80 lines at once).
Never conclude "logged nothing" from an empty result -- check the summary's
`sawOutput` and `timedOut` fields.

**Exit code 1 means at least one emitted entry was an ERROR.** Check that first.

## Recipes

```bash
node scripts/nplog/nplog --json --last-run
node scripts/nplog/nplog --since 10m --json
node scripts/nplog/nplog --since 10m --json --min-level warn
node scripts/nplog/nplog --json --mode 10 '\[DIAG\]'
node scripts/nplog/nplog --since 1h --json --max-entries 50
```

`--since` also accepts `30s`, `2h`, a bare number (minutes), or a wall-clock time
like `19:36` / `2026-07-29 19:36`.

## Output shape

NDJSON -- one object per entry, then a summary:

```json
{"seq":0,"ts":"2026-07-29T09:14:59-07:00","level":"error","source":"plugin","run":"onMessageFromHTMLView","text":"…"}
{"summary":true,"file":"…","emitted":6,"entriesScanned":17,"droppedByMaxEntries":0,"cursor":"…","hasError":true,"sawOutput":true,"timedOut":false}
```

- `level` -- `debug` | `info` | `warn` | `error` | `null`
- `source` -- `plugin` or `webview`
- `run` -- the `Executing function` this entry belongs to
- `text` -- the whole entry (pretty-printed objects stay intact, newlines included)
- `cursor` -- feed back into `--since` for the next read
- `sawOutput` / `timedOut` -- only when waiting; `sawOutput:false` + `timedOut:true` means you looked before NotePlan flushed

## Do not grep the raw log

Each of these returns empty, which reads as "no errors" and is worse than an error:

| Naive attempt | What actually happens |
| --- | --- |
| `grep '^JSLog:'` | every line has a timestamp before the marker |
| `grep '\| ERROR \|'` | WARN/ERROR use emoji (`🥺 WARN 🥺`, `❗️ ERROR ❗️`), not pipes |
| filter on the leading timestamp | wrong on ~2/3 of lines -- that is flush time, not event time |

A pretty-printed object also spans many physical lines with only the first carrying
the marker. `--json` solves all four.

## Do not use the MCP plugin log as ground truth

`noteplan_plugins action:"log"` reads `Plugins/<id>/_MCP-console.log`. It is
**truncated on every plugin invocation**. For a timer-refreshing plugin (Dashboard),
an unrelated refresh wipes the run under investigation within seconds. The main log
is a strict superset and the only durable record. `nplog` reads that by default.

For a faster window onto the *current* run only, use `nplog --plugin <pluginID>` --
lower latency, still not durable history.

## Notes

- No NotePlan window needs focus; `nplog` only reads files. Firing an x-callback
  requires NotePlan running -- check with `pgrep -fl NotePlan` (beta is
  `NotePlan Beta`, so `pgrep -x NotePlan` misses it).
- Interactive viewer and full CLI: `scripts/nplog/README.md`
- Parser / maintainer internals: `scripts/nplog/AGENTS.md`
