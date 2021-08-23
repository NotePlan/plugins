# What's changed in 🕓 Event Helpers?
See [website README for more details](https://github.com/NotePlan/plugins/tree/main/jgclark.EventHelpers), and how to configure.

### v0.3.8, 23.8.2021
- fix: time block not being detected at start of task (thanks, @stacey)
- fix: remove time string from appearing in the event title in the calendar

### v0.3.7, 21.8.2021
- fix: error in `includeHeadings` setting lookup

### v0.3.6, 18.8.2021
- updated: can include `*|NOTES|*` and `*|URL|*` in templates, as they're now available from the API.

### v0.3.4, 15.8.2021
- updated: now compiled for macOS versions back to 10.13.0.
- updated: the `locale` and `timeOptions` settings now apply to calls to get matching events as well.

### v0.3.3, 10.8.2021
- new: new optional setting `confirmEventCreation` for `/time blocks to calendar` that if true asks user to confirm each event to be created
- updated: improved placement of the processedTagName (if used) after an event has been created

### v0.3.2, 7.8.2021
- new: identical events de-duping in /insert matching events

### v0.3.1, 6.8.2021
- new: ability to list events for whichever daily calendar page is open, not just Today
- new: shorter `{{events()}}` tag option as an alias of `{{listTodaysEvents()}}` and `{{matchingEvents()}}` as an alias of `{{listMatchingEvents()}}`

### v0.3.0, 4.8.2021 @dwertheimer
- Updated ::toLocaleShortTime() to deal with locales and timeStrings.
- Updated events config to use:
 `locale: "en-US",
  timeOptions: { hour: '2-digit', minute: '2-digit', hour12: false }`
  For more details on the options here, please see [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat)
- Updated: the TITLE, START and END times are now shown in templates as `*|TITLE|*`, `*|START|*` and `*|END|*`, to allow for these words to be used in event titles
- Also added optional template for all-day events
`{{listTodaysEvents({template:"### START-END: *|TITLE|*",allday_template:"### *|TITLE|*"})}}`

### v0.2.7, 3.8.2021
- adds ability to recognise time blocks of form `at 5-5:30pm` alongside the others
- adds ability to ignore misleading time-only time blocks in lines containing `@done(YYYY-MM-DD HH:MM)`

### v0.2.6 1.8.2021
- adds ability to customise the addMatchingEvents lines with template strings, not just prepended string
- fixed issue with running list today's events, due to change in configuration mechanism

### v0.2.4 30.07.2021 @dwertheimer
- (bump) Minor tweak to use template replacement from helperFunctions.js

### v0.2.3, 28.7.2021
- adds ability to pass a parameter to the `{{listTodaysEvents()}}` template command to customise how to present the list of today's events. See 'Using Event Lists from a Template' in the README.

### v0.2.2, 13.7.2021
- add: ability to add `[[event:ID]]` link when creating an event from a time block
- fix: time block parse error (tip off by @nikolaus)

### v0.2.1, 13.7.2021
- refactor to allow to be called from Daily Note Template as either:
  -  `{{listTodaysEvents()}}` or
  -  `{{listMatchingEvents()}}`

### v0.2.0, 12.7.2021
- add: `/add matching events`: adds matching events to today's note
- add: `/insert today's events as list`: insert list of Today's calendar events at cursor

### v0.1.1, 2.7.2021
- first release, with `/timeblock` command, and configuration system
