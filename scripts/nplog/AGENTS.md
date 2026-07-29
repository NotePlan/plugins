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
3. **Size the window so the content exactly fills it.** `sample.log` renders as **27 rows** plus
   2 status rows, so ~30–31 rows is right. Too tall leaves a dead band of empty background
   under the log; too short truncates. On a Retina Mac these bounds give 31 rows × 158 cols:

   ```bash
   osascript -e 'tell application "iTerm2" to set bounds of window id <ID> to {120, 120, 1240, 560}'
   ```

4. **Crop to the window**, don't capture the whole desktop:

   ```bash
   screencapture -x -o -R120,120,1120,440 ~/Desktop/nplog-screenshot.png
   ```

   `-R` takes `x,y,width,height` in screen points and matches the bounds above. `-x` suppresses
   the shutter sound; `-o` omits the window shadow.

5. **Check the status bar reads `15/15 (27 rows)`.** If the entry count differs, the ingest
   logic changed — investigate before publishing the image.

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
- **Reading the screen back over AppleScript is unreliable while output streams.**
  `contents of current session` can return a half-drawn frame, which looks like a rendering bug
  (a status bar reading `DEBU` instead of `DEBUG`). Verify against a static log with `--file`, or
  take a screenshot, before believing it.
