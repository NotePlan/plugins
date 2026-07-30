# nplog — maintainer notes

Read this before changing how `nplog` renders, or before producing a screenshot for the README.

## Reproducing the README screenshot

`sample.log` in this directory is a committed fixture built to exercise **every** display
feature at once. Always screenshot from it rather than from your live NotePlan log — a real log
gives a different picture every run, so you can't tell a rendering regression from a data
change.

```bash
# from the repo root
nplog --file scripts/nplog/sample.log
```

`--file` pins that one log and disables rotation-following, so the view is stable.

### The recipe

1. **Open a fresh terminal window.** Don't reuse one with scrollback in it.
2. **Don't run `clear` first.** iTerm intercepts the clear-scrollback escape with an
   "A control sequence attempted to clear scrollback history" banner that lands on top of your
   screenshot. A new window is already clean.
3. **Size the window so the content exactly fills it.** `sample.log` renders as **29 rows** plus
   2 status rows, so ~32 rows is right. Too tall leaves a dead band of empty background under
   the log; too short and the first rule scrolls off the top (the view follows the tail). On a
   Retina Mac these bounds give 32 rows × 167 cols:

   ```bash
   osascript -e 'tell application "iTerm2" to set bounds of window id <ID> to {120, 120, 1300, 585}'
   ```

4. **Crop to the window**, don't capture the whole desktop:

   ```bash
   screencapture -x -o -R120,120,1180,465 ~/Downloads/nplog-screenshot.png
   ```

   `-R` takes `x,y,width,height` in screen points and matches the bounds above. `-x` suppresses
   the shutter sound; `-o` omits the window shadow.

   Write to `~/Downloads`, not `~/Desktop`. A cloud-sync client (Dropbox, iCloud Desktop &
   Documents) may be managing `~/Desktop`, in which case a file written there can be relocated
   out from under you — the write reports success and the file still isn't where you left it.
   After capturing, confirm the file really exists before relying on it.

5. **Check the status bar reads `17/17 (29 rows)`.** If the entry count differs, the ingest
   logic changed — investigate before publishing the image.

6. **Confirm iTerm actually brought your window to the front** before capturing, or you will
   screenshot whatever was on top instead. `select` alone is not enough:

   ```bash
   osascript -e 'tell application "iTerm2" to activate'
   test "$(osascript -e 'tell application "iTerm2" to return id of current window')" = "<ID>"
   ```

Screenshots are **not** committed to the repo. Upload the PNG to the GitHub README via the web
editor, which rehosts it under `user-attachments`; the README's `<img>` tag points there.

## What `sample.log` deliberately covers

Keep all of these when editing it, or the screenshot stops proving anything:

| Feature | How it appears |
| --- | --- |
| dimmed timestamps | every line |
| dimmed routine levels | `\| DEBUG \|`, `\| INFO  \|` |
| **orange** WARN | `🥺 WARN 🥺` — two of them |
| **red** ERROR | `❗️ ERROR ❗️` — two of them |
| dimmed source tag | `[WebView Log]` → rendered `[WebView]` |
| **red** error source tag | `[WebView Error ❗️]` → rendered `[WebView Error]` |
| multi-line object | the `=> Reminder:` block, with a nested object *and* a nested array so depth-aware indentation is visible |
| native non-JSLog lines | `[PluginRefresh] start`, `initFunc result:` — hidden by default, and the reason `--raw` shows more |
| filterable text | `refreshSomeSections` appears on several lines; good for demoing highlight + the `┈┈┈` gap rule |
| run separator | two `Executing function 'onMessageFromHTMLView'` lines, which become the rules themselves |
| idle separator | a deliberate 47-second gap (`09:14:10` → `09:14:57`) so the lull rule appears, merged with the run rule |
| outer vs inner timestamps | every line's outer flush stamp is `09:15:02`, deliberately unlike the inner ones — a fixture where they matched would hide the bug below |

To show the filter/highlight instead of the default view, type into the running instance rather
than passing an argument — e.g. `refreshSomeSections` — then screenshot.

## Severity markers are emoji, not pipes

The single easiest thing to get wrong. `LOG_LEVEL_STRINGS` in
[`helpers/dev.js`](../../helpers/dev.js) is the source of truth:

```js
['| DEBUG |', '| INFO  |', '🥺 WARN 🥺', '❗️ ERROR ❗️', 'none']
```

