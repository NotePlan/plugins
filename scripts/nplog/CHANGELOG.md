# nplog changelog

All notable changes to `nplog` are documented here. Versions follow
[Semantic Versioning](https://semver.org/): MAJOR for breaking CLI/output changes, MINOR for
new features, PATCH for fixes. Check the current version with `nplog --version`.

## [1.1.2] - 2026-07-30

- nplog's own stream-boundary notices — the `--plugin` reset marker and the main-log
  `switching to <newer file>` marker — now render as **separator rules** (dimmed, dashes either
  side, same `SEP_LABEL_INDENT` lead as an idle/run rule) instead of as plain log text. They're
  boundaries in the stream, so they now look like one.
- Documented a structural limitation of `--plugin` mode: **named-run separators
  (`Executing function 'X'`) never appear there.** That line is NotePlan's own notice that it
  invoked a plugin entry point, not plugin `console.log` output, so it only exists in the main
  log (measured: 33 vs 0 over the same window). `--plugin` still gets idle-lull rules.

## [1.1.1] - 2026-07-30

- **Fixed `^L` (clear display) corrupting every timestamp afterwards.** It cleared the `lines`
  buffer but not the index-parallel `stamps` array, so from then on entry *N*'s text was paired
  with a stale pre-clear timestamp. The visible symptom was an idle separator appearing in the
  middle of a contiguous burst of output, labelled with a clock minutes off from the lines
  around it (e.g. `───── 2026-07-30 15:50:30  54s idle ─────` sitting between lines all stamped
  `16:44:27`). Both arrays are now always cleared together.

## [1.1.0] - 2026-07-30

- **Added `--plugin ID`**, tailing one plugin's `_MCP-console.log` instead of the main log.
  Same interactive viewer, filters, context modes, and `--json` headless mode -- just a
  lower-latency, single-plugin-scoped source. `_MCP-console.log` has no outer flush-timestamp or
  `JSLog:` marker to strip (it's already the same "payload" shape `entryPayload()` produces from
  the main log), so it's parsed with a dedicated `consumePluginLine()` rather than reusing
  `consumeLine()`'s marker-stripping.
- NotePlan truncates and rewrites `_MCP-console.log` in place on every plugin invocation.
  `nplog` now **keeps streaming through resets** rather than needing a restart, and shows a
  visible `--- ... was reset by NotePlan (new run) ---` marker in the buffer when it happens.
- Fixed a real bug this surfaced: **`size < position` is not a reliable truncation signal.**
  Confirmed an in-place rewrite doesn't change the file's inode, and if new content regrows to
  match or exceed the old read position before the next poll, a size-only check misses the
  truncation entirely -- `nplog` would then silently read from the stale position into
  unrelated new content and display a plausible-looking but WRONG line, indistinguishable from a
  genuinely torn line in the source file. Fixed with a content fingerprint: the last 64 bytes
  ending at the read position are now re-verified against disk on every poll regardless of size.
- Warns (rather than erroring) when the target `_MCP-console.log` is missing or empty -- likely
  means the plugin hasn't logged anything yet this session, or its MCP integration has never
  been used -- and keeps watching for it to appear.
- **`--plugin` needs to know where NotePlan's container lives**, which differs between the App
  Store and Setapp builds (different bundle IDs). `install.sh` now detects which one you have
  and, if it can't tell (or you have both), asks once and writes the answer to
  `~/.config/nplog/config.json`. `NPLOG_APP_SUPPORT_DIR` overrides it; auto-detection is the
  fallback if neither is set.

## [1.0.3] - 2026-07-30

- Clarified `^U` vs `^L`, which read as near-synonyms ("clear" vs "wipe") and were easy to
  confuse. The filter box in the status bar now always reads `filter (^U to clear): foo`,
  filter typed or not, so the hint doesn't need repeating in the bottom help line — which now
  just names `^L clear display` on its own. No behavior changed — both commands already did
  what they say.

## [1.0.2] - 2026-07-30

- Idle/run separator rules now carry a local `YYYY-MM-DD HH:MM:SS` clock at the start of their
  label (e.g. `───── 2026-07-30 09:00:10  10s idle  Executing function 'x' ─────`).
- **Timestamps are now hidden by default** (`^T`, or `--show-time`/`--time`, to show them;
  `--no-time`/`--no-timestamps` still accepted, now a no-op). With the clock moved onto the
  separators, hiding the repeated per-line timestamp no longer loses your sense of where you
  are in the log time-wise -- the separators give a bird's-eye view of the clock as you scroll.

## [1.0.1] - 2026-07-30

- Lowered the file-poll interval from 1s to 250ms (`POLL_MS` in `nplog`) so nplog adds less of
  its own latency once NotePlan actually flushes bytes to the log file. Note this does not
  touch the dominant source of perceived lag: NotePlan batches its own writes to the log file
  (documented in the README as up to tens of seconds, historically up to two hours), so a tool
  like Console.app watching NotePlan's live system log will still appear well ahead of anything
  reading the file, nplog included.

## [1.0.0] - 2026-07-30

- First versioned release.
- Added a hard noise-exclusion filter: lines matching a pattern in `noise-exclusions.js` are
  dropped entirely, before they reach the buffer — not dimmed, not filterable back in. Ships
  with two patterns pre-populated: NotePlan's constant, harmless `Skipping plugin command
  'unknown': 'name' or 'jsFunction' missing in plugin.json` warning, and `Plugin update failed:
  Already installing other plugins.`
- Added `--version` / `-v`.
