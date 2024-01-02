# 🧹 Tidy Up Changelog
See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.Tidy/README.md) for full details on the available commands and use from callbacks and templates.

## [0.11.0] - 2024-01-02 @jgclark
- new **/List doubled notes** command that creates/updates a note that lists notes that potentially have doubled content (i.e. internal duplication).

## [0.10.0] - 2023-12-21 @dwertheimer
- modify topLevelTasks to include indented tasks
- fix bug in moving top level tasks

## [0.9.2] - 2023-12-15 @jgclark
- Updates the list of command aliases to suit changes in NotePlan 3.9.9.
- **/List conflicted notes** now includes the machine name in the note title it creates (available from NotePlan 3.9.9).

## [0.9.1] - 2023-09-15 @jgclark
- /List stubs now ignores its own output note when finding stubs.

## [0.9.0] - 2023-08-27 @jgclark
- new **/List stubs** command that creates/updates a note that lists all your notes that have note links (wikilinks) that lead nowhere.
- new optional setting "Folders to exclude for /List ... commands" that instructs the "/List stubs", "/List conflicted notes" and "/List duplicate notes" commands to ignore specific folders.

## [0.8.1] - 2023-08-26 @jgclark
- fixed bug that stopped **/File root-level notes** working for notes without a title

## [0.8.0] - 2023-07-18 @dwertheimer
- new command: Move top-level tasks in Editor to heading]
- fixed moving of files to proper folder name in Trash

## [0.7.0] - 2023-07-04 @dwertheimer
- new **/Remove >today tags from completed todos** command that removes the ">today" tag still attached to completed/cancelled tasks that means they keep showing up in Today's references every day forever. Does not touch open tasks.

## [0.6.0] - 2023-06-24 @jgclark
- new **/List conflicted notes** command that creates a new NP note that lists all your notes on your current device with file-level conflicts, along with summary details about them
- new **/Remove blank notes** command will delete any completely blank notes, or just with a starting '#' character
- improve display of duplicate notes that are empty
- improved/fixed display of progress dialogs

## [0.5.0] - 2023-06-12 @jgclark
- new **/List duplicate notes** command that creates a new NP note that lists all your notes with identical titles, along with summary details about those potential duplicates

## [0.4.0] - 2023-05-26 @jgclark
### New
- new **Remove triggers from recent calendar notes** command which removes one or more triggers from recent (but past) calendar notes. (This could be used as part of a daily or weekly Template.)
- new option "➡️ Ignore this note from now on" in the **File root-level notes** command, which populates the 'Root notes to ignore' setting for you. (For @dwertheimer.) Note: this only works from NP 3.9.2 build 1036 onwards.
- new **update plugin settings** command that can be run on iOS devices
- new setting "Run commands silently?". When running commands silently, they will run entirely in the background and not pop up dialogs to check or report success. Only turn this on when you're comfortable that the commands are doing what you expect. If you run in this mode, then details will be written to the Plugin Console at level 'INFO' instead.

## [0.3.0] - 2023-01-22 @jgclark
### New
- new **Tidy Up** command which runs as many of the the commands in this plugin as you wish, all in one go. (This could be used as part of a daily or weekly Template.)
- new **Remove orphaned blockIDs** command which removes blockIDs throughout your notes that no longer have sync'd copies. (Requested by @dwertheimer)

## [0.2.0] - 2023-01-19 (unreleased) @jgclark
### New
- new **File root-level notes** command which asks which folder you'd like each note at the root level moved to. (Thanks to ideas from @dwertheimer)

## [0.1.0] - 2023-01-04 (unreleased) @jgclark
First release, implementing these commands:
- **Remove section from recent notes** (alias "rsfrn"): Remove a given section (both the heading and its content) from recently-changed notes. (Can be used with parameters from Template or x-callback.)
- **Remove section from all notes** (alias "rcuh"). Remove a given section (both the heading and its content) from all notes. (Can be used with parameters from Template or x-callback.)
- **Remove time parts from @done() dates** (alias "rtp"): Remove time parts of @done(date time) from recently-updated notes. Can be used with parameters from Template or Callback.
- **Remove @done() markers** (alias "rdm"): Remove @done() markers from recently-updated notes.

Most can be used with parameters from a Template, or via an x-callback call.