DEBUG and INFO are pipe-delimited and space-padded to equal width. **WARN and ERROR are
delimited by emoji.** A pipe-only regex silently matches zero real WARN/ERROR lines — it looks
like the feature works, because DEBUG/INFO still style correctly.

Two traps in the patterns (`WARN_LEVEL_RE` / `ERROR_LEVEL_RE`):

- `❗️` is **two** code points: U+2757 plus a U+FE0F variation selector. Written as a literal,
  `❗️?` looks like an optional `❗` but the `?` actually applies to the invisible selector. The
  code uses explicit `❗️?` escapes so this can't be misread.
- At least one delimiter must be **required**, or a bare "ERROR" inside an ordinary message gets
  coloured. One real line had only a trailing `🥺`, so each side is optional *provided the other
  is present*.

Validate any change to these against every log you have, checking both coverage and
over-matching:

```bash
ls ~/Library/Containers/co.noteplan.NotePlan3/Data/Library/Application\ Support/co.noteplan.NotePlan3/Logs/
```

Last verified: 1210/1210 WARN and 1336/1336 ERROR lines styled, with no false positives on
prose like `"handling WARN cases"` or `"errorCount = 3"`.

## Every line carries TWO timestamps

The other easiest thing to get wrong, and it produced a whole class of nonsense output.

```
2026-07-29 15:51:09 JSLog: 2026-07-29 15:49:21 | DEBUG | routeRequestsFromReact ...
└─ outer: when NotePlan flushed ─┘ └─ inner: when the plugin logged ─┘
```

Output is written in batches, so the two disagree on roughly **two thirds** of real lines, by as
much as a couple of **hours**. The inner one is the real event time and the one displayed on
screen, so all timing arithmetic must use it (`payloadStamp()`, not the raw line prefix). Deriving
idle gaps from the outer stamp produced lulls that never happened and rules labelled with a time
*later* than the lines beneath them.

Two consequences to preserve:

- Lines like `Executing function 'x'` carry **no** inner timestamp. They inherit the previous
  entry's, so they don't invent a gap — which also means a measured lull lands on the line
  *after* the run marker, not on it. That is why the lull/run merge searches both directions.
- A fixture whose outer and inner stamps agree cannot catch a regression here. `sample.log`
  deliberately uses a single late flush stamp for every line.

## Only a line that *opens* a structure may start a block

A multi-line entry begins when a line ends with `{` or `[`. Unbalanced depth alone is
far too loose — NotePlan's own native logging contains prose like

```
[IAPHandler Received a purchase update
```

whose stray `[` made the parser swallow the next several hundred lines into one 40 KB
entry, which then got classified as an ERROR because the word appeared somewhere inside
it. `opensStructure()` is the guard; don't relax it.

## Two log files -- only one is ground truth

| | `Logs/co.noteplan.NotePlan3 <ts>.log` | `Plugins/<id>/_MCP-console.log` |
| --- | --- | --- |
| scope | everything, every plugin | one plugin |
| prefix | `<timestamp> JSLog:` on every line | marker already stripped |
| retention | append-only for the whole session | **truncated on every plugin invocation** |
| promptness | lags; flushes in batches | written immediately |

The second is what the NotePlan MCP's `noteplan_plugins action:"log"` reads, and it is
**deliberately not used here**. Measured on a live system for the same second: 32 unique
lines there vs 66 in the main log, with nothing present there and missing here. Watching
one file across three Dashboard invocations it went 9 lines → 20,982 bytes → 5,314 bytes
— it *shrank*, because each invocation truncates it. Since the Dashboard refreshes on a
timer, an unrelated background refresh wipes the run you were investigating within
seconds. The main log is a strict superset and the only durable record.

If you ever do want to parse that file, note its lines carry **no** `JSLog:` marker, so
`entryPayload()` returns null for every one of them and you keep only the object bodies
(measured: 1424 lines collapsed to 69 entries, every plain line silently dropped). That
is what `markerOptional` exists for; `--raw` needs it too, and additionally used to
return before the block-opening check so it could not group objects at all.

## The main log flushes in BATCHES -- never treat quiet as finished

The main log's one weakness. Measured live: after firing an x-callback the file sat
untouched for **24 seconds**, then gained 80 lines in one write. The outer-vs-inner
timestamp gap has historically reached **two hours**.

This makes a naive settle loop actively harmful: a quiet-timer started right after an
action fires immediately, emits zero entries, and the caller concludes the action logged
nothing. `--wait-idle` therefore tracks "has anything arrived at all" separately from
"has it gone quiet", refuses to finish until it has seen output, and reports `sawOutput` /
`timedOut` in the summary so a missed read is distinguishable from a silent run.

