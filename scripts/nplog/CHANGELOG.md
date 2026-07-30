# nplog changelog

All notable changes to `nplog` are documented here. Versions follow
[Semantic Versioning](https://semver.org/): MAJOR for breaking CLI/output changes, MINOR for
new features, PATCH for fixes. Check the current version with `nplog --version`.

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
