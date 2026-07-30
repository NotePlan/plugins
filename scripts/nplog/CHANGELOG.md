# nplog changelog

All notable changes to `nplog` are documented here. Versions follow
[Semantic Versioning](https://semver.org/): MAJOR for breaking CLI/output changes, MINOR for
new features, PATCH for fixes. Check the current version with `nplog --version`.

## [1.0.0] - 2026-07-30

- First versioned release.
- Added a hard noise-exclusion filter: lines matching a pattern in `noise-exclusions.js` are
  dropped entirely, before they reach the buffer — not dimmed, not filterable back in. Ships
  with two patterns pre-populated: NotePlan's constant, harmless `Skipping plugin command
  'unknown': 'name' or 'jsFunction' missing in plugin.json` warning, and `Plugin update failed:
  Already installing other plugins.`
- Added `--version` / `-v`.
