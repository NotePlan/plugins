# What's changed in ⚡️ Quick Capture
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.QuickCapture), and how to configure.
## [0.9.1] - 2022-05-12
### Added
- **quick add task under heading** and **quick add line under heading** now can add to existing daily (calendar) notes, not just regular notes. This also works for x-callback calls to these plugin commands.

## [0.9.0] - 2022-05-06
### Added
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
