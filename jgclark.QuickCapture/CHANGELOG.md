# What's changed in ⚡️ Quick Capture
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.QuickCapture), and how to configure.

## [0.15.2] - 2023-12-07
### Fixed
- '/quick add task under heading' using wrong paragraph type when inserting at top of note (thanks to tip by @laestrella26)

## [0.15.1] - 2023-11-30
### Added
- new x-callback argument to set heading level (1-5) on commands "/quick add task under heading" and "/quick add line under heading"
### Fixed
- wrong display of number of '#' headings in the 'Choose Heading' dialog

## [0.15.0] - 2023-09-01
### Added
- new "/**quick add to this month's journal** and **/quick add to this year's journal** commands
### Improved
- speeded up the slower /quick... commands
### Fixed
- fixed bug using relative dates with x-callbacks (reported by @phenix)

## [0.14.1] - 2023-08-27
### Fixed
- /quick add line under heading: first note in list wouldn't work (thanks to report by @phenix)
- some relative dates not annotated in command bar lists
<!-- - re-hide a test command -->

## [0.14.0] - 2023-08-19
### Added
- _relative dates_ `today`, `yesterday`, `tomorrow`, `this week`, `last week`, `next week`, `this month`, `last month`, `next month`, `this quarter`, `last quarter`, `next quarter` are available when using x-callback-url mechanism to invoke the "/quick add to calendar note", "/quick prepend task to calendar note", "/quick add task under heading" and "/quick add line under heading" commands. Pass in in place of the 'note title' or 'note date' argument (suitably URL encoded, of course).
- the same commands, when run interactively from the command bar, now annotate these same dates, so you can find them more easily in the long list. The list remains sorted with most-recently updated first.
- the "quick add task to inbox" command can now take a second parameter for the note title (or even a relative date) when run from template or x-callback. See README for details.

## [0.13.0] - 2023-03-24
### Added
- command to edit settings, even on iOS
### Breaking Changes
- command '/quick prepend task to daily note' is renamed to '**/quick prepend task to calendar note**' as it now covers any period of calendar note. The previous alias 'qpd' still works. Note: this also changes the x-callback-url parameter accordingly.
- same for '/quick prepend task to daily note' which is renamed to '**/quick prepend task to calendar note**'.
- therefore command '**/quickly add to weekly note**' is removed.
### Changed
- 'append' commands now add before any archive section in the note, and 'prepend' commands now add after any frontmatter in the note.
### Known bug
- there's a known bug in commands that add text under a heading, if there's an earlier non-heading line with same text as the heading line. I'm waiting on a fix to the API. (Thanks to @Colin for the report.)

## [0.12.1] - 2022-08-21
### Added
- new **/quick add to journal this week** command, for those using weekly journals (for @john1)

## [0.12.0] - 2022-08-01
### Added
- greater flexibility when running these functions from x-callback calls. It's possible to send one or more empty arguments, and that will cause the missing argument(s) be requested from the user, as it it were run interactively. Note: this only works from NotePlan v3.6.1. (Requested by @John1)
- the matching of section headings in /qalh and /qath from x-callback calls is done as an exact match, or (from 0.12) just the first part of it. This means it's possible to have a section such as `## Journal for 3.4.22` that changes every day, but still refer to it by the unchanging string `Journal`.

## [0.11.0] - 2022-07-15
### Added
- the **/addToInboxNote** command can now send to the current Weekly as well as Daily or other fixed note. **Note: please review your settings**, as they have changed to accommodate this.

## [0.10.1..0.10.0] - 2022-06-27
### Added
- new command **/quick add to Weekly note** command
### Fixed
- issue with passing YYYY-MM-DD dates as part of an x-callback invocation

## [0.9.1..0.9.0] - 2022-05-12
### Added
- **/quick add task under heading** and **/quick add line under heading** now can add to existing daily (calendar) notes, not just regular notes. This also works for x-callback calls to these plugin commands.
- ability to use these commands from x-callback-url calls. For example, calling the following (e.g. from the  Shortcuts app, or even within NP itself) will do the equivalent of running the command `/quick add to journal today` and supplying with input 'something interesting': `noteplan://x-callback-url/runPlugin?pluginID=jgclark.QuickCapture&command=quick%20add%20to%20journal%20today&arg0=something%20interesting`

## [0.8.0..0.8.6] - 2022-04-18
### Changed
- code clean-up, removing references to old _configuration note, and moved to newer logging system
- now using new Configuration UI system instead of _configuration.
- Tweaks the `/int` command's prompt text to remind user the title of the designated Inbox note (or today's daily note). (Thanks to @dwertheimer for the suggestion.)
- changed back to using long command names
- (under the hood) updated settings ready for new settings UI

### Fixed
- Flow Error in the last part of `quickCapture.js
- For some date locales, /int and /qaj were adding to tomorrow's note, not today's (thanks to @colingold for the report)

## [0.7.0..0.7.2] - 2021-10-05
### Added
- this feature requested by @bcohen44: "with a new _configuration setting `textToAppendToTasks`, you can specify text (including hashtags or mentions) that will be appended to all new tasks created using the `/int` command." I've extended this to cover the other relevant commands provided by this plugin.

### Fixed
- finally tracked down configuration bug (thanks to tip from @dwertheimer)
- broke ability to write to daily note in trying to fix the configuration bug (thanks to tip from @bcohen44 and @elessar)

## [0.6.0] - 2021-08-29
### Added
- this feature requested by @duclearc: "I want to be able to call the global NotePlan shortcut, and from it (using /qath) add a task to it on the fly to a heading. And if that heading doesn't exist, the plugin should create it." It allows creation of the new header both at the top and bottom of the note.

## [0.5.0] - 2021-08-14
### Changed
- `/int` now only looks for `inboxTitle` in the _configuration settings note. If the setting is missing, or doesn't match a note, then the plugin will try to create it, from default settings if necessary. If the empty string (`inboxTitle: ""`) is given, then use the daily note instead
- some code refactoring

## [0.4.0..0.4.5] - 2021-07-09
### Added
- add `/qaj` command: Quickly add text to the Journal section of today's daily note

### Changed
- smarter prepending for `/qpt` command
- `/int`  now uses the `Templates/_configuration` file (described above) to get settings for this command, rather than have to change the plugin script file directly

### Fixed
- bug fix with empty configurations (thanks to @renehuber)

## [0.3.0..0.3.2] - 2021-05-16
### Added
- add `/qpt` command: quickly prepend task
- add `/qat` command: quickly append task
- add `inbox add task` command
- add `quickly add a task to note section` command
- add `quickly add a text line to note section` command

### Changed
- change name of plugin to QuickCapture [EM suggestion]
- change to using short command names [EM suggestions]
