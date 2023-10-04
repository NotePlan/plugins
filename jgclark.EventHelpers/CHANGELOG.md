# What's changed in 🕓 Event Helpers?

See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.EventHelpers), and how to configure.


## [0.21.0] - 2023-09-29 @jgclark
### New
- "/shift dates" and "/process date offsets" now unhook sync'd lines (blockIDs) from others before changing them, to preserve the other copies
- "/shift dates" now deals with checklists as well as tasks, and cancelled items too.
- "/shift dates" can now remove any 'processed tag name' (as set in the "/time blocks to calendar" command) from tasks or checklists. This is controlled by new setting "Remove any 'processed tag name' on tasks or checklists?"
- new "/Events: update plugin settings" command to allow updating settings on iOS/iPadOS devices
### Changed
- "/time blocks to calendar" now more sensibly handles time blocks that contain a week reference (`>YYYY-Wnn`) as well as day references
- "/process date offsets" now will only offer to run "/time blocks to calendar" if there are any time blocks in the note

## [0.20.3] - 2023-06-12 @jgclark
### Changed
- added 'STOPMATCHING' as a possible placeholder for "/insert matching events". If present it will not process a given event further, so only the first match in the "Events match list" list will be used. (This does not stop remaining events in the day being matched.)

## [0.20.2] - 2023-02-13 @jgclark
### Added
- the date offset intervals (e.g. `{3d}` can now use upper-case letters B,D,W,M,Q,Y as well as the existing lower-case letters
- more helpful text in a dialog box

## [0.20.1] - 2022-12-30 @jgclark
### Added
- added support for time blocks in Checklists (available from NotePlan 3.8)

## [0.20.0] - 2022-12-08 @dwertheimer, @jgclark
### Added
- added 'MEETINGNOTE' link as a format option, which adds a button to create a meeting note to events in event listings. There's also a new setting 'Meeting Note Template title' which you can use to set which template to pick if you have several; if it isn't set then a list will be presented. (Note: this requires at least v1.1.2 of the separate Meeting Notes plugin.)

## [0.19.4] - 2022-12-04
### Added
- can now send `calendars` parameter to the commands via Templates. E.g. `calendars:"list,of,calendar,names"` (for @joepindell)

## [0.19.3] - 2022-11-30

### Changed

- "/insert events" commands now de-duplicates 'ATTENDEES' and 'ATTENDEENAMES' before writing to notes (for @CDP54321)
- "/process date offsets" command now ignores tasks which have been completed.

## [0.19.2] - 2022-10-21

### Added

- new setting "Include time blocks from completed tasks?" for the "/time blocks to calendar" command.

## [0.19.1] - 2022-10-05

### Added

- new setting "Set any completed tasks to not complete?" for the "/shift dates" command.

## [0.19.0] - 2022-09-27

### Added

- new setting "Remove @done dates?" for the "/shift dates" command.
- "/shift dates" command now also works for weekly dates (e.g. `2022-W34`), leaving the date written as a weekly date.

## [0.18.0] - 2022-08-31

### Added

- new `includeAllDayEvents` parameter for the `events()` and `matchingEvents()` template functions.

## [0.17.1] - 2022-08-31

### Changed

- the format of `*|DATE|*` can now be overridden with the 'Shared Settings > Locale' setting.

## [0.17.0] - 2022-08-10

### Added

- the **location** of an event is now available in the output of "/insert day's event as list" and "/insert matching events" commands. It's formatting code is `*|LOCATION|*`.

### Changed
- the 'Add event ID?' option for "/time blocks to calendar" command now inserts one of the nicely-formatted event links rather than the underlying eventID. The setting has been renamed 'Add event link?' to reflect this.

## [0.16.6] - 2022-07-22
### Changed
- updated to newer logging framework. No functional changes.

## [0.16.5] - 2022-06-17
### Fixed
- work around a bug in NP's 'Timeblock text must contain string' setting (tracked down with help by @StuW)
- code tidy up

## [0.16.4] - 2022-06-12
### Changed
- now uses NP's 'Timeblock text must contain string' setting (if set) when detecting whether a line has a valid Time block in it.
- improved user messaging when running '/shift dates'

## [0.16.3] - 2022-05-26
### New
- in /process date offsets, if a controlling date can't be found, then it will now ask the user for one instead

### Changed
- removed some whitespace stripping which was useful to me, but not to others.

## [0.16.2] - 2022-05-25
### Added

- `*|ATTENDEENAMES|*` placeholder, which gives either name or email address of event attendees, but no other details

### Fixed
- issue with `*|URL|*` placeholder

## [0.16.1] - 2022-05-20

### Fixed

- bug in calculation of offsets with 'b'usiness days

## [0.16.0] - 2022-05-13

### Added

- new **/shift dates** command that takes dates in the selected lines and shifts them forwards or backwards by a given date interval. (It doesn't change dates in `@done(...) mentions, or that are in brackets.)

## [0.15.1] - 2022-05-06

### Fixed

- typo in default configuration of '' setting
- restored 'template' parameter option

## [0.15.0] - 2022-05-03

### Added

- Added new 'Events List display format' and 'Events List display format for all-day events' settings to allow user to customise the event lists when run as /commands. This uses the same format as can already be passed as a parameter in the `events()` template functions.  Defaults are given.
- Added support for including the date of an event in the output for calendar events. You can include it in format strings as placeholder `*|DATE|*`.
- Added more flexibility in the formatting of event lists. So now instead of including (for example) `*|ATTENDEES|*` you can now include other text (including line breaks) within the placeholder, for example `*|\nwith ATTENDEES|*`. If the ATTENDEES is not empty, then it will output the list after a newline and the text 'with '.  Here is a fuller example to use in a Template.

```js
<%- events( {format:"### (*|CAL, |**|START|*) *|EVENTLINK|**|\nwith ATTENDEES|**|\nNOTES|**|\nURL|*", allday_format:"- (*|CAL|*) *|EVENTLINK|**|\nNOTES|**|\nURL|*", includeHeadings:true} ) %>
```

- In date offsets, added ability to specify offset dates that work relative to each subsequent line [requested by @george65]

### Changed

- Under-the-hood change to register its functions ready for NP 3.5.2. (Means minimum version that it will run with is v3.5.2.)

## [0.14.1] - 2022-04-26

### Changed

- Improved messaging if a Templating user tries to use this Plugin's functions, without the plugin being installed.
- Removed the version of /insert day's events that simply wrote to the Plugin Console for testing

### Fixed

- Fixed events() in a template returning events for the previous day (thanks @dwertheimer for PR)

## [0.14.0] - 2022-04-23

### Added

- Added support for including list of Attendees in output for calendar events. You can include it in format strings as `*|ATTENDEES|*`. This produces a comma-separated list of names or emails (where name isn't given).
- Added new `daysToCover` parameter that allows multiple days to be output for the `/insert day's events as list` and `/insert matching events` commands (request #251 by @StuW). For example: include `daysToCover: 3` to the parameter string to see events for the selected day, plus the following 2.
- Added new optional setting 'Matching Events heading', which sets the heading to put before list of matching events when using the `/insert matching events` command or `listMatchingEvents()` template call

## [0.13.0] - 2022-04-20

### Added

- Added a new 'Sort order' setting for event lists. It now defaults to 'time' ordering (by start time), unless the 'calendar' option is chosen (which then orders by calendar name then start time). (for @Bartmroz)
- Added support for 'Calendar Item Link' in calendar entries. If you add this Markdown link to a note, NotePlan will link the event with the note and show the note in the dropdown when you click on the note icon of the event in the sidebar.  You can include it in format strings as `*|EVENTLINK|*`.

### Fixed

- fix to older 'template' parameters which weren't being picked up OK.

## [0.12.0] - 2022-04-12

### Changed

- updated README to reflect the new Templating system's syntax (`<%- events(...) %>)` that replaces `{{events(...)}}`.
- to reduce potential confusion with the new Templating system, the parameters `template` and `allday_template` have been renamed to `format` and `allday_format`, and the README updated. (The previous parameters will still work for now.)
- improved settings display
- removed option of using the old `_configuration` note for settings: all now done through the built-in Settings UI
- moved to newer logging mechanism

### Fixed

- fixed empty output when calling `events()` through Templates, if the format didn't include `*|CAL|*`

## [0.11.5] - 2022-02-20

### Added

- new `defaultEventDuration` (in minutes) which is used if the time block doesn't have an end time, to create it. Otherwise the event will be 0 minutes long.

## [0.11.4] - 2022-02-07

### Fixed

- fix to allow `matchingEvent` calls to be run from Templates, after change to new built-in Settings screen

## [0.11.3] - 2022-02-05

### Changed

- now tell user if orphaned date offsets are found (i.e. without the date to offset from)
- when creating events from time blocks, now keep any '>date' portion in the task, but not in the event title

## [0.11.2] - 2022-02-04

### Changed

- now using new Configuration UI system instead of _configuration.

## [0.11.0] - 2022-01-30

### Changed

- uses NotePlan's native dialog prompts (available from v3.3.2)
- under-the-hood changes preparing for the next Configuration system
- tighten timeblock definition following NP's changes in v3.4 (now requires 'am' or 'pm' not just 'a' or 'p'.)

## [0.10.1] - 2022-01-08

### Changed

- `/timeblock` aligns with the newly-published detailed [guide to Timeblocking in NotePlan](https://help.noteplan.co/article/121-time-blocking). This mostly means time blocks are also detected in headings, list items, and done tasks.
- `/timeblock` detection now stops at the `## Done` or `## Cancelled` section of a note, if present.

## [0.10.0] - 2021-12-26 (@m1well)

### Changed

- in `/listDaysEvents` if user want to output calendar name, then the output now gets sorted by calendar name and start time

## [0.9.0] - 2021-12-17 (unreleased)

### Changed

- `/timeblock` now uses more advanced time block detection regex that now matches the time blocks NotePlan finds, rather than the ones the documentation said it detects

## [0.8.0] - 2021-12-01 (@m1well)

### Added

- added ability to map a calendar name to a given string (e.g. to shorten calendar name in output)

## [0.7.0] - 2021-11-19

### Added

- added `/process date offsets` command: find date offset patterns and turn them into due dates, based on date at start of section, or a less-indented line, or the line itself.

## [0.6.3] - 2021-11-11

### Fixed

- typo in default settings, that caused JSON5 errors (Spotted by @dwertheimer from reports by @aliembee, @temisphere)

## [0.6.2] - 2021-10-21

### Changed

- now shows a warning if no timeblocks could be found, rather than apparently just doing nothing

## [0.6.1] - 2021-10-05

### Fixed

- 'undefined' appearing when 'eventsHeading' empty

## [0.6.0] - 2021-09-18

### Added

- can now specify a subset of calendars of interest when listing today's events, or matching events. This is useful if you want to ignore certain calendars. To use this add the new `calendarSet` setting with an array of strings of the calendar names to include. (Requested by @brentonmallen1)

## [0.5.1] - 2021-09-14

### Changed

- now using smarter way of using parameters that means `includeHeadings:false` will work rather than `includeHeadings:"false"`, to be more in keeping with JSON (thanks, @dwertheimer)

## [0.5.0] - 2021.09-13

### Added

- can now set specific calendar to write time block entries to, using the new `calendarToWriteTo` setting. If it's not specified, or empty, then the system-wide default calendar will be used, as before.

## [0.4.1] - 2021-09-09

### Fixed

- missing backslash in default configuration

## [0.4.0] - 2021-08-27

### Changed

- when using `/time blocks to calendar` command with the `addEventID` setting set to true, the string is tweaked to read `⏰event:ID` rather than making it a pseudo-link. This makes it easier to style (and normally hide) the ID using theme customisation. See the README for an example of how to do this.

## [0.3.0..0.3.8] - 2021-08-23

### Added

- optional setting `confirmEventCreation` for `/time blocks to calendar` that if true asks user to confirm each event to be created
- identical events de-duping in /insert matching events
- ability to list events for whichever daily calendar page is open, not just Today
- shorter `{{events()}}` tag option as an alias of `{{listTodaysEvents()}}` and `{{matchingEvents()}}` as an alias of `{{listMatchingEvents()}}`

### Changed

- can include `*|NOTES|*` and `*|URL|*` in templates, as they're now available from the API.
- now compiled for macOS versions back to 10.13.0.
- the `locale` and `timeOptions` settings now apply to calls to get matching events as well.
- improved placement of the processedTagName (if used) after an event has been created

### Fixed

- time block not being detected at start of task (thanks, @stacey)
- remove time string from appearing in the event title in the calendar
- error in `includeHeadings` setting lookup

### v0.3.0, 4.8.2021 @dwertheimer

- Updated ::toLocaleShortTime() to deal with locales and timeStrings.
- Updated events config to use:
 `locale: "en-US",
  timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false }`
  For more details on the options here, please see [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat)
- Updated: the TITLE, START and END times are now shown in templates as `*|TITLE|*`, `*|START|*` and `*|END|*`, to allow for these words to be used in event titles
- Also added optional template for all-day events
`{{listTodaysEvents({template:"### START-END: *|TITLE|*",allday_template:"### *|TITLE|*"})}}`

## [0.2.0..0.2.7]]

### Added

- `/add matching events`: adds matching events to today's note
- `/insert today's events as list`: insert list of Today's calendar events at cursor
- adds ability to recognise time blocks of form `at 5-5:30pm` alongside the others
- adds ability to ignore misleading time-only time blocks in lines containing `@done(YYYY-MM-DD HH:MM)`
- ability to customise the addMatchingEvents lines with template strings, not just prepended string
- ability to pass a parameter to the `{{listTodaysEvents()}}` template command to customise how to present the list of today's events. See 'Using Event Lists from a Template' in the README.
- ability to add `[[event:ID]]` link when creating an event from a time block

### Changed

- refactor to allow to be called from Daily Note Template as either:
  - `{{listTodaysEvents()}}` or
  - `{{listMatchingEvents()}}`

### Fixed

- issue with running list today's events, due to change in configuration mechanism
- time block parse error (tip off by @nikolaus)

## [0.1.1] 2021-07-02

### Added

- first release, with `/timeblock` command, and configuration system
