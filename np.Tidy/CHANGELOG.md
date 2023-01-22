# 🧹 Tidy Changelog
See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.Tidy/README.md) for full details on available commands and use from callbacks and templates.

## [0.3.0-beta] - 2023-01-20
### New
- new **/Remove orphaned blockIDs** command which removes blockIDs throughout your notes that no longer have sync'd copies. (Requested by @dwertheimer)

## [0.2.0] - 2023-01-19 (unreleased)
### New
- new **/File root-level notes** command which asks which folder you'd like each note at the root level moved to. (Thanks to ideas from @dwertheimer)

## [0.1.0] - 2023-01-04 (unreleased)
First release, implementing these commands:
- **/Remove section from recent notes** (alias "rsfrn"): Remove a given section (heading + its content block) from recently-changed notes. Can be used with parameters from Template or x-callback.
- **/Remove time parts from @done() dates** (alias "rtp"): Remove time parts of @done(date time) from recently-updated notes. Can be used with parameters from Template or Callback.
- **/Remove @done() markers** (alias "rdm"): Remove @done() markers from recently-updated notes. 
- TODO: **/Remove content under heading in all notes** (alias "rcuh"). (original function by @dwertheimer)

All can be used with parameters from a Template, or via an x-callback call.
