# nplog

A live, filterable viewer for [NotePlan](https://noteplan.co)'s plugin log output.

NotePlan writes every `console.log` from a plugin (and from plugin WebViews) into a rolling
log file inside its app container (in addition to NotePlan's own log). 

`nplog` is a terminal-based program that tails that file, strips it down to just the plugin
output, and puts a **regex filter box** on screen that you can retype at any moment without
restarting anything.

<img width="1490" height="816" alt="CleanShot 2026-07-29 at 14 57 49@2x" src="https://github.com/user-attachments/assets/c0467c4a-d94e-464d-8db7-24ac20491c92" />

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

## Usage

```bash
nplog                              # follow the newest log
nplog dashboard                    # start with a filter already applied
nplog 'Section|Perspective'        # regex alternation
nplog --mode 5                     # start in "match + next 5 lines" mode
nplog --no-time                    # start with timestamps hidden
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
