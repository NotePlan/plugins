# 🧹 Tidy Up Changelog
See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.Tidy/README.md) for full details on the available commands and use from callbacks and templates.

## [0.4.0] - 2023-05-26
### New
- new **Remove triggers from recent calendar notes** command which removes one or more triggers from recent (but past) calendar notes. (This could be used as part of a daily or weekly Template.)
- new option "➡️ Ignore this note from now on" in the **File root-level notes** command, which populates the 'Root notes to ignore' setting for you. (For @dwertheimer.) Note: this only works from NP 3.9.2 build 1036 onwards.
- new **update plugin settings** command that can be run on iOS devices
- new setting "Run commands silently?". When running commands silently, they will run entirely in the background and not pop up dialogs to check or report success. Only turn this on when you're comfortable that the commands are doing what you expect. If you run in this mode, then details will be written to the Plugin Console at level 'INFO' instead.

## [0.3.0] - 2023-01-22
### New
- new **Tidy Up** command which runs as many of the the commands in this plugin as you wish, all in one go. (This could be used as part of a daily or weekly Template.)
- new **Remove orphaned blockIDs** command which removes blockIDs throughout your notes that no longer have sync'd copies. (Requested by @dwertheimer)

## [0.2.0] - 2023-01-19 (unreleased)
### New
- new **File root-level notes** command which asks which folder you'd like each note at the root level moved to. (Thanks to ideas from @dwertheimer)

## [0.1.0] - 2023-01-04 (unreleased)
First release, implementing these commands:
- **Remove section from recent notes** (alias "rsfrn"): Remove a given section (both the heading and its content) from recently-changed notes. (Can be used with parameters from Template or x-callback.)
- **Remove section from all notes** (alias "rcuh"). Remove a given section (both the heading and its content) from all notes. (Can be used with parameters from Template or x-callback.)
- **Remove time parts from @done() dates** (alias "rtp"): Remove time parts of @done(date time) from recently-updated notes. Can be used with parameters from Template or Callback.
- **Remove @done() markers** (alias "rdm"): Remove @done() markers from recently-updated notes.

Most can be used with parameters from a Template, or via an x-callback call.
