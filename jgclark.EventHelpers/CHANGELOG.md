# What's changed in 🕓 Event Helpers?
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.EventHelpers), and how to configure.
## Future / Unreleased
- tighten timeblock-finding regex if Eduard does
- add further fields (e.g. location) if Eduard adds to the API

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
  -  `{{listTodaysEvents()}}` or
  -  `{{listMatchingEvents()}}`
### Fixed
- issue with running list today's events, due to change in configuration mechanism
- time block parse error (tip off by @nikolaus)

## [0.1.1] 2021-07-02
### Added
- first release, with `/timeblock` command, and configuration system
