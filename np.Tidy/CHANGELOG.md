# 🧹 Tidy Up Changelog
See Plugin [README](https://github.com/NotePlan/plugins/blob/main/np.Tidy/README.md) for full details on the available commands and use from callbacks and templates.

## [1.0.0] - 2025-09-23??? @jgclark
- New command **/Remove empty blocks** which in the open note removes empty list items, quotations and headings, and reduces multiple empty lines to a single empty line.
- new setting 'Ignore future calendar notes?' for '/Remove section from all notes' command
- rather arbitrarily promoting this to v1.0 after 2.5 years :-)
<!-- Perhaps improvement to Remove Section from all notes ? -->

## [0.14.11] - 2025-09-09 @jgclark
- improvements to '/List stubs' command, including better display of Teamspace notes

## [0.14.10] - 2025-09-03 @jgclark
- fix regression in '/Generate @repeats from recent notes' command.

## [0.14.9] - 2025-08-30 @jgclark
- rebuild to use updated code from Repeat Extensions plugin in **/Generate @repeats in recent notes** command
- update **/Remove blank notes** to gracefully handle Teamspace notes, which can't be removed (at this time).

## [0.14.8] - 2025-06-24 @jgclark
- updated **/Remove section from all notes** command to show how many sections it will remove, and also to use the 'Type of match for section headings' (`Exact`, `Starts with`, or `Contains`) and 'Folders to exclude' settings
- code refactoring

## [0.14.7] - 2025-02-18 @jgclark
- Stop lots of popups appearing when running **/Generate @repeats in recent notes** command (thanks, @kanera).
- The **/List stubs** command now understands line links (and so ignores the part of the link after the `^` character) (thanks, @ChrisMetcalf).
- Improved descriptions of some settings.

## [0.14.6] - 2025-02-16 @dwertheimer
- Minor fix to calling **/Move top-level tasks to heading** from a template

## [0.14.5] - 2025-02-15 @dwertheimer
- tweak **/Move top-level tasks to heading** to be able to be run from an xcallback

## [0.14.4] - 2024-12-18 @jgclark
- fix to allow blank Calendar notes to be removed by '/remove blank notes'.

## [0.14.3] - 2024-11-17 @jgclark
- Stop lots of popups appearing when running **/Generate @repeats in recent notes** command.

## [0.14.2] - 2024-09-25 @jgclark
- **/file root notes** command can now create a new folder as one of the possible options (for @dwertheimer)

## [0.14.1] - 2024-06-14 @jgclark
- Re-build following updates to Repeat Extensions, which this uses.

## [0.14.0] - 2024-06-07 @jgclark
- New **/Generate @repeats in recent notes** command generates any needed new @repeat() lines in all recently-changed notes. This is great for people using the extended @repeat() syntax of the separate [Repeat Extensions plugin](https://github.com/NotePlan/plugins/blob/main/jgclark.RepeatExtensions/README.md), who don't need to use triggers on notes, if they can run this instead every day or two.

## [0.13.0] - 2024-06-01 @jgclark
- **/List conflicted notes** offers side-by-side viewing of conflicted note versions (for regular notes) on macOS and iPadOS
- **/List conflicted notes** now clears out all copies of conflicted notes (and subfolders) from earlier runs of the command
- bug fixes when 'How many days count as recent?' setting is left blank

## [0.12.1] - 2024-04-09 @jgclark
- **/List conflicted notes** now covers Calendar notes as well (thanks, @dwertheimer)

## [0.12.0] - 2024-04-06 @jgclark
- **/List conflicted notes** can now write copy of the prior conflicted version of notes to special '@Conflicted Copies' folder, if new setting 'Save a copy of previous version as a separate note?' is turned on.

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
- **Remove section from all notes** (alias "rsan"). Remove a given section (both the heading and its content) from all notes. (Can be used with parameters from Template or x-callback.)  _Dangerous!_
- **Remove time parts from @done() dates** (alias "rtp"): Remove time parts of @done(date time) from recently-updated notes. Can be used with parameters from Template or Callback.
- **Remove @done() markers** (alias "rdm"): Remove @done() markers from recently-updated notes.

Most can be used with parameters from a Template, or via an x-callback call.