Corollaries: the default `--timeout` is 90s, not 30s; and `--follow` exists because no
fixed wait can be right when a Dashboard refresh ping-pongs asynchronously for anything
from 2 to 30 seconds.

## Other things worth knowing before you change rendering

- **Styling happens in one pass.** `styleLine()` paints a per-character style array and then
  emits runs. Applying dim and highlight as separate nested escape sequences does not work —
  the inner reset cancels the outer style for the rest of the line. Match beats colour beats dim.
- **`[22m` vs `[0m`.** Dim spans close with `[22m` (intensity only, preserving colour); coloured
  spans need `[0m` to clear colour too.
- **Object bodies are never styled as chrome.** Continuation rows are data — a value like
  `"created": "2026-07-29 10:00:00"` must not be dimmed as if it were a log timestamp.
- **Every row is written with absolute cursor positioning** (`ESC[row;1H`) and an erase-line.
  That makes the display self-correcting: an over-long line clipped by the terminal can't
  corrupt later rows or the status bar. Truncation uses `slice(0, cols)`, which counts UTF-16
  code units rather than display columns, so a line of emoji can come up a little short of the
  margin — harmless, and deliberately not "fixed" with a width table.
- **Headless mode must never touch the alternate screen.** `--json`/`--mark` branch out
  of `main()` before the TTY check, because they are meant to be piped. If you add
  interactive setup to `main()`, put it after that branch.
- **`sleep()` uses `Atomics.wait`, not a spin loop.** The settle loop in `--wait-idle` is
  synchronous by design, but polling `Date.now()` pegged a core — which matters for a
  command an agent may call repeatedly.
- **Reading the screen back over AppleScript is unreliable while output streams.**
  `contents of current session` can return a half-drawn frame, which looks like a rendering bug
  (a status bar reading `DEBU` instead of `DEBUG`). Verify against a static log with `--file`, or
  take a screenshot, before believing it.
- **`noise-exclusions.js` drops lines entirely, before they reach the buffer.** This is not the
  same thing as the dimmed chrome in `styleLine()` (timestamp/severity/source tag, still visible,
  still filterable) — an excluded line is gone from both the interactive view and `--json`,
  unrecoverable by any filter, and doesn't count toward `entriesScanned`. Only add a pattern here
  for noise that has zero signal on every viewing (a benign warning NotePlan logs constantly); if
  you'd ever want to see it with a broader filter, it belongs in `NOISE_SPANS` (dimmed) instead,
  not here.
- **Timestamps are hidden by default (`showTime: false`); separators carry the clock instead.**
  `separatorClock()` in `separatorForRange()` reads `stamps[to]` — `to` being the entry the
  boundary is entering — and relies on `payloadStamp()` always resolving to a real number (it
  backfills from `lastStampMs` when a line has no timestamp of its own, e.g. `Executing
  function` lines), so it's effectively never NaN in practice. If you ever change `payloadStamp`
  to allow NaN through, `separatorClock` already no-ops on non-finite input, but the separator
  would then silently lose its clock — worth a deliberate decision, not an accident.

## Diagnostic utilities (`utils/`)

- **`utils/log-timing.js`** — standalone, not part of nplog's own runtime. Tails one log file
  and reports wall-clock-now minus each complete line's own timestamp (single-file mode), or
  races two files against each other by matching identical payload text FIFO-per-payload
  (`--compare-file`, labeled **Full-Log** for `--file` — the main JSLog file — vs. **MCP-Log** for
  `--compare-file`, one plugin's `_MCP-console.log`) to report which arrives first and by how
  much, plus one-sided "gap" lines that never showed up on the other side within
  `--gap-timeout-ms` (default 2 minutes — Full-Log flush lag has been observed past a minute in
  practice and documented historically up to two hours, so anything shorter mislabels merely-slow
  lines as missing). `_MCP-console.log` truncates on every plugin invocation rather than
  appending, so its `Tailer` treats `size < position` as truncation-and-restart, not an error —
  worth knowing if you extend this to another file that behaves the same way; it also tolerates
  the compare file not existing yet (e.g. a plugin that hasn't logged anything this session). Press
  `c` while it's running to reset all accumulated stats/pending state without restarting the
  process, so a comparison window can be scoped to exactly one triggered action.
