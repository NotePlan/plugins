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
node scripts/nplog/nplog --since "$CURSOR" --wait-idle 3 --timeout 30 --json
```

`--wait-idle 3` matters: an x-callback returns **immediately** while the plugin runs
asynchronously. Without it you read the log before the plugin has finished and see
nothing. It returns once the log has been quiet for 3s, or at `--timeout`.

**Exit code 1 means at least one emitted entry was an ERROR** — check it before
reading anything, it is the cheapest possible signal.

## Recipes

```bash
# just this plugin's own console log (already scoped — usually the best starting point)
node scripts/nplog/nplog --plugin jgclark.Dashboard --json

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
{"summary":true,"file":"…","emitted":6,"entriesScanned":17,"droppedByMaxEntries":0,"cursor":"…","hasError":true}
```

- `level` — `debug` | `info` | `warn` | `error` | `null`
- `source` — `plugin` or `webview`
- `run` — the `Executing function` this entry belongs to, so you can attribute an
  error to the invocation that caused it
- `text` — the whole entry. A pretty-printed object arrives **whole**, newlines
  included, because one object is one entry
- `cursor` — feed back into `--since` for the next read

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

## Relationship to the NotePlan MCP

The MCP's `noteplan_plugins` with `action: "log"` reads
`<Plugins>/<pluginId>/_MCP-console.log` — the same per-plugin file `--plugin` reads.
It supports `tail: N` and `clear: true`, and `clear` before an action is a workable
alternative to `--mark`.

Prefer the MCP when you just want a quick eyeball of one plugin's recent output.
Prefer `nplog --json` when you need any of: structured levels, objects kept intact,
run attribution, an error exit code, waiting for an async run to finish, or the main
log rather than one plugin's file.

They compose — `--plugin <id>` gives you MCP's per-plugin scoping *and* this parsing.

## Notes

- `--plugin` reads a file that **accumulates** and is never rotated; some are months
  stale. Check the `ts` of what you get back before trusting it as recent.
- No NotePlan window needs focus for `--json`; it only reads files. Firing an
  x-callback does require NotePlan to be running.
- See `scripts/nplog/README.md` for the interactive viewer and
  `scripts/nplog/AGENTS.md` for parser internals.
