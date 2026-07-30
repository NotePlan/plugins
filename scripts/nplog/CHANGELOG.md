# nplog changelog

All notable changes to `nplog` are documented here. Versions follow
[Semantic Versioning](https://semver.org/): MAJOR for breaking CLI/output changes, MINOR for
new features, PATCH for fixes. Check the current version with `nplog --version`.

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
