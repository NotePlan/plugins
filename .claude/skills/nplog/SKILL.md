---
name: nplog
description: Read NotePlan's plugin log to debug a plugin. Use when investigating why a NotePlan plugin misbehaved, after triggering a plugin command or x-callback URL, when the user says a plugin "isn't working"/"threw an error"/"did nothing", or when you need to see what a plugin logged. Wraps `scripts/nplog/nplog --json`, which parses the log into structured records — do NOT grep the raw log file, it has three traps that silently return zero results.
---

# Reading the NotePlan plugin log

`scripts/nplog/nplog` (in this repo) parses NotePlan's log into structured records.
Run it as `node scripts/nplog/nplog` from the repo root, or just `nplog` if
`scripts/nplog/install.sh` has been run.

**Always use `--json` for programmatic reading.** The default mode is a full-screen
interactive viewer for humans and will hang a non-TTY caller.

## The core loop: "what happened when I did X?"

```bash
CURSOR=$(node scripts/nplog/nplog --mark)
open "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Show%20Dashboard"
node scripts/nplog/nplog --since "$CURSOR" --follow --wait-idle 5 --json
```

An x-callback returns **immediately** while the plugin keeps running — a Dashboard
refresh ping-pongs asynchronously for anywhere from 2 to 30 seconds. Do not guess a
duration:

- `--follow` streams entries as they arrive.
- `--wait-idle 5` stops after five seconds of silence. A run still in flight writes
  something within five seconds, so that much quiet means it finished.
- `--timeout` (default 90s) is the hard cap.

**The log flushes in batches.** Measured: the file sat untouched for 24s after an action,
then gained 80 lines at once. So never conclude "the action logged nothing" from an empty
result — check the summary's `sawOutput` and `timedOut` fields, which exist precisely to
tell that apart from "I looked too early". Do not lower `--timeout` below ~30s.

**Exit code 1 means at least one emitted entry was an ERROR** — check it before
reading anything, it is the cheapest possible signal.

## Recipes

```bash
# only the most recent plugin invocation
node scripts/nplog/nplog --json --last-run

# the last 10 minutes (also accepts 30s / 2h / a bare number = minutes,
# or a local wall-clock time like 19:36 or "2026-07-29 19:36")
node scripts/nplog/nplog --since 10m --json

# problems only
node scripts/nplog/nplog --since 10m --json --min-level warn

# find a diagnostic line and see the 10 entries that followed it
node scripts/nplog/nplog --json --mode 10 '\[DIAG\]'

# keep the output small (default 500; truncation is always reported, never silent)
node scripts/nplog/nplog --since 1h --json --max-entries 50
```

## Output shape

NDJSON — one object per entry, then one summary object:

```json
{"seq":0,"ts":"2026-07-29T09:14:59-07:00","level":"error","source":"plugin","run":"onMessageFromHTMLView","text":"…"}
{"summary":true,"file":"…","emitted":6,"entriesScanned":17,"droppedByMaxEntries":0,"cursor":"…","hasError":true,"sawOutput":true,"timedOut":false}
```

- `level` — `debug` | `info` | `warn` | `error` | `null`
- `source` — `plugin` or `webview`
- `run` — the `Executing function` this entry belongs to, so you can attribute an
  error to the invocation that caused it
- `text` — the whole entry. A pretty-printed object arrives **whole**, newlines
  included, because one object is one entry
- `cursor` — feed back into `--since` for the next read
- `sawOutput` / `timedOut` — only when waiting. `sawOutput:false` with `timedOut:true`
  means you gave up before NotePlan flushed, **not** that nothing was logged

## Do not grep the raw log

Three traps, each of which returns **empty** — which reads as "no errors" and is
worse than an error:

| Naive attempt | What actually happens |
| --- | --- |
| `grep '^JSLog:'` | zero matches — every line has a timestamp before the marker |
| `grep '\| ERROR \|'` | zero matches — WARN/ERROR are delimited by emoji (`🥺 WARN 🥺`, `❗️ ERROR ❗️`), not pipes |
| filtering on the leading timestamp | wrong on ~2/3 of lines, by up to hours — that is the flush time, not the event time |

Also: a pretty-printed object spans a dozen physical lines and only the first carries
the marker, so grepping a field hands you an orphan with no idea which object it
belonged to. `--json` solves all four.

## Do not use the MCP's plugin log as ground truth

The NotePlan MCP's `noteplan_plugins action:"log"` reads
`<Plugins>/<id>/_MCP-console.log`. It looks ideal — already scoped to one plugin — but
it is **truncated on every plugin invocation**, so it holds only the most recent one.
For a plugin that refreshes on a timer (the Dashboard does), the run you care about is
wiped seconds later by an unrelated background refresh. Measured for the same second:
32 unique lines there vs 66 in the main log.

The main log is a strict superset and the only durable record. `nplog` reads that by
default. Use the MCP's log for a quick human eyeball if you like, never as evidence about
a specific past run -- unless you're only interested in what's happening in the *current*
run, in which case `nplog --plugin <pluginID>` tails it directly (much lower latency than
the main log's flush lag) and keeps streaming through the resets. Still not durable
history -- just a faster window onto whatever is happening right now.

## Notes

- No NotePlan window needs focus; `nplog` only reads files. Firing an x-callback does
  require NotePlan to be running — check with `pgrep -fl NotePlan` (the beta's process
  is named `NotePlan Beta`, so `pgrep -x NotePlan` misses it).
- See `scripts/nplog/README.md` for the interactive viewer and
  `scripts/nplog/AGENTS.md` for parser internals.
