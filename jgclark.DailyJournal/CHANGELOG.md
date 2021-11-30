# What's changed in ☀️ Daily Journal Plugin?

## [0.9.0] - 2021-11-25
### Added
- it is now possible to add `<subheading>`s in the review questions string
- you can also add bullet points

## [0.8.3] - 2021-10-11
### Changed
- recompiled to bring in knowledge of recently-added functions in other plugins

## [0.8.2] - 2021-09-07
### Fixed
- fixed an error in /todayStart that kept it from running if the note wasn't open

## [0.8.1] - 2021-08-31
### Changed
- under-the-hood changes responding to underlying framework changes

## [0.8.0] -@dwertheimer
- new: Brought back the original /dayStart as /todayStart ;) 

### [0.7.0..0.7.1], 2021-08-07
### Added
- now supports macOS back to v10.13
- the commands now work on whatever daily calendar note is open, not only on today's note

### [0.6.0..0.6.9] - 2021-07-30 
### Added
- additions to weather() template macro to add more fields and use string replacements (@dwertheimer)
- ability to check for `<number>` as well as `<int>` values in daily review questions

### Changed
- under-the-hood changes responding to underlying API and framework changes, and other plugins' changes
- more informative pop ups as it works
- on first use it now offers to populate default configuration (as shown above) into the _configuration file
- now `/dayStart` calls the Templates plugin to apply the `Daily Note Template` template. To include a weather forecast, now include the `{{weather()}}` tag in that template, and configure the OpenWeather calls as described in the `Templates/_configuration` file. 
- now `/dayReview` also uses the `Templates/_configuration` file to get settings for this command.

## [0.5.0] - 2021-05-27
### Changed
- use Template system (from '**NoteHelpers**' plugin) to provide the `Daily Note Template`. This template title defaults to 'Daily Note Template', but can be configured in `pref_templateText ` (as above).
- updated code to use newer NotePlan APIs

## [0.4.0] - 2021-04-24
- first main release
