# nplog

A live, filterable viewer for [NotePlan](https://noteplan.co)'s plugin log output.

NotePlan writes every `console.log` from a plugin (and from plugin WebViews) into a rolling
log file inside its app container (in addition to NotePlan's own log). 

`nplog` is a terminal-based program that tails that file, strips it down to just the plugin
output, and puts a **regex filter box** on screen that you can retype at any moment without
restarting anything.

It also has a [headless `--json` mode](#headless-mode-scripts-ci-and-ai-agents) for scripts
and AI agents, and ships an accompanying Claude Code skill at
[`.claude/skills/nplog/SKILL.md`](../../.claude/skills/nplog/SKILL.md) (a hidden directory —
`ls` won't show it) so agents use the tool rather than grepping the log by hand.

<img width="1774" height="892" alt="CleanShot 2026-07-29 at 16 08 46@2x" src="https://github.com/user-attachments/assets/dca65479-0b7b-440b-ad86-957090563e9a" />

## Why not just `tail | grep`?

- **It follows log rotation.** NotePlan starts a brand-new timestamped file
  (`co.noteplan.NotePlan3 2026-07-28--20-41-00-962.log`) every time it relaunches. A plain
  `tail -f` stays pinned to the old file and silently goes quiet. `nplog` notices the newer
  file, prints a `--- switching to … ---` marker, and keeps going.
- **You can change the filter without losing history.** `grep` decides once, at the moment
  the line streams past. `nplog` keeps the lines in memory, so retyping the filter
  re-searches everything it has already read.
- **Context modes.** Log lines are rarely useful alone — you usually want the few lines that
  came *after* the one that matched.
- **Pretty-printed objects stay intact.** `console.log` of an object spans a dozen physical
  log lines; `grep` hands you one orphaned field. `nplog` treats the whole object as a single
  entry — see [Multi-line objects](#multi-line-objects).
- **Runs are visually separated.** Output arrives in bursts; a rule marks where each batch of
  work begins so you're not hunting for the boundary — see [Run separators](#run-separators).

## Requirements

Node.js (any recent version). No npm packages — it is a single dependency-free script.

### Terminal compatibility

Works in any terminal emulator, including iTerm2. It only uses the universally-supported
ANSI/VT100 basics — alternate screen (`?1049h`), cursor positioning, erase-line, reverse
video, dim, and SGR colour (256-colour for the WARN orange) — plus Node's own raw-mode key
handling, which is
terminal-agnostic.

Verified on macOS **Terminal.app** and **iTerm2**. It should be equally happy in Ghostty,
kitty, WezTerm, Alacritty, Warp, and the VS Code / Zed integrated terminals.

Two deliberate choices help here: every binding is a **control key**, and the
help line **collapses to a shorter form** on narrower windows rather than wrapping.

## Install

From the root of this repo:

```bash
./scripts/nplog/install.sh
```

That symlinks `nplog` into `~/.local/bin` so it will run from your shell.
Pass a different directory to override the location, e.g.
`./scripts/nplog/install.sh /usr/local/bin`.

Because it's a **symlink**, a later `git pull` updates the tool you actually run — there's no
need to re-install. If `~/.local/bin` isn't on your `PATH`, the installer tells you what to add
to your shell profile.

You can also skip installing and just run it in place: `node scripts/nplog/nplog`.

Want to see it without waiting for NotePlan to log something? A sample log is committed
alongside it:

```bash
nplog --file scripts/nplog/sample.log
```

## Using it from an AI agent

This repo ships a Claude Code **skill** at
[`.claude/skills/nplog/SKILL.md`](../../.claude/skills/nplog/SKILL.md), so an agent
reaches for this tool instead of grepping the log by hand.

**Claude Code needs no installation.** Project skills under `.claude/skills/` are picked
up automatically for anyone working in this repo — clone, and it is there. (Verified: the
skill became available to a running session within moments of the file being created.)

To make it available in *every* directory, not just this repo, link it into your user
skills folder:

```bash
mkdir -p ~/.claude/skills
ln -s "$PWD/.claude/skills/nplog" ~/.claude/skills/nplog
```

A symlink rather than a copy, so `git pull` keeps it current. Note the skill invokes the
tool as `node scripts/nplog/nplog`, which assumes the repo root is the working directory;
if you link it globally, run `scripts/nplog/install.sh` too so a bare `nplog` is on
`PATH` from anywhere.

**Other AI tools** (Cursor, Windsurf, plain API agents) do not read `.claude/skills/`.
Point them at that file, or at the [Headless mode](#headless-mode-scripts-ci-and-ai-agents)
section below — the CLI itself is tool-agnostic.

## Usage

```bash
nplog                              # follow the newest log
nplog dashboard                    # start with a filter already applied
nplog 'Section|Perspective'        # regex alternation
nplog --mode 5                     # start in "match + next 5 lines" mode
nplog --no-time                    # start with timestamps hidden
nplog --idle-gap 10                # only rule off lulls of 10s+ (0 = never)
nplog --no-separators              # no run/idle rules at all
nplog --raw                        # keep non-JSLog lines (NotePlan's own native logging)
nplog --file "/path/to/some.log"   # pin one file instead of auto-following
```

### Keys

Everything is a control key, because compact Mac keyboards have no PgUp / PgDn / Home / End.

| Key | Action |
| --- | --- |
| *(type anything)* | edit the filter — applies live |
| `Tab` | cycle context: `match only` → `match+1 lines` → `+5` → `+10` → back |
| `^T` | show / hide timestamps |
| `^G` | show / hide the run + idle rules |
| `^U` | clear the filter |
| `^L` | clear the buffer (drop history, keep following) |
| `^B` / `^F` | page **b**ack / **f**orward |
| `^P` / `^N` | one line **p**revious / **n**ext |
| `^A` / `^E` | jump to top / end (`^E` also resumes following) |
| `^C` | quit |

The bottom line names each control, e.g. `TAB: context (match+N lines)`; the status bar above
it shows the setting currently in effect.

If you *do* have a full-size keyboard (or use Fn+arrow), `PgUp`, `PgDn`, `Home`, `End` and the
arrow keys work too.

### The status bar

```
 filter: getRemindersGenerated|refreshSomeSections   re  ctx:match only  52/8791 (416 rows)  FOLLOW
```

- `re` — the filter compiled as a regex. If it can't (say you've typed `Section(` and haven't
  closed the paren yet) this reads `LITERAL(bad re)` and the text is matched literally
  instead. It never errors out mid-typing.
- `no-time` — appears only when timestamps are hidden (`^T`).
- `ctx:match only` — current context mode.
- `52/8791` — matching **entries** shown / total entries in the buffer.
- `(416 rows)` — appears only when those entries occupy more screen rows than there are
  entries, i.e. when some match is a pretty-printed object. This is why `match only` can still
  fill the screen: one matching entry can be a 12-line object. See
  [Multi-line objects](#multi-line-objects).
- `FOLLOW` / `SCROLL` — whether new output auto-scrolls. Scrolling up switches to `SCROLL`;
  `^E` returns to `FOLLOW`.

Matches are highlighted, and `┈┈┈` rules mark places where lines were skipped between
non-adjacent matches.

### Dimmed boilerplate, coloured severity

The same prefix repeats on every line and crowds out the message you're reading, so it's
**dimmed** rather than removed — still there when you want it, but out of the way:

- the timestamp — `2026-07-29 11:34:54`
- the routine severity markers — `| DEBUG |`, `| INFO  |`
- the source tag — `[WebView]`

```
2026-07-29 15:09:36 | DEBUG | refreshSomeSections :: Starting for TB
└────── dimmed ─────┘         └── your message, full brightness ──┘
```

`WARN` and `ERROR` are the exception — they're the one part of the prefix that *is* signal, so
they're **coloured** (orange and red) instead of dimmed. They're deliberately muted rather than
bold: enough to catch your eye while scanning, without shouting on every other line.

Note these two use **emoji delimiters** rather than pipes — see `LOG_LEVEL_STRINGS` in
[`helpers/dev.js`](../../helpers/dev.js), which is the source of truth for all four:

```
2026-07-27 18:34:37 🥺 WARN 🥺 sendToHTMLWindow :: Window does not exist    <- orange
[WebView Error] 2026-07-24 08:06:37 ❗️ ERROR ❗️ No para/content in item     <- red
```

The `[WebView Error]` tag is coloured red too, rather than dimmed like the plain `[WebView]`
tag. NotePlan's own native `ERROR:` lines (visible only with `--raw`) are also picked up.

`^T` (or `--no-time`) drops the timestamps entirely — the severity marker and source tag keep
their styling:

```
| DEBUG | refreshSomeSections :: Starting for TB
```

Two deliberate exceptions:

- **Filter matches always win.** A hit is highlighted even where it lands inside dimmed text,
  so searching `DEBUG` still shows you where it matched.
- **Object bodies are never dimmed.** The lines of a multi-line object are *data*, so they
  render at full brightness even when a value happens to look like a timestamp.

Filtering always runs against the *full* line, so you can still search for a time or a
severity even while they're hidden or dimmed.

### Run separators

Plugin output arrives in bursts. Finding where one batch of work ended and the next began means
scanning timestamps by eye, so `nplog` draws a rule at each boundary:

```
2026-07-29 09:14:10 | DEBUG | setPluginData :: Sending changeMessage: "Finished ..."
───────────────────────────── 47s idle  Executing function 'onMessageFromHTMLView' ─────────────
2026-07-29 09:14:57 | DEBUG | routeRequestsFromReact received actionType="refreshEnabled..."
```

Two things trigger a rule:

- **A run start.** NotePlan logs `Executing function 'name'` when it invokes a plugin entry
  point. That line *becomes* the rule rather than sitting beneath it, so the boundary costs one
  row instead of two.
- **A lull.** When the log goes quiet for `--idle-gap` seconds (default **3**) the rule reports
  how long. Useful because plenty of runs are triggered by timers or refreshes and never log an
  `Executing function` line at all — on a real day's log, lulls catch a few hundred boundaries
  that the run marker alone misses.

When a lull and a run coincide they merge into the one rule, as above. The label starts in the
same column as your message text, so the rules line up with the log rather than cutting across
it. `^G` toggles them off; `--idle-gap 0` keeps run rules but drops lull rules.

Rules also survive filtering, which is when they earn their keep — with a filter applied you're
looking at scattered matches, and the rule tells you which run each group came from. A boundary
hidden *by* the filter still surfaces: the rule is drawn for the whole stretch of log between
two visible entries, so it reports real idle time rather than time the filter hid.

### Multi-line objects

When a plugin pretty-prints an object or array, NotePlan writes it across many physical log
lines — and only the *first* carries the `JSLog:` marker; the rest just repeat the timestamp:

```
2026-07-28 14:46:20 JSLog: 2026-07-28 14:46:20 | DEBUG | => Reminder: :: {
2026-07-28 14:46:20 "title": "You should cancel the auto renew on Medawar",
2026-07-28 14:46:20 "listname": "Reminders",
2026-07-28 14:46:20 }
```

`nplog` detects the unbalanced `{` (or `[`), and keeps absorbing following lines until the
brace balances — storing the whole thing as **one entry**:

```
2026-07-28 14:46:20 | DEBUG | => Reminder: :: {
    "title": "You should cancel the auto renew on Medawar",
    "listname": "Reminders",
  }
```

The repeated timestamps on the continuation lines are dropped, and — since NotePlan flattens
the original indentation — the body is **re-indented by nesting depth**, so it reads as real
JSON again. Closing braces line up with their openers:

```
2026-07-29 14:40:33 | DEBUG | => Reminder: :: {
    "title": "Send out the newsletter",
    "occurences": {
      "weekly": true,
      "days": [
        "mon",
        "tue"
      ]
    },
    "time": "10:00"
  }
```

Because it's one entry:

- Filtering on **any** field shows you the **entire object**, not a lone line. `listname`
  matching 178 objects reports `178`, not 178 fragments.
- The `+1/+5/+10` context modes count *entries*, so "+1" means the next log entry — not the
  next line of the object you're already looking at.
- A regex can span the newlines (`.` is dotAll here), so `Reminder.*listname` matches.

Robustness details, all verified against real logs:

- Brace counting **ignores braces inside string values**, so `"tricky {"` or a value of `"]"`
  can't throw off the count.
- A new `<timestamp> JSLog:` line **always** ends the block, so a truncated or malformed object
  can't swallow the rest of the log.
- Blocks render **as they stream** — you see the object growing, rather than waiting for the
  closing brace.
- A block left open when the log rotates is closed at the switch.
- Sometimes the `{` lands on the line *after* the `JSLog:` header; that fragment starts its own
  block rather than being dropped.

## Headless mode (scripts, CI, and AI agents)

Everything above is the interactive viewer. `--json` turns the same parser into a
one-shot command that prints NDJSON and exits — no TTY needed, no ANSI codes, nothing
to scrape.

```bash
nplog --json --last-run                 # the most recent plugin invocation
nplog --since 10m --json                # the last 10 minutes
nplog --since 10m --json --min-level warn
```

**Exit code 1 if any emitted entry was an ERROR.** That alone answers "did it work?"
without reading a single line.

### Answering "what happened when I did X?"

An x-callback returns *immediately* while the plugin runs asynchronously, so reading
the log straight after firing one shows nothing. Bracket the action instead:

```bash
CURSOR=$(nplog --mark)
open "noteplan://x-callback-url/runPlugin?pluginID=jgclark.Dashboard&command=Show%20Dashboard"
nplog --since "$CURSOR" --follow --wait-idle 5 --json
```

You cannot know in advance how long a command takes — a Dashboard refresh ping-pongs
asynchronously between plugin and WebView for anything from two to thirty seconds. So
don't guess a duration:

- `--follow` streams entries as they arrive, so you see progress instead of waiting blind.
- `--wait-idle 5` stops once the log has been quiet for five seconds. A run still in
  flight writes *something* within five seconds, so silence that long means it finished.
- `--timeout` (default 90s) is the hard cap.

Drop `--follow` if you only want the final batch in one shot.

> **The log flushes in batches, so don't set a short timeout.** Measured on a live
> system: after an action the file sat untouched for **24 seconds**, then gained 80 lines
> at once. Historically the gap between an event and its flush has been as much as two
> hours. `--wait-idle` therefore never treats "quiet" as "finished" until it has actually
> seen output, and the summary reports `sawOutput` / `timedOut` so you can tell *"the
> action logged nothing"* from *"I looked too early"*.

### `--since` takes three shapes

| Form | Example | Meaning |
| --- | --- | --- |
| cursor | `"…962.log:11993599"` | byte-exact, from `--mark` |
| duration | `10m`, `30s`, `2h`, `10` | back from now (bare number = minutes) |
| wall clock | `19:36`, `19:36:56`, `"2026-07-29 19:36"` | local time; a future time means yesterday |

Durations and times filter on each entry's **own** timestamp — the real event time,
not the flush time (see [the two-timestamp trap](AGENTS.md)).

### Output

One JSON object per entry, then a summary:

```json
{"seq":0,"ts":"2026-07-29T09:14:59-07:00","level":"error","source":"plugin","run":"onMessageFromHTMLView","text":"…"}
{"summary":true,"file":"…","emitted":6,"entriesScanned":17,"droppedByMaxEntries":0,"cursor":"…","hasError":true}
```

- `level` — `debug` / `info` / `warn` / `error` / `null`
- `source` — `plugin` or `webview`
- `run` — which `Executing function` invocation this entry belongs to, so an error can
  be attributed to the call that caused it
- `text` — the entire entry; **a pretty-printed object arrives whole**, newlines and
  all. Width clipping is a display concern and does not apply here
- `cursor` — pass to the next `--since`
- `droppedByMaxEntries` — truncation is always reported, never silent

`--mode N` works here too, so you can pull a match plus the next N entries:

```bash
nplog --json --mode 10 '\[DIAG\]'      # the DIAG line and what happened after it
```

### Why a tool rather than `grep`

Three traps, each returning **empty** — which reads as "no errors" and is worse than
a crash:

| Naive attempt | What happens |
| --- | --- |
| `grep '^JSLog:'` | zero matches; the timestamp comes first |
| `grep '\| ERROR \|'` | zero matches; WARN/ERROR use emoji delimiters |
| filter on the leading timestamp | wrong on ~2/3 of lines, by up to hours |

### Why only the main log

There is a second, tempting source: `<Plugins>/<id>/_MCP-console.log`, which the NotePlan
MCP's `noteplan_plugins action:"log"` reads. It is already scoped to one plugin and
already has the `JSLog:` marker stripped. **nplog deliberately does not use it.**

Measured on a live system:

| | main log | `_MCP-console.log` |
| --- | --- | --- |
| retention | append-only, whole session | **truncated on every plugin invocation** |
| completeness (same second) | 66 unique lines | 32 — a subset, nothing it had was missing here |
| promptness | lags, flushes in batches | written immediately |

The truncation is disqualifying: Dashboard refreshes on a timer, so the run you care
about is wiped seconds later by an unrelated background refresh. Watching one file
through three invocations, it went 9 lines → 20,982 bytes → 5,314 bytes — it shrank.

The main log is a strict superset and the only durable record, so that is what nplog
reads. Its one weakness — the flush lag — is handled by `--wait-idle` refusing to call
an untouched file "finished".

Agents working in this repo get this as a skill — see
[`.claude/skills/nplog/SKILL.md`](../../.claude/skills/nplog/SKILL.md).

## Filtering is regex

The filter is a case-insensitive JavaScript regular expression, so:

| Pattern | Finds |
| --- | --- |
| `dashboard` | plain substring |
| `Section\|Perspective` | either word |
| `^\[WebView\]` | only WebView lines |
| `ERROR\|WARN` | problems only |
| `refresh.*Sections` | wildcards between terms |
| `:: \d+ items` | digits |

Anything that isn't valid regex is matched literally, so you can paste an arbitrary log
fragment (`sections [TB`) without escaping it.

## Where the logs come from

```
~/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application Support/co.noteplan.NotePlan3/Logs/
```

Files are named `co.noteplan.NotePlan3 <timestamp>.log`; beta builds may nest a second
`Logs/` directory inside that one, and both are searched. If you have override the location with the
`NPLOG_DIR` environment variable, e.g. if you use Setapp.

```bash
NPLOG_DIR=/some/other/Logs nplog
e.g.
NPLOG_DIR=~/Library/Containers/co.noteplan.NotePlan-setapp/Data/Library/Application nplog
```

### What gets shown by default

NotePlan tags plugin output with a `JSLog:` marker (basically all the plugin console contents)

```
2026-07-29 11:34:54 JSLog: [WebView Log] 2026-07-29 11:34:54 | DEBUG | Webview :: sendActionToPlugin
```

`nplog` keeps only those lines (plus the continuation lines of a multi-line object), drops
everything up to and including the marker, and abbreviates `[WebView Log]` to `[WebView]`.

**Use `--raw` to see NotePlan's own non-plugin logging too.**

> **Gotcha if you write your own filter:** don't anchor on `^JSLog:`. NotePlan added the
> leading `2026-07-29 11:34:54` timestamp at some point, and that anchor silently stopped
> matching — the original `noteplan_log_filtered.sh` emitted *nothing* for months rather than
> erroring. Strip the timestamp first, *then* anchor on `JSLog:`.

## Notes

- Runs on the terminal's alternate screen, so it never pollutes your real scrollback, and
  quitting leaves the terminal exactly as it was.
- Holds the most recent 50,000 **entries** in memory (`MAX_LINES` in the script) — a
  multi-line object counts as one. On startup it seeds from the last 2 MB of the current file
  so there's immediate history to search.
- Polls once a second for new bytes and for rotation.
- A block that never closes is capped at 500 continuation lines (`MAX_CONT_LINES`).

## Running it alongside your watchers

`nplog` is most useful in its own terminal tab, next to `npc plugin:dev` and your test watcher —
you edit, the plugin rebuilds, and you watch the log react.

If you drive your dev environment from a personal `.hyperlayout` file (gitignored, so yours is
your own), give it a dedicated tab rather than a narrow pane — the filter bar and context modes
want the width:

```json
"dashboard": [
  [ "npc plugin:dev jgclark.Dashboard -nc" ],
  [ "npm run test:watch" ],
  [ "nplog" ]
]
```
